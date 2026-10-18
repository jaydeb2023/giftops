import { NextRequest, NextResponse } from 'next/server'

// Same Groq setup/fallback pattern as /api/chat and /api/agent-chat, kept
// consistent rather than introducing a third AI provider just for this panel.
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
      max_tokens: 700,
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

// POST /api/team/assistant — { question, roster, persona }
// `roster` is a small, already-fetched summary of the owner's own team
// (name/position/status/agents/last-active) built client-side from the
// same data the table renders — this route never queries the DB itself,
// it only reasons over what the client already legitimately has.
export async function POST(req: NextRequest) {
  try {
    const { question, roster, persona } = await req.json()
    if (!question || !String(question).trim()) {
      return NextResponse.json({ answer: 'একটা প্রশ্ন লিখুন।' })
    }

    const rosterJson = JSON.stringify(Array.isArray(roster) ? roster.slice(0, 200) : [])

    const personaFraming: Record<string, string> = {
      hr: 'তুমি একজন HR Assistant — কর্মীদের অবস্থা, স্ট্যাটাস, এবং সাধারণ টিম-ব্যবস্থাপনা প্রশ্নে সাহায্য করো।',
      recruiter: 'তুমি একজন Recruiter Assistant — নতুন নিয়োগ, পদবী, এবং কে কোন এজেন্টে কাজ করছে তা নিয়ে সাহায্য করো।',
      payroll: 'তুমি একজন Payroll Assistant — কর্মীদের সংখ্যা, পদবী অনুযায়ী ভাগ, এবং হিসাব-সম্পর্কিত প্রশ্নে সাহায্য করো। তুমি বেতনের নির্দিষ্ট সংখ্যা জানো না, শুধু এই তালিকার তথ্য ব্যবহার করো।',
    }
    const framing = personaFraming[persona] || personaFraming.hr

    const system =
      `তুমি "Sahayak AI"-এর টিম ও কর্মচারী ব্যবস্থাপনা প্যানেলের একজন সহায়ক। ${framing} ` +
      `শুধু বাংলায়, সংক্ষিপ্ত ও স্পষ্টভাবে উত্তর দাও। ` +
      `নিচে ব্যবহারকারীর নিজের টিমের তালিকা JSON আকারে দেওয়া হলো — শুধু এই তথ্যের ভিত্তিতে উত্তর দাও, ` +
      `অনুমান করে নতুন তথ্য বানিও না। কোনো নাম না থাকলে "কোনো তথ্য পাওয়া যায়নি" বলো।\n\n` +
      `টিম তালিকা:\n${rosterJson}`

    let answer = ''
    let lastError = ''
    for (const model of GROQ_MODELS) {
      try {
        answer = await callGroq(model, system, [{ role: 'user', content: String(question) }])
        break
      } catch (err: any) {
        lastError = err.message
        continue
      }
    }

    if (!answer) {
      console.error('team/assistant: all models failed:', lastError)
      return NextResponse.json({ answer: 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।' })
    }

    return NextResponse.json({ answer })
  } catch (e) {
    console.error('team/assistant error:', e)
    return NextResponse.json({ answer: 'সমস্যা হয়েছে, আবার চেষ্টা করুন।' })
  }
}
