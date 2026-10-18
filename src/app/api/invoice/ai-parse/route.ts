import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

// Same models used by the WhatsApp AI reply engine — free/cheap Groq-hosted,
// good enough for structured extraction like this.
const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']

const SYSTEM_PROMPT = `তুমি একজন invoice তৈরির সহকারী। দোকানদার বাংলা, বাংলিশ (রোমান হরফে বাংলা), বা ইংরেজি — যেকোনো ভাষায় একটা লাইন লিখবে বা বলবে, যাতে থাকবে কাস্টমারের নাম (থাকতেও পারে, নাও থাকতে পারে) এবং একটা বা একাধিক পণ্যের নাম, পরিমাণ ও দাম।

তোমার কাজ: এই বাক্য থেকে একটা JSON অবজেক্ট বানানো, ঠিক এই আকারে, আর কিছু নয় — কোনো ব্যাখ্যা, কোনো markdown কোড ব্লক, কোনো অতিরিক্ত লেখা নয়:

{
  "customer_name": "string বা null যদি না থাকে",
  "customer_phone": "string বা null যদি না থাকে (১০ সংখ্যার ভারতীয় নম্বর হলে বসাও)",
  "paid_amount": number বা null (যদি স্পষ্ট বলা থাকে যে কত টাকা পরিশোধ হয়েছে),
  "items": [
    { "item_name": "string (বাংলায় লেখো)", "quantity": number, "unit": "string (যেমন কেজি, লিটার, পিস, প্যাকেট)", "unit_price": number }
  ]
}

নিয়ম:
- পণ্যের নাম সবসময় বাংলায় লিখবে, দাম ও পরিমাণ সংখ্যায়।
- একক (unit) না বলা থাকলে "পিস" ধরে নাও।
- দাম বা পরিমাণ একদমই বোঝা না গেলে সেই item বাদ দাও।
- কমপক্ষে একটা item থাকতেই হবে, নাহলে items: []।
- শুধু JSON আউটপুট দাও, আর কিছু না।`

interface ParsedItem { item_name: string; quantity: number; unit: string; unit_price: number }
interface ParsedInvoice {
  customer_name: string | null
  customer_phone: string | null
  paid_amount: number | null
  items: ParsedItem[]
}

function safeParseJson(raw: string): ParsedInvoice | null {
  // Models sometimes wrap JSON in ```json fences despite instructions — strip them.
  const cleaned = raw.replace(/```json|```/g, '').trim()
  try {
    const obj = JSON.parse(cleaned)
    if (!Array.isArray(obj.items)) return null
    return {
      customer_name: obj.customer_name || null,
      customer_phone: obj.customer_phone || null,
      paid_amount: typeof obj.paid_amount === 'number' ? obj.paid_amount : null,
      items: obj.items
        .filter((i: any) => i && i.item_name && Number(i.quantity) > 0 && Number(i.unit_price) >= 0)
        .map((i: any) => ({
          item_name: String(i.item_name).trim(),
          quantity: Number(i.quantity),
          unit: String(i.unit || 'পিস').trim(),
          unit_price: Number(i.unit_price),
        })),
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'কিছু লিখুন বা বলুন আগে।' }, { status: 400 })
  }

  const key = process.env.GROQ_API_KEY
  if (!key) {
    return NextResponse.json({ error: 'AI সার্ভিস কনফিগার করা নেই (GROQ_API_KEY)।' }, { status: 500 })
  }

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_tokens: 800,
          temperature: 0.1,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.trim() },
          ],
        }),
      })
      if (!res.ok) continue

      const data = await res.json()
      const raw: string = data?.choices?.[0]?.message?.content?.trim() || ''
      if (!raw) continue

      const parsed = safeParseJson(raw)
      if (!parsed) continue

      if (!parsed.items.length) {
        return NextResponse.json(
          { error: 'কোনো পণ্য বোঝা যায়নি। পণ্যের নাম, পরিমাণ ও দাম বলে/লিখে আবার চেষ্টা করুন। যেমন: "রাহুলকে ৫ কেজি চাল ৬০ টাকা করে"' },
          { status: 422 }
        )
      }

      return NextResponse.json({ result: parsed })
    } catch (e) {
      console.error(`[invoice-ai-parse] ${model} failed`, e)
    }
  }

  return NextResponse.json({ error: 'AI থেকে উত্তর পাওয়া যায়নি, একটু পরে আবার চেষ্টা করুন।' }, { status: 502 })
}
