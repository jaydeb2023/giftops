import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { LIBRARY_AGENT_IDS, LIBRARY_AGENT_SLUGS } from '@/lib/libraryAgentIds'
import { resolveEffectiveAccess, canAccessAgent } from '@/lib/teamAccess'
import { normalizeDigits, normalizeMessage } from '@/lib/bnNormalize'
import { parseAddStockIntent, matchProduct, convertQty, DOKAN_UNITS, buildProductMatchNote, buildCustomerMatchNote } from '@/lib/localIntent'
import { getCallerId, logAiActivity } from '@/lib/chatAuth'
import { parseMultiStock, detectIntent, toBulkItem, numbersPresent, type Vertical } from '@/lib/stockParser'
import { resolveProduct, MATCH_MIN } from '@/lib/productDictionary'
import { stripImageContext, IMAGE_CTX_MARK } from '@/lib/chatVocab'
import { effectiveScope, classAllowed, stripForbiddenTags, scopeDenied, deniedMessage, type Scope } from '@/lib/chatPolicy'
/**
 * Server-side Supabase client using the service role key.
 *
 * IMPORTANT: this must NOT silently fall back to the anon key. The anon key
 * has no auth.uid() on the server, so every RLS policy of the form
 * "auth.uid() = user_id" rejects inserts/updates from it — with no thrown
 * error, since the request itself succeeds, it just matches zero rows.
 * That silent failure is why stock/customer/sale writes could disappear
 * with no error in the logs. Fail loudly instead, so a missing env var on
 * Vercel is caught immediately instead of shipping broken writes.
 */
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not set — refusing to fall back to the anon key, which would silently fail RLS-protected writes.')
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey)
}

const DOKAN_AGENT_ID = LIBRARY_AGENT_IDS.dokan

const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
]

async function callGroq(model: string, system: string, messages: any[]) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  })
  if (!res.ok) throw new Error(`Groq ${model}: ${res.status}`)
  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response')
  return content
}

async function tryGroq(system: string, messages: any[]) {
  for (const model of GROQ_MODELS) {
    try { return await callGroq(model, system, messages) } catch { continue }
  }
  throw new Error('All models failed')
}

function today() { return new Date().toISOString().slice(0, 10) }


// ── Fallback-only product name extraction ──────────────────────────
// Used solely by the regex fallback path (the AI tag parser is tried first
// and does this correctly on its own). Instead of naively cutting the
// message at its first digit — which grabs the whole leading phrase like
// "stock a add koro onion" instead of just "onion" — this strips every
// recognized filler/command word, unit, currency word and number out of
// the message and returns whatever meaningful word(s) are left over.
const STOCK_NAME_STOPWORDS = new Set([
  'add', 'koro', 'kore', 'kori', 'korte', 'a', 'e', 'the', 'to', 'in', 'of', 'at', 'for', 'and',
  'stock', 'stok', 'stoke', 'stcok', 'new', 'product', 'item', 'items',
  'sell', 'selling', 'sale', 'price', 'buy', 'buying', 'cost', 'mrp', 'bikroy',
  'per', 'taka', 'tk', 'rs', 'rupee', 'rupees',
  'kg', 'kgs', 'gram', 'grams', 'litre', 'liter', 'litres', 'liters', 'pic', 'pics', 'pcs', 'piece', 'pieces',
  'করো', 'কর', 'করা', 'করেছি', 'যোগ', 'পণ্য', 'নতুন', 'স্টক', 'স্টকে', 'এড', 'অ্যাড',
  'পার', 'প্রতি', 'বিক্রি', 'বেচা', 'কিনেছি', 'বিক্রয়মূল্য', 'ক্রয়মূল্য', 'বিক্রয়', 'ক্রয়', 'টাকা', 'কেজি', 'কিলো', 'লিটার', 'পিস', 'টি', 'মূল্য', 'দাম', 'আজকে', 'আজ',
])

function extractStockItemName(userMsg: string, qtyMatchFull?: string): string {
  let cleaned = userMsg
  if (qtyMatchFull) cleaned = cleaned.split(qtyMatchFull).join(' ')
  // strip bare numbers (prices, costs, leftover quantities)
  cleaned = cleaned.replace(/\d+(?:\.\d+)?/g, ' ')
  // strip punctuation
  cleaned = cleaned.replace(/[₹\/,.:;()"'!?]/g, ' ')
  const words = cleaned.split(/\s+/).filter(Boolean)
  const kept = words.filter(w => !STOCK_NAME_STOPWORDS.has(w.toLowerCase()))
  const name = kept.join(' ').trim()
  return name
}

// ── Write-result verification helper ──────────────────────────────
// Supabase's insert()/update() calls return { error } even when you don't
// destructure it — ignoring that return value (as most of the blocks below
// used to) means a failed write (bad column, constraint violation, etc.)
// is completely invisible: the code marches on and still reports success
// to the chat, which is how a customer/product could get an "✅ added"
// confirmation while nothing was actually saved. Every write below now
// goes through this so failures are logged and never counted as success.
async function execWrite(promise: PromiseLike<{ error: any }>, label: string): Promise<boolean> {
  try {
    const { error } = await promise
    if (error) { console.error(`${label} DB error:`, error.message, error.details || '', error.hint || ''); return false }
    return true
  } catch (e) { console.error(`${label} threw:`, e); return false }
}

// Same as execWrite, but for inserts we need the new row's id back — used so
// a later "edit & resend" on the same chat message can find and reverse
// exactly the rows this write created, instead of guessing.
async function execWriteId(promise: PromiseLike<{ data: any; error: any }>, label: string): Promise<string | null> {
  try {
    const { data, error } = await promise
    if (error) { console.error(`${label} DB error:`, error.message, error.details || '', error.hint || ''); return null }
    return data?.id || null
  } catch (e) { console.error(`${label} threw:`, e); return null }
}

// ── Edit & resend support ──────────────────────────────────────────
// When the user edits a previous message and resends it, the frontend
// sends back the `dataRefs` that the ORIGINAL reply returned. Before
// writing anything for the corrected message, we undo exactly those rows
// (and only those — never anything else the user saved since), so the
// correction replaces the old numbers instead of adding a duplicate sale/
// customer/due on top of a wrong one. Customers are intentionally never
// deleted here even if the original message created one — losing a খদ্দের
// record is worse than leaving an unused one, and later messages may
// already reference them.
async function reversePreviousRefs(supabase: any, previousRefs: any[] = []) {
  for (const ref of previousRefs) {
    if (!ref || ref.type !== 'dokan_sale') continue
    try {
      if (ref.saleId) await execWrite(supabase.from('daily_sales').delete().eq('id', ref.saleId), 'reverse daily_sales')
      if (ref.purchaseId) await execWrite(supabase.from('crm_purchases').delete().eq('id', ref.purchaseId), 'reverse crm_purchases')
      if (ref.creditId) await execWrite(supabase.from('credit_entries').delete().eq('id', ref.creditId), 'reverse credit_entries')
      if (ref.stockItemId && ref.stockQtyDeducted) {
        const { data: cur } = await supabase.from('stock_items').select('current_qty').eq('id', ref.stockItemId).maybeSingle()
        if (cur) {
          await execWrite(
            supabase.from('stock_items').update({ current_qty: Number(cur.current_qty) + Number(ref.stockQtyDeducted) }).eq('id', ref.stockItemId),
            'reverse stock deduct'
          )
        }
      }
    } catch (e) { console.error('reversePreviousRefs error:', e) }
  }
}

// ── Fallback-only customer field extraction ──────────────────────────
// Same rationale as extractStockItemName: this only runs when the AI tag
// parser didn't emit a usable [*_ADD_CUSTOMER: ...] tag. The old version
// required the message to literally contain "name=" / "name:" — real
// sentences like "রহিম নামে একজন কাস্টমার যোগ করো" or "customer add koro
// Rahim phone 9876543210" never match that, so the customer silently never
// got saved. This tries several common shapes before giving up.
function extractCustomerFields(userMsg: string): { name: string; phone: string; address: string } {
  const phoneMatch = userMsg.match(/(?:phone|phn|ph|ফোন)[=:\s#]*?(\d{10,})/i) || userMsg.match(/(\d{10,})/)
  const phone = phoneMatch ? phoneMatch[1].trim() : ''

  const addressMatch = userMsg.match(/(?:address|ঠিকানা|বাড়ি|bari)[=:\s]+([a-zA-Z\u0980-\u09FF\s,]+?)(?:,|phone|phn|notes|$)/i)
  const address = addressMatch ? addressMatch[1].trim() : ''

  let name = ''
  // 1. Explicit "name=X" / "name: X"
  let m = userMsg.match(/name[=:\s]+([a-zA-Z\u0980-\u09FF]+(?:\s+[a-zA-Z\u0980-\u09FF]+)?)(?:,|phone|phn|address|$)/i)
  if (m) name = m[1].trim()
  // 2. "<name> নামে" — "রহিম নামে একজন কাস্টমার/খদ্দের"
  if (!name) {
    m = userMsg.match(/([a-zA-Z\u0980-\u09FF]+(?:\s+[a-zA-Z\u0980-\u09FF]+)?)\s*নামে/i)
    if (m) name = m[1].trim()
  }
  // 3. keyword ... koro/কর/করো <name> — "customer add koro Rahim", "কাস্টমার যোগ করো রহিম"
  if (!name) {
    m = userMsg.match(/(?:customer|কাস্টমার|খদ্দের)\D{0,20}(?:koro|কর|করো)\s+([a-zA-Z\u0980-\u09FF]+(?:\s+[a-zA-Z\u0980-\u09FF]+)?)/i)
    if (m) name = m[1].trim()
  }
  // 4. "<name> customer/কাস্টমার/খদ্দের ..." — name comes before the keyword
  if (!name) {
    m = userMsg.match(/^(.+?)\s+(?:customer|কাস্টমার|খদ্দের)\b/i)
    if (m) {
      const candidate = m[1].trim()
      if (candidate && !/^(add|new|নতুন|আজ|আজকে)$/i.test(candidate)) name = candidate
    }
  }
  return { name, phone, address }
}

// ── Fetch data per business type ──────────────────────────────────
async function fetchBusinessData(supabase: any, userId: string, agentType: string) {
  const todayDate = today()

  if (agentType === 'kapor') {
    const [prodsRes, salesRes, custsRes, suppliersRes] = await Promise.all([
      supabase.from('kapor_products').select('*').eq('user_id', userId),
      supabase.from('kapor_sales').select('*').eq('user_id', userId).order('sale_date', { ascending: false }).limit(50),
      supabase.from('kapor_customers').select('*').eq('user_id', userId),
      supabase.from('kapor_suppliers').select('*').eq('user_id', userId),
    ])
    const products = prodsRes.data || []
    const sales = salesRes.data || []
    const customers = custsRes.data || []
    const suppliers = suppliersRes.data || []
    const todaySales = sales.filter((s: any) => s.sale_date === todayDate)
    const todayRevenue = todaySales.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
    const totalDue = customers.reduce((s: number, c: any) => s + Number(c.total_due || 0), 0)
    const supplierDue = suppliers.reduce((s: number, x: any) => s + Number(x.due_amount || 0), 0)
    const lowStock = products.filter((p: any) => p.stock_qty <= p.min_stock)

    return `
== কাপড়ের দোকানের REAL DATA ==
আজকের তারিখ: ${todayDate}
আজকের বিক্রি: ₹${todayRevenue.toFixed(0)}
আজকের লেনদেন: ${todaySales.length}টি
মোট খদ্দের বাকি: ₹${totalDue.toFixed(0)}
সরবরাহকারী দেনা: ₹${supplierDue.toFixed(0)}

== স্টক (${products.length}টি পোশাক) ==
${products.slice(0, 30).map((p: any) => `${p.name} (${p.size}): ${p.stock_qty} পিস, দাম ₹${p.sell_price}, Category: ${p.category}${p.stock_qty <= p.min_stock ? ' ⚠️কম' : ''}`).join('\n')}

== আজকের বিক্রি ==
${todaySales.map((s: any) => `${s.item_name}: ${s.qty} পিস, ₹${s.total_amount}${Number(s.due_amount) > 0 ? ` (বাকি ₹${s.due_amount})` : ' (পরিশোধ)'}`).join('\n') || 'আজ কোনো বিক্রি নেই'}

== সাম্প্রতিক বিক্রি ==
${sales.slice(0, 10).map((s: any) => `${s.sale_date} | ${s.customer_name} | ${s.item_name} | ₹${s.total_amount} | ${Number(s.due_amount) > 0 ? `বাকি ₹${s.due_amount}` : 'পরিশোধ'}`).join('\n')}

== খদ্দের তালিকা (${customers.length}জন) ==
${customers.map((c: any) => `${c.name}${c.phone ? ` (${c.phone})` : ''}${Number(c.total_due) > 0 ? ` — বাকি ₹${c.total_due}` : ' — ক্লিয়ার'}`).join('\n')}

== কম স্টক (${lowStock.length}টি) ==
${lowStock.map((p: any) => `${p.name}: মাত্র ${p.stock_qty} পিস`).join('\n') || 'সব ঠিক আছে'}

== সরবরাহকারী অর্ডার ==
${suppliers.slice(0, 10).map((s: any) => `${s.supplier_name}: ${s.item_ordered}, ${s.qty_ordered} পিস, দেনা ₹${s.due_amount}, স্ট্যাটাস: ${s.status}`).join('\n') || 'কোনো অর্ডার নেই'}
`.trim()
  }

  if (agentType === 'mishti') {
    const [itemsRes, salesRes, custsRes, prodsRes] = await Promise.all([
      supabase.from('mishti_items').select('*').eq('user_id', userId),
      supabase.from('mishti_sales').select('*').eq('user_id', userId).order('sale_date', { ascending: false }).limit(50),
      supabase.from('mishti_customers').select('*').eq('user_id', userId),
      supabase.from('mishti_production').select('*').eq('user_id', userId).order('production_date', { ascending: false }).limit(20),
    ])
    const items = itemsRes.data || []
    const sales = salesRes.data || []
    const customers = custsRes.data || []
    const productions = prodsRes.data || []
    const todaySales = sales.filter((s: any) => s.sale_date === todayDate)
    const todayRevenue = todaySales.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
    const todayProd = productions.filter((p: any) => p.production_date === todayDate).reduce((s: number, p: any) => s + Number(p.qty_kg || 0), 0)
    const totalDue = customers.reduce((s: number, c: any) => s + Number(c.total_due || 0), 0)

    return `
== মিষ্টির দোকানের REAL DATA ==
আজকের তারিখ: ${todayDate}
আজকের বিক্রি: ₹${todayRevenue.toFixed(0)}
আজকের উৎপাদন: ${todayProd} কেজি
মোট বাকি: ₹${totalDue.toFixed(0)}

== মিষ্টির স্টক (${items.length}টি) ==
${items.map((i: any) => `${i.name}: ${i.stock_kg} কেজি, দাম ₹${i.price_per_kg}/কেজি, মেয়াদ ${i.shelf_life_days}ঘণ্টা${i.stock_kg <= i.min_stock_kg ? ' ⚠️কম' : ''}`).join('\n')}

== আজকের বিক্রি ==
${todaySales.map((s: any) => `${s.item_name}: ${s.qty_kg} কেজি, ₹${s.total_amount}${Number(s.due_amount) > 0 ? ` (বাকি ₹${s.due_amount})` : ' (পরিশোধ)'}`).join('\n') || 'আজ কোনো বিক্রি নেই'}

== সাম্প্রতিক বিক্রি ==
${sales.slice(0, 10).map((s: any) => `${s.sale_date} | ${s.customer_name} | ${s.item_name} | ${s.qty_kg}কেজি | ₹${s.total_amount}`).join('\n')}

== আজকের উৎপাদন ==
${productions.filter((p: any) => p.production_date === todayDate).map((p: any) => `${p.item_name}: ${p.qty_kg} কেজি`).join('\n') || 'আজ কোনো উৎপাদন লগ নেই'}

== খদ্দের (${customers.length}জন) ==
${customers.map((c: any) => `${c.name}${c.phone ? ` (${c.phone})` : ''}${Number(c.total_due) > 0 ? ` — বাকি ₹${c.total_due}` : ' — ক্লিয়ার'}`).join('\n')}
`.trim()
  }

  if (agentType === 'hotel') {
    const [ordersRes, custsRes, menuRes, stockRes] = await Promise.all([
      supabase.from('hotel_orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      supabase.from('hotel_customers').select('*').eq('user_id', userId),
      supabase.from('hotel_menu').select('*').eq('user_id', userId),
      supabase.from('hotel_stock').select('*').eq('user_id', userId),
    ])
    const orders = ordersRes.data || []
    const customers = custsRes.data || []
    const menu = menuRes.data || []
    const stock = stockRes.data || []
    const todayOrders = orders.filter((o: any) => o.created_at?.slice(0, 10) === todayDate)
    const todayRevenue = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0)
    const totalDue = customers.reduce((s: number, c: any) => s + Number(c.total_due || 0), 0)
    const lowStock = stock.filter((s: any) => s.quantity <= s.min_quantity)

    return `
== হোটেল/ধাবার REAL DATA ==
আজকের তারিখ: ${todayDate}
আজকের বিক্রি: ₹${todayRevenue.toFixed(0)}
আজকের অর্ডার: ${todayOrders.length}টি
মোট খদ্দের বাকি: ₹${totalDue.toFixed(0)}

== আজকের অর্ডার ==
${todayOrders.map((o: any) => `${o.table_no} | ${o.customer_name} | ₹${o.total_amount} | ${o.status}`).join('\n') || 'আজ কোনো অর্ডার নেই'}

== মেনু (${menu.length}টি পদ) ==
${menu.filter((m: any) => m.is_available).slice(0, 20).map((m: any) => `${m.name_bn || m.name}: ₹${m.price}/${m.category}`).join('\n')}

== স্টক (${stock.length}টি) ==
${stock.map((s: any) => `${s.name}: ${s.quantity} ${s.unit}${s.quantity <= s.min_quantity ? ' ⚠️কম' : ''}`).join('\n')}

== খদ্দের (${customers.length}জন) ==
${customers.map((c: any) => `${c.name}${Number(c.total_due) > 0 ? ` — বাকি ₹${c.total_due}` : ' — ক্লিয়ার'}`).join('\n')}

== কম স্টক ==
${lowStock.map((s: any) => `${s.name}: ${s.quantity} ${s.unit}`).join('\n') || 'সব ঠিক আছে'}
`.trim()
  }

  if (agentType === 'dokan') {
    // Canonical tables — same ones /api/agent-chat and the global Dashboard
    // (Overview/বিক্রি/স্টক/বাকি) read, tagged with the fixed Dokan agent_id
    // so this vertical's data shows up everywhere consistently.
    const [stockRes, salesRes, custsRes, creditRes, suppliersRes] = await Promise.all([
      supabase.from('stock_items').select('*').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID),
      supabase.from('daily_sales').select('*').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID).order('sale_date', { ascending: false }).limit(50),
      supabase.from('crm_customers').select('*').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID),
      supabase.from('credit_entries').select('*').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID).neq('status', 'paid'),
      supabase.from('dokan_suppliers').select('*').eq('user_id', userId).order('order_date', { ascending: false }).limit(20),
    ])
    const products = stockRes.data || []
    const sales = salesRes.data || []
    const customers = custsRes.data || []
    const credits = creditRes.data || []
    const suppliers = suppliersRes.data || []
    const todaySales = sales.filter((s: any) => s.sale_date === todayDate)
    const todayRevenue = todaySales.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
    const totalDue = credits.reduce((s: number, c: any) => s + Math.max(0, Number(c.amount || 0) - Number(c.paid_amount || 0)), 0)
    const supplierDue = suppliers.reduce((s: number, x: any) => s + Number(x.due_amount || 0), 0)
    const lowStock = products.filter((p: any) => Number(p.current_qty) <= Number(p.min_qty))

    return `
== দোকানের REAL DATA ==
আজকের তারিখ: ${todayDate}
আজকের বিক্রি: ₹${todayRevenue.toFixed(0)}
আজকের লেনদেন: ${todaySales.length}টি
মোট খদ্দের বাকি: ₹${totalDue.toFixed(0)}
সরবরাহকারী দেনা: ₹${supplierDue.toFixed(0)}

== ক্যাটাগরি (${new Set(products.map((p: any) => p.category || 'অন্যান্য')).size}টি) ==
${[...new Set(products.map((p: any) => p.category || 'অন্যান্য'))].join(', ') || 'কোনো ক্যাটাগরি নেই'}

== পণ্য স্টক (${products.length}টি) ==
${products.slice(0, 30).map((p: any) => `${p.item_name} (${p.category || 'অন্যান্য'}): ${p.current_qty} ${p.unit}, বিক্রি ₹${p.sell_price || 0}/${p.unit}, ক্রয় ₹${p.unit_cost || 0}${Number(p.current_qty) <= Number(p.min_qty) ? ' ⚠️কম' : ''}`).join('\n')}

== আজকের বিক্রি ==
${todaySales.map((s: any) => `${s.item_name}: ${s.quantity}, ₹${s.total_amount}${s.notes ? ` — ${s.notes}` : ''}`).join('\n') || 'আজ কোনো বিক্রি নেই'}

== সাম্প্রতিক বিক্রি ==
${sales.slice(0, 10).map((s: any) => `${s.sale_date} | ${s.item_name} | ${s.quantity} | ₹${s.total_amount}${s.notes ? ` | ${s.notes}` : ''}`).join('\n')}

== খদ্দের তালিকা (${customers.length}জন) ==
${customers.map((c: any) => `${c.name}${c.phone ? ` (${c.phone})` : ''}`).join('\n')}

== বাকি (${credits.length}টি) ==
${credits.map((c: any) => `${c.customer_name}: বাকি ₹${(Number(c.amount || 0) - Number(c.paid_amount || 0)).toFixed(0)}${c.notes ? ` — ${c.notes}` : ''}`).join('\n') || 'কোনো বাকি নেই'}

== কম স্টক (${lowStock.length}টি) ==
${lowStock.map((p: any) => `${p.item_name}: মাত্র ${p.current_qty} ${p.unit}`).join('\n') || 'সব ঠিক আছে'}

== সরবরাহকারী অর্ডার ==
${suppliers.slice(0, 10).map((s: any) => `${s.supplier_name}: ${s.item_ordered}, ${s.qty_ordered} ${s.unit}, দেনা ₹${s.due_amount}, স্ট্যাটাস: ${s.status}`).join('\n') || 'কোনো অর্ডার নেই'}
`.trim()
  }

  return ''
}


