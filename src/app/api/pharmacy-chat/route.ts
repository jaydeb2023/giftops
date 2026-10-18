import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCallerId } from '@/lib/chatAuth'
import { resolveEffectiveAccess, canAccessAgent } from '@/lib/teamAccess'
import { effectiveScope, classAllowed, scopeDenied, deniedMessage } from '@/lib/chatPolicy'
import { parseMultiStock, detectIntent, toBulkItem, numbersPresent } from '@/lib/stockParser'

/**
 * Server-side Supabase client using the service role key.
 * Must NOT silently fall back to the anon key — see business-chat/route.ts
 * for the full explanation. A missing env var should fail loudly, not
 * produce silent RLS-rejected writes.
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
      temperature: 0.3,
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

function buildPharmacyContext(data: {
  businessName: string
  medicines: any[]
  patients: any[]
  recentSales: any[]
  halkhata: any[]
  todayRevenue: number
  totalDue: number
}) {
  const { businessName, medicines, patients, recentSales, halkhata, todayRevenue, totalDue } = data
  const lowStock = medicines.filter(m => m.stock <= m.min_stock)
  const now = new Date()
  const expired = medicines.filter(m => {
    if (!m.expiry) return false
    return new Date(m.expiry + '-01') < now
  })
  const expiringSoon = medicines.filter(m => {
    if (!m.expiry) return false
    const diff = (new Date(m.expiry + '-01').getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff < 90
  })
  const todaySales = recentSales.filter((s: any) => s.purchase_date === new Date().toISOString().slice(0, 10))
  return `
== ফার্মেসির তথ্য ==
ফার্মেসির নাম: ${businessName || 'আমার ফার্মেসি'}
আজকের তারিখ: ${new Date().toLocaleDateString('bn-IN')}

== স্টক সারসংক্ষেপ ==
মোট ওষুধ: ${medicines.length}টি
কম স্টক (${lowStock.length}টি): ${lowStock.map(m => `${m.name}(${m.stock} ${m.unit})`).join(', ') || 'নেই'}
মেয়াদ উত্তীর্ণ (${expired.length}টি): ${expired.map(m => m.name).join(', ') || 'নেই'}
শীঘ্রই মেয়াদ শেষ (${expiringSoon.length}টি): ${expiringSoon.map(m => `${m.name}(${m.expiry})`).join(', ') || 'নেই'}

== সম্পূর্ণ স্টক তালিকা ==
${medicines.slice(0, 40).map(m => `${m.name}: ${m.stock} ${m.unit}, MRP ₹${m.mrp}, মেয়াদ ${m.expiry || 'অজানা'}`).join('\n')}

== আর্থিক তথ্য ==
আজকের বিক্রি: ₹${todayRevenue.toFixed(0)}
আজকের লেনদেন: ${todaySales.length}টি
মোট বাকি: ₹${totalDue.toFixed(0)}

== বাকির তালিকা (${halkhata.length}জন) ==
${halkhata.slice(0, 15).map((h: any) => `${h.patient_name}: ₹${Number(h.total_due).toFixed(0)}`).join('\n') || 'কোনো বাকি নেই'}

== সাম্প্রতিক বিক্রি ==
${recentSales.slice(0, 10).map((s: any) => `${s.purchase_date} | ${s.customer_name || 'অজানা'} | ${s.item_name} | ₹${s.total_amount} | ${Number(s.due_amount) > 0 ? `বাকি ₹${s.due_amount}` : 'পরিশোধিত'}`).join('\n')}

== রোগী তালিকা (${patients.length}জন) ==
${patients.slice(0, 20).map((p: any) => `${p.name}${p.phone ? ` (${p.phone})` : ''}${p.total_due > 0 ? ` — বাকি ₹${p.total_due}` : ''}`).join('\n')}
`.trim()
}

// Bengali digits (০-৯) make Number() return NaN — convert to ASCII first.
function normalizeDigits(s: string): string {
  return (s || '').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
}

function parseParams(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  raw.split(',').forEach(pair => {
    const [k, ...rest] = pair.split('=')
    if (k) result[k.trim().toLowerCase()] = normalizeDigits(rest.join('=').trim())
  })
  return result
}

export async function POST(req: NextRequest) {
  try {
    const { messages, businessName, focus } = await req.json()
    if (!messages?.length) {
      return NextResponse.json({ content: 'কোনো বার্তা পাওয়া যায়নি।' })
    }

    // Caller comes from the signed-in session (Bearer token), never from the request body.
    const callerId = await getCallerId(req)
    if (!callerId) {
      return NextResponse.json({ content: '⚠️ আপনার সেশন শেষ হয়ে গেছে। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।', dataWritten: false }, { status: 401 })
    }
    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, callerId)
    if (!canAccessAgent(access, 'library', 'pharmacy-assistant')) {
      return NextResponse.json({ content: '🔒 এই এজেন্ট ব্যবহারের অনুমতি আপনার নেই।', dataWritten: false })
    }
    const userId = access.ownerId                      // an employee works on the OWNER's data
    const scope = effectiveScope(access.role, focus)   // sales-only / stock-only roles + the owner's focus filter
    const denied = scopeDenied(messages[messages.length - 1]?.content || '', scope)
    if (denied) return NextResponse.json({ content: denied, dataWritten: false })

    const lastUserText: string = String(messages[messages.length - 1]?.content || '')

    // ── "Add stock" is read by deterministic code, never by the chat model ──────────────
    // The model used to invent quantities / prices / expiry dates and claim "added!".
    // Now: understand every product in the message (one or many), match it against this
    // pharmacy's own medicines + the built-in medicine dictionary, and show an editable
    // card. Anything unclear is highlighted. Nothing is saved until the owner taps save.
    if (userId && classAllowed('stock', scope) && detectIntent(lastUserText) === 'add_stock') {
      let shop: { name: string; unit?: string }[] = []
      try {
        const { data } = await supabase.from('pharmacy_medicines').select('name,unit').eq('user_id', userId).limit(2000)
        shop = (data || []).map((m: any) => ({ name: m.name, unit: m.unit }))
      } catch (e) { console.error('pharmacy propose: list failed', e) }
      const parsed = parseMultiStock(lastUserText, { vertical: 'pharmacy', shop }, 'add_stock')
      if (parsed) {
        const items = parsed.items.length
          ? parsed.items.map(toBulkItem)
          : [{ name: '', qty: '', unit: 'পাতা', unit_cost: '', sell_price: '', category: 'অন্যান্য', expiry: '', heardAs: '', flags: ['name', 'qty'], note: 'কোন ওষুধ কত — বুঝতে পারিনি, নিচে লিখে দিন', status: 'unknown' }]
        const unclear = items.filter((i: any) => i.status !== 'ok' || i.flags.some((f: string) => f === 'qty' || f === 'unit' || f === 'name')).length
        const lines = items.map((i: any, k: number) => `${k + 1}. ${i.name || '❓'}${i.qty !== '' ? ` — ${i.qty} ${i.unit}` : ''}${i.sell_price !== '' ? `, ₹${i.sell_price}` : ''}${i.expiry ? `, মেয়াদ ${i.expiry}` : ''}`).join('\n')
        const content = parsed.items.length
          ? `📝 ${items.length}টি ওষুধ পেয়েছি:\n${lines}\n` + (unclear ? `\n⚠️ ${unclear}টি ঠিক বুঝতে পারিনি — হলুদ দাগ দেওয়া ঘরগুলো দেখে ঠিক করুন।` : '\nনিচে দেখে নিন, তারপর **সব যোগ করুন** চাপুন।')
          : '🤔 কোন ওষুধ কত যোগ করবেন ঠিক বুঝতে পারিনি। নিচের ফর্মে লিখে দিন।'
        return NextResponse.json({ content, pendingAction: { type: 'add_stock_bulk', source: 'chat', items }, dataWritten: false })
      }
    }

    let contextStr = ''
    if (userId) {
      try {
        const [medsRes, patientsRes, salesRes] = await Promise.all([
          supabase.from('pharmacy_medicines').select('*').eq('user_id', userId).order('name'),
          supabase.from('crm_customers').select('*').eq('user_id', userId).eq('business_type', 'pharmacy'),
          supabase.from('crm_purchases')
            .select('*, crm_customers(name, phone)')
            .eq('user_id', userId)
            .order('purchase_date', { ascending: false })
            .limit(50),
        ])
        const medicines = medsRes.data || []
        const patients = patientsRes.data || []
        const allSales = salesRes.data || []
        const dueMap: Record<string, number> = {}
        const nameMap: Record<string, string> = {}
        allSales.forEach((s: any) => {
          if (Number(s.due_amount) > 0) {
            dueMap[s.customer_id] = (dueMap[s.customer_id] || 0) + Number(s.due_amount)
          }
          if (s.crm_customers?.name) nameMap[s.customer_id] = s.crm_customers.name
        })
        const halkhata = Object.entries(dueMap).map(([id, due]) => ({
          patient_name: nameMap[id] || 'অজানা',
          total_due: due,
        })).sort((a, b) => b.total_due - a.total_due)
        const patientsWithDue = patients.map((p: any) => ({ ...p, total_due: dueMap[p.id] || 0 }))
        const today = new Date().toISOString().slice(0, 10)
        const todayRevenue = allSales
          .filter((s: any) => s.purchase_date === today)
          .reduce((sum: number, s: any) => sum + Number(s.total_amount || 0), 0)
        const totalDue = halkhata.reduce((sum, h) => sum + h.total_due, 0)
        const salesWithName = allSales.map((s: any) => ({ ...s, customer_name: s.crm_customers?.name || '' }))
        contextStr = buildPharmacyContext({
          businessName: businessName || 'আমার ফার্মেসি',
          medicines, patients: patientsWithDue,
          recentSales: salesWithName, halkhata, todayRevenue, totalDue,
        })
      } catch (dbErr) {
        console.error('DB fetch error:', dbErr)
        contextStr = '(ডেটাবেজ থেকে তথ্য আনতে সমস্যা হয়েছে)'
      }
    }

    const systemPrompt = `তুমি "${businessName || 'আমার ফার্মেসি'}"-এর একজন বিশেষজ্ঞ বাংলা ফার্মেসি AI সহায়ক।

তোমার কাজ:
১. নিচের REAL DATA দিয়ে প্রশ্নের উত্তর দাও — কোনো কিছু অনুমান করবে না
২. ওষুধের সাধারণ জ্ঞান (ব্যবহার, পার্শ্বপ্রতিক্রিয়া) দিতে পারো — কিন্তু prescription দেবে না
৩. যদি real data-তে কিছু না থাকে, স্পষ্ট বলো "এই তথ্য আমার কাছে নেই"
৪. সবসময় বাংলায় উত্তর দাও, সংক্ষিপ্ত ও স্পষ্টভাবে
৪ক. ওষুধের ডোজ/মাত্রা (কত মিগ্রা, কতবার, বাচ্চার ওজন অনুযায়ী) নিজে থেকে বলবে না — বলো "ডোজ ডাক্তার বা ফার্মাসিস্টের কাছ থেকে জেনে নিন, প্যাকেটের লেবেলও দেখুন"
৪খ. ব্যবহারকারীর কথা পরিষ্কার না বুঝলে অনুমান করবে না, কোনো ট্যাগও দেবে না — স্পষ্ট করে বলো কোনটা বুঝতে পারোনি এবং কী বলতে হবে
৪গ. যে সংখ্যা/দাম/মেয়াদ ব্যবহারকারী নিজে বলেননি তা কোনো ট্যাগে বসাবে না
৫. টাকার হিসাব ও stock নিয়ে সুনির্দিষ্ট সংখ্যা দাও

${contextStr ? `\n== ফার্মেসির REAL DATA ==\n${contextStr}\n== DATA শেষ ==` : ''}

গুরুত্বপূর্ণ: শুধু উপরের real data থেকে উত্তর দাও। Data-তে নেই এমন কিছু বানিয়ে বলবে না।

== ডেটা লেখার নিয়ম (WRITE-BACK) ==
বিক্রি রেকর্ড করতে উত্তরের শেষে দাও:
[PHARM_SELL: name=Paracetamol, qty=5, price=10, customer=রামবাবু, paid=50]

স্টক আপডেট করতে:
[PHARM_STOCK: name=Paracetamol, qty=100]

নতুন ওষুধ যোগ করতে:
[PHARM_ADD: name=Amoxicillin, category=Antibiotic, stock=50, price=15, expiry=2026-12]

নতুন রোগী যোগ করতে:
[PHARM_PATIENT: name=সুদর্শন হালদার, age=25, phone=9876000000, address=কলকাতা, disease=সর্দি ও কাশি]

উদাহরণ — "রামবাবুকে ৫টা প্যারাসিটামল দিলাম ৫০ টাকায়":
"ঠিক আছে! রামবাবুকে ৫টি Paracetamol ₹৫০-তে বিক্রি হয়েছে।"
[PHARM_SELL: name=Paracetamol, qty=5, price=10, customer=রামবাবু, paid=50]

IMPORTANT: tag সবসময় উত্তরের একেবারে শেষে, আলাদা লাইনে।`

    const history = messages
      .filter((_: any, i: number) => i > 0)
      .map((m: any) => ({ role: m.role, content: m.content }))
    const finalMessages = history.length > 0
      ? history
      : [{ role: 'user', content: messages[messages.length - 1]?.content || 'হ্যালো' }]

    const rawContent = await tryGroq(systemPrompt, finalMessages)
    let dataWritten = false
    let cleanContent = rawContent

    // ── Anti-hallucination gate ─────────────────────────────────────────────────────────
    // The model may only write numbers the owner literally said. If a tag carries a quantity /
    // price / paid amount that is NOT in the user's message, nothing is written and the owner
    // is asked to say it again (instead of getting a made-up "✅ done").
    const sellRaw = rawContent.match(/\[PHARM_SELL:\s*([^\]]+)\]/i)
    const stockRaw = rawContent.match(/\[PHARM_STOCK:\s*([^\]]+)\]/i)
    let blockedInvented = false
    if (sellRaw) { const q = parseParams(sellRaw[1]); if (!numbersPresent(lastUserText, [q.qty, q.price, q.paid])) blockedInvented = true }
    if (stockRaw) { const q = parseParams(stockRaw[1]); if (!numbersPresent(lastUserText, [q.qty])) blockedInvented = true }
    if (blockedInvented) {
      return NextResponse.json({ content: '⚠️ সংখ্যাগুলো পরিষ্কার শুনতে পারিনি, তাই কিছু সেভ করিনি। আবার বলুন — যেমন: "রামবাবুকে ৫ পাতা প্যারাসিটামল ৫০ টাকায় দিলাম"।', dataWritten: false })
    }

    // [PHARM_SELL] — total_amount ও due_amount বাদ (generated column)
    const sellMatch = rawContent.match(/\[PHARM_SELL:\s*([^\]]+)\]/i)
    if (sellMatch && userId && classAllowed('sales', scope)) {
      try {
        const p = parseParams(sellMatch[1])
        const qty = Number(p.qty || 1)
        const price = Number(p.price || 0)
        const paid = Number(p.paid || price * qty)
        const total = qty * price
        const due = Math.max(0, total - paid)
        const today = new Date().toISOString().slice(0, 10)
        let customerId: string | null = null
        if (p.customer && p.customer !== 'নগদ' && p.customer !== 'cash') {
          const { data: existing } = await supabase.from('crm_customers')
            .select('id').eq('user_id', userId).ilike('name', p.customer).single()
          if (existing) {
            customerId = existing.id
          } else {
            const { data: newCust } = await supabase.from('crm_customers').insert({
              user_id: userId, name: p.customer, phone: p.phone || '',
              business_type: 'pharmacy', source: 'chat',
            }).select('id').single()
            customerId = newCust?.id || null
          }
        }
        // ⚠️ total_amount ও due_amount দেওয়া হচ্ছে না — DB generated column
        const { error: sellError } = await supabase.from('crm_purchases').insert({
          user_id: userId,
          customer_id: customerId,
          purchase_date: today,
          item_name: p.name || p.item || 'অজানা',
          item_category: 'medicine',
          quantity: qty,
          unit: 'strip',
          unit_price: price,
          paid_amount: paid,
          payment_status: due > 0 ? 'partial' : 'paid',
          source: 'chat',
        })
        if (sellError) { console.error('PHARM_SELL DB error:', sellError.message) }
        else {
          const { data: med } = await supabase.from('pharmacy_medicines')
            .select('id,stock').ilike('name', `%${p.name || p.item}%`).eq('user_id', userId).single()
          if (med) await supabase.from('pharmacy_medicines').update({ stock: Math.max(0, med.stock - qty) }).eq('id', med.id)
          dataWritten = true
        }
      } catch (e) { console.error('PHARM_SELL error:', e) }
    }

    // [PHARM_STOCK]
    const stockMatch = rawContent.match(/\[PHARM_STOCK:\s*([^\]]+)\]/i)
    if (stockMatch && userId && classAllowed('stock', scope)) {
      try {
        const p = parseParams(stockMatch[1])
        const { data: med } = await supabase.from('pharmacy_medicines')
          .select('id,stock').ilike('name', `%${p.name || p.item}%`).eq('user_id', userId).single()
        if (med) {
          await supabase.from('pharmacy_medicines').update({ stock: Number(p.qty || 0) }).eq('id', med.id)
          dataWritten = true
        }
      } catch (e) { console.error('PHARM_STOCK error:', e) }
    }

    // [PHARM_ADD] — the model proposed a NEW medicine. Never insert it directly: show the editable card
    // and mark every value the owner did not literally say.
    const addMatch = rawContent.match(/\[PHARM_ADD:\s*([^\]]+)\]/i)
    if (addMatch && userId && classAllowed('stock', scope)) {
      const p = parseParams(addMatch[1])
      const said = (v: any) => v === undefined || v === '' || numbersPresent(lastUserText, [v])
      const flags: string[] = []
      const qty = Number(p.stock || p.qty || 0) || ''
      const price = Number(p.price || p.mrp || 0) || ''
      if (!said(qty)) flags.push('qty'); if (!said(price)) flags.push('price')
      const expiryOk = !p.expiry || /\d/.test(lastUserText) && (lastUserText.includes(String(p.expiry).slice(0, 4)))
      if (!expiryOk || !p.expiry) flags.push('expiry')
      const item = { name: p.name || '', qty: said(qty) ? qty : '', unit: 'পাতা', unit_cost: '', sell_price: said(price) ? price : '', category: p.category || 'অন্যান্য', expiry: expiryOk ? (p.expiry || '') : '', heardAs: '', flags: Array.from(new Set(flags)), note: flags.length ? 'এই ঘরগুলো আপনি বলেননি — নিজে লিখে দিন' : '', status: flags.length ? 'check' : 'ok' }
      return NextResponse.json({ content: `📝 বুঝেছি: **${item.name || 'নতুন ওষুধ'}**। নিচে দেখে নিন, ভুল থাকলে ঠিক করে **সব যোগ করুন** চাপুন।`, pendingAction: { type: 'add_stock_bulk', source: 'chat', items: [item] }, dataWritten: false })
    }

    // [PHARM_PATIENT]
    const patientMatch = rawContent.match(/\[PHARM_PATIENT:\s*([\s\S]*?)\]/i)
    if (patientMatch && userId && classAllowed('customer', scope)) {
      try {
        const p = parseParams(patientMatch[1])
        const patientName = p.name || 'নতুন রোগী'

        // Check for duplicate by phone first
        let existingId: string | null = null
        if (p.phone) {
          const { data: existing } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('user_id', userId)
            .eq('phone', p.phone)
            .eq('business_type', 'pharmacy')
            .single()
          if (existing) existingId = existing.id
        }

        if (existingId) {
          // Already exists — still mark dataWritten so UI refreshes
          dataWritten = true
        } else {
          const insertPayload: Record<string, any> = {
            user_id: userId,
            business_type: 'pharmacy',
            name: patientName,
            phone: p.phone || '',
            address: p.address || '',
            notes: p.disease || p.notes || '',
            gender: p.gender || 'unknown',
          }
          // Only add optional columns if they won't cause schema errors
          if (p.age) insertPayload.age = Number(p.age)

          const { error: patientError } = await supabase
            .from('crm_customers')
            .insert(insertPayload)

          if (patientError) {
            console.error('PHARM_PATIENT DB error:', patientError.message, patientError.details, patientError.hint)
          } else {
            dataWritten = true
          }
        }
      } catch (e) { console.error('PHARM_PATIENT error:', e) }
    }

    cleanContent = rawContent.replace(/\[(PHARM_SELL|PHARM_STOCK|PHARM_ADD|PHARM_PATIENT)[\s\S]*?\]/gi, '').trim()
    if (!cleanContent) {
      cleanContent = dataWritten ? '✅ হয়ে গেছে!' : 'দুঃখিত, বুঝতে পারিনি। আবার বলুন।'
    }
    // The model proposed an action this role may not run → say so (nothing was written)
    const refused = (!!sellMatch && !classAllowed('sales', scope)) || (!!stockMatch && !classAllowed('stock', scope))
      || (!!addMatch && !classAllowed('stock', scope)) || (!!patientMatch && !classAllowed('customer', scope))
    if (refused) cleanContent = deniedMessage(scope)
    return NextResponse.json({ content: cleanContent, dataWritten, patientSaved: !!patientMatch && dataWritten })

  } catch (error: any) {
    console.error('Pharmacy chat error:', error)
    return NextResponse.json({
      content: 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।'
    })
  }
}
