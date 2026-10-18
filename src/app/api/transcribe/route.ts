// src/app/api/transcribe/route.ts
//
// Speech-to-text for every chat/voice box in the app.
// The browser records audio (MediaRecorder) and posts it here; we send it to
// Groq's Whisper and return plain text. Why server-side Whisper instead of the
// browser's built-in speech engine: it is far better at Bengali + English mixed
// speech ("আজকে stock এ কী কী মাল আছে") and we can hint it with the shop's own
// product / customer names so local words are spelled correctly.
//
// Safety rules baked in (Whisper is known to "invent" text on silence):
//   • only signed-in users can call it (it spends your Groq quota)
//   • segments Whisper itself flags as non-speech / low-confidence / looping are dropped
//   • well-known phantom phrases ("Thank you.", "Subtitles by …") are dropped
//   • the text is only ever returned to the input box — the user still reviews it
//     and taps Send, so a mis-heard word never writes to the database unseen.
import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'
import { buildPrompt, cleanTranscript } from '@/lib/transcribeUtils'
import { serviceClient } from '@/lib/chatAuth'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { loadVocab } from '@/lib/chatVocab'
import { DICTIONARY, kindsForVertical, type DictVertical } from '@/lib/productDictionary'
import { normalizeMessage } from '@/lib/bnNormalize'

export const runtime = 'nodejs'
export const maxDuration = 30

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const PRIMARY_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3'
const FALLBACK_MODEL = 'whisper-large-v3-turbo'

const MAX_BYTES = 4 * 1024 * 1024      // Vercel request bodies top out at ~4.5 MB
const MIN_BYTES = 1500                 // anything smaller is just container headers
const ALLOWED_TYPE = /^(audio|video)\/(webm|ogg|mp4|mpeg|mpga|m4a|x-m4a|wav|x-wav|flac|aac)/i

// ── very small per-user rate limit (best effort: memory is per server instance)
const RATE_WINDOW_MS = 60_000
const RATE_MAX = 20
const hits = new Map<string, number[]>()
function rateLimited(userId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(userId) || []).filter(t => now - t < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) { hits.set(userId, recent); return true }
  recent.push(now)
  hits.set(userId, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < RATE_WINDOW_MS)) hits.delete(k)
  return false
}