// ── just the product/item names, for deterministic name-matching ───
// (see buildProductMatchNote in localIntent.ts). A second, narrow
// query alongside fetchBusinessData's — kept separate so it can never
// affect the main REAL DATA block if something here fails.
async function fetchProductNames(supabase: any, userId: string, agentType: string): Promise<string[]> {
  try {
    if (agentType === 'dokan') {
      const { data } = await supabase.from('stock_items').select('item_name').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
      return (data || []).map((r: any) => r.item_name).filter(Boolean)
    }
    if (agentType === 'kapor') {
      const { data } = await supabase.from('kapor_products').select('name').eq('user_id', userId)
      return (data || []).map((r: any) => r.name).filter(Boolean)
    }
    if (agentType === 'mishti') {
      const { data } = await supabase.from('mishti_items').select('name').eq('user_id', userId)
      return (data || []).map((r: any) => r.name).filter(Boolean)
    }
    if (agentType === 'hotel') {
      const [{ data: stock }, { data: menu }] = await Promise.all([
        supabase.from('hotel_stock').select('name').eq('user_id', userId),
        supabase.from('hotel_menu').select('name,name_bn').eq('user_id', userId),
      ])
      return [
        ...(stock || []).map((r: any) => r.name),
        ...(menu || []).flatMap((r: any) => [r.name, r.name_bn]),
      ].filter(Boolean)
    }
  } catch (e) {
    console.error('fetchProductNames error:', e)
  }
  return []
}

// ── just the customer names, for the same deterministic name-matching ──
async function fetchCustomerNames(supabase: any, userId: string, agentType: string): Promise<string[]> {
  try {
    if (agentType === 'dokan') {
      const { data } = await supabase.from('crm_customers').select('name').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
      return (data || []).map((r: any) => r.name).filter(Boolean)
    }
    if (agentType === 'kapor') {
      const { data } = await supabase.from('kapor_customers').select('name').eq('user_id', userId)
      return (data || []).map((r: any) => r.name).filter(Boolean)
    }
    if (agentType === 'mishti') {
      const { data } = await supabase.from('mishti_customers').select('name').eq('user_id', userId)
      return (data || []).map((r: any) => r.name).filter(Boolean)
    }
    if (agentType === 'hotel') {
      const { data } = await supabase.from('hotel_customers').select('name').eq('user_id', userId)
      return (data || []).map((r: any) => r.name).filter(Boolean)
    }
  } catch (e) {
    console.error('fetchCustomerNames error:', e)
  }
  return []
}

