// src/app/api/agent-chat/route.ts
// ─────────────────────────────────────────────────────────────────
// Universal chat route for USER-CREATED agents.
// Unlike /api/chat (which is dumb), this route:
//   1. Fetches the agent's real stored records from agent_records
//   2. Builds a rich Bengali context string from that data
//   3. Calls Groq AI with full context
//   4. Parses the AI response for write-back intents (new sale, stock update, etc.)
//   5. Saves new records to agent_records automatically
// ─────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { resolveEffectiveAccess, canAccessAgent } from '@/lib/teamAccess'
import { effectiveScope, scopeDenied, deniedMessage, classAllowed, type Scope } from '@/lib/chatPolicy'
import { parseMultiStock, detectIntent, toBulkItem, numbersPresent } from '@/lib/stockParser'

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createSbClient(url, key)
}

// What a SAVE block writes → who may write it. Anything not listed (e.g. expenses) is owner/admin only.
function saveTypeAllowed(type: string, scope: Scope): boolean {
  if (scope === 'all') return true
  const t = String(type || '').toLowerCase()
  const stock = ['stock', 'purchase', 'product', 'inventory']
  const sales = ['sale', 'sales', 'order', 'customer', 'credit', 'baki', 'due', 'payment', 'invoice']
  return scope === 'stock' ? stock.includes(t) : sales.includes(t)
}
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// ── Groq setup ────────────────────────────────────────────────
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
      temperature: 0.2,
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
  let lastError = ''
  for (const model of GROQ_MODELS) {
    try { return await callGroq(model, system, messages) }
    catch (err: any) {
      lastError = err.message
      console.error(`Model ${model} failed:`, err.message)
      continue
    }
  }
  throw new Error(`All Groq models failed: ${lastError}`)
}

