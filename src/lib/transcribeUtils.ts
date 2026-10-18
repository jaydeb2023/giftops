// src/lib/transcribeUtils.ts
// Pure helpers for /api/transcribe (kept out of route.ts because Next.js only
// allows HTTP-method exports from a route file).

// Whisper's prompt is capped at 224 tokens and Bengali is token-hungry, so keep
// it short. Names beyond this budget are simply not hinted.
const PROMPT_CHAR_BUDGET = 150

// ── prompt = a few shop words + this shop's own vocabulary
export function buildPrompt(hint: string, lang: 'bn' | 'en'): string {
  const names: string[] = []
  const seen = new Set<string>()
  for (const raw of (hint || '').split('|')) {
    const n = raw.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30)
    if (!n || seen.has(n.toLowerCase())) continue
    seen.add(n.toLowerCase()); names.push(n)
    if (names.length >= 40) break
  }
  const base = lang === 'en' ? 'Shop stock, sales, dues.' : 'দোকানের স্টক, বিক্রি, বাকি।'
  let prompt = base
  for (const n of names) {
    const next = `${prompt} ${n},`
    if (next.length > PROMPT_CHAR_BUDGET) break
    prompt = next
  }
  return prompt.replace(/,$/, '.')
}

// ── phantom-text filters ────────────────────────────────────────────────────
const PHANTOM = [
  /^(thank you( so much)?( for watching)?|thanks for watching|please subscribe|bye+)[.!\s]*$/i,
  /^(subtitles? (by|made by)|captions? by|transcribed by|amara\.org|www\.).*/i,
  /^(\.|,|-|…|\s)+$/,
]

// "আলু আলু আলু আলু …" loops — keep at most 3 in a row.
export function collapseRepeats(text: string): string {
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  let run = 0
  for (const w of words) {
    if (out.length && out[out.length - 1] === w) { run++; if (run >= 3) continue } else run = 0
    out.push(w)
  }
  return out.join(' ')
}

type Segment = { text?: string; no_speech_prob?: number; avg_logprob?: number; compression_ratio?: number }

export function cleanTranscript(data: { text?: string; segments?: Segment[] }): string {
  let text = ''
  if (Array.isArray(data.segments) && data.segments.length) {
    const kept = data.segments.filter(s => {
      const noSpeech = (s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -0.8   // Whisper's own "this is silence" rule
      const looping = (s.compression_ratio ?? 0) > 2.4                                 // repetitive garbage
      const veryUnsure = (s.avg_logprob ?? 0) < -1.6
      return !(noSpeech || looping || veryUnsure)
    })
    text = kept.map(s => (s.text || '').trim()).join(' ')
  } else {
    text = data.text || ''
  }
  text = collapseRepeats(text.replace(/\s+/g, ' ').trim())
  if (PHANTOM.some(re => re.test(text))) return ''
  return text
}
