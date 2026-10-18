import { NextRequest, NextResponse } from 'next/server'

const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
]

async function callGroq(model: string, systemPrompt: string, messages: any[]) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Groq error (${model}): ${response.status} - ${err}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Empty response from Groq')
  return content
}

export async function POST(req: NextRequest) {
  try {
    const { messages, systemPrompt } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json({ content: 'কোনো বার্তা পাওয়া যায়নি।' })
    }

    // Build clean message history — skip first assistant greeting
    const history = messages
      .filter((_: any, i: number) => i > 0)
      .map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }))

    const finalMessages = history.length > 0
      ? history
      : [{ role: 'user', content: messages[messages.length - 1]?.content || 'হ্যালো' }]

    const system = systemPrompt ||
      `তুমি একজন সহায়ক বাংলা AI assistant। সবসময় বাংলায় উত্তর দাও।
       সংক্ষিপ্ত, স্পষ্ট এবং বন্ধুত্বপূর্ণভাবে উত্তর দাও।
       ব্যবহারকারীর প্রশ্ন বুঝে সঠিক তথ্য দাও।`

    // Try each model in order until one works
    let content = ''
    let lastError = ''

    for (const model of GROQ_MODELS) {
      try {
        content = await callGroq(model, system, finalMessages)
        break
      } catch (err: any) {
        lastError = err.message
        console.error(`Model ${model} failed:`, err.message)
        continue
      }
    }

    if (!content) {
      console.error('All Groq models failed:', lastError)
      return NextResponse.json({
        content: 'দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।'
      })
    }

    return NextResponse.json({ content })

  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json({
      content: 'দুঃখিত, একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।'
    }, { status: 200 })
  }
}