// ── Fetch agent's real data ───────────────────────────────────
// FIX (cross-agent data leak): the 5 canonical tables below used to be
// filtered only by user_id — with more than one agent, that meant every
// agent's chat pulled in every OTHER agent's sales/expenses/dues/stock/
// customers too, so the numbers it reported here could silently disagree
// with this agent's own dashboard tab (which was already correctly
// scoped by agent_id — see dashboard/page.tsx). Now scoped the same way.
async function fetchAgentData(supabase: any, agentId: string, userId: string) {
  // IST-aware "today" — the server runs in UTC, which lags India local time
  // by up to 5.5h, so a plain toISOString() slice mislabels sales made
  // between 12:00–5:30 AM IST as "yesterday". See GenericBusinessManagerUI.tsx.
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

  const [recordsRes, settingsRes, salesRes, expensesRes, creditsRes, stockRes, crmRes] = await Promise.all([
    supabase.from('agent_records').select('*').eq('agent_id', agentId).eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('agent_settings').select('settings').eq('agent_id', agentId).eq('user_id', userId).single(),
    supabase.from('daily_sales').select('*').eq('user_id', userId).eq('agent_id', agentId).order('sale_date', { ascending: false }).limit(50),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('agent_id', agentId).order('expense_date', { ascending: false }).limit(30),
    supabase.from('credit_entries').select('*').eq('user_id', userId).eq('agent_id', agentId).order('created_at', { ascending: false }).limit(30),
    supabase.from('stock_items').select('*').eq('user_id', userId).eq('agent_id', agentId).order('item_name'),
    supabase.from('crm_customers').select('*').eq('user_id', userId).eq('agent_id', agentId).order('created_at', { ascending: false }).limit(30),
  ])

  const records: any[]  = recordsRes.data || []
  const settings: any   = settingsRes.data?.settings || {}
  const salesData: any[] = salesRes.data || []
  const expensesData: any[] = expensesRes.data || []
  const creditsData: any[]  = creditsRes.data || []
  const stockData: any[]    = stockRes.data || []
  const crmData: any[]      = crmRes.data || []

  // Group records by type
  const byType: Record<string, any[]> = {}
  for (const r of records) {
    if (!byType[r.record_type]) byType[r.record_type] = []
    byType[r.record_type].push(r)
  }

  const todayRecords  = records.filter(r => r.recorded_at === today)
  const sales         = byType['sale']     || []
  const stocks        = byType['stock']    || []
  const credits       = byType['credit']   || []
  const expenses      = byType['expense']  || []
  const customers     = byType['customer'] || []
  const notes         = byType['note']     || []

  const todaySales    = sales.filter(r => r.recorded_at === today)
  const todayRevenue  = todaySales.reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
  const totalDue      = credits
    .filter((r: any) => r.data?.status !== 'paid')
    .reduce((s: number, r: any) => s + Number(r.amount || 0), 0)

  const currency = settings.currency || '₹'
  const bizName  = settings.business_name || 'আমার ব্যবসা'

  // ── Build context string ──────────────────────────────────
  let context = `
== ব্যবসার তথ্য ==
ব্যবসার নাম: ${bizName}
আজকের তারিখ: ${today}
Currency: ${currency}
মোট এন্ট্রি: ${records.length}টি

== আজকের সারসংক্ষেপ ==
আজকের বিক্রি: ${currency}${todayRevenue.toFixed(0)}
আজকের লেনদেন: ${todaySales.length}টি
মোট বাকি: ${currency}${totalDue.toFixed(0)}
`.trim()

  if (sales.length > 0) {
    context += `\n\n== বিক্রির রেকর্ড (সর্বশেষ ${Math.min(sales.length, 20)}টি) ==\n`
    context += sales.slice(0, 20)
      .map((r: any) => `${r.recorded_at} | ${r.label} | ${currency}${r.amount || 0}${r.data?.customer ? ` | ${r.data.customer}` : ''}${r.data?.status === 'due' ? ' | বাকি' : ''}`)
      .join('\n')
  }

  if (stocks.length > 0) {
    context += `\n\n== স্টক (${stocks.length}টি পণ্য) ==\n`
    context += stocks
      .map((r: any) => `${r.data?.item || r.label}: ${r.data?.qty || 0} ${r.data?.unit || 'pcs'}${Number(r.data?.qty) <= Number(r.data?.min_qty || 0) ? ' ⚠️কম স্টক' : ''}`)
      .join('\n')
  }

  if (credits.length > 0) {
    const pending = credits.filter((r: any) => r.data?.status !== 'paid')
    context += `\n\n== বাকি / ক্রেডিট (${pending.length}টি pending) ==\n`
    context += pending.slice(0, 15)
      .map((r: any) => `${r.data?.customer || 'অজানা'}: ${currency}${r.amount} — ${r.recorded_at}`)
      .join('\n')
  }

  if (expenses.length > 0) {
    context += `\n\n== খরচ (সর্বশেষ ১০টি) ==\n`
    context += expenses.slice(0, 10)
      .map((r: any) => `${r.recorded_at} | ${r.label} | ${currency}${r.amount}`)
      .join('\n')
  }

  if (customers.length > 0) {
    context += `\n\n== খদ্দের তালিকা (${customers.length}জন) ==\n`
    context += customers.slice(0, 15)
      .map((r: any) => `${r.data?.name || r.label}${r.data?.phone ? ` (${r.data.phone})` : ''}`)
      .join('\n')
  }

  if (notes.length > 0) {
    context += `\n\n== নোট ==\n`
    context += notes.slice(0, 5).map((r: any) => `${r.recorded_at}: ${r.label}`).join('\n')
  }

  // Merge display-table data into context
  const NL = '\n'
  if (salesData.length > 0) {
    const todaySalesFromTable = salesData.filter((s: any) => s.sale_date === today)
    const todayRevTable = todaySalesFromTable.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
    const totalRevTable = salesData.reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0)
    context += NL + NL + '== \u09ac\u09bf\u0995\u09cd\u09b0\u09bf\u09b0 \u09b0\u09c7\u0995\u09b0\u09cd\u09a1 (daily_sales, \u09ae\u09cb\u099f ' + salesData.length + '\u099f\u09bf) ==' + NL
    context += '\u0986\u099c\u0995\u09c7\u09b0 \u09ac\u09bf\u0995\u09cd\u09b0\u09bf: \u20b9' + todayRevTable + ' (' + todaySalesFromTable.length + '\u099f\u09bf)' + NL
    context += '\u09ae\u09cb\u099f \u09ac\u09bf\u0995\u09cd\u09b0\u09bf: \u20b9' + totalRevTable + NL
    context += salesData.slice(0, 15).map((s: any) => {
      const note = s.notes ? ' | ' + s.notes : ''
      return s.sale_date + ' | ' + s.item_name + ' | qty:' + s.quantity + ' | \u20b9' + s.total_amount + note
    }).join(NL)
  }
  if (stockData.length > 0) {
    context += NL + NL + '== \u09b8\u09cd\u099f\u0995 \u0993 \u09ac\u09bf\u0995\u09cd\u09b0\u09df\u09ae\u09c2\u09b2\u09cd\u09af (stock_items, ' + stockData.length + '\u099f\u09bf) ==' + NL
    context += stockData.map((s: any) => {
      const low = Number(s.current_qty) <= Number(s.min_qty) ? ' low-stock' : ''
      const price = s.sell_price ? (' | \u09ac\u09bf\u0995\u09cd\u09b0\u09df\u09ae\u09c2\u09b2\u09cd\u09af: \u20b9' + s.sell_price + '/' + (s.unit || 'pcs')) : ' | \u09ac\u09bf\u0995\u09cd\u09b0\u09df\u09ae\u09c2\u09b2\u09cd\u09af: unknown'
      return s.item_name + ': ' + s.current_qty + ' ' + (s.unit || '') + low + price
    }).join(NL)
  }
  if (creditsData.length > 0) {
    const pending = creditsData.filter((c: any) => c.status !== 'paid')
    const totalPending = pending.reduce((s: number, c: any) => s + Number(c.amount || 0), 0)
    context += NL + NL + '== \u09ac\u09be\u0995\u09bf (credit_entries, ' + pending.length + ' pending, total \u20b9' + totalPending + ') ==' + NL
    context += pending.slice(0, 10).map((c: any) => c.customer_name + ': \u20b9' + c.amount).join(NL)
  }
  if (expensesData.length > 0) {
    const totalExp = expensesData.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
    context += NL + NL + '== \u0996\u09b0\u099a (expenses, total \u20b9' + totalExp + ') ==' + NL
    context += expensesData.slice(0, 10).map((e: any) => e.expense_date + ' | ' + e.description + ' | \u20b9' + e.amount).join(NL)
  }
  if (crmData.length > 0) {
    context += NL + NL + '== \u0996\u09a6\u09cd\u09a6\u09c7\u09b0 (crm_customers, ' + crmData.length + ') ==' + NL
    context += crmData.slice(0, 10).map((c: any) => c.name + (c.phone ? ' (' + c.phone + ')' : '')).join(NL)
  }
  if (records.length === 0 && salesData.length === 0 && stockData.length === 0) {
    context += NL + 'No data yet.'
  }
  return context
}