// ── Write-back: parse AI intent tags and save to Supabase ─────────
async function parseAndWriteBack(supabase: any, userId: string, agentType: string, aiResponse: string, userMsg: string = '', previousRefs: any[] = []): Promise<{ wrote: boolean; customerSaved: boolean; dataRefs: any[]; blocked?: boolean }> {
  let wrote = false
  let customerSaved = false
  const dataRefs: any[] = []

  // Anti-hallucination: the model may not write a quantity / price the owner never said.
  if (inventedNumbers(agentType, aiResponse, userMsg)) return { wrote: false, customerSaved: false, dataRefs: [], blocked: true }

  // If this call is correcting an earlier message (edit & resend), undo
  // exactly what that earlier message wrote before applying the new one.
  if (previousRefs && previousRefs.length > 0) {
    await reversePreviousRefs(supabase, previousRefs)
  }

  // Pattern: [ADD_SALE: item=X, qty=N, price=N, customer=X, paid=N]
  const saleMatch = aiResponse.match(/\[ADD_SALE:\s*([\s\S]*?)\]/i)
  if (saleMatch && agentType === 'kapor') {
    try {
      const p = parseIntentParams(saleMatch[1])
      const qty = Number(p.qty || 1)
      const price = Number(p.price || 0)
      const paid = Number(p.paid || price * qty)
      const total = qty * price
      const due = Math.max(0, total - paid)
      const todayDate = today()
      const saleOk = await execWrite(supabase.from('kapor_sales').insert({
        user_id: userId, item_name: p.item || p.name || 'অজানা',
        qty, sell_price: price, discount: 0,
        total_amount: total, paid_amount: paid, due_amount: due,
        customer_name: p.customer || 'নগদ', customer_phone: p.phone || '',
        sale_date: todayDate, payment_status: due > 0 ? 'partial' : 'paid', notes: '',
      }), 'KAPOR ADD_SALE insert')
      if (p.item) {
        const { data: prod } = await supabase.from('kapor_products').select('id,stock_qty,name').ilike('name', `%${p.item}%`).eq('user_id', userId).maybeSingle()
        if (prod) {
          await execWrite(supabase.from('kapor_products').update({ stock_qty: Math.max(0, prod.stock_qty - qty) }).eq('id', prod.id), 'KAPOR ADD_SALE stock deduct')
        }
      }
      if (saleOk) wrote = true
    } catch (e) { console.error('ADD_SALE write error:', e) }
  }

  // Pattern: [UPDATE_STOCK: item=X, qty=N]
  const stockMatch = aiResponse.match(/\[UPDATE_STOCK:\s*([\s\S]*?)\]/i)
  if (stockMatch && agentType === 'kapor') {
    try {
      const p = parseIntentParams(stockMatch[1])
      const { data: prod } = await supabase.from('kapor_products').select('id').ilike('name', `%${p.item || p.name}%`).eq('user_id', userId).maybeSingle()
      if (prod) {
        const ok = await execWrite(supabase.from('kapor_products').update({ stock_qty: Number(p.qty || 0) }).eq('id', prod.id), 'KAPOR UPDATE_STOCK')
        if (ok) wrote = true
      }
    } catch (e) { console.error('UPDATE_STOCK write error:', e) }
  }

  // Pattern: [ADD_PRODUCT: name=X, category=X, price=N, stock=N, size=X]
  const prodMatch = aiResponse.match(/\[ADD_PRODUCT:\s*([\s\S]*?)\]/i)
  if (prodMatch && agentType === 'kapor') {
    try {
      const p = parseIntentParams(prodMatch[1])
      const ok = await execWrite(supabase.from('kapor_products').insert({
        user_id: userId,
        name: p.name || 'নতুন পণ্য',
        category: p.category || 'অন্যান্য',
        size: p.size || 'ফ্রি সাইজ',
        color: p.color || '',
        stock_qty: Number(p.stock || p.qty || 0),
        min_stock: Number(p.min_stock || 3),
        purchase_price: Number(p.cost || p.purchase_price || 0),
        sell_price: Number(p.price || p.sell_price || 0),
        supplier: p.supplier || '',
        is_available: true,
      }), 'KAPOR ADD_PRODUCT insert')
      if (ok) wrote = true
    } catch (e) { console.error('ADD_PRODUCT write error:', e) }
  }

  // ── Kapor: ADD_CUSTOMER ──────────────────────────────────────────
  // [ADD_CUSTOMER: name=X, phone=X, address=X, notes=X]
  const custMatch = aiResponse.match(/\[ADD_CUSTOMER:\s*([\s\S]*?)\]/i)
  if (custMatch && agentType === 'kapor') {
    try {
      const p = parseIntentParams(custMatch[1])
      const custName = p.name || 'নতুন খদ্দের'
      // Avoid duplicate by phone
      let alreadyExists = false
      if (p.phone) {
        const { data: existing } = await supabase.from('kapor_customers')
          .select('id').eq('user_id', userId).eq('phone', p.phone).maybeSingle()
        if (existing) alreadyExists = true
      }
      if (!alreadyExists) {
        const { error: custError } = await supabase.from('kapor_customers').insert({
          user_id: userId,
          name: custName,
          phone: p.phone || '',
          address: p.address || '',
          notes: p.notes || '',
          total_due: 0,
          total_spent: 0,
          last_visit: today(),
        })
        if (custError) {
          console.error('ADD_CUSTOMER DB error:', custError.message, custError.details, custError.hint)
        } else {
          wrote = true
          customerSaved = true
        }
      } else {
        wrote = true // already exists, still trigger UI refresh
        customerSaved = true
      }
    } catch (e) { console.error('ADD_CUSTOMER error:', e) }
  }



  // ══════════════════════════════════════════════════════════════
  // ── HOTEL write-back intents ──────────────────────────────────
  // ══════════════════════════════════════════════════════════════

  const isHotelReadQuery = (() => {
    const hasSaleVerb = /order|paid|kineche|bechhi|sell|sold|add|যোগ|নতুন|dilo|নিলো|settle/i.test(userMsg)
    return !hasSaleVerb && /^(কি আছে|কী আছে|কত|দেখাও|দেখান|report|রিপোর্ট|show|list|\?$)/i.test(userMsg.trim())
  })()

  // [HOTEL_ADD_ORDER: table=X, customer=X, items=name:qty:price|..., paid=N, notes=X]
  if (agentType === 'hotel' && !isHotelReadQuery) {
    const orderMatches = [...aiResponse.matchAll(/\[HOTEL_ADD_ORDER:\s*([\s\S]*?)\]/gi)]
    for (const match of orderMatches) {
      try {
        const p = parseIntentParams(match[1])
        const rawItems = (p.items || '').split('|').map((seg: string) => {
          const parts = seg.split(':')
          return { name: parts[0]?.trim() || 'অজানা', qty: Number(parts[1]) || 1, price: Number(parts[2]) || 0 }
        }).filter((i: any) => i.name)
        const total = rawItems.reduce((s: number, i: any) => s + i.qty * i.price, 0)
        const paid = Number(p.paid || 0)
        const due = Math.max(0, total - paid)
        const ok = await execWrite(supabase.from('hotel_orders').insert({
          user_id: userId,
          table_no: p.table || 'টেবিল ১',
          customer_name: p.customer || 'অজানা',
          customer_phone: p.phone || '',
          items: JSON.stringify(rawItems),
          total_amount: total,
          paid_amount: paid,
          due_amount: due,
          status: due > 0 ? 'pending' : 'paid',
          notes: p.notes || '',
          created_at: new Date().toISOString(),
        }), 'HOTEL_ADD_ORDER insert')
        if (ok) wrote = true
      } catch (e) { console.error('HOTEL_ADD_ORDER error:', e) }
    }
  }

  // [HOTEL_PAY_ORDER: table=X, paid=N]
  if (agentType === 'hotel' && !isHotelReadQuery) {
    const payMatches = [...aiResponse.matchAll(/\[HOTEL_PAY_ORDER:\s*([\s\S]*?)\]/gi)]
    for (const match of payMatches) {
      try {
        const p = parseIntentParams(match[1])
        const tableNo = p.table || ''
        const paid = Number(p.paid || 0)
        const { data: openOrder } = await supabase.from('hotel_orders')
          .select('id,total_amount,paid_amount,due_amount')
          .eq('user_id', userId).ilike('table_no', `%${tableNo}%`)
          .in('status', ['pending', 'active'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (openOrder) {
          const newPaid = Number(openOrder.paid_amount || 0) + paid
          const newDue = Math.max(0, Number(openOrder.total_amount || 0) - newPaid)
          const ok = await execWrite(supabase.from('hotel_orders').update({
            paid_amount: newPaid, due_amount: newDue,
            status: newDue <= 0 ? 'paid' : 'pending',
          }).eq('id', openOrder.id), 'HOTEL_PAY_ORDER update')
          if (ok) wrote = true
        }
      } catch (e) { console.error('HOTEL_PAY_ORDER error:', e) }
    }
  }

  // [HOTEL_ADD_MENU: name=X, name_bn=X, category=X, price=N, cost=N, is_veg=true/false]
  if (agentType === 'hotel' && !isHotelReadQuery) {
    const menuMatches = [...aiResponse.matchAll(/\[HOTEL_ADD_MENU:\s*([\s\S]*?)\]/gi)]
    for (const match of menuMatches) {
      try {
        const p = parseIntentParams(match[1])
        const ok = await execWrite(supabase.from('hotel_menu').insert({
          user_id: userId,
          name: p.name || 'নতুন পদ',
          name_bn: p.name_bn || p.name || '',
          category: p.category || 'অন্যান্য',
          price: Number(p.price || 0),
          cost: Number(p.cost || 0),
          is_veg: p.is_veg !== 'false',
          is_available: true,
        }), 'HOTEL_ADD_MENU insert')
        if (ok) wrote = true
      } catch (e) { console.error('HOTEL_ADD_MENU error:', e) }
    }
  }

  // [HOTEL_ADD_STOCK: name=X, category=X, unit=X, qty=N, min_qty=N, cost=N]
  if (agentType === 'hotel' && !isHotelReadQuery) {
    const stockMatches = [...aiResponse.matchAll(/\[HOTEL_ADD_STOCK:\s*([\s\S]*?)\]/gi)]
    for (const match of stockMatches) {
      try {
        const p = parseIntentParams(match[1])
        const { data: existing } = await supabase.from('hotel_stock')
          .select('id,quantity').ilike('name', `%${p.name}%`).eq('user_id', userId).maybeSingle()
        let ok: boolean
        if (existing) {
          ok = await execWrite(supabase.from('hotel_stock')
            .update({ quantity: Number(existing.quantity) + Number(p.qty || 0) }).eq('id', existing.id), 'HOTEL_ADD_STOCK update')
        } else {
          ok = await execWrite(supabase.from('hotel_stock').insert({
            user_id: userId,
            name: p.name || 'নতুন উপাদান',
            category: p.category || 'অন্যান্য',
            unit: p.unit || 'কেজি',
            quantity: Number(p.qty || 0),
            min_quantity: Number(p.min_qty || 5),
            cost_per_unit: Number(p.cost || 0),
          }), 'HOTEL_ADD_STOCK insert')
        }
        if (ok) wrote = true
      } catch (e) { console.error('HOTEL_ADD_STOCK error:', e) }
    }
  }

  // [HOTEL_ADD_CUSTOMER: name=X, phone=X, address=X, notes=X]
  if (agentType === 'hotel' && !isHotelReadQuery) {
    const custMatches = [...aiResponse.matchAll(/\[HOTEL_ADD_CUSTOMER:\s*([\s\S]*?)\]/gi)]
    for (const match of custMatches) {
      try {
        const p = parseIntentParams(match[1])
        const { data: existing } = await supabase.from('hotel_customers')
          .select('id').eq('user_id', userId)
          .ilike('name', `%${p.name}%`).maybeSingle()
        if (!existing) {
          const ok = await execWrite(supabase.from('hotel_customers').insert({
            user_id: userId,
            name: p.name || 'নতুন খদ্দের',
            phone: p.phone || '',
            address: p.address || '',
            notes: p.notes || '',
            total_due: 0, total_spent: 0,
          }), 'HOTEL_ADD_CUSTOMER insert')
          if (ok) { customerSaved = true; wrote = true }
        } else {
          wrote = true
        }
      } catch (e) { console.error('HOTEL_ADD_CUSTOMER error:', e) }
    }
  }

  // ── DOKAN write-back intents ─────────────────────────────────────
  // All writes now target the canonical tables (stock_items, daily_sales,
  // crm_customers, crm_purchases, credit_entries) tagged with DOKAN_AGENT_ID,
  // so both this panel and the global Dashboard read the same rows.
  //
  // Guard: only block obvious read-only queries — NOT sale/add messages
  const isDokanReadQuery = /^(কি আছে|কী আছে|stock.*ki|ki.*stock|কত|দেখাও|দেখান|দেখান|report|রিপোর্ট|show|list|stock dekhao|স্টক দেখ|\?$)/i.test(userMsg.trim())
    && !/add|koro|kineche|kinlo|beche|bechhi|sell|bought|sold|যোগ|বিক্রি|কিনেছে|kineche|nilo|dilo/i.test(userMsg)

  // ── DOKAN_ADD_PRODUCT → stock_items upsert ────────────────────────
  if (agentType === 'dokan' && !isDokanReadQuery) {
    const dokanProdMatches = [...aiResponse.matchAll(/\[DOKAN_ADD_PRODUCT:\s*([\s\S]*?)\]/gi)]
    for (const match of dokanProdMatches) {
      try {
        const p = parseIntentParams(match[1])
        if (!p.name || p.name === 'পণ্যের নাম') continue // skip placeholder
        const { data: existing } = await supabase.from('stock_items')
          .select('id,current_qty').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
          .ilike('item_name', p.name).maybeSingle()
        let ok: boolean
        if (existing) {
          ok = await execWrite(supabase.from('stock_items').update({
            current_qty: Number(p.stock || p.qty || existing.current_qty || 0),
            sell_price: p.price !== undefined ? Number(p.price) : undefined,
          }).eq('id', existing.id), 'DOKAN_ADD_PRODUCT update')
        } else {
          ok = await execWrite(supabase.from('stock_items').insert({
            user_id: userId,
            agent_id: DOKAN_AGENT_ID,
            item_name: p.name,
            category: p.category || guessDokanCategory(p.name),
            unit: p.unit || 'কেজি',
            current_qty: Number(p.stock || p.qty || 0),
            min_qty: Number(p.min_stock || 5),
            sell_price: Number(p.price || 0),
            unit_cost: Number(p.cost || p.cost_price || 0),
          }), 'DOKAN_ADD_PRODUCT insert')
        }
        if (ok) wrote = true
      } catch (e) { console.error('DOKAN_ADD_PRODUCT error:', e) }
    }
  }

  // ── DOKAN_ADD_SALE → daily_sales + crm_customers + crm_purchases + credit_entries ──
  if (agentType === 'dokan' && !isDokanReadQuery) {
    const dokanSaleMatches = [...aiResponse.matchAll(/\[DOKAN_ADD_SALE:\s*([\s\S]*?)\]/gi)]

    for (const match of dokanSaleMatches) {
      try {
        const p = parseIntentParams(match[1])
        const qty = Number(p.qty || 1)
        const itemName = p.item || p.name || 'অজানা'
        let custName = p.customer || 'নগদ' // may be replaced with the canonical stored spelling below
        const custPhone = p.phone || ''

        // Look up the stock item FIRST, before computing money.
        const { data: prod } = await supabase.from('stock_items')
          .select('id,current_qty,sell_price').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
          .ilike('item_name', `%${itemName}%`).maybeSingle()

        // FIX: when the item is already in stock with a set sell_price,
        // that price is authoritative — the AI's own `price=` guess is
        // ignored. Without this, a message like "রহিম ৩ কেজি চাল কিনেছে
        // ১০০ টাকা দিয়েছে" (no price stated) led the model to sometimes
        // back-compute price as paid÷qty (₹100÷3 ≈ ₹33/kg) instead of
        // using চাল's real stock price (₹60/kg) — undercharging the sale
        // and hiding what should have been a real বাকি. Only a genuinely
        // new/unlisted item falls back to whatever price the AI supplied.
        const price = (prod && prod.sell_price) ? Number(prod.sell_price) : Number(p.price || 0)
        const total = qty * price
        const paid = p.paid !== undefined ? Number(p.paid) : total
        const due = Math.max(0, total - paid)

        // 1. daily_sales — feeds the Dashboard's Overview/বিক্রি charts
        const saleId = await execWriteId(supabase.from('daily_sales').insert({
          user_id: userId,
          agent_id: DOKAN_AGENT_ID,
          sale_date: today(),
          item_name: itemName,
          quantity: qty,
          unit_price: price,
          notes: custName !== 'নগদ' ? `খদ্দের: ${custName}` : '',
          source: 'chat',
        }).select('id').single(), 'DOKAN_ADD_SALE daily_sales insert')
        const saleOk = !!saleId

        // Track exactly what this one sale-tag wrote, so an "edit & resend"
        // on this same chat message can undo precisely this (and nothing
        // saved before or after it).
        const ref: any = {
          type: 'dokan_sale', saleId,
          // Carried through to the chat confirmation below, so the exact
          // computed numbers are visible to the user immediately — a bad
          // price/total is caught by looking at the chat, not by opening
          // the dashboard separately.
          itemName, qty, unit: p.unit || 'কেজি', price, total, paid, due, custName,
        }

        // Deduct stock
        if (prod) {
          await execWrite(supabase.from('stock_items')
            .update({ current_qty: Math.max(0, Number(prod.current_qty) - qty) }).eq('id', prod.id), 'DOKAN_ADD_SALE stock deduct')
          ref.stockItemId = prod.id
          ref.stockQtyDeducted = qty
        }

        // 3. Resolve/create the customer + log the purchase + বাকি if underpaid
        if (custName !== 'নগদ') {
          let customerId: string | null = null
          // FIX: also select `name` (not just id/phone). The বাকি panel joins
          // credit_entries.customer_name back to crm_customers.name by exact
          // string match, so every write below MUST reuse this canonical,
          // already-stored spelling/casing — never the raw `custName` this
          // particular message happened to use. Otherwise "shilpa" this
          // message vs "Shilpa" stored from an earlier message silently
          // drops the due amount out of every বাকি total, even though the
          // credit_entries row itself was written correctly.
          const { data: existCust } = await supabase.from('crm_customers')
            .select('id,phone,name').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
            .ilike('name', custName).maybeSingle()

          if (existCust) {
            customerId = existCust.id
            custName = existCust.name // reuse canonical stored name from here on
            if (custPhone && !existCust.phone) {
              await execWrite(supabase.from('crm_customers').update({ phone: custPhone }).eq('id', existCust.id), 'DOKAN_ADD_SALE phone update')
            }
          } else {
            const { data: created, error: createErr } = await supabase.from('crm_customers').insert({
              user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan',
              name: custName, phone: custPhone, source: 'chat',
            }).select('id').single()
            if (createErr) console.error('DOKAN_ADD_SALE customer create DB error:', createErr.message, createErr.details || '')
            customerId = created?.id || null
          }
          ref.customerId = customerId
          ref.custName = custName // keep the chat-confirmation ref in sync with the canonical name too

          if (customerId) {
            ref.purchaseId = await execWriteId(supabase.from('crm_purchases').insert({
              user_id: userId, customer_id: customerId,
              purchase_date: today(), item_name: itemName,
              quantity: qty, unit: p.unit || 'কেজি', unit_price: price,
              paid_amount: paid,
              payment_status: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending',
              source: 'chat',
            }).select('id').single(), 'DOKAN_ADD_SALE purchase insert')
          }

          if (due > 0) {
            ref.creditId = await execWriteId(supabase.from('credit_entries').insert({
              user_id: userId, agent_id: DOKAN_AGENT_ID,
              customer_name: custName, amount: total, paid_amount: paid,
              status: paid > 0 ? 'partial' : 'pending',
              notes: `${itemName} — ${qty}${p.unit || 'কেজি'}`, source: 'chat',
            }).select('id').single(), 'DOKAN_ADD_SALE credit_entries insert')
            if (ref.creditId) customerSaved = true
          }
        }

        if (saleOk) { wrote = true; dataRefs.push(ref) }
      } catch (e) { console.error('DOKAN_ADD_SALE error:', e) }
    }
  }

  // ── DOKAN_UPDATE_STOCK → stock_items ──────────────────────────────
  if (agentType === 'dokan' && !isDokanReadQuery) {
    const dokanStockMatches = [...aiResponse.matchAll(/\[DOKAN_UPDATE_STOCK:\s*([\s\S]*?)\]/gi)]
    for (const match of dokanStockMatches) {
      try {
        const p = parseIntentParams(match[1])
        const itemName = p.item || p.name || ''
        const { data: prod } = await supabase.from('stock_items')
          .select('id').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
          .ilike('item_name', `%${itemName}%`).maybeSingle()
        if (prod) {
          const ok = await execWrite(supabase.from('stock_items').update({ current_qty: Number(p.qty || 0) }).eq('id', prod.id), 'DOKAN_UPDATE_STOCK')
          if (ok) wrote = true
        }
      } catch (e) { console.error('DOKAN_UPDATE_STOCK error:', e) }
    }
  }

  // ── DOKAN_ADD_CUSTOMER → crm_customers ────────────────────────────
  if (agentType === 'dokan' && !isDokanReadQuery) {
    const dokanCustMatches = [...aiResponse.matchAll(/\[DOKAN_ADD_CUSTOMER:\s*([\s\S]*?)\]/gi)]
    for (const match of dokanCustMatches) {
      try {
        const p = parseIntentParams(match[1])
        const { data: existing } = await supabase.from('crm_customers')
          .select('id').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
          .eq('phone', p.phone || '__none__').maybeSingle()

        let ok = true
        if (!existing) {
          ok = await execWrite(supabase.from('crm_customers').insert({
            user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan',
            name: p.name || 'নতুন খদ্দের', phone: p.phone || '',
            address: p.address || '', notes: p.notes || '', source: 'chat',
          }), 'DOKAN_ADD_CUSTOMER insert')
        } else if (p.address) {
          ok = await execWrite(supabase.from('crm_customers').update({ address: p.address }).eq('id', existing.id), 'DOKAN_ADD_CUSTOMER update')
        }
        if (ok) { wrote = true; customerSaved = true }
      } catch (e) { console.error('DOKAN_ADD_CUSTOMER error:', e) }
    }
  }

  // ── Mishti write-back intents ────────────────────────────────────

  // ── Mishti: ADD_CUSTOMER ─────────────────────────────────────────
  // [MISHTI_ADD_CUSTOMER: name=X, phone=X, address=X, notes=X]
  const mishtiCustMatch = aiResponse.match(/\[MISHTI_ADD_CUSTOMER:\s*([\s\S]*?)\]/i)
  if (mishtiCustMatch && agentType === 'mishti') {
    try {
      const p = parseIntentParams(mishtiCustMatch[1])
      const custName = p.name || 'নতুন খদ্দের'
      let alreadyExists = false
      if (p.phone) {
        const { data: existing } = await supabase.from('mishti_customers')
          .select('id').eq('user_id', userId).eq('phone', p.phone).maybeSingle()
        if (existing) alreadyExists = true
      }
      if (!alreadyExists) {
        const { error: custError } = await supabase.from('mishti_customers').insert({
          user_id: userId, name: custName, phone: p.phone || '',
          address: p.address || '', notes: p.notes || '',
          total_due: 0, total_spent: 0, last_purchase: today(), is_regular: false,
        })
        if (custError) { console.error('MISHTI_ADD_CUSTOMER DB error:', custError.message, custError.details) }
        else { wrote = true; customerSaved = true }
      } else { wrote = true; customerSaved = true }
    } catch (e) { console.error('MISHTI_ADD_CUSTOMER error:', e) }
  }


  // [MISHTI_ADD_SALE: item=X, qty_kg=N, price=N, customer=X, paid=N, occasion=X]
  const mishtiSaleMatch = aiResponse.match(/\[MISHTI_ADD_SALE:\s*([\s\S]*?)\]/i)
  if (mishtiSaleMatch && agentType === 'mishti') {
    try {
      const p = parseIntentParams(mishtiSaleMatch[1])
      const qty = Number(p.qty_kg || p.qty || 1)
      const price = Number(p.price || 0)
      const paid = Number(p.paid || price * qty)
      const total = qty * price
      const due = Math.max(0, total - paid)
      await supabase.from('mishti_sales').insert({
        user_id: userId,
        item_name: p.item || p.name || 'অজানা',
        quantity_kg: qty, price_per_kg: price,
        total_amount: total, paid_amount: paid, due_amount: due,
        customer_name: p.customer || 'নগদ', customer_phone: p.phone || '',
        sale_date: today(), payment_status: due > 0 ? 'partial' : 'paid',
        occasion: p.occasion || '', notes: '',
      })
      if (p.item) {
        const { data: item } = await supabase.from('mishti_items').select('id,stock_kg').ilike('name', `%${p.item}%`).eq('user_id', userId).maybeSingle()
        if (item) await supabase.from('mishti_items').update({ stock_kg: Math.max(0, item.stock_kg - qty) }).eq('id', item.id)
      }
      wrote = true
    } catch (e) { console.error('MISHTI_ADD_SALE error:', e) }
  }

  // [MISHTI_ADD_PRODUCTION: item=X, qty_kg=N]
  const mishtiProdMatch = aiResponse.match(/\[MISHTI_ADD_PRODUCTION:\s*([\s\S]*?)\]/i)
  if (mishtiProdMatch && agentType === 'mishti') {
    try {
      const p = parseIntentParams(mishtiProdMatch[1])
      const qty = Number(p.qty_kg || p.qty || 0)
      await supabase.from('mishti_production').insert({
        user_id: userId, item_name: p.item || p.name || 'অজানা',
        quantity_kg: qty, production_date: today(), notes: '',
      })
      if (p.item) {
        const { data: item } = await supabase.from('mishti_items').select('id,stock_kg').ilike('name', `%${p.item}%`).eq('user_id', userId).maybeSingle()
        if (item) await supabase.from('mishti_items').update({ stock_kg: item.stock_kg + qty }).eq('id', item.id)
      }
      wrote = true
    } catch (e) { console.error('MISHTI_ADD_PRODUCTION error:', e) }
  }

  // [MISHTI_ADD_ITEM: name=X, name_bn=X, category=X, price=N, cost=N, stock=N]
  const mishtiItemMatch = aiResponse.match(/\[MISHTI_ADD_ITEM:\s*([\s\S]*?)\]/i)
  if (mishtiItemMatch && agentType === 'mishti') {
    try {
      const p = parseIntentParams(mishtiItemMatch[1])
      await supabase.from('mishti_items').insert({
        user_id: userId,
        name: p.name || 'নতুন মিষ্টি',
        name_bn: p.name_bn || p.name || 'নতুন মিষ্টি',
        category: p.category || 'অন্যান্য',
        price_per_kg: Number(p.price || 0),
        cost_per_kg: Number(p.cost || 0),
        stock_kg: Number(p.stock || 0),
        min_stock_kg: Number(p.min_stock || 1),
        shelf_life_days: Number(p.shelf_life || 3),
        is_available: true, made_today_kg: 0,
        production_date: today(),
      })
      wrote = true
    } catch (e) { console.error('MISHTI_ADD_ITEM error:', e) }
  }

  return { wrote, customerSaved, dataRefs }
}

// ══════════════════════════════════════════════════════════════════
// Confirm-before-save for Dokan "add stock"
//  1. proposeDokanStock: reads the message WITHOUT any AI (so nothing can be
//     invented), matches it against the shop's own products, and returns a
//     proposal. Nothing is written.
//  2. The chat shows an editable card. Only when the owner taps "সেভ করুন"
//     does the client send the (possibly corrected) values back as
//     `confirmAction`, and executeDokanAction validates and writes them.
// ══════════════════════════════════════════════════════════════════
const clean = (v: any, max: number) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, max)
const num = (v: any) => { const n = Number(normalizeDigits(String(v ?? '')).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN }
const escLike = (v: string) => v.replace(/[\\%_]/g, m => '\\' + m)

async function logChatFailure(info: { userId?: string; agentSlug?: string; message: string; normalized?: string; reply?: string; reason: string }) {
  try {
    const sb = getServiceClient()
    const { error } = await sb.from('chat_failures').insert({
      user_id: info.userId || null,
      agent_slug: info.agentSlug || null,
      message: (info.message || '').slice(0, 1000),
      normalized: (info.normalized || '').slice(0, 1000),
      reply: (info.reply || '').slice(0, 500),
      reason: info.reason,
    })
    if (error) console.error('chat_failures insert:', error.message)
  } catch (e) { console.error('chat_failures threw:', e) }
}

async function loadDokanProducts(supabase: any, userId: string): Promise<any[]> {
  try {
    const { data } = await supabase.from('stock_items')
      .select('item_name,current_qty,unit,sell_price')
      .eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID).limit(2000)
    if (Array.isArray(data)) return data
  } catch (e) { console.error('propose: product list failed:', e) }
  return []
}

// "Add stock" — read by deterministic code (never the chat model), ONE or MANY products per message.
//  • everything clear + one product  → the single editable card (as before)
//  • several products, or anything unclear → one editable list; unclear rows are marked so the owner
//    completes them one by one. Nothing is written until the owner taps save.
async function proposeDokanStock(supabase: any, userId: string, rawMsg: string) {
  if (detectIntent(rawMsg) !== 'add_stock') return null
  const products = await loadDokanProducts(supabase, userId)
  const parsed = parseMultiStock(rawMsg, { vertical: 'dokan', shop: products.map((p: any) => ({ name: p.item_name, unit: p.unit })) }, 'add_stock')
  if (!parsed) return null

  if (!parsed.items.length) {
    const blank = { name: '', qty: '', unit: 'কেজি', unit_cost: '', sell_price: '', category: 'অন্যান্য', expiry: '', heardAs: '', flags: ['name', 'qty'], note: 'কোন পণ্য কত — বুঝতে পারিনি, নিচে লিখে দিন', status: 'unknown' }
    return { content: '🤔 কোন পণ্য কত যোগ করবেন ঠিক বুঝতে পারিনি। নিচের ফর্মে লিখে দিন।', pending: { type: 'add_stock_bulk', source: 'chat', items: [blank] } }
  }

  const first = parsed.items[0]
  const single = parsed.items.length === 1 && first.status === 'ok'
    && !first.flags.some(f => f === 'name' || f === 'qty' || f === 'unit') && DOKAN_UNITS.includes(first.unit) && first.qty !== ''
  if (single) {
    const existing = products.find((p: any) => String(p.item_name).toLowerCase() === first.name.toLowerCase())
    const pending = {
      type: 'add_stock' as const, name: first.name, heardAs: first.heardAs, qty: Number(first.qty), unit: first.unit,
      price: Number(first.price) || 0, cost: Number(first.cost) || 0,
      category: guessDokanCategory(first.name),
      existingQty: existing ? Number(existing.current_qty ?? 0) : null,
      existingUnit: existing ? (existing.unit || 'কেজি') : null,
      isNew: !existing,
    }
    const priceTxt = pending.price ? `, বিক্রয়মূল্য ₹${pending.price}/${pending.unit}` : ''
    return { content: `📝 বুঝেছি: **${pending.name}** — ${pending.qty} ${pending.unit}${priceTxt}${pending.isNew ? ' (নতুন পণ্য)' : ''}।\nনিচে দেখে নিন, ভুল থাকলে ঠিক করে **সেভ করুন** চাপুন।`, pending }
  }

  const unclear = parsed.items.filter(i => i.status !== 'ok' || i.flags.some(f => f === 'qty' || f === 'unit' || f === 'name')).length
  const lines = parsed.items.map((i, k) => `${k + 1}. ${i.name || '❓'}${i.qty !== '' ? ` — ${i.qty} ${i.unit}` : ''}${i.price !== '' ? `, ₹${i.price}` : ''}`).join('\n')
  const content = `📝 ${parsed.items.length}টি পণ্য পেয়েছি:\n${lines}\n` +
    (unclear ? `\n⚠️ ${unclear}টি ঠিক বুঝতে পারিনি — হলুদ দাগ দেওয়া ঘরগুলো দেখে ঠিক করুন।` : '\nনিচে দেখে নিন, তারপর **সব যোগ করুন** চাপুন।')
  return { content, pending: { type: 'add_stock_bulk' as const, source: 'chat' as const, items: parsed.items.map(toBulkItem) } }
}

// Product names the shop already has, per kind of shop (so "চাল" lands on an existing "Rice", "XL শার্ট" on "Shirt (XL)" …)
async function loadShopNames(supabase: any, userId: string, agentType: string): Promise<{ name: string; unit?: string }[]> {
  try {
    if (agentType === 'kapor') {
      const { data } = await supabase.from('kapor_products').select('name').eq('user_id', userId).limit(2000)
      return (data || []).map((r: any) => ({ name: r.name }))
    }
    if (agentType === 'mishti') {
      const { data } = await supabase.from('mishti_items').select('name').eq('user_id', userId).limit(2000)
      return (data || []).map((r: any) => ({ name: r.name, unit: 'কেজি' }))
    }
    if (agentType === 'hotel') {
      const { data } = await supabase.from('hotel_stock').select('name,unit').eq('user_id', userId).limit(2000)
      return (data || []).map((r: any) => ({ name: r.name, unit: r.unit }))
    }
  } catch (e) { console.error('loadShopNames failed:', e) }
  return []
}

// "Add stock" for Kapor / Mishti / Hotel — same rule as Dokan & Pharmacy: code reads the message (one OR many
// products), anything unclear is highlighted in an editable list, nothing is written until the owner taps save.
async function proposeVerticalStock(supabase: any, userId: string, rawMsg: string, agentType: 'kapor' | 'mishti' | 'hotel') {
  if (detectIntent(rawMsg) !== 'add_stock') return null
  // a hotel "add to menu" request is a menu item (price, no quantity), not stock
  if (agentType === 'hotel' && /মেনু|মেনুতে|menu|পদ\b|dish/i.test(rawMsg)) return null
  const shop = await loadShopNames(supabase, userId, agentType)
  const parsed = parseMultiStock(rawMsg, { vertical: agentType as Vertical, shop }, 'add_stock')
  if (!parsed) return null
  const word = agentType === 'kapor' ? 'পোশাক' : agentType === 'mishti' ? 'মিষ্টি' : 'মাল'
  const blank = { name: '', qty: '', unit: agentType === 'kapor' ? 'পিস' : 'কেজি', unit_cost: '', sell_price: '', category: 'অন্যান্য', expiry: '', heardAs: '', flags: ['name', 'qty'], note: 'কোনটা কত — বুঝতে পারিনি, নিচে লিখে দিন', status: 'unknown' }
  let items: any[] = parsed.items.length ? parsed.items.map(toBulkItem) : [blank]
  if (agentType === 'mishti') {
    // mishti stock is kept in kg — never silently store "20 ভাঁড়" as 20 kg
    items = items.map((it: any) => (it.unit === 'কেজি' || it.qty === '' ? it
      : { ...it, unit: 'কেজি', flags: Array.from(new Set([...(it.flags || []), 'unit', 'qty'])), note: `${it.note ? it.note + ' · ' : ''}মিষ্টির স্টক কেজিতে রাখা হয় — পরিমাণ কেজিতে লিখে দিন` }))
  }
  const unclear = items.filter((i: any) => i.status !== 'ok' || (i.flags || []).some((f: string) => f === 'qty' || f === 'unit' || f === 'name')).length
  const lines = items.map((i: any, k: number) => `${k + 1}. ${i.name || '❓'}${i.qty !== '' ? ` — ${i.qty} ${i.unit}` : ''}${i.sell_price !== '' ? `, ₹${i.sell_price}` : ''}`).join('\n')
  const content = parsed.items.length
    ? `📝 ${items.length}টি ${word} পেয়েছি:\n${lines}\n` + (unclear ? `\n⚠️ ${unclear}টি ঠিক বুঝতে পারিনি — হলুদ দাগ দেওয়া ঘরগুলো দেখে ঠিক করুন।` : '\nনিচে দেখে নিন, তারপর **সব যোগ করুন** চাপুন।')
    : `🤔 কোন ${word} কত যোগ করবেন ঠিক বুঝতে পারিনি। নিচের ফর্মে লিখে দিন।`
  return { content, pending: { type: 'add_stock_bulk' as const, source: 'chat' as const, items } }
}

// Numbers the model may NOT invent. Stock / product / menu adds must carry only numbers the owner said.
// (Sales & orders are only checked for the quantity: price/paid can legitimately come from the saved price list.)
function inventedNumbers(agentType: string, aiResponse: string, userMsg: string): boolean {
  if (!['kapor', 'mishti', 'hotel'].includes(agentType)) return false
  const get = (tag: string) => Array.from(aiResponse.matchAll(new RegExp(`\\[${tag}:\\s*([\\s\\S]*?)\\]`, 'gi'))).map(m => parseIntentParams(m[1]))
  const said = (...n: any[]) => numbersPresent(userMsg, n.map(x => (Number(x) === 1 ? 0 : x)))   // "এক"/"একটা" may be implied
  let bad = false
  if (agentType === 'kapor') {
    for (const p of get('ADD_SALE')) if (!said(p.qty)) bad = true
    for (const p of get('UPDATE_STOCK')) if (!said(p.qty)) bad = true
    for (const p of get('ADD_PRODUCT')) if (!said(p.stock, p.qty, p.price, p.sell_price, p.cost, p.purchase_price)) bad = true
  } else if (agentType === 'mishti') {
    for (const p of get('MISHTI_ADD_SALE')) if (!said(p.qty_kg, p.qty)) bad = true
    for (const p of get('MISHTI_ADD_PRODUCTION')) if (!said(p.qty_kg, p.qty)) bad = true
    for (const p of get('MISHTI_ADD_ITEM')) if (!said(p.stock, p.price, p.min_stock)) bad = true
  } else {
    for (const p of get('HOTEL_ADD_STOCK')) if (!said(p.qty, p.cost)) bad = true
    for (const p of get('HOTEL_ADD_MENU')) if (!said(p.price, p.cost)) bad = true
    for (const p of get('HOTEL_ADD_ORDER')) {
      const qtys = String(p.items || '').split('|').map((seg: string) => seg.split(':')[1])
      if (!said(...qtys)) bad = true
    }
  }
  return bad
}

// A sale that names a product the shop doesn't stock must say so — not let the chat model improvise.
async function unknownSaleProductReply(supabase: any, userId: string, rawMsg: string, agentType: string = 'dokan'): Promise<string | null> {
  if (detectIntent(rawMsg) !== 'sale') return null
  const shop = agentType === 'dokan'
    ? (await loadDokanProducts(supabase, userId)).map((p: any) => ({ name: p.item_name, unit: p.unit }))
    : await loadShopNames(supabase, userId, agentType)
  const parsed = parseMultiStock(rawMsg, { vertical: agentType as Vertical, shop }, 'sale')
  if (!parsed || !parsed.items.length) return null
  const bad: string[] = []
  for (const it of parsed.items) {
    if (it.qty === '' || !it.name || it.known) continue            // matched to something the shop already stocks → fine
    if (/^\S+(কে|র|এর)$/.test(it.name)) continue                  // a lone word like "রহিমকে" is a customer, not a product
    it.name = it.name.replace(/^\S+(কে|এর)\s+/, '')                // "রহিমকে ফুসকা" → "ফুসকা"
    const r = resolveProduct(it.name, shop, [])                     // shop's own list only
    if (r.best && r.best.source === 'shop' && r.best.score >= MATCH_MIN) continue
    // recognised in the dictionary but not in THIS shop's stock (e.g. "ফুল্কো ভি" = ফুলকপি) → say so, never improvise
    bad.push(`“${it.heardAs || it.name}”${it.status !== 'unknown' ? ` (${it.name} মনে হচ্ছে)` : it.alternatives.length ? ` (কাছাকাছি: ${it.alternatives.join(', ')})` : ''}`)
  }
  if (!bad.length) return null
  return `❓ ${bad.join(', ')} আপনার স্টকে খুঁজে পাইনি। পণ্যের নাম আবার বলুন/লিখুন, অথবা নতুন পণ্য হলে আগে "স্টকে যোগ করো ..." বলে যোগ করুন।`
}

async function executeDokanAction(supabase: any, userId: string, a: any) {
  if (!a || a.type !== 'add_stock') return { ok: false, content: '⚠️ অচেনা অনুরোধ।' }
  const name = clean(a.name, 60)
  const qty = num(a.qty), price = num(a.price || 0), cost = num(a.cost || 0)
  const unit = DOKAN_UNITS.includes(String(a.unit)) ? String(a.unit) : ''
  if (!name) return { ok: false, content: '⚠️ পণ্যের নাম লিখুন।' }
  if (!(qty > 0) || qty > 1_000_000) return { ok: false, content: '⚠️ পরিমাণ ঠিক নয় (০-এর বেশি হতে হবে)।' }
  if (!unit) return { ok: false, content: '⚠️ একক (কেজি/পিস...) বেছে নিন।' }
  if (!(price >= 0) || price > 10_000_000 || !(cost >= 0) || cost > 10_000_000) return { ok: false, content: '⚠️ দাম ঠিক নয়।' }
  const category = clean(a.category, 40) || guessDokanCategory(name)

  try {
    const { data: found, error: findErr } = await supabase.from('stock_items')
      .select('id,current_qty,unit')
      .eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
      .ilike('item_name', escLike(name)).limit(1)
    if (findErr) { console.error('confirm: lookup failed:', findErr.message); return { ok: false, dbError: true, content: '⚠️ ডেটাবেজে সেভ করা যায়নি। Supabase-এর টেবিল/পারমিশন (RLS) চেক করুন।' } }
    const existing = Array.isArray(found) ? found[0] : null

    if (existing) {
      const eu = existing.unit || 'কেজি'
      const add = convertQty(qty, unit, eu)
      if (add === null) return { ok: false, content: `⚠️ "${name}" আগে ${eu}-তে আছে, তাই ${unit} যোগ করা যাবে না। একক ${eu} করে আবার চেষ্টা করুন।` }
      const total = Math.round((Number(existing.current_qty || 0) + add) * 1000) / 1000
      const patch: any = { current_qty: total }
      if (price > 0) patch.sell_price = price
      if (cost > 0) patch.unit_cost = cost
      const { error } = await supabase.from('stock_items').update(patch).eq('id', existing.id)
      if (error) { console.error('confirm: update failed:', error.message); return { ok: false, dbError: true, content: '⚠️ ডেটাবেজে সেভ করা যায়নি। Supabase-এর টেবিল/পারমিশন (RLS) চেক করুন।' } }
      return { ok: true, content: `✅ ${name} — ${qty} ${unit} যোগ হয়েছে। এখন মোট স্টক: ${total} ${eu}।` }
    }

    const { error } = await supabase.from('stock_items').insert({
      user_id: userId, agent_id: DOKAN_AGENT_ID, item_name: name, category, unit,
      current_qty: qty, min_qty: 5, sell_price: price, unit_cost: cost,
    })
    if (error) { console.error('confirm: insert failed:', error.message); return { ok: false, dbError: true, content: '⚠️ ডেটাবেজে সেভ করা যায়নি। Supabase-এর টেবিল/পারমিশন (RLS) চেক করুন।' } }
    return { ok: true, content: `✅ ${name} — ${qty} ${unit}${price ? `, বিক্রয়মূল্য ₹${price}/${unit}` : ''} স্টকে যোগ হয়েছে।` }
  } catch (e) {
    console.error('confirm: threw:', e)
    return { ok: false, dbError: true, content: '⚠️ ডেটাবেজে সেভ করা যায়নি।' }
  }
}

// Runs the exact same writes the normal (non-gated) DOKAN_ADD_SALE path
// runs — daily_sales, stock deduction, crm_customers, crm_purchases,
// credit_entries — just triggered by the owner's confirm tap instead of
// running automatically, and using whatever the owner corrected on the card.
async function executeDokanSale(supabase: any, userId: string, a: any) {
  const custName = clean(a.customerName, 60)
  const custPhone = clean(a.phone, 20)
  const items = Array.isArray(a.items) ? a.items : []
  if (!custName) return { ok: false, content: '⚠️ খদ্দেরের নাম লিখুন।' }
  if (!items.length) return { ok: false, content: '⚠️ অন্তত একটি পণ্য লাগবে।' }

  try {
    let customerId: string | null = null
    const { data: existCust } = await supabase.from('crm_customers')
      .select('id,name').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
      .ilike('name', custName).maybeSingle()
    let canonicalName = custName
    if (existCust) {
      customerId = existCust.id
      canonicalName = existCust.name
    } else {
      const { data: created, error: createErr } = await supabase.from('crm_customers').insert({
        user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan',
        name: custName, phone: custPhone, source: 'chat',
      }).select('id').single()
      if (createErr) { console.error('executeDokanSale customer create:', createErr.message); return { ok: false, dbError: true, content: '⚠️ ডেটাবেজে সেভ করা যায়নি।' } }
      customerId = created?.id || null
    }

    const bnDigits = (n: number) => n.toLocaleString('bn-IN')
    const lines: string[] = []
    let grandTotal = 0, grandPaid = 0, grandDue = 0

    for (const [i, it] of items.entries()) {
      const itemName = clean(it.name, 60)
      const qty = num(it.qty), unit = clean(it.unit, 20) || 'কেজি', price = num(it.price)
      if (!itemName || !(qty > 0) || !(price >= 0)) continue
      const total = qty * price
      const paid = it.paid === '' || it.paid == null ? total : num(it.paid)
      const due = Math.max(0, total - (Number.isFinite(paid) ? paid : total))

      const { data: prod } = await supabase.from('stock_items')
        .select('id,current_qty').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
        .ilike('item_name', escLike(itemName)).maybeSingle()

      await execWrite(supabase.from('daily_sales').insert({
        user_id: userId, agent_id: DOKAN_AGENT_ID, sale_date: today(),
        item_name: itemName, quantity: qty, unit_price: price,
        notes: `খদ্দের: ${canonicalName}`, source: 'chat',
      }), 'executeDokanSale daily_sales insert')

      if (prod) {
        await execWrite(supabase.from('stock_items')
          .update({ current_qty: Math.max(0, Number(prod.current_qty) - qty) }).eq('id', prod.id), 'executeDokanSale stock deduct')
      }

      if (customerId) {
        await execWrite(supabase.from('crm_purchases').insert({
          user_id: userId, customer_id: customerId, purchase_date: today(),
          item_name: itemName, quantity: qty, unit, unit_price: price,
          paid_amount: paid, payment_status: due <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending',
          source: 'chat',
        }), 'executeDokanSale purchase insert')

        if (due > 0) {
          await execWrite(supabase.from('credit_entries').insert({
            user_id: userId, agent_id: DOKAN_AGENT_ID, customer_name: canonicalName,
            amount: total, paid_amount: paid, status: paid > 0 ? 'partial' : 'pending',
            notes: `${itemName} — ${qty}${unit}`, source: 'chat',
          }), 'executeDokanSale credit_entries insert')
        }
      }

      lines.push(`${i + 1}. ${itemName} — ${qty}${unit} × ₹${price} = ₹${bnDigits(total)}`)
      grandTotal += total; grandPaid += (Number.isFinite(paid) ? paid : total); grandDue += due
    }

    if (!lines.length) return { ok: false, content: '⚠️ কোনো বৈধ পণ্য পাওয়া যায়নি।' }

    const content = `🧾 বিল — ${canonicalName}\n${lines.join('\n')}\n────────────\nমোট: ₹${bnDigits(grandTotal)}\nজমা: ₹${bnDigits(grandPaid)}`
      + (grandDue > 0 ? `\nবাকি: ₹${bnDigits(grandDue)}` : '\n✅ সম্পূর্ণ পরিশোধ')
    return { ok: true, content }
  } catch (e) {
    console.error('executeDokanSale threw:', e)
    return { ok: false, dbError: true, content: '⚠️ ডেটাবেজে সেভ করা যায়নি।' }
  }
}

// ══════════════════════════════════════════════════════════════════
// Confirm-before-save for Dokan sales — but ONLY when the named customer
// is genuinely new (not already in crm_customers). An existing, already-
// verified customer still saves instantly, same as before — the risk this
// guards against is specifically a mis-heard/garbled NEW name (from voice
// or a typo) silently creating a wrong customer record with a wrong বাকি.
//
// The AI still does the hard parsing (multi-item messages, natural
// phrasing, splitting one stated payment across several items) via its
// existing DOKAN_ADD_SALE tags — this only intercepts AFTER that parsing,
// before anything is written, when the tags name someone not on file yet.
const dokanSaleTagRe = /\[DOKAN_ADD_SALE:\s*([\s\S]*?)\]/gi

async function checkNewSaleCustomer(supabase: any, userId: string, aiResponse: string) {
  const matches = [...aiResponse.matchAll(dokanSaleTagRe)]
  if (!matches.length) return null

  const items = matches.map(m => {
    const p = parseIntentParams(m[1])
    return {
      name: p.item || p.name || 'অজানা',
      qty: p.qty || '1',
      unit: p.unit || 'কেজি',
      price: p.price || '0',
      paid: p.paid ?? '',
    }
  })

  const rawNames = [...new Set(matches.map(m => (parseIntentParams(m[1]).customer || '').trim()).filter(n => n && n !== 'নগদ'))]
  // More than one distinct customer name in a single message is rare and
  // not safely representable as one review card — let it through the
  // normal path rather than block a legitimate multi-customer message.
  if (rawNames.length !== 1) return null

  const custName = rawNames[0]
  const { data: existCust } = await supabase.from('crm_customers')
    .select('id').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
    .ilike('name', custName).maybeSingle()
  if (existCust) return null // already a known customer — no gate needed

  const custPhone = (parseIntentParams(matches[0][1]).phone || '').trim()
  return { type: 'add_sale' as const, customerName: custName, phone: custPhone, items }
}

function parseIntentParams(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  raw.split(',').forEach(pair => {
    const [k, ...rest] = pair.split('=')
    if (k) result[k.trim().toLowerCase()] = normalizeDigits(rest.join('=').trim())
  })
  return result
}

// Guesses a Dokan Manager stock category from an item name, matching the
// exact category pill labels in DEFAULT_DOKAN_CATS (src/components/DokanManagerUI.tsx).
// Falls back to 'অন্যান্য' (Other) when nothing matches.
function guessDokanCategory(name: string): string {
  const n = (name || '').toLowerCase()
  const rules: [RegExp, string][] = [
    [/rice|chal|চাল|dal|ডাল|dail|masur|mosur|mung|মুগ|gram|ছোলা|chola/i, 'চাল-ডাল'],
    [/\boil\b|tel|তেল|mosla|মশলা|spice|jeera|jira|জিরা|holud|হলুদ|morich|মরিচ|\bsalt\b|লবণ|lobon|গোলমরিচ|elach|এলাচ/i, 'তেল-মশলা'],
    [/atta|ময়দা|moyda|\bflour\b|suji|সুজি|besan|বেসন/i, 'আটা-ময়দা'],
    [/\bcha\b|চা\b|\btea\b|chini|চিনি|\bsugar\b|gur|গুড়/i, 'চা-চিনি'],
    [/soap|সাবান|shampoo|শ্যাম্পু|detergent|surf|shabon|টুথপেস্ট|toothpaste/i, 'সাবান-শ্যাম্পু'],
    [/biscuit|বিস্কুট|chocolate|চকোলেট|choco|candy|toffee|টফি/i, 'বিস্কুট-চকোলেট'],
    [/\begg\b|ডিম|\bdim\b|\bfish\b|মাছ|\bmach\b|\bmeat\b|মাংস|mangsho|chicken|মুরগি|murgi/i, 'ডিম-মাছ-মাংস'],
    [/vegetable|সবজি|sobji|potato|আলু|\balu\b|onion|পেঁয়াজ|peyaj|tomato|টমেটো|\bfruit\b|ফল|\bfol\b|apple|আপেল|banana|কলা|kola/i, 'সবজি-ফল'],
    [/\bwater\b|পানি|\bpani\b|juice|জুস|cold drink|coke|pepsi|\bdrink\b|পানীয়/i, 'পানীয়'],
    [/\bpen\b|কলম|\bcopy\b|খাতা|notebook|pencil|পেন্সিল|স্টেশনারি/i, 'স্টেশনারি'],
  ]
  for (const [re, cat] of rules) if (re.test(n)) return cat
  return 'অন্যান্য'
}

function detectAgentType(agentSlug: string): string {
  if (agentSlug.includes('kapor')) return 'kapor'
  if (agentSlug.includes('mishti')) return 'mishti'
  if (agentSlug.includes('hotel') || agentSlug.includes('dhaba')) return 'hotel'
  if (agentSlug.includes('dokan') || agentSlug.includes('crm')) return 'dokan'
  if (agentSlug.includes('pharmacy') || agentSlug.includes('farme')) return 'pharmacy'
  return 'general'
}

export async function POST(req: NextRequest) {
  try {
    const { messages, agentSlug, businessName, agentName, previousRefs, confirmAction, focus } = await req.json()
    // The caller is taken from the signed-in session (Authorization: Bearer <token>),
    // NOT from the request body — a userId in the body could be anyone's.
    const callerId = await getCallerId(req)
    if (!callerId) {
      return NextResponse.json({
        content: '⚠️ আপনার সেশন শেষ হয়ে গেছে। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।',
        dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null,
      }, { status: 401 })
    }

    const agentType = detectAgentType(agentSlug || '')

    // ── Enterprise team access ───────────────────────────────────────
    // Resolves whether the caller is a normal owner (full access to their
    // own data — the vast majority of accounts) or a restricted employee
    // logged into an enterprise owner's team. For a normal single-user
    // account this is a no-op: access.ownerId === callerId and every
    // agent is allowed, so `userId` below is unchanged from before this
    // feature existed. For a restricted employee, this blocks the
    // request if they weren't granted this specific agent, and — for a
    // request that IS allowed — points every data read/write for the
    // rest of this function at the OWNER's account, not the employee's
    // own (empty) one, since the employee is working inside the owner's
    // business, not a separate business of their own.
    let userId: string | undefined = callerId
    let scope: Scope = 'all'
    let actorRole = 'owner'
    if (callerId) {
      const access = await resolveEffectiveAccess(getServiceClient(), callerId)
      actorRole = access.role
      // Role limits (sales-only / stock-only) combined with the owner's optional focus filter.
      scope = effectiveScope(access.role, focus)
      const libraryRef = (LIBRARY_AGENT_SLUGS as Record<string, string>)[agentType]
      if (libraryRef && !canAccessAgent(access, 'library', libraryRef)) {
        return NextResponse.json({
          content: '⚠️ এই এজেন্টে আপনার অ্যাক্সেস নেই। মালিকের সাথে যোগাযোগ করুন।',
          dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null,
        }, { status: 403 })
      }
      userId = access.ownerId
    }

    // ── The owner tapped "সেভ করুন" on a confirmation card ──────────
    if (confirmAction) {
      const confirmClass = confirmAction.type === 'add_sale' ? 'sales' : 'stock'
      if (!classAllowed(confirmClass, scope)) {
        return NextResponse.json({ content: deniedMessage(scope), dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
      }
      if (!userId || agentType !== 'dokan') return NextResponse.json({ content: '⚠️ এই কাজটি এখানে সমর্থিত নয়।', dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
      const result = confirmAction.type === 'add_sale'
        ? await executeDokanSale(getServiceClient(), userId, confirmAction)
        : await executeDokanAction(getServiceClient(), userId, confirmAction)
      if (!result.ok) {
        await logChatFailure({ userId, agentSlug, message: JSON.stringify(confirmAction).slice(0, 500), reply: result.content, reason: result.dbError ? 'db_error' : 'invalid_confirm' })
      }
      if (result.ok) await logAiActivity({ ownerId: userId, actorId: callerId, actorRole, agentSlug, kind: confirmClass, text: String(result.content || '').split('\n')[0] })
      return NextResponse.json({ content: result.content, dataWritten: !!result.ok, customerSaved: false, dataRefs: [], mishtiAction: null })
    }

    if (!messages?.length) return NextResponse.json({ content: 'কোনো বার্তা পাওয়া যায়নি।' })

    // Role guard on what is being ASKED, before any business data is loaded.
    {
      const denied = scopeDenied(stripImageContext(messages[messages.length - 1]?.content || ''), scope)
      if (denied) return NextResponse.json({ content: denied, dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
    }

    // ── Dokan "add stock": propose first, write only after confirmation ──
    if (userId && agentType === 'dokan' && classAllowed('stock', scope)) {
      const lastRaw = stripImageContext(messages[messages.length - 1]?.content || '')
      const proposal = await proposeDokanStock(getServiceClient(), userId, lastRaw)
      if (proposal) {
        return NextResponse.json({ content: proposal.content, pendingAction: proposal.pending, dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
      }
    }
    if (userId && (agentType === 'kapor' || agentType === 'mishti' || agentType === 'hotel') && classAllowed('stock', scope)) {
      const lastRaw = stripImageContext(messages[messages.length - 1]?.content || '')
      const proposal = await proposeVerticalStock(getServiceClient(), userId, lastRaw, agentType)
      if (proposal) {
        return NextResponse.json({ content: proposal.content, pendingAction: proposal.pending, dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
      }
    }
    if (userId && (agentType === 'dokan' || agentType === 'kapor' || agentType === 'mishti') && classAllowed('sales', scope)) {
      const bad = await unknownSaleProductReply(getServiceClient(), userId, stripImageContext(messages[messages.length - 1]?.content || ''), agentType)
      if (bad) return NextResponse.json({ content: bad, dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
    }
    let contextStr = ''
    let productMatchNote = ''
    let customerMatchNote = ''

    if (userId && agentType !== 'general') {
      try {
        const supabase = getServiceClient()
        const lastUserMsg = messages[messages.length - 1]?.content || ''
        const [text, names, custNames] = await Promise.all([
          fetchBusinessData(supabase, userId, agentType),
          fetchProductNames(supabase, userId, agentType),
          fetchCustomerNames(supabase, userId, agentType),
        ])
        contextStr = text
        productMatchNote = buildProductMatchNote(lastUserMsg, names)
        customerMatchNote = buildCustomerMatchNote(lastUserMsg, custNames)
      } catch (e) {
        console.error('DB fetch error:', e)
        contextStr = '(ডেটাবেজ থেকে তথ্য আনতে সমস্যা হয়েছে)'
      }
    }

    const systemPrompt = `তুমি "${businessName || agentName || 'ব্যবসা'}" এর একজন বিশেষজ্ঞ বাংলা AI সহায়ক।

কঠোর নিয়ম:
১. শুধুমাত্র নিচের REAL DATA থেকে উত্তর দাও
২. Data-তে নেই এমন কোনো সংখ্যা বা তথ্য বানিয়ে বলবে না
৩. যদি জানতে না পারো, বলো "এই তথ্য আমার কাছে নেই"
৪. সবসময় বাংলায় উত্তর দাও
৫. সংক্ষিপ্ত ও সুনির্দিষ্ট উত্তর দাও
৬. টাকার হিসাব সবসময় exact সংখ্যা দাও
৭. ভাষা যেকোনো হতে পারে — বাংলা হরফ, Banglish (রোমান হরফে বাংলা), বা English — সব বোঝার চেষ্টা করো এবং সঠিকভাবে বাংলায় উত্তর দাও।
৮. ⚠️ CRITICAL — এই নিয়মটা শুধু তখনই প্রযোজ্য যখন user স্টক সম্পর্কে জিজ্ঞাসা করছে (যেমন "X আছে?", "X-এর দাম কত?")। এই ক্ষেত্রে, কখনো দুটো আলাদা পণ্যকে গুলিয়ে ফেলবে না শুধু বানান/উচ্চারণ কাছাকাছি বলে। যেমন: "লাউ" (bottle gourd) আর "আলু" (potato) — সম্পূর্ণ আলাদা পণ্য, একই জিনিস নয়। user যে পণ্যের নাম জিজ্ঞাসা করেছে সেটা REAL DATA-তে হুবহু বা প্রায়-হুবহু না থাকলে, কাছাকাছি বানানের অন্য পণ্য দিয়ে উত্তর দিও না — স্পষ্ট করে বলো "[যে নাম বলেছে] আমাদের স্টকে নেই", তারপর ইচ্ছা করলে জিজ্ঞেস করো user হয়তো অন্য পণ্যের কথা বলছে কিনা।
   ⚠️ এই নিয়মটা "নতুন পণ্য যোগ করা"-তে প্রযোজ্য নয়। user যখন বলে "X যোগ করো / stock a X add koro / X কিনেছি" — এটা নতুন পণ্য যোগ করার কমান্ড, প্রশ্ন নয়। এক্ষেত্রে REAL DATA-তে সেই পণ্য না থাকা স্বাভাবিক ও প্রত্যাশিত (কারণ তুমি সেটাই এখন যোগ করছ) — "X আমাদের স্টকে নেই" বলে reject কোরো না, বরং [DOKAN_ADD_PRODUCT: ...] ট্যাগ দিয়ে নতুন পণ্য হিসেবে যোগ করো।
৯. নিচে "পণ্যের নাম যাচাই" নামে একটা ব্লক থাকতে পারে — এটা কোড দিয়ে (AI ছাড়া) যাচাই করা, তাই এটাই পণ্যের নাম মেলানোর একমাত্র নির্ভরযোগ্য উৎস (স্টক সম্পর্কে প্রশ্নের ক্ষেত্রে)। এই ব্লক যা বলে তার বিপরীতে নিজের অনুমান দিয়ে কখনো উত্তর দিও না। কিন্তু এটাও নতুন পণ্য যোগ করাকে block করে না — user যখন সরাসরি নতুন পণ্য যোগ করতে বলছে, তখন এই ব্লকে "নেই" লেখা থাকলেও স্বাভাবিকভাবে [DOKAN_ADD_PRODUCT: ...] দিয়ে যোগ করো।
১০. একইভাবে "খদ্দেরের নাম যাচাই" ব্লক থাকতে পারে — দুইজন ভিন্ন খদ্দেরকে নাম কাছাকাছি বলে এক ভেবো না (যেমন "রিতা মণ্ডল" আর "গীতা মণ্ডল")। নতুন কোনো নাম শুনলে এবং তালিকায় হুবহু মিল না থাকলে, সেটাকে নতুন খদ্দের হিসেবেই ধরে নাও, পুরনো কোনো নামের সাথে জোর করে মেলাবে না।
১১. ⚠️ কখনো markdown টেবিল (| pipe | দিয়ে সারি-কলাম) ব্যবহার কোরো না — চ্যাটে এটা ভাঙা/অগোছালো দেখায়, বিশেষ করে ফোনে। কেউ "সব স্টক দেখাও", "সব খদ্দের বলো", "আজকের সব বিক্রি" — এই ধরনের একাধিক আইটেমের তালিকা চাইলে, একটা বিল/রসিদের মতো সাজিয়ে দাও:
[তালিকার শিরোনাম, ইমোজি সহ যেমন 📦 আজকের স্টক]
১. পণ্যের নাম — পরিমাণ একক, ₹দাম/একক
২. পণ্যের নাম — পরিমাণ একক, ₹দাম/একক
(প্রতিটি নতুন লাইনে, নম্বর দিয়ে, কোনো pipe/টেবিল ছাড়া)
প্রাসঙ্গিক হলে শেষে একটা সারাংশ লাইন দাও (যেমন মোট আইটেম সংখ্যা, বা কম স্টকে থাকা পণ্য কয়টা)।

== ডেটা লেখার নিয়ম (WRITE-BACK) ==
তোমাকে অবশ্যই উত্তরের একেবারে শেষে, আলাদা লাইনে, নিচের নিয়ম অনুযায়ী tag যোগ করতে হবে:

${agentType === 'kapor' ? `কাপড়ের দোকান:
নতুন বিক্রি: [ADD_SALE: item=পণ্যের নাম, qty=পরিমাণ, price=দাম, customer=খদ্দের, paid=পরিশোধ]
স্টক আপডেট: [UPDATE_STOCK: item=পণ্যের নাম, qty=নতুন পরিমাণ]
নতুন পণ্য: [ADD_PRODUCT: name=নাম, category=ক্যাটাগরি, price=বিক্রয়মূল্য, stock=স্টক, size=সাইজ]
নতুন খদ্দের: [ADD_CUSTOMER: name=নাম, phone=ফোন, address=ঠিকানা, notes=নোট]
উদাহরণ — "রামবাবুকে ২ পিস লাল শাড়ি ৮০০ টাকায় বেচেছি":
[ADD_SALE: item=লাল শাড়ি, qty=2, price=400, customer=রামবাবু, paid=800]
উদাহরণ — "রামবাবু নামে নতুন খদ্দের যোগ করো, ফোন 9876000000":
[ADD_CUSTOMER: name=রামবাবু, phone=9876000000, address=, notes=]` : ''}


${agentType === 'dokan' ? `মুদিখানা / জেনারেল দোকান — WRITE TAG নিয়ম:

⚠️ CRITICAL: শুধুমাত্র নিচের পরিস্থিতিতে tag দাও। প্রশ্ন, জিজ্ঞাসা, রিপোর্ট, "কি আছে", "দেখাও", "কত" — এই ধরনের বার্তায় কোনো tag দেবে না।

✅ tag দাও শুধুমাত্র যখন user স্পষ্টভাবে ADD / SELL / UPDATE বলছে:

নতুন পণ্য স্টকে যোগ (add/যোগ/নতুন শব্দ থাকলে):
[DOKAN_ADD_PRODUCT: name=পণ্যের নাম, category=চাল-ডাল, unit=কেজি, stock=পরিমাণ, price=বিক্রয়মূল্য, cost=ক্রয়মূল্য, min_stock=ন্যূনতম]

বিক্রি লগ (sell/বেচ/বিক্রি শব্দ থাকলে):
[DOKAN_ADD_SALE: item=পণ্যের নাম, qty=পরিমাণ, unit=কেজি, price=দর, customer=খদ্দেরের নাম, paid=পরিশোধ]

স্টক আপডেট (update/পরিবর্তন শব্দ থাকলে):
[DOKAN_UPDATE_STOCK: item=পণ্যের নাম, qty=নতুন পরিমাণ]

নতুন খদ্দের (add customer/খদ্দের যোগ শব্দ থাকলে):
[DOKAN_ADD_CUSTOMER: name=নাম, phone=ফোন, address=ঠিকানা, notes=নোট]

উদাহরণ — "dehradun rice 200kg stock a add koro mrp per kg 65" → tag দাও:
[DOKAN_ADD_PRODUCT: name=Dehradun Rice, category=চাল-ডাল, unit=কেজি, stock=200, price=65, cost=55, min_stock=20]

উদাহরণ — "rambabu ke 5 kg chal 65 taka te bechhi" → tag দাও:
[DOKAN_ADD_SALE: item=Dehradun Rice, qty=5, unit=কেজি, price=65, customer=রামবাবু, paid=325]

উদাহরণ — "ajker stock a ki ki ache?" → কোনো tag নেই, শুধু উত্তর দাও
উদাহরণ — "amar dokan er total biki koto?" → কোনো tag নেই, শুধু উত্তর দাও
উদাহরণ — "stock dekhao" → কোনো tag নেই, শুধু উত্তর দাও

উদাহরণ — "soumi halder 1 ltr sorser tel kineche and rice 1kg kineche phone 7600099800" → দুটো আলাদা SALE tag দাও (এখানে কোনো জমার কথা বলা হয়নি, তাই পুরো দামই ধরে নাও পরিশোধ হয়েছে, তাই paid=দাম):
[DOKAN_ADD_SALE: item=Sorser Tel, qty=1, unit=লিটার, price=150, customer=soumi halder, paid=150]
[DOKAN_ADD_SALE: item=Dehradun Rice, qty=1, unit=কেজি, price=65, customer=soumi halder, paid=65]
[DOKAN_ADD_CUSTOMER: name=soumi halder, phone=7600099800, address=kolkata, notes=]

⚠️ CRITICAL — একাধিক পণ্য + একটিমাত্র মোট জমা/পেমেন্ট থাকলে (এটা সবচেয়ে বেশি ভুল হওয়া জায়গা):
যদি একটি মেসেজে একাধিক পণ্য কেনা হয় (একাধিক DOKAN_ADD_SALE tag লাগবে) কিন্তু user শুধু একটিমাত্র মোট "জমা/দিয়েছে/paid" পরিমাণ বলে (প্রতিটি পণ্যের জন্য আলাদা করে বলেনি), তাহলে প্রতিটি item-এ কখনোই paid=সেই item-এর পুরো দাম বসাবে না (এতে ভুলভাবে "সম্পূর্ণ পরিশোধ" দেখাবে, যদিও আসলে বাকি আছে)। বরং সেই একটিমাত্র মোট জমার পরিমাণ item-গুলোর মধ্যে ক্রমানুসারে ভাগ করো (প্রথম item-এ যতটা যায় ততটা বসাও, বাকিটা পরের item-এ, এভাবে চালিয়ে যাও) — যতক্ষণ না পুরো জমার টাকা শেষ হয়ে যায়, তারপরের item-গুলোতে paid=0 বসাও। সব tag মিলিয়ে মোট paid = user-এর বলা মোট জমার সমান হতে হবে, একটি টাকাও বেশি না।

উদাহরণ — "shilpa raw 4 kg chal r 5 kg peyaj kineche, 200 taka diyeche" (চাল ৬০ টাকা/কেজি, পেঁয়াজ ৬০ টাকা/কেজি ধরে):
চাল: ৪ × ৬০ = ২৪০ টাকা। পেঁয়াজ: ৫ × ৬০ = ৩০০ টাকা। মোট = ৫৪০ টাকা। মোট জমা মাত্র ২০০ টাকা — এটা প্রথম item (চাল)-এর ২৪০ টাকা দামের মধ্যেই পুরোটা শেষ, তাই চাল-এ paid=200 (বাকি ৪০), আর পেঁয়াজে paid=0 (পুরো ৩০০ বাকি):
[DOKAN_ADD_SALE: item=চাল, qty=4, unit=কেজি, price=60, customer=shilpa, paid=200]
[DOKAN_ADD_SALE: item=পেঁয়াজ, qty=5, unit=কেজি, price=60, customer=shilpa, paid=0]
(ভুল হবে যদি দুটো tag-এই paid=240 এবং paid=300 বসাও — তাহলে মোট বাকি ৩৪০ টাকা হওয়ার বদলে ভুলভাবে "সম্পূর্ণ পরিশোধ" দেখাবে)

মনে রাখো: "ajker/আজকের" মানে শুধু "today" — যদি কেউ কিনেছে/bechhi/kineche বলে, সেটি বিক্রির তথ্য, tag দাও।

উদাহরণ — শব্দের ক্রম উল্টাপাল্টা বা সংক্ষিপ্ত ইউনিট (p = পিস/piece) হলেও বুঝে tag দাও:
"Ajker lau add koro 20 p stock a 20 taka per p lau" → এটা "লাউ" নামের পণ্য, ২০ পিস স্টকে যোগ, দাম প্রতি পিস ২০ টাকা:
[DOKAN_ADD_PRODUCT: name=Lau, category=সবজি, unit=পিস, stock=20, price=20, cost=0, min_stock=5]

উদাহরণ — REAL DATA-তে যে পণ্যের নাম নেই, সেটা কাছাকাছি বানানের অন্য পণ্য দিয়ে গুলিয়ে ফেলবে না:
user: "Lau ki jano? আমাদের স্টকে লাউ আছে?" (REAL DATA-তে শুধু "আলু" আছে, "লাউ" নেই) →
"না, আমাদের বর্তমান স্টকে লাউ নেই। আলু আছে ৮৬ কেজি, বিক্রয়মূল্য ৳৩০/কেজি — আপনি কি সেটার কথা বলছেন, নাকি লাউ স্টকে যোগ করতে চান?"
(ভুল হবে যদি "লাউ" আর "আলু"-কে একই পণ্য ধরে নাও এবং আলুর তথ্য দিয়ে বলো এটাই লাউ)` : ''}


${agentType === 'hotel' ? `হোটেল / ধাবা ম্যানেজার — WRITE TAG নিয়ম:

⚠️ CRITICAL: শুধুমাত্র user স্পষ্টভাবে ADD/ORDER/SELL/UPDATE বলছে তখনই tag দাও। প্রশ্ন / রিপোর্ট / দেখাও — এই বার্তায় কোনো tag নেই।

নতুন অর্ডার (table/টেবিল/order শব্দ থাকলে):
[HOTEL_ADD_ORDER: table=টেবিল নং, customer=নাম, items=পদ১:qty১:দাম১|পদ২:qty২:দাম২, paid=পরিশোধ, notes=নোট]

অর্ডার পেমেন্ট/বন্ধ (paid/পরিশোধ/settle শব্দ থাকলে):
[HOTEL_PAY_ORDER: table=টেবিল নং, paid=পরিশোধ]

মেনুতে নতুন পদ (add menu/মেনু যোগ শব্দ থাকলে):
[HOTEL_ADD_MENU: name=পদের নাম, name_bn=বাংলা নাম, category=ভাত-রুটি, price=দাম, cost=ক্রয়মূল্য, is_veg=true]

স্টক আপডেট (stock/স্টক add/update শব্দ থাকলে):
[HOTEL_ADD_STOCK: name=উপাদান, category=চাল-ডাল, unit=কেজি, qty=পরিমাণ, min_qty=ন্যূনতম, cost=দাম]

নতুন খদ্দের (customer/খদ্দের add শব্দ থাকলে):
[HOTEL_ADD_CUSTOMER: name=নাম, phone=ফোন, address=ঠিকানা, notes=নোট]

উদাহরণ — "table 3 te 2 plate dal makhni 180 taka ar 3 roti 15 taka order diye gese":
[HOTEL_ADD_ORDER: table=টেবিল ৩, customer=অজানা, items=Dal Makhni:2:180|Roti:3:15, paid=0, notes=]

উদাহরণ — "table 3 paid kore dilo 405 taka":
[HOTEL_PAY_ORDER: table=টেবিল ৩, paid=405]

উদাহরণ — "menu te chicken curry add koro price 180 taka":
[HOTEL_ADD_MENU: name=Chicken Curry, name_bn=চিকেন কারি, category=মাংস, price=180, cost=120, is_veg=false]

উদাহরণ — "chaler stock 50kg add koro cost 55 per kg":
[HOTEL_ADD_STOCK: name=Chal, category=চাল-ডাল, unit=কেজি, qty=50, min_qty=10, cost=55]

প্রশ্ন/রিপোর্টে কোনো tag নেই:
"aajker order ki ki ache?" → শুধু উত্তর দাও
"total biki koto?" → শুধু উত্তর দাও` : ''}

${agentType === 'mishti' ? `মিষ্টির দোকান:
নতুন মিষ্টি স্টকে যোগ করতে: [MISHTI_ADD_ITEM: name=Rosogolla, name_bn=রসগোল্লা, category=রসের মিষ্টি, price=15, cost=8, stock=200]
বিক্রি লগ করতে: [MISHTI_ADD_SALE: item=রসগোল্লা, qty_kg=2, price=300, customer=রামবাবু, paid=600]
উৎপাদন লগ করতে: [MISHTI_ADD_PRODUCTION: item=রসগোল্লা, qty_kg=5]
নতুন খদ্দের যোগ করতে: [MISHTI_ADD_CUSTOMER: name=নাম, phone=ফোন, address=ঠিকানা, notes=নোট]
উদাহরণ — "rosogolla add koro stock 200 pic sell 15 taka per pic":
[MISHTI_ADD_ITEM: name=Rosogolla, name_bn=রসগোল্লা, category=রসের মিষ্টি, price=15, cost=8, stock=200]
উদাহরণ — "আজ রামবাবুকে ২ কেজি রসগোল্লা ৩০০ টাকায় বেচেছি":
[MISHTI_ADD_SALE: item=রসগোল্লা, qty_kg=2, price=150, customer=রামবাবু, paid=300]` : ''}

IMPORTANT: tag টি সবসময় উত্তরের একেবারে শেষে দাও, আলাদা লাইনে। tag ছাড়া উত্তর অসম্পূর্ণ।

${productMatchNote}${customerMatchNote}${contextStr ? `\n== এই ব্যবসার REAL DATA (শুধু এখান থেকে উত্তর দাও) ==\n${contextStr}\n== DATA শেষ ==` : '\n(এই user-এর কোনো data এখনো নেই)'}

সতর্কতা: উপরের data-তে যা নেই তা কখনো বলবে না। অনুমান করবে না।`

    const history = messages
      .filter((_: any, i: number) => i > 0)
      .map((m: any) => ({ role: m.role, content: m.content }))

    const finalMessagesRaw = history.length > 0 ? history : [{ role: 'user', content: messages[messages.length - 1]?.content || 'হ্যালো' }]
    // The model (and every parser below) sees "5", never "৫" / "পাঁচ".
    const finalMessages = finalMessagesRaw.map((m: any, i: number) =>
      i === finalMessagesRaw.length - 1 && m.role === 'user' ? { ...m, content: normalizeMessage(String(m.content || '')) } : m)

    const hasPhoto = (messages[messages.length - 1]?.content || '').includes(IMAGE_CTX_MARK)
    const photoNote = hasPhoto ? `

PHOTO DATA: the user's last message is followed by [ATTACHED_IMAGE_DATA …] — items read from a photo they sent (name | qty | rate | amount | sku | existing_product or new_product, optional party=customer/supplier).
- Words like "এগুলো / এই পণ্যগুলো / ছবির / these / ei gulo" mean THESE items. Do exactly what the user typed (add to stock / sell or bill / write as baki), once per item, using the item's own qty, unit and rate.
- If an item has existing_product="X", use X's exact name. Use the photo's party as the customer unless the user names someone else; if the user wants a bill/baki and no customer is known, ASK for the customer name instead of guessing.
- Never act on the photo data unless the user asked for something. Never invent quantities or prices that are not in it.` : ''
    const scopeNote = scope === 'stock'
      ? '\n\nROLE LIMIT: this user may ONLY manage STOCK. Never create sales, customers, dues/baki, invoices or reports — politely say it is outside their role.'
      : scope === 'sales'
        ? '\n\nROLE LIMIT: this user may ONLY handle SALES, CUSTOMERS, DUES (baki) and BILLING. Never add or change stock/products — politely say it is outside their role.'
        : ''
    const rawContent = await tryGroq(systemPrompt + scopeNote + photoNote, finalMessages)
    const gated = stripForbiddenTags(rawContent, scope)
    const content = gated.text
    const scopeBlocked = gated.blocked.length > 0

    // ── Write-back ──────────────────────────────────────────────────
    // PRIORITY ORDER MATTERS: the AI's own structured tags (e.g.
    // [DOKAN_ADD_PRODUCT: name=Onion, ...], [DOKAN_ADD_CUSTOMER: name=Rahim, ...])
    // are parsed by an LLM that read the full free-form sentence, so it correctly
    // separates "onion" from "stock a add koro onion 100kg selling price 60 taka
    // per kg" and correctly extracts a customer's name from natural phrasing that
    // doesn't use a literal "name=" format. The hand-written regex/keyword
    // matchers below this block are a *fallback only*, for the rare case where
    // the model doesn't emit a usable tag — they intentionally cover a narrower
    // set of fixed phrasings and are much more likely to mis-extract a name.
    // Running them first (as this used to) meant a garbled regex match could
    // "win" over a perfectly good AI-parsed tag, which is what caused items
    // like "Stock a add koro onion" (instead of "onion") to get saved, and
    // caused customer-add messages that didn't literally contain "name=" to
    // silently do nothing. So: try the tag parser first, then fall back.
    let dataWritten = false
    let customerSaved = false
    let dataRefsOut: any[] = []
    let directWriteOverride = false
    // When the regex fallback (not the AI tag parser) makes a write, we echo
    // back exactly what got saved instead of a generic "সেভ করা হয়েছে ✅" —
    // that way a bad extraction (wrong name, wrong qty) is visible immediately
    // instead of being hidden behind a success message.
    let savedSummary = ''
    let failReason = ''
    let dbWriteError = false // true when a write was attempted but the database rejected it
    const userMsg = normalizeMessage(stripImageContext(finalMessages[finalMessages.length - 1]?.content || '')).toLowerCase()

    if (userId && agentType !== 'general' && !scopeBlocked) {
      try {
         const supabaseClient = getServiceClient()

        // ── Dokan sale to a genuinely NEW customer: hold for confirmation ──
        // (existing/known customers skip this and save instantly, below)
        if (agentType === 'dokan') {
          const salePending = await checkNewSaleCustomer(supabaseClient, userId, content)
          if (salePending) {
            const itemsTxt = salePending.items.map((it: any) => `${it.name} ${it.qty}${it.unit}`).join(', ')
            const proposalContent = `📝 বুঝেছি: **${salePending.customerName}** — ${itemsTxt}।\nএটা নতুন খদ্দের মনে হচ্ছে — নিচে দেখে নিন, ভুল থাকলে ঠিক করে **সেভ করুন** চাপুন।`
            return NextResponse.json({ content: proposalContent, pendingAction: salePending, dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
          }
        }

        // ── Primary: AI tag-based write-back ──────────────────────────
        {
          const result = await parseAndWriteBack(supabaseClient, userId, agentType, content, userMsg, previousRefs || [])
          if (result.blocked) {
            return NextResponse.json({ content: '⚠️ সংখ্যাগুলো (পরিমাণ/দাম) পরিষ্কার শুনতে পারিনি, তাই কিছু সেভ করিনি। আবার বলুন বা লিখুন — যেমন: "শার্ট ২০ পিস ৪৫০ টাকা"।', dataWritten: false, customerSaved: false, dataRefs: [], mishtiAction: null })
          }
          dataWritten = result.wrote
          customerSaved = result.customerSaved
          dataRefsOut = result.dataRefs

          // Grounded bill — built from the actual numbers the write just
          // used (stock-price-corrected), not the model's own sentence, so
          // a wrong price/total/বাকি would be visible right in the chat
          // instead of only surfacing later on the dashboard. One message
          // can log several items for the same customer (e.g. "soumi 1kg
          // chal ar 1ltr tel") — those are grouped into a single itemized
          // bill with one grand total, instead of one separate confirmation
          // line per item, so it reads like a real receipt. A message that
          // happens to name more than one customer still gets one bill
          // block per customer, each with its own item lines and total.
          const saleRefs = dataRefsOut.filter((r: any) => r.type === 'dokan_sale')
          if (saleRefs.length > 0) {
            const byCustomer = new Map<string, any[]>()
            for (const ref of saleRefs) {
              const who = ref.custName && ref.custName !== 'নগদ' ? ref.custName : 'নগদ বিক্রি'
              if (!byCustomer.has(who)) byCustomer.set(who, [])
              byCustomer.get(who)!.push(ref)
            }
            const bnDigits = (n: number) => n.toLocaleString('bn-IN')
            savedSummary = [...byCustomer.entries()].map(([who, refs]) => {
              const itemLines = refs.map((r: any, i: number) =>
                `${i + 1}. ${r.itemName} — ${r.qty}${r.unit} × ₹${r.price} = ₹${bnDigits(r.total)}`
              ).join('\n')
              const grandTotal = refs.reduce((s: number, r: any) => s + Number(r.total || 0), 0)
              const grandPaid = refs.reduce((s: number, r: any) => s + Number(r.paid || 0), 0)
              const grandDue = refs.reduce((s: number, r: any) => s + Number(r.due || 0), 0)
              return `🧾 বিল — ${who}\n${itemLines}\n────────────\nমোট: ₹${bnDigits(grandTotal)}\nজমা: ₹${bnDigits(grandPaid)}`
                + (grandDue > 0 ? `\nবাকি: ₹${bnDigits(grandDue)}` : '\n✅ সম্পূর্ণ পরিশোধ')
            }).join('\n\n')
          }
        }

        // ── MISHTI: detect "add stock" intent from user message ──
        if (agentType === 'mishti' && !dataWritten) {
          const isAddIntent = /add|যোগ|stock|stok|stcok|নতুন|new/i.test(userMsg)

          if (isAddIntent) {
            const numbers = [...userMsg.matchAll(/(\d+)/g)].map(m => Number(m[1]))
            const qty = numbers.find(n => n >= 1) || 0
            const priceMatch = userMsg.match(/(?:sell|price|taka|tk|টাকা|per pic|per kg)\s*(\d+)|(\d+)\s*(?:taka|tk|টাকা)/i)
            const price = priceMatch ? Number(priceMatch[1] || priceMatch[2]) : (numbers[1] || 0)

            const mishtiNameMap: Record<string, [string, string]> = {
              'rosogolla': ['Rosogolla', 'রসগোল্লা'],
              'rasgulla': ['Rosogolla', 'রসগোল্লা'],
              'রসগোল্লা': ['Rosogolla', 'রসগোল্লা'],
              'sandesh': ['Sandesh', 'সন্দেশ'],
              'সন্দেশ': ['Sandesh', 'সন্দেশ'],
              'mishti doi': ['Mishti Doi', 'মিষ্টি দই'],
              'মিষ্টি দই': ['Mishti Doi', 'মিষ্টি দই'],
              'kalo jam': ['Kalo Jam', 'কালোজাম'],
              'kalojam': ['Kalo Jam', 'কালোজাম'],
              'কালোজাম': ['Kalo Jam', 'কালোজাম'],
              'pantua': ['Pantua', 'পান্তুয়া'],
              'পান্তুয়া': ['Pantua', 'পান্তুয়া'],
              'jalebi': ['Jalebi', 'জিলিপি'],
              'জিলিপি': ['Jalebi', 'জিলিপি'],
              'gulab jamun': ['Gulab Jamun', 'গুলাব জামুন'],
              'ladoo': ['Ladoo', 'লাড্ডু'],
              'লাড্ডু': ['Ladoo', 'লাড্ডু'],
              'chomchom': ['Chomchom', 'চমচম'],
              'চমচম': ['Chomchom', 'চমচম'],
              'kheer': ['Kheer', 'খির'],
              'malpua': ['Malpua', 'মালপোয়া'],
              'payesh': ['Payesh', 'পায়েস'],
            }

            let nameEn = '', nameBn = ''
            const lowerMsg = userMsg.toLowerCase()
            for (const [key, [en, bn]] of Object.entries(mishtiNameMap)) {
              if (lowerMsg.includes(key.toLowerCase())) {
                nameEn = en; nameBn = bn; break
              }
            }

            if (!nameEn) {
              const aiLower = content.toLowerCase()
              for (const [key, [en, bn]] of Object.entries(mishtiNameMap)) {
                if (aiLower.includes(key.toLowerCase())) {
                  nameEn = en; nameBn = bn; break
                }
              }
            }

            if (!nameEn) {
              const wordMatch = userMsg.match(/[a-z]{3,}/gi)
              const skipWords = ['add', 'koro', 'stock', 'stok', 'stcok', 'sell', 'pic', 'pcs', 'taka', 'per', 'new', 'korte', 'a']
              const nameWord = wordMatch?.find((w: string) => !skipWords.includes(w.toLowerCase()))
              if (nameWord) { nameEn = nameWord.charAt(0).toUpperCase() + nameWord.slice(1); nameBn = nameWord }
            }

            console.log(`[MISHTI WRITE] name=${nameEn} qty=${qty} price=${price} isAddIntent=${isAddIntent}`)

            if (nameEn && qty > 0) {
              try {
                const { data: existing } = await supabaseClient.from('mishti_items')
                  .select('id, stock_kg').ilike('name', nameEn).eq('user_id', userId).maybeSingle()
                let mErr: any = null
                if (existing) {
                  const r = await supabaseClient.from('mishti_items').update({ stock_kg: Number(existing.stock_kg) + qty }).eq('id', existing.id)
                  mErr = r.error
                } else {
                  const r = await supabaseClient.from('mishti_items').insert({
                    user_id: userId, name: nameEn, name_bn: nameBn,
                    category: 'অন্যান্য', price_per_kg: price, cost_per_kg: 0,
                    stock_kg: qty, min_stock_kg: 5, shelf_life_days: 2,
                    is_available: true, made_today_kg: 0, production_date: today(),
                  })
                  mErr = r.error
                }
                if (mErr) { console.error('[MISHTI WRITE] DB error:', mErr.message); dbWriteError = true }
                else {
                  dataWritten = true
                  console.log(`[MISHTI WRITE] SUCCESS dataWritten=true`)
                }
              } catch (e) { console.error('[MISHTI WRITE] DB error:', e) }
            }
          }
        }

        // ── MISHTI: detect "add customer" intent from user message ──
        if (agentType === 'mishti' && !dataWritten && !customerSaved) {
          const custKeywords = ['customer add', 'khaddher add', 'খদ্দের যোগ', 'নতুন খদ্দের', 'add customer', 'customer jog', 'কাস্টমার যোগ', 'কাস্টমার এড', 'নতুন কাস্টমার', 'খদ্দের এড', 'খদ্দের অ্যাড', 'কাস্টমার অ্যাড']
          const isCustIntent = custKeywords.some(k => userMsg.includes(k))
          if (isCustIntent) {
            const { name: custName, phone: custPhone, address: custAddress } = extractCustomerFields(userMsg)
            if (custName) {
              let alreadyExists = false
              if (custPhone) {
                const { data: existing } = await supabaseClient.from('mishti_customers')
                  .select('id').eq('user_id', userId).eq('phone', custPhone).maybeSingle()
                if (existing) alreadyExists = true
              }
              if (!alreadyExists) {
                const { error: ce } = await supabaseClient.from('mishti_customers').insert({
                  user_id: userId, name: custName, phone: custPhone,
                  address: custAddress, notes: '',
                  total_due: 0, total_spent: 0, last_purchase: today(), is_regular: false,
                })
                if (ce) { console.error('MISHTI cust direct error:', ce.message) }
                else { dataWritten = true; customerSaved = true }
              } else { dataWritten = true; customerSaved = true }
            }
          }
        }


        // ── DOKAN: detect "sale (+ customer)" intent from user message directly ──
        // Handles compound messages like:
        // "ajker shivaji halder, baba sham halder bari kolkata pin 700086
        //  aj rice kineche 3 kg taka joma diyeche 100 taka"
        // Best-effort regex — free-form sentences vary a lot, so this won't
        // catch every phrasing, but it removes the AI's tag-formatting as a
        // single point of failure for the most common shapes.
        if (agentType === 'dokan' && !dataWritten) {
          const saleKeywords = ['kineche', 'kinlo', 'kinechen', 'nilo', 'niyeche', 'beche', 'bikri', 'bechhi', 'কিনেছে', 'কিনেছেন', 'নিয়েছে', 'বিক্রি']
          const isSaleIntent = saleKeywords.some(k => userMsg.includes(k))

          if (isSaleIntent) {
            let itemName = ''
            let qty = 0
            let unit = 'কেজি'
            const itemBeforeVerb = userMsg.match(/([a-zA-Z\u0980-\u09FF]+)\s+(?:kineche|kinlo|kinechen|niyeche|nilo|কিনেছে|কিনেছেন|নিয়েছে)/i)
            const qtyMatch = userMsg.match(/(\d+(?:\.\d+)?)\s*(kg|কেজি|কিলো|litre|liter|লিটার|pic|pcs|piece|পিস|টি)/i)
            if (itemBeforeVerb) itemName = itemBeforeVerb[1].trim()
            if (qtyMatch) {
              qty = Number(qtyMatch[1])
              unit = /kg|কেজি|কিলো/i.test(qtyMatch[2]) ? 'কেজি' : /litre|liter|লিটার/i.test(qtyMatch[2]) ? 'লিটার' : 'পিস'
            }

            const paidMatch = userMsg.match(/(?:joma|জমা|advance|paid|dilo|দিল|dise|দিয়েছে)\D{0,15}(\d+(?:\.\d+)?)/i)
            const paid = paidMatch ? Number(paidMatch[1]) : 0

            let custName = ''
            const beforeBaba = userMsg.match(/(?:^|\s)(?:ajker|আজকের)?\s*([a-zA-Z\u0980-\u09FF]+(?:\s+[a-zA-Z\u0980-\u09FF]+)?)\s*,?\s*(?:baba|বাবা|father)/i)
            const beforeBari = userMsg.match(/(?:^|\s)(?:ajker|আজকের)?\s*([a-zA-Z\u0980-\u09FF]+(?:\s+[a-zA-Z\u0980-\u09FF]+)?)\s*,?\s*(?:bari|বাড়ি|address)/i)
            if (beforeBaba) custName = beforeBaba[1].trim()
            else if (beforeBari) custName = beforeBari[1].trim()

            const pinMatch = userMsg.match(/pin[:\s]*(\d{6})/i)
            const addrMatch = userMsg.match(/(?:bari|বাড়ি|address)[:\s]+([a-zA-Z\u0980-\u09FF]+)/i)
            const address = [addrMatch?.[1], pinMatch?.[1]].filter(Boolean).join(' ')
            const unitPrice = paid > 0 && qty > 0 ? Math.round((paid / qty) * 100) / 100 : 0

            if (itemName && qty > 0) {
              try {
                const { data: prod } = await supabaseClient.from('stock_items')
                  .select('id,current_qty').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
                  .ilike('item_name', `%${itemName}%`).maybeSingle()
                if (prod) {
                  await supabaseClient.from('stock_items')
                    .update({ current_qty: Math.max(0, Number(prod.current_qty) - qty) }).eq('id', prod.id)
                }

                const { error: saleErr } = await supabaseClient.from('daily_sales').insert({
                  user_id: userId, agent_id: DOKAN_AGENT_ID, sale_date: today(),
                  item_name: itemName.charAt(0).toUpperCase() + itemName.slice(1),
                  quantity: qty, unit_price: unitPrice,
                  notes: custName ? `খদ্দের: ${custName}` : '', source: 'chat',
                })
                if (saleErr) { console.error('DOKAN sale (direct) insert error:', saleErr.message) }
                else { dataWritten = true; directWriteOverride = true }

                if (custName) {
                  const { data: existCust } = await supabaseClient.from('crm_customers')
                    .select('id').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
                    .ilike('name', custName).maybeSingle()
                  let customerId: string | undefined = existCust?.id
                  if (!existCust) {
                    const { data: created, error: custErr } = await supabaseClient.from('crm_customers').insert({
                      user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan',
                      name: custName, address, source: 'chat',
                    }).select('id').single()
                    if (custErr) console.error('DOKAN sale->customer (direct) error:', custErr.message)
                    else { customerId = created?.id; customerSaved = true; directWriteOverride = true }
                  }
                  if (customerId) {
                    await supabaseClient.from('crm_purchases').insert({
                      user_id: userId, customer_id: customerId, purchase_date: today(),
                      item_name: itemName, quantity: qty, unit, unit_price: unitPrice,
                      paid_amount: paid, payment_status: paid > 0 ? 'paid' : 'pending', source: 'chat',
                    })
                  }
                }
              } catch (e) { console.error('DOKAN sale (direct) DB error:', e) }
            }
          }
        }

        // ── DOKAN: detect "add product/stock" intent from user message directly (more reliable than AI tags) ──
        if (agentType === 'dokan' && !dataWritten) {
          const addKeywords = [
            'add koro', 'যোগ করো', 'যোগ কর', 'add stock', 'new product', 'নতুন পণ্য',
            'stock a add', 'stock e add', 'stok a add', 'stoke add',
            'এড কর', 'অ্যাড কর', 'স্টকে এড', 'স্টকে অ্যাড', 'stoke এড', 'stoke অ্যাড',
          ]
          const isAddIntent = addKeywords.some(k => userMsg.includes(k))

          if (isAddIntent) {
            const qtyMatch = userMsg.match(/(\d+(?:\.\d+)?)\s*(kg|কেজি|কিলো|litre|liter|লিটার|pic|pcs|piece|পিস|টি)/i)
            const qty = qtyMatch ? Number(qtyMatch[1]) : 0
            const unit = qtyMatch
              ? (/kg|কেজি|কিলো/i.test(qtyMatch[2]) ? 'কেজি' : /litre|liter|লিটার/i.test(qtyMatch[2]) ? 'লিটার' : 'পিস')
              : 'কেজি'

            const priceMatch = userMsg.match(/(?:sell(?:ing)?\s*price|বিক্রয়\s*মূল্য|বিক্রি\s*মূল্য|বিক্রয়\s*দাম|bikroy|mrp|দাম)\D{0,15}(\d+(?:\.\d+)?)/i)
              || userMsg.match(/(\d+(?:\.\d+)?)\s*(?:taka|tk|টাকা|₹)\s*(?:per|\/|পার|প্রতি)/i)
            const price = priceMatch ? Number(priceMatch[1]) : 0

            const costMatch = userMsg.match(/(?:buy(?:ing)?\s*price|cost|(?<!বি)ক্রয়\s*মূল্য|(?<!বি)ক্রয়\s*দাম)\D{0,15}(\d+(?:\.\d+)?)/i)
            const cost = costMatch ? Number(costMatch[1]) : 0

            const productName = extractStockItemName(userMsg, qtyMatch?.[0])

            if (productName && qty > 0) {
              try {
                const { data: existing } = await supabaseClient.from('stock_items')
                  .select('id,current_qty').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
                  .ilike('item_name', productName).maybeSingle()
                if (existing) {
                  const { error: updErr } = await supabaseClient.from('stock_items').update({
                    current_qty: qty, sell_price: price || undefined, unit_cost: cost || undefined,
                  }).eq('id', existing.id)
                  if (updErr) { console.error('DOKAN product (direct) update error:', updErr.message); dbWriteError = true }
                  else {
                    dataWritten = true; directWriteOverride = true
                    savedSummary = `✅ ${productName} — স্টক ${qty} ${unit}${price ? `, বিক্রয়মূল্য ₹${price}/${unit}` : ''} আপডেট হয়েছে।`
                  }
                } else {
                  const cleanName = productName.charAt(0).toUpperCase() + productName.slice(1)
                  const { error: insErr } = await supabaseClient.from('stock_items').insert({
                    user_id: userId, agent_id: DOKAN_AGENT_ID,
                    item_name: cleanName,
                    category: guessDokanCategory(productName), unit, current_qty: qty, min_qty: 5,
                    sell_price: price, unit_cost: cost,
                  })
                  if (insErr) { console.error('DOKAN product (direct) insert error:', insErr.message); dbWriteError = true }
                  else {
                    dataWritten = true; directWriteOverride = true
                    savedSummary = `✅ ${cleanName} — ${qty} ${unit}${price ? `, বিক্রয়মূল্য ₹${price}/${unit}` : ''} স্টকে যোগ হয়েছে।`
                  }
                }
              } catch (e) { console.error('DOKAN product (direct) DB error:', e) }
            }
          }
        }

        // ── DOKAN: detect "add customer" intent from user message directly ──
        if (agentType === 'dokan' && !dataWritten && !customerSaved) {
          const custKeywords = ['customer add', 'khaddher add', 'খদ্দের যোগ', 'নতুন খদ্দের', 'add customer', 'customer jog', 'কাস্টমার যোগ', 'কাস্টমার এড', 'নতুন কাস্টমার', 'খদ্দের এড', 'খদ্দের অ্যাড', 'কাস্টমার অ্যাড']
          const isCustIntent = custKeywords.some(k => userMsg.includes(k))
          if (isCustIntent) {
            const { name: custName, phone: custPhone, address: custAddress } = extractCustomerFields(userMsg)
            if (custName) {
              let alreadyExists = false
              if (custPhone) {
                const { data: existing } = await supabaseClient.from('crm_customers')
                  .select('id').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID).eq('phone', custPhone).maybeSingle()
                if (existing) alreadyExists = true
              }
              if (!alreadyExists) {
                const cleanCustName = custName.charAt(0).toUpperCase() + custName.slice(1)
                const { error: custError } = await supabaseClient.from('crm_customers').insert({
                  user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan',
                  name: cleanCustName, phone: custPhone, address: custAddress, source: 'chat',
                })
                if (custError) console.error('DOKAN customer (direct) DB error:', custError.message)
                else {
                  dataWritten = true; customerSaved = true; directWriteOverride = true
                  savedSummary = `✅ খদ্দের ${cleanCustName}${custPhone ? ` (${custPhone})` : ''} যোগ হয়েছে।`
                }
              } else { dataWritten = true; customerSaved = true }
            }
          }
        }


        // ── KAPOR: detect "add product" intent from user message ──
        if (agentType === 'kapor' && !dataWritten) {
          const addKeywords = [
            'add koro', 'যোগ করো', 'যোগ কর', 'add stock', 'new product', 'নতুন পণ্য', 'stock a add', 'stok a add',
            'এড কর', 'অ্যাড কর', 'স্টকে এড', 'স্টকে অ্যাড',
          ]
          const isAddIntent = addKeywords.some(k => userMsg.includes(k))

          if (isAddIntent) {
            const qtyMatch = userMsg.match(/(\d+)\s*(pic|pcs|piece|পিস|টি)/i)
            const qty = qtyMatch ? Number(qtyMatch[1]) : 0
            const priceMatch = userMsg.match(/(?:sell|sell price|বিক্রি|mrp|taka|tk|₹)\s*(\d+)|(\d+)\s*(?:taka|tk|₹|টাকা)/i)
            const price = priceMatch ? Number(priceMatch[1] || priceMatch[2]) : 0
            const buyMatch = userMsg.match(/(?:buy|buying|cost|কিনেছি|ক্রয়)\s*(\d+)/i)
            const buyPrice = buyMatch ? Number(buyMatch[1]) : 0

            const productName = extractStockItemName(userMsg, qtyMatch?.[0])

            if (productName && qty > 0) {
              const cleanName = productName.charAt(0).toUpperCase() + productName.slice(1)
              const { error: kErr } = await supabaseClient.from('kapor_products').insert({
                user_id: userId, name: cleanName,
                category: 'অন্যান্য', size: 'ফ্রি সাইজ', color: '',
                stock_qty: qty, min_stock: 3,
                purchase_price: buyPrice, sell_price: price,
                supplier: '', is_available: true,
              })
              if (kErr) { console.error('KAPOR product (direct) insert error:', kErr.message); dbWriteError = true }
              else {
                dataWritten = true
                directWriteOverride = true
                savedSummary = `✅ ${cleanName} — ${qty} পিস${price ? `, বিক্রয়মূল্য ₹${price}` : ''} স্টকে যোগ হয়েছে।`
              }
            }
          }
        }

        // ── KAPOR: detect "add customer" intent from user message ──
        if (agentType === 'kapor' && !dataWritten && !customerSaved) {
          const custKeywords = ['customer add', 'khaddher add', 'খদ্দের যোগ', 'নতুন খদ্দের', 'add customer', 'customer jog', 'khaddher jog', 'কাস্টমার যোগ', 'কাস্টমার এড', 'নতুন কাস্টমার', 'খদ্দের এড', 'খদ্দের অ্যাড', 'কাস্টমার অ্যাড']
          const isCustIntent = custKeywords.some(k => userMsg.includes(k))

          if (isCustIntent) {
            const { name: custName, phone: custPhone, address: custAddress } = extractCustomerFields(userMsg)

            if (custName) {
              let alreadyExists = false
              if (custPhone) {
                const { data: existing } = await supabaseClient.from('kapor_customers')
                  .select('id').eq('user_id', userId).eq('phone', custPhone).maybeSingle()
                if (existing) alreadyExists = true
              }
              if (!alreadyExists) {
                const cleanCustName = custName.charAt(0).toUpperCase() + custName.slice(1)
                const { error: custError } = await supabaseClient.from('kapor_customers').insert({
                  user_id: userId,
                  name: cleanCustName,
                  phone: custPhone,
                  address: custAddress,
                  notes: '',
                  total_due: 0,
                  total_spent: 0,
                  last_visit: today(),
                })
                if (custError) {
                  console.error('KAPOR ADD_CUSTOMER (direct) DB error:', custError.message, custError.details)
                } else {
                  dataWritten = true
                  customerSaved = true
                  directWriteOverride = true
                  savedSummary = `✅ খদ্দের ${cleanCustName}${custPhone ? ` (${custPhone})` : ''} যোগ হয়েছে।`
                }
              } else {
                dataWritten = true
                customerSaved = true
              }
            }
          }
        }

      } catch (e) { console.error('Write-back error:', e) }
    }

    // Strip all intent tags from the response before sending to UI
    let cleanContent = content.replace(/\[(ADD_SALE|UPDATE_STOCK|ADD_PRODUCT|ADD_CUSTOMER|MISHTI_ADD_CUSTOMER|MISHTI_ADD_SALE|MISHTI_ADD_PRODUCTION|MISHTI_ADD_ITEM|DOKAN_ADD_PRODUCT|DOKAN_ADD_SALE|DOKAN_UPDATE_STOCK|DOKAN_ADD_CUSTOMER|HOTEL_ADD_ORDER|HOTEL_PAY_ORDER|HOTEL_ADD_MENU|HOTEL_ADD_STOCK|HOTEL_ADD_CUSTOMER)[\s\S]*?\]/gi, '').trim()

    // ── Never trust the model's own prose to report on database state ──
    // The model can — and does, occasionally — write a normal-sounding
    // "সঞ্জীব রয়কে নতুন খদ্দের হিসেবে যুক্ত করা হয়েছে।" (success!) sentence as
    // part of its reply even in the turns where it forgot to emit the
    // [DOKAN_ADD_CUSTOMER: ...] tag, or where the tag it emitted was
    // malformed and the insert never ran. Since `dataWritten`/`customerSaved`
    // are only ever set true after a real Supabase write actually succeeded
    // (see execWrite above), they are the one source of truth here — the
    // AI's own claim of success or failure is not. So for any message that
    // looks like it was trying to write something, the reply the user sees
    // is always regenerated from dataWritten, never taken from the model's
    // own sentence, whether that sentence claimed success or failure.
    // For ordinary questions (not a write attempt) the model's own answer
    // is kept as-is, since that's legitimately grounded in the REAL DATA
    // block injected into its context.
    // ── Never trust the model's own prose to report on database state ──
    // The model can — and does, occasionally — write a normal-sounding
    // "সঞ্জীব রয়কে নতুন খদ্দের হিসেবে যুক্ত করা হয়েছে।" (success!) sentence as
    // part of its reply even in the turns where it forgot to emit the
    // [DOKAN_ADD_CUSTOMER: ...] tag, or where the tag it emitted was
    // malformed and the insert never ran. Since `dataWritten`/`customerSaved`
    // are only ever set true after a real Supabase write actually succeeded
    // (see execWrite above), they are the one source of truth — the AI's own
    // claim of success or failure is not.
    //
    // Two narrow, evidence-based overrides, never a blanket one (a blanket
    // "any write-sounding word ⇒ override" rule would wrongly clobber real
    // answers to real questions like "আজকে কত বিক্রি হয়েছে" that happen to
    // contain a word like বিক্রি but were never a write attempt):
    //  1. A write genuinely happened (dataWritten) → always show a grounded
    //     confirmation instead of the model's own sentence, since a write
    //     only ever fires from an explicit keyword/tag match in the first
    //     place, so showing *some* confirmation is always correct here.
    //  2. Nothing was written, but the model's own sentence claims otherwise
    //     — either a false "এই তথ্য আমার কাছে নেই" (for what was actually a
    //     write command) or a false "...যোগ হয়েছে/সেভ হয়েছে" (claiming a
    //     save that never happened) — AND the user's message itself looked
    //     like a write attempt. Genuine answers to genuine questions never
    //     match these phrase patterns, so they pass through untouched.
    if (dataWritten) {
      cleanContent = savedSummary || 'ঠিক আছে, এটা সেভ করা হয়েছে। ✅'
    } else {
      const soundsLikeNoInfo = /এই তথ্য আমার কাছে নেই|তথ্য নেই|জানি না/i.test(cleanContent)
      const soundsLikeFalseSuccess = /যুক্ত করা হয়েছে|যোগ করা হয়েছে|সেভ করা হয়েছে|যোগ হয়েছে|আপডেট করা হয়েছে|successfully added|has been added|has been saved/i.test(cleanContent)
      const looksLikeWriteAttempt = /\b(add|koro|kore|kori|kineche|kinlo|kinechen|niyeche|nilo|beche|bechhi|bikri|sell|sold|bought|paid|dilo|dise)\b|যোগ|এড কর|এড করো|অ্যাড কর|অ্যাড করো|কিনেছে|নিয়েছে|পরিশোধ|দিয়েছে|নিলো|নিল|নিলেন|কিনলো|কিনল|কিনলেন|দিলো|দিলাম|দিয়েছি|বেচলাম|বেচেছি/i.test(userMsg)
      if (dbWriteError) {
        failReason = 'db_error'
        cleanContent = '⚠️ বার্তাটা বুঝেছি, কিন্তু ডেটাবেজে সেভ করা যায়নি। Supabase-এর টেবিল/পারমিশন (RLS) চেক করুন — সার্ভার লগে কারণ লেখা আছে।'
      } else if (looksLikeWriteAttempt && (soundsLikeNoInfo || soundsLikeFalseSuccess)) {
        failReason = 'not_understood'
        cleanContent = 'দুঃখিত, বার্তাটা পুরোপুরি বুঝতে পারিনি — তাই সেভ করা যায়নি। একটু সহজ করে লিখে দেখুন, যেমন:\n"আলু ১০০ কেজি যোগ করো, বিক্রয়মূল্য ৩০ টাকা/কেজি"\nবা: "রহিম ৫ কেজি চাল কিনেছে, ৩০০ টাকা দিয়েছে"\nবা: "খদ্দের যোগ করো রহিম, ফোন ৯৮৭৬৫৪৩২১০"'
      }
    }
    // Stripping tags could leave an empty bubble on some genuine-question
    // turns — never send back an empty string.
    if (!cleanContent) {
      failReason = failReason || 'empty_reply'
      cleanContent = 'দুঃখিত, ঠিক বুঝতে পারিনি। আবার একটু স্পষ্ট করে বলবেন?'
    }
    // Save every message the bot could not handle, so they can be reviewed and
    // turned into new rules / examples. Never blocks or breaks the reply.
    if (!failReason && !dataWritten && !customerSaved && /এই তথ্য আমার কাছে নেই|তথ্য নেই/.test(cleanContent)) failReason = 'no_info'
    if (failReason) {
      await logChatFailure({ userId, agentSlug, message: messages[messages.length - 1]?.content || '', normalized: userMsg, reply: cleanContent, reason: failReason })
    }

    if (scopeBlocked) { cleanContent = deniedMessage(scope); dataWritten = false; customerSaved = false }

    // Live "recent AI work" feed (best effort — never blocks the reply)
    if (userId && (dataWritten || customerSaved)) {
      const cls = gated.classes
      const kind = cls.includes('sales') ? 'sales' : cls.includes('stock') ? 'stock' : cls.includes('customer') ? 'customer' : 'other'
      await logAiActivity({ ownerId: userId, actorId: callerId, actorRole, agentSlug, kind, text: String(cleanContent || '').replace(/[*_`#]/g, '').split('\n')[0] })
    }

    // Also return the raw AI content tags so client can do its own insert if needed
    const mishtiItemTag = content.match(/\[MISHTI_ADD_ITEM:\s*([\s\S]*?)\]/i)
    const mishtiCustTag = content.match(/\[MISHTI_ADD_CUSTOMER:\s*([\s\S]*?)\]/i)
    const mishtiSaleTag = content.match(/\[MISHTI_ADD_SALE:\s*([\s\S]*?)\]/i)

    return NextResponse.json({
      content: cleanContent,
      dataWritten,
      customerSaved,
      // Row ids this specific reply wrote (dokan sale flow only, for now).
      // The frontend stores these against this chat message; if the user
      // later edits & resends that message, they come back as
      // `previousRefs` so the correction updates the same records instead
      // of creating duplicates.
      dataRefs: dataRefsOut,
      mishtiAction: mishtiItemTag ? { type: 'add_item', params: mishtiItemTag[1] }
        : mishtiCustTag ? { type: 'add_customer', params: mishtiCustTag[1] }
        : mishtiSaleTag ? { type: 'add_sale', params: mishtiSaleTag[1] }
        : null
    })

  } catch (error: any) {
    // Logged with name/message/stack so a Vercel log search for
    // "Business chat error:" shows what actually failed (Groq timeout,
    // rate limit, a bad JSON parse, a DB error, etc.) instead of only the
    // generic message the user sees below.
    console.error('Business chat error:', error?.name, error?.message, error?.stack)
    return NextResponse.json({ content: 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না।' })
  }
}