async function callGroq(file: Blob, filename: string, model: string, lang: 'bn' | 'en', prompt: string) {
  const fd = new FormData()
  fd.append('file', file, filename)
  fd.append('model', model)
  fd.append('language', lang)
  fd.append('temperature', '0')
  fd.append('response_format', 'verbose_json')
  if (prompt) fd.append('prompt', prompt)
  return fetch(GROQ_URL, { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` }, body: fd })
}

// ── 2nd pass: turn what Whisper heard into what the speaker MEANT ──────────
// Whisper hears sounds; shopkeepers speak in Bengali, regional dialects (Rarhi, Sylheti,
// Chittagonian, Rangpuri, Noakhali…), Hindi/Bhojpuri words and English product names, all
// mixed. A short LLM pass fixes mis-heard words against this shop's OWN product / customer
// names, turns spoken numbers into digits and drops noise — without changing the meaning.
const LLM_URL = 'https://api.groq.com/openai/v1/chat/completions'
const FIX_MODEL = process.env.GROQ_VOICE_FIX_MODEL || 'llama-3.3-70b-versatile'

async function understand(raw: string, products: string, customers: string, agent: string): Promise<string> {
  const system = `You clean up speech-to-text for a Bengali small-business assistant (shops, pharmacy, clothing, hotel, sweets) in West Bengal and Bangladesh.
The speaker may use standard Bengali, regional dialects, Hindi/Bhojpuri/Urdu words, or English mixed in. The transcript may contain mis-heard words and noise artifacts.
Output the sentence the speaker MEANT, as ONE line, keeping the same mix of scripts (English product names stay English).
Rules:
1. Fix mis-heard words using KNOWN PRODUCTS and KNOWN CUSTOMERS — if a heard word sounds like one of them, write it exactly as in the list.
2. Spoken numbers/fractions → digits: পাঁচ=5, আড়াই=2.5, দেড়=1.5, সোয়া=1.25, সাড়ে তিন=3.5, এক হাজার=1000. Money: টাকা/ট্যাকা/রুপি → টাকা.
3. Units: কিলো/কিলু→কেজি, গোটা/টা→পিস, ডজন, প্যাকেট, বোতল, পাতা, সের, পোয়া, লিটার, গ্রাম.
4. Keep the intent words exactly: বিক্রি/বেচলাম/দিলাম = sale; কিনলাম/আনলাম/এলো = purchase / stock in; বাকি/ধার = credit; জমা/পেলাম/দিয়েছে = payment received.
5. NEVER add items, quantities, prices or names that were not spoken. Do not answer the question, do not explain.
6. If the transcript is only noise or meaningless fragments, output an empty line.
Output ONLY the corrected text.`
  const user = `BUSINESS: ${agent || 'general shop'}
KNOWN PRODUCTS: ${products || '—'}
KNOWN CUSTOMERS: ${customers || '—'}
TRANSCRIPT: ${raw}`
  const r = await fetch(LLM_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: FIX_MODEL, temperature: 0, max_tokens: 300, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  })
  if (!r.ok) return raw
  const out = String((await r.json())?.choices?.[0]?.message?.content || '').replace(/^["“'`]+|["”'`]+$/g, '').trim()
  if (!out) return raw.split(/\s+/).length <= 2 ? '' : raw      // noise → nothing; real speech → keep Whisper's text
  if (out.length > raw.length * 2 + 30) return raw               // it started "answering" → ignore
  return out
}

const fail = (status: number, error: string, message: string) =>
  NextResponse.json({ error, message }, { status })

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail(401, 'unauthorized', 'আবার লগইন করুন।')
    if (rateLimited(user.id)) return fail(429, 'rate_limited', 'একটু পরে আবার চেষ্টা করুন।')
    if (!process.env.GROQ_API_KEY) return fail(500, 'not_configured', 'ভয়েস সার্ভিস চালু নেই।')

    let form: FormData
    try { form = await req.formData() } catch { return fail(400, 'bad_request', 'অডিও পাওয়া যায়নি।') }

    const audio = form.get('audio')
    if (!(audio instanceof Blob)) return fail(400, 'no_audio', 'অডিও পাওয়া যায়নি।')
    if (audio.size > MAX_BYTES) return fail(413, 'too_large', 'রেকর্ডিং অনেক বড় — ছোট করে বলুন।')
    if (audio.size < MIN_BYTES) return NextResponse.json({ text: '' })
    if (audio.type && !ALLOWED_TYPE.test(audio.type)) return fail(415, 'bad_type', 'এই অডিও ফরম্যাট সমর্থিত নয়।')

    const lang: 'bn' | 'en' = form.get('lang') === 'en' ? 'en' : 'bn'
    const prompt = buildPrompt(String(form.get('hint') || ''), lang)
    const ext = /mp4|m4a|aac/i.test(audio.type) ? 'm4a' : /ogg/i.test(audio.type) ? 'ogg' : /wav/i.test(audio.type) ? 'wav' : 'webm'
    const filename = `voice.${ext}`

    // 1st try: best model + vocabulary prompt
    let res = await callGroq(audio, filename, PRIMARY_MODEL, lang, prompt)
    // If Groq rejects the prompt, retry once without it
    if (res.status === 400 && prompt) {
      const body = await res.clone().text().catch(() => '')
      if (/prompt/i.test(body)) res = await callGroq(audio, filename, PRIMARY_MODEL, lang, '')
    }
    // Overloaded / rate limited → faster model
    if ((res.status === 429 || res.status >= 500) && PRIMARY_MODEL !== FALLBACK_MODEL) {
      res = await callGroq(audio, filename, FALLBACK_MODEL, lang, prompt)
    }
    if (!res.ok) {
      console.error('transcribe: Groq error', res.status, (await res.text().catch(() => '')).slice(0, 300))
      return fail(502, 'stt_failed', 'ভয়েস বুঝতে পারিনি — আবার চেষ্টা করুন বা টাইপ করুন।')
    }
    const data = await res.json()
    const raw = cleanTranscript(data)
    if (!raw) return NextResponse.json({ text: '' })

    // Understand what was meant, using this shop's own words (best effort — falls back to Whisper's text)
    let text = raw
    try {
      const agent = String(form.get('agent') || '')
      const sb = serviceClient()
      const access = await resolveEffectiveAccess(sb, user.id)
      const vocab = await loadVocab(sb, access.ownerId, agent || null, access.role !== 'stock')
      // The shop's own names first, then the built-in dictionary for this kind of shop (Bengali + English spelling),
      // so even a brand-new shop with an empty stock list gets "প্যারাসিটামল", "চাল", "ময়দা" … heard correctly.
      const vertical: DictVertical = /pharm|farme/.test(agent) ? 'pharmacy' : /kapor/.test(agent) ? 'kapor' : /mishti/.test(agent) ? 'mishti'
        : /hotel|dhaba/.test(agent) ? 'hotel' : /dokan|crm/.test(agent) ? 'dokan' : 'general'
      const kinds = kindsForVertical(vertical)
      const dict = DICTIONARY.filter(e => kinds.includes(e.kind)).map(e => `${e.aliases.find(a => /[ঀ-৿]/.test(a)) || e.name} (${e.name})`)
      const products = [...vocab.products.slice(0, 120).map(p => (p.sku ? `${p.name} (${p.sku})` : p.name)), ...dict].join(', ').slice(0, 3200)
      const customers = vocab.customers.slice(0, 60).join(', ').slice(0, 700)
      text = await understand(raw, products, customers, agent)
      text = normalizeMessage(text)          // spoken numbers → digits ("পঞ্চাশ পিস" → "50 পিস") so what you see is what is parsed
    } catch (e: any) {
      console.error('transcribe: understand pass skipped:', e?.message)
    }
    return NextResponse.json({ text, raw: text !== raw ? raw : undefined })
  } catch (e: any) {
    console.error('transcribe: unexpected error', e?.message)
    return fail(500, 'server_error', 'ভয়েস বুঝতে পারিনি — আবার চেষ্টা করুন।')
  }
}