// ── Parse AI response for write-back intents ──────────────────
// We ask AI to ALWAYS append a JSON block when it records data.
// Format: <!--SAVE:{"type":"sale","label":"...","amount":100,"data":{}}-->

function parseWriteBackIntents(aiResponse: string) {
  const intents: any[] = []
  let cleanResponse = aiResponse
  const marker = '<!--SAVE:'
  let searchFrom = 0

  while (true) {
    const start = cleanResponse.indexOf(marker, searchFrom)
    if (start === -1) break

    // Find the first '{' after the marker, then walk forward balancing
    // braces (ignoring braces inside quoted strings) to find where the JSON
    // object actually ends. This recovers the intent even when the model
    // forgets the closing '-->' or appends stray characters after it —
    // which is exactly what caused raw '<!--SAVE:{...}' text to leak into
    // the visible chat before this fix.
    let i = start + marker.length
    while (i < cleanResponse.length && cleanResponse[i] !== '{') i++
    let jsonEnd = -1
    if (i < cleanResponse.length) {
      let depth = 0, inString = false, escape = false
      for (let j = i; j < cleanResponse.length; j++) {
        const ch = cleanResponse[j]
        if (escape) { escape = false; continue }
        if (ch === '\\') { escape = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') depth++
        else if (ch === '}') { depth--; if (depth === 0) { jsonEnd = j; break } }
      }
    }

    let tagEnd: number
    if (jsonEnd !== -1) {
      try { intents.push(JSON.parse(cleanResponse.slice(i, jsonEnd + 1))) } catch { /* skip malformed JSON — still strip the tag below */ }
      tagEnd = cleanResponse.slice(jsonEnd + 1, jsonEnd + 4) === '-->' ? jsonEnd + 4 : jsonEnd + 1
    } else {
      // No balanced JSON found at all — drop everything from the marker
      // onward rather than let raw tag debris show up in the chat.
      tagEnd = cleanResponse.length
    }

    cleanResponse = cleanResponse.slice(0, start) + cleanResponse.slice(tagEnd)
    searchFrom = start
  }

  return { cleanResponse: cleanResponse.trim(), intents }
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { messages, agentId, systemPrompt, previousRefs, focus } = await req.json()

    if (!messages?.length || !agentId) {
      return NextResponse.json({ content: 'বার্তা বা agent ID পাওয়া যায়নি।' })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ content: 'অনুগ্রহ করে login করুন।' }, { status: 401 })
    }

    // Employees work on the OWNER's data, limited to their role (sales-only / stock-only) and to
    // the agents they were granted — the same rules as the other chats.
    const access = await resolveEffectiveAccess(createServiceClient(), user.id)
    if (!canAccessAgent(access, 'custom', agentId)) {
      return NextResponse.json({ content: '🔒 এই এজেন্ট ব্যবহারের অনুমতি আপনার নেই।' })
    }
    const ownerId = access.ownerId
    const scope = effectiveScope(access.role, focus)
    const denied = scopeDenied(messages[messages.length - 1]?.content || '', scope)
    if (denied) return NextResponse.json({ content: denied })

    // ── "Add stock" for custom agents: code reads the message (one OR many products), never the model ──
    // Unknown names stay as heard, unclear fields are highlighted in an editable list, and nothing is
    // written until the owner taps save. Matches against this agent's own stock first, then the built-in
    // dictionary (groceries, clothes, sweets, food).
    const lastUserText: string = String(messages[messages.length - 1]?.content || '')
    if (classAllowed('stock', scope) && detectIntent(lastUserText) === 'add_stock') {
      let shop: { name: string; unit?: string }[] = []
      try {
        const { data } = await createServiceClient().from('stock_items').select('item_name,unit')
          .eq('user_id', ownerId).eq('agent_id', agentId).limit(2000)
        shop = (data || []).map((r: any) => ({ name: r.item_name, unit: r.unit }))
      } catch (e) { console.error('agent-chat propose: stock list failed', e) }
      const parsed = parseMultiStock(lastUserText, { vertical: 'general', shop }, 'add_stock')
      if (parsed) {
        const blank = { name: '', qty: '', unit: 'পিস', unit_cost: '', sell_price: '', category: 'অন্যান্য', expiry: '', heardAs: '', flags: ['name', 'qty'], note: 'কোনটা কত — বুঝতে পারিনি, নিচে লিখে দিন', status: 'unknown' }
        const items: any[] = parsed.items.length ? parsed.items.map(toBulkItem) : [blank]
        const unclear = items.filter(i => i.status !== 'ok' || (i.flags || []).some((f: string) => f === 'qty' || f === 'unit' || f === 'name')).length
        const lines = items.map((i, k) => `${k + 1}. ${i.name || '❓'}${i.qty !== '' ? ` — ${i.qty} ${i.unit}` : ''}${i.sell_price !== '' ? `, ₹${i.sell_price}` : ''}`).join('\n')
        const content = parsed.items.length
          ? `📝 ${items.length}টি পণ্য পেয়েছি:\n${lines}\n` + (unclear ? `\n⚠️ ${unclear}টি ঠিক বুঝতে পারিনি — হলুদ দাগ দেওয়া ঘরগুলো দেখে ঠিক করুন।` : '\nনিচে দেখে নিন, তারপর **সব যোগ করুন** চাপুন।')
          : '🤔 কোন পণ্য কত যোগ করবেন ঠিক বুঝতে পারিনি। নিচের ফর্মে লিখে দিন।'
        return NextResponse.json({ content, pendingAction: { type: 'add_stock_bulk', source: 'chat', items }, dataWritten: false })
      }
    }

    // 0. This agent's business vertical — drives crm_customers.business_type
    //    and, later, which dashboard tabs/fields the agent's data appears under.
    const { data: agentRow } = await supabase
      .from('agents').select('business_type').eq('id', agentId).single()
    const businessType = agentRow?.business_type || 'general'

    // 1. Fetch real data for this agent
    const dataContext = await fetchAgentData(supabase, agentId, ownerId)

    // 2. Build system prompt with data + write-back instructions
    const fullSystem = `${systemPrompt}

== আপনার REAL DATA (Supabase থেকে সরাসরি) ==
${dataContext}

== DATA WRITE-BACK নির্দেশনা ==
যখন ব্যবহারকারী নতুন তথ্য বলেন (বিক্রি, স্টক, বাকি, খরচ, কাস্টমার), তখন উত্তরের শেষে এই format-এ একটি hidden tag যোগ করো:
<!--SAVE:{"type":"sale","label":"চাল ৫কেজি","amount":350,"data":{"item":"চাল","qty":5,"unit":"কেজি","unit_price":70,"paid":200,"customer":"রামবাবু","phone":"9876543210","address":"কলকাতা","status":"due"}}-->

মূল্য/বিক্রয়মূল্য সংক্রান্ত নির্দেশনা:
- উপরে "স্টক ও বিক্রয়মূল্য" সেকশনে প্রতিটি পণ্যের জানা বিক্রয়মূল্য (₹/একক) দেওয়া আছে। বিক্রি হিসাব করার সময় এই দাম ব্যবহার করো — মোট (amount) = পরিমাণ × জানা বিক্রয়মূল্য।
- ব্যবহারকারী নতুন করে দাম না বললে, ধরে নেওয়া সংখ্যাটি (যেমন "২০০ টাকা দিয়েছে") মোট বিক্রয়মূল্য নয়, বরং পরিশোধিত (paid) পরিমাণ হতে পারে — বিশেষ করে যদি তা জানা বিক্রয়মূল্য অনুযায়ী হিসাব করা মোটের চেয়ে কম হয়। এমন হলে "amount"-এ সঠিক মোট বসাও এবং "data.paid"-এ যত টাকা দেওয়া হয়েছে তা বসাও, "status":"due" দাও।
- সম্পূর্ণ টাকা পরিশোধ হলে "data.paid" বাদ দাও (বা amount-এর সমান), "status":"paid" দাও।
- ব্যবহারকারী কোনো পণ্যের বিক্রয়মূল্য বলল/আপডেট করল/মুছে দিতে বলল (যেমন "চালের দাম ৭০ টাকা কেজি", "দাম বদলে ৮০ করো", "দাম মুছে দাও") — তখন type "stock" দাও এবং data-তে "unit_price" ফিল্ডে নতুন দাম বসাও (মুছতে চাইলে unit_price:0 দাও)। কোনো qty পরিবর্তন না হলে qty দিও না।

কাস্টমারের ফোন নম্বর বা ঠিকানা বললে অবশ্যই "phone" এবং "address" ফিল্ডে data-তে যুক্ত করো, নাহলে খালি রাখো।

record_type হবে: "sale", "stock", "credit", "expense", "customer", "note"
- বিক্রি/বিক্রয় → "sale"
- স্টক যোগ/আপডেট/দাম পরিবর্তন → "stock"
- বাকি/ক্রেডিট → "credit"
- খরচ → "expense"
- নতুন কাস্টমার → "customer"
- অন্য তথ্য → "note"

IMPORTANT: শুধু তখনই SAVE tag দাও যখন ব্যবহারকারী স্পষ্টভাবে নতুন তথ্য রেকর্ড করতে বলেন। প্রশ্ন বা রিপোর্ট চাইলে SAVE tag দিও না।`

    // 3. Build message history (skip greeting)
    const history = messages
      .filter((_: any, i: number) => i > 0)
      .map((m: any) => ({ role: m.role, content: m.content }))

    const finalMessages = history.length > 0
      ? history
      : [{ role: 'user', content: messages[messages.length - 1]?.content || 'হ্যালো' }]

    // 4. Call AI
    const rawResponse = await tryGroq(fullSystem, finalMessages)

    // 5. Parse write-back intents
    const parsed = parseWriteBackIntents(rawResponse)
    // Drop any write this role may not do (sales role ≠ stock changes, stock role ≠ sales)
    const intents = parsed.intents.filter((it: any) => saveTypeAllowed(it?.type, scope))
    const refused = intents.length < parsed.intents.length
    // Anti-hallucination: a stock / sale record may only carry numbers the owner actually said.
    // (A sale's price/paid can come from the saved price list, so only its quantity is checked.)
    const inventedWrite = intents.some((it: any) => {
      const d = it?.data || {}
      const one = (v: any) => (Number(v) === 1 ? 0 : v)
      if (it?.type === 'stock') return !numbersPresent(lastUserText, [one(d.qty ?? d.quantity), d.unit_price, d.unit_cost])
      if (it?.type === 'sale') return !numbersPresent(lastUserText, [one(d.qty ?? d.quantity)])
      return false
    })
    if (inventedWrite) {
      return NextResponse.json({ content: '⚠️ সংখ্যাগুলো (পরিমাণ/দাম) পরিষ্কার শুনতে পারিনি, তাই কিছু সেভ করিনি। আবার বলুন বা লিখুন — যেমন: "চাল ৫০ কেজি ৬০ টাকা"।', dataWritten: false })
    }
    const cleanResponse = refused ? deniedMessage(scope) : parsed.cleanResponse

    // 5b. Edit & resend: undo exactly what the message being corrected
    // wrote, before applying the new one — same pattern as business-chat,
    // so a correction updates the same rows instead of duplicating them.
    if (previousRefs && previousRefs.length > 0) {
      for (const ref of previousRefs) {
        try {
          if (ref.recordId) await supabase.from('agent_records').delete().eq('id', ref.recordId)
          if (ref.saleId) await supabase.from('daily_sales').delete().eq('id', ref.saleId)
          if (ref.purchaseId) await supabase.from('crm_purchases').delete().eq('id', ref.purchaseId)
          if (ref.creditId) await supabase.from('credit_entries').delete().eq('id', ref.creditId)
          if (ref.expenseId) await supabase.from('expenses').delete().eq('id', ref.expenseId)
          if (ref.customerId && ref.customerWasNew) await supabase.from('crm_customers').delete().eq('id', ref.customerId)
          if (ref.stockItemId) {
            if (ref.stockWasNew) {
              await supabase.from('stock_items').delete().eq('id', ref.stockItemId)
            } else if (ref.stockQtyDelta) {
              const { data: cur } = await supabase.from('stock_items').select('current_qty').eq('id', ref.stockItemId).maybeSingle()
              if (cur) await supabase.from('stock_items').update({ current_qty: Number(cur.current_qty) - Number(ref.stockQtyDelta) }).eq('id', ref.stockItemId)
            }
          }
        } catch (e) { console.error('agent-chat reverse previousRef error:', e) }
      }
    }

    // 6. Save any new records to ALL display tables so Reports/CRM/Dashboard stay in sync
    // IST-aware "today" — see note in fetchAgentData() above.
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    // Row ids this reply writes — returned to the frontend so an edit &
    // resend on THIS message later knows exactly what to undo.
    const dataRefs: any[] = []
    if (intents.length > 0) {
      for (const intent of intents) {
        const d = intent.data || {}
        const ref: any = {}

        // Always save to agent_records (generic log)
        const { data: recCreated } = await supabase.from('agent_records').insert({
          user_id: ownerId, agent_id: agentId,
          record_type: intent.type || 'note',
          label: intent.label || '',
          amount: intent.amount || null,
          data: d, source: 'chat', recorded_at: today,
        }).select('id').single()
        ref.recordId = recCreated?.id || null

        // Sale → daily_sales (for ReportDashboard) + crm_purchases (for per-customer history)
        // + credit_entries (auto-created when payment is partial)
        if (intent.type === 'sale') {
          const qty = Number(d.qty || d.quantity || 1)
          const itemNameForSale = d.item || intent.label || 'অজানা'

          // FIX: if this item is already in stock with a set sell_price,
          // that's authoritative — never derive price from paid÷qty. A
          // message like "৩ কেজি চাল কিনেছে, ১০০ টাকা দিয়েছে" (no price
          // stated, payment less than the full total) used to make the
          // fallback below compute unitPrice from the paid amount itself,
          // undercharging the sale and hiding a real বাকি. Same fix as
          // business-chat's DOKAN_ADD_SALE.
          let stockSellPrice: number | null = null
          try {
            const { data: s } = await supabase.from('stock_items')
              .select('sell_price').eq('user_id', ownerId).eq('agent_id', agentId)
              .ilike('item_name', itemNameForSale).maybeSingle()
            if (s?.sell_price) stockSellPrice = Number(s.sell_price)
          } catch { /* no matching stock item — fine, fall through */ }

          // Prefer: (1) the item's real stock price, (2) the AI-supplied
          // unit_price, (3) deriving from a stated total — never from paid.
          const unitPrice = stockSellPrice ?? (d.unit_price ? Number(d.unit_price) : (intent.amount ? Number(intent.amount) / qty : 0))
          const totalAmount = stockSellPrice ? qty * stockSellPrice : (intent.amount ? Number(intent.amount) : qty * unitPrice)
          // How much was actually collected — defaults to the full total unless
          // the AI flagged a smaller "paid" amount (partial payment).
          const paidAmount = (d.paid !== undefined && d.paid !== null && d.paid !== '')
            ? Math.min(Number(d.paid), totalAmount)
            : totalAmount
          const dueAmount = Math.max(0, totalAmount - paidAmount)

          const { data: saleCreated } = await supabase.from('daily_sales').insert({
            user_id: ownerId, agent_id: agentId,
            sale_date: today,
            item_name: itemNameForSale,
            quantity: qty, unit_price: unitPrice,
            notes: d.customer ? `খদ্দের: ${d.customer}` : '',
            source: 'chat',
          }).select('id').single()
          ref.saleId = saleCreated?.id || null

          // Resolve (or create) the customer, then log this purchase + any due against them
          if (d.customer && d.customer !== 'নগদ' && d.customer !== 'cash') {
            let customerId: string | null = null
            let customerWasNew = false
            const { data: existing, error: findErr } = await supabase.from('crm_customers')
              .select('id, phone, address').eq('user_id', ownerId).eq('agent_id', agentId).ilike('name', d.customer).maybeSingle()
            if (findErr) console.error('crm_customers lookup:', findErr)

            if (existing) {
              customerId = existing.id
              const updates: any = {}
              if (d.phone && !existing.phone) updates.phone = d.phone
              if (d.address && !existing.address) updates.address = d.address
              if (Object.keys(updates).length > 0) {
                await supabase.from('crm_customers').update(updates).eq('id', existing.id)
                  .then(({ error }) => { if (error) console.error('crm_customers update:', error) })
              }
            } else {
              const { data: created, error: createErr } = await supabase.from('crm_customers').insert({
                user_id: ownerId, agent_id: agentId,
                name: d.customer, phone: d.phone || '', address: d.address || '',
                business_type: businessType, source: 'chat',
              }).select('id').single()
              if (createErr) console.error('crm_customers insert:', createErr)
              customerId = created?.id || null
              customerWasNew = true
            }
            ref.customerId = customerId
            ref.customerWasNew = customerWasNew

            // Log the purchase itself for date-wise, per-customer history
            if (customerId) {
              const { data: purchCreated } = await supabase.from('crm_purchases').insert({
                user_id: ownerId, customer_id: customerId,
                purchase_date: today,
                item_name: itemNameForSale,
                quantity: qty, unit: d.unit || 'pcs', unit_price: unitPrice,
                paid_amount: paidAmount,
                payment_status: dueAmount > 0 ? (paidAmount > 0 ? 'partial' : 'pending') : 'paid',
                source: 'chat',
              }).select('id').single()
              ref.purchaseId = purchCreated?.id || null
            }

            // Partial/no payment → automatically create a বাকি (credit_entries) row
            // for the outstanding amount, instead of silently losing the due.
            if (dueAmount > 0) {
              const { data: creditCreated } = await supabase.from('credit_entries').insert({
                user_id: ownerId, agent_id: agentId,
                customer_name: d.customer,
                amount: totalAmount, paid_amount: paidAmount,
                status: paidAmount > 0 ? 'partial' : 'pending',
                notes: d.item ? `${d.item} — ${qty}${d.unit || ''}` : '',
                source: 'chat',
              }).select('id').single()
              ref.creditId = creditCreated?.id || null
            }
          }
        }

        // Expense → expenses (for ReportDashboard)
        if (intent.type === 'expense') {
          const { data: expCreated } = await supabase.from('expenses').insert({
            user_id: ownerId, agent_id: agentId,
            expense_date: today,
            description: intent.label || d.description || 'খরচ',
            amount: Number(intent.amount || 0),
            category: d.category || 'misc', source: 'chat',
          }).select('id').single()
          ref.expenseId = expCreated?.id || null
        }

        // Credit → credit_entries (for ReportDashboard)
        if (intent.type === 'credit') {
          const { data: credCreated } = await supabase.from('credit_entries').insert({
            user_id: ownerId, agent_id: agentId,
            customer_name: d.customer || intent.label || 'অজানা',
            amount: Number(intent.amount || 0),
            paid_amount: 0, status: 'pending',
            notes: d.notes || '', source: 'chat',
          }).select('id').single()
          ref.creditId = credCreated?.id || null
        }

        // Stock → stock_items upsert (for ReportDashboard)
        if (intent.type === 'stock') {
          const itemName = d.item || intent.label || 'অজানা'
          let existingStock: any = null
          try {
            const { data: s } = await supabase.from('stock_items')
              .select('id, current_qty, sell_price').eq('user_id', ownerId).eq('agent_id', agentId).ilike('item_name', itemName).single()
            existingStock = s
          } catch { existingStock = null }

          const priceGiven = d.unit_price !== undefined && d.unit_price !== null && d.unit_price !== ''
          const qtyDelta = Number(d.qty || 0)

          if (existingStock) {
            const updates: any = {}
            if (qtyDelta) updates.current_qty = (existingStock.current_qty || 0) + qtyDelta
            if (priceGiven) updates.sell_price = Number(d.unit_price) || null
            if (Object.keys(updates).length > 0) {
              await supabase.from('stock_items').update(updates).eq('id', existingStock.id)
                .then(({ error }) => { if (error) console.error('stock_items update:', error) })
            }
            ref.stockItemId = existingStock.id
            ref.stockQtyDelta = qtyDelta
            ref.stockWasNew = false
          } else {
            const { data: stockCreated } = await supabase.from('stock_items').insert({
              user_id: ownerId, agent_id: agentId,
              item_name: itemName,
              current_qty: qtyDelta,
              unit: d.unit || 'pcs',
              min_qty: Number(d.min_qty || 3),
              unit_cost: Number(d.cost || 0),
              sell_price: priceGiven ? Number(d.unit_price) : null,
            }).select('id').single()
            ref.stockItemId = stockCreated?.id || null
            ref.stockWasNew = true
          }
        }

        // Customer → crm_customers (for CRMDashboard)
        if (intent.type === 'customer') {
          try {
            const { data: existingCrm } = await supabase.from('crm_customers')
              .select('id').eq('user_id', ownerId).eq('agent_id', agentId).ilike('name', d.name || intent.label || '').single()
            if (!existingCrm) throw new Error('not found')
            ref.customerId = existingCrm.id
            ref.customerWasNew = false
          } catch {
            const { data: custCreated } = await supabase.from('crm_customers').insert({
              user_id: ownerId, agent_id: agentId,
              name: d.name || intent.label || 'অজানা',
              phone: d.phone || '', address: d.address || '',
              notes: d.notes || '',
              business_type: businessType, source: 'chat',
            }).select('id').single()
            ref.customerId = custCreated?.id || null
            ref.customerWasNew = true
          }
        }

        dataRefs.push(ref)
      }
    }

    return NextResponse.json({
      content:      cleanResponse,
      saved:        intents.length,  // tells frontend how many records were saved
      savedIntents: intents,
      dataRefs,     // used by "edit & resend" to undo exactly this reply's writes
    })

  } catch (error: any) {
    console.error('agent-chat error:', error)
    return NextResponse.json({
      content: 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।',
    })
  }
}

// ── GET: fetch agent records (for data panel) ─────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const agentId    = searchParams.get('agentId')
    const recordType = searchParams.get('type')
    const limit      = parseInt(searchParams.get('limit') || '50')

    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    let query = supabase
      .from('agent_records')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (recordType) query = query.eq('record_type', recordType)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ records: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ── DELETE: delete a record ───────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { recordId } = await req.json()
    if (!recordId) return NextResponse.json({ error: 'recordId required' }, { status: 400 })

    const { error } = await supabase
      .from('agent_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
