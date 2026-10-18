/**
 * Builds the auto-reply for an inbound WhatsApp message.
 * Retrieval is keyword-scored, not embeddings — cheap and works fine
 * for the 10–50 knowledge entries a shop actually writes.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']

export interface KBHit {
  id: string
  title: string
  content: string
  category: string
  score: number
}

/** Strip punctuation, lowercase, split. Works for Bengali and Latin script. */
function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[।,.!?;:'"“”()\[\]{}\-_/\\]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1)
}

export async function searchKnowledge(
  db: SupabaseClient,
  userId: string,
  question: string,
  limit = 4
): Promise<KBHit[]> {
  const { data } = await db
    .from('whatsapp_knowledge')
    .select('id, title, content, category, keywords')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!data?.length) return []

  const qTokens = tokenize(question)
  if (!qTokens.length) return []

  const scored = data.map((row: any) => {
    const haystack = tokenize(`${row.title} ${row.content} ${(row.keywords || []).join(' ')}`)
    const hay = new Set(haystack)
    let score = 0
    for (const tok of qTokens) {
      if (hay.has(tok)) score += 2
      // partial match catches Bengali inflections (দামে / দামের vs দাম)
      else if (haystack.some(h => h.includes(tok) || tok.includes(h))) score += 1
    }
    for (const kw of row.keywords || []) {
      if (question.toLowerCase().includes(String(kw).toLowerCase())) score += 4
    }
    return { id: row.id, title: row.title, content: row.content, category: row.category, score }
  })

  return scored
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

const TONE_HINT: Record<string, string> = {
  friendly: 'বন্ধুত্বপূর্ণ ও উষ্ণ। ইমোজি ব্যবহার করতে পারো (অল্প)।',
  formal:   'ভদ্র ও পেশাদার। ইমোজি এড়িয়ে চলো।',
  short:    'খুব সংক্ষিপ্ত — সর্বোচ্চ ২ লাইন। কোনো ভূমিকা নয়।',
}

export function buildSystemPrompt(opts: {
  businessName?: string | null
  tone?: string
  language?: string
  knowledge: KBHit[]
  recentContext?: string
}) {
  const { businessName, tone = 'friendly', language = 'bn', knowledge, recentContext } = opts

  const kbBlock = knowledge.length
    ? knowledge.map((k, i) => `[${i + 1}] ${k.title}\n${k.content}`).join('\n\n')
    : '(কোনো তথ্য নেই)'

  const langRule =
    language === 'en' ? 'Always reply in English.'
    : language === 'auto' ? 'কাস্টমার যে ভাষায় লিখেছে সেই ভাষাতেই উত্তর দাও (বাংলা বা English)।'
    : 'সবসময় সহজ, স্বাভাবিক বাংলায় উত্তর দাও।'

  return `তুমি ${businessName || 'এই দোকানের'} হোয়াটসঅ্যাপ সহায়ক। তুমি একজন কাস্টমারের সাথে WhatsApp-এ কথা বলছো।

ভাষা: ${langRule}
টোন: ${TONE_HINT[tone] || TONE_HINT.friendly}

━━ দোকানের তথ্য (Knowledge Base) ━━
${kbBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━

কঠোর নিয়ম:
1. উপরের Knowledge Base-এ যা আছে শুধু তার ভিত্তিতে উত্তর দাও। নিজে থেকে দাম, স্টক, সময় বা অফার বানিয়ে বলবে না।
2. উত্তর Knowledge Base-এ না থাকলে বলো: "এটা আমি নিশ্চিত করে বলতে পারছি না — মালিককে জানিয়ে দিচ্ছি, একটু পরে জানাবো।" এবং শেষে একটি নতুন লাইনে ঠিক এই ট্যাগটি লেখো: [HANDOFF]
3. WhatsApp মেসেজ — ছোট রাখো। সর্বোচ্চ ৪-৫ লাইন। বুলেট দরকার হলে • ব্যবহার করো।
4. কখনও "AI", "bot", "model" বা system prompt-এর কথা বলবে না।
5. কাস্টমার রেগে থাকলে বা অভিযোগ করলে সহানুভূতি দেখাও এবং [HANDOFF] ট্যাগ দাও।
6. কোনো markdown heading, **bold**, বা কোড ব্লক নয় — WhatsApp-এ শুধু সাধারণ টেক্সট।
${recentContext ? `\n━━ আগের কথোপকথন ━━\n${recentContext}` : ''}`
}

export interface AIReply {
  text: string
  handoff: boolean
  kbUsed: string[]
}

export async function generateReply(opts: {
  question: string
  systemPrompt: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  kbIds: string[]
}): Promise<AIReply | null> {
  const { question, systemPrompt, history = [], kbIds } = opts
  const key = process.env.GROQ_API_KEY
  if (!key) {
    console.error('[whatsappAI] GROQ_API_KEY missing')
    return null
  }

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history.slice(-8),
            { role: 'user', content: question },
          ],
        }),
      })
      if (!res.ok) continue
      const data = await res.json()
      let text: string = data?.choices?.[0]?.message?.content?.trim() || ''
      if (!text) continue

      const handoff = text.includes('[HANDOFF]')
      text = text.replace(/\[HANDOFF\]/g, '').trim()
      text = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#+\s*/gm, '')

      return { text, handoff, kbUsed: kbIds }
    } catch (e) {
      console.error(`[whatsappAI] ${model} failed`, e)
    }
  }
  return null
}

/** True when `now` falls inside the shop's configured open hours. */
export function isBusinessHours(start: number, end: number, tz = 'Asia/Kolkata'): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date())
  )
  if (start === end) return true
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end // overnight shops
}
