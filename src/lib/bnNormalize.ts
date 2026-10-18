// src/lib/bnNormalize.ts
// ─────────────────────────────────────────────────────────────────
// Turns the many ways a shop owner says a number into plain digits, so
// every regex / Number() downstream sees "5", never "৫" or "পাঁচ".
//
//   ৫ কেজি            → 5 কেজি
//   পাঁচ কেজি         → 5 কেজি
//   দেড় কেজি          → 1.5 কেজি
//   আড়াই কেজি         → 2.5 কেজি
//   সাড়ে তিন কেজি     → 3.5 কেজি
//   আধা কেজি          → 0.5 কেজি
//   সোয়া এক / পৌনে দুই → 1.25 / 1.75
//   দুইশো পঞ্চাশ টাকা  → 250 টাকা
//   পাঁচ হাজার         → 5000
//   পাঁচটা ডিম         → 5 পিস ডিম
// Only whole words are converted, so names like "একতারা" stay untouched.
// ─────────────────────────────────────────────────────────────────

/** ০-৯ → 0-9 (JS `\d` and Number() do not understand Bengali digits). */
export function normalizeDigits(s: string): string {
  return (s || '').replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
}

const nfc = (s: string) => s.normalize('NFC').replace(/[\u200c\u200d]/g, '')

// ── 1–100 and common spelling variants ────────────────────────────
const RAW_WORDS: Record<string, number> = {
  'শূন্য': 0,
  'এক': 1, 'দুই': 2, 'দু': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5, 'পাচ': 5, 'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9,
  'দশ': 10, 'এগারো': 11, 'এগার': 11, 'বারো': 12, 'তেরো': 13, 'তের': 13, 'চৌদ্দ': 14, 'পনেরো': 15, 'পনের': 15,
  'ষোলো': 16, 'ষোল': 16, 'সতেরো': 17, 'সতের': 17, 'আঠারো': 18, 'আঠার': 18, 'উনিশ': 19, 'ঊনিশ': 19,
  'বিশ': 20, 'কুড়ি': 20, 'একুশ': 21, 'বাইশ': 22, 'তেইশ': 23, 'চব্বিশ': 24, 'পঁচিশ': 25, 'পচিশ': 25, 'ছাব্বিশ': 26, 'সাতাশ': 27, 'আঠাশ': 28, 'আটাশ': 28,
  'ঊনত্রিশ': 29, 'উনত্রিশ': 29, 'ত্রিশ': 30, 'তিরিশ': 30, 'একত্রিশ': 31, 'বত্রিশ': 32, 'তেত্রিশ': 33, 'চৌত্রিশ': 34, 'পঁয়ত্রিশ': 35,
  'ছত্রিশ': 36, 'সাঁইত্রিশ': 37, 'আটত্রিশ': 38, 'ঊনচল্লিশ': 39, 'উনচল্লিশ': 39, 'চল্লিশ': 40, 'একচল্লিশ': 41, 'বিয়াল্লিশ': 42,
  'তেতাল্লিশ': 43, 'চুয়াল্লিশ': 44, 'পঁয়তাল্লিশ': 45, 'ছেচল্লিশ': 46, 'সাতচল্লিশ': 47, 'আটচল্লিশ': 48, 'ঊনপঞ্চাশ': 49, 'উনপঞ্চাশ': 49,
  'পঞ্চাশ': 50, 'একান্ন': 51, 'বায়ান্ন': 52, 'তিপ্পান্ন': 53, 'চুয়ান্ন': 54, 'পঞ্চান্ন': 55, 'ছাপ্পান্ন': 56, 'সাতান্ন': 57, 'আটান্ন': 58,
  'ঊনষাট': 59, 'উনষাট': 59, 'ষাট': 60, 'একষট্টি': 61, 'বাষট্টি': 62, 'তেষট্টি': 63, 'চৌষট্টি': 64, 'পঁয়ষট্টি': 65, 'ছেষট্টি': 66,
  'সাতষট্টি': 67, 'আটষট্টি': 68, 'ঊনসত্তর': 69, 'উনসত্তর': 69, 'সত্তর': 70, 'একাত্তর': 71, 'বাহাত্তর': 72, 'তিয়াত্তর': 73,
  'চুয়াত্তর': 74, 'পঁচাত্তর': 75, 'ছিয়াত্তর': 76, 'সাতাত্তর': 77, 'আটাত্তর': 78, 'ঊনআশি': 79, 'উনআশি': 79, 'আশি': 80,
  'একাশি': 81, 'বিরাশি': 82, 'তিরাশি': 83, 'চুরাশি': 84, 'পঁচাশি': 85, 'ছিয়াশি': 86, 'সাতাশি': 87, 'অষ্টাশি': 88, 'আটাশি': 88,
  'ঊননব্বই': 89, 'উননব্বই': 89, 'নব্বই': 90, 'একানব্বই': 91, 'বিরানব্বই': 92, 'তিরানব্বই': 93, 'চুরানব্বই': 94,
  'পঁচানব্বই': 95, 'ছিয়ানব্বই': 96, 'সাতানব্বই': 97, 'আটানব্বই': 98, 'নিরানব্বই': 99, 'নিরানকাই': 99,
}
const HALVES: Record<string, number> = { 'দেড়': 1.5, 'আড়াই': 2.5, 'আধা': 0.5, 'আধ': 0.5, 'অর্ধেক': 0.5 }
const SCALES: Record<string, number> = { 'শো': 100, 'শ': 100, 'শত': 100, 'হাজার': 1000, 'লাখ': 100000, 'লক্ষ': 100000 }
const FRACTION_PREFIX: Record<string, number> = { 'সাড়ে': 0.5, 'সোয়া': 0.25, 'পৌনে': -0.25 }
const CLASSIFIER = /(টি|টা|টে|টো)$/

const WORDS = new Map<string, number>(Object.entries(RAW_WORDS).map(([k, v]) => [nfc(k), v]))
const HALF_MAP = new Map<string, number>(Object.entries(HALVES).map(([k, v]) => [nfc(k), v]))
const SCALE_MAP = new Map<string, number>(Object.entries(SCALES).map(([k, v]) => [nfc(k), v]))
const PREFIX_MAP = new Map<string, number>(Object.entries(FRACTION_PREFIX).map(([k, v]) => [nfc(k), v]))

// Speech-to-text and quick typing blur শ/স, ন/ণ/ঞ, ি/ী … so "তিরিস", "পন্চাস", "সাতাস" must still read as
// তিরিশ / পঞ্চাশ / সাতাশ. Used only as a fallback when the exact word is not found, and only when the
// folded spelling points to exactly one number.
const fold = (w: string) => nfc(w).replace(/[ঁ়]/g, '').replace(/[ণঞ]/g, 'ন').replace(/[শষ]/g, 'স')
  .replace(/ী/g, 'ি').replace(/ূ/g, 'ু').replace(/ঊ/g, 'উ').replace(/ঈ/g, 'ই').replace(/য়/g, 'য').replace(/ৎ/g, 'ত')
const FOLDED = new Map<string, number | null>()
for (const [k, v] of Array.from(WORDS.entries())) {
  if (k.length < 3) continue
  const f = fold(k)
  FOLDED.set(f, FOLDED.has(f) && FOLDED.get(f) !== v ? null : v)
}

interface Atom { n: number; scale: number | null; classifier: boolean }

/** Reads ONE token as a number atom, or null if it is not a number word/digit. */
// Short spoken forms that are only safe when glued to শো/শ (ছশো = 600, নশো = 900). Alone, ছ / ন are just letters.
const COLLOQ_BASE: Record<string, number> = { 'ছ': 6, 'ন': 9, 'সাত': 7, 'আট': 8 }

function readAtom(tokRaw: string): Atom | null {
  const tok = nfc(tokRaw)
  if (!tok) return null
  if (/^\d+(\.\d+)?$/.test(tok)) return { n: Number(tok), scale: null, classifier: false }
  if (WORDS.has(tok)) return { n: WORDS.get(tok)!, scale: null, classifier: false }
  if (tok.length >= 3) { const fv = FOLDED.get(fold(tok)); if (fv !== undefined && fv !== null) return { n: fv, scale: null, classifier: false } }
  if (HALF_MAP.has(tok)) return { n: HALF_MAP.get(tok)!, scale: null, classifier: false }

  // classifier suffix: পাঁচটা / দুটো / তিনটি → number + "পিস"
  const m = tok.match(CLASSIFIER)
  if (m) {
    const base = tok.slice(0, tok.length - m[0].length)
    if (WORDS.has(base)) return { n: WORDS.get(base)!, scale: null, classifier: true }
    if (/^\d+$/.test(base)) return { n: Number(base), scale: null, classifier: true }
  }

  // glued scale: পাঁচশো / দেড়শো / আড়াইশো / 5শো
  for (const [sw, sv] of Array.from(SCALE_MAP.entries()).sort((a, b) => b[0].length - a[0].length)) {
    if (tok.length > sw.length && tok.endsWith(sw)) {
      const base = tok.slice(0, tok.length - sw.length)
      if (WORDS.has(base)) return { n: WORDS.get(base)!, scale: sv, classifier: false }
      if (COLLOQ_BASE[base] !== undefined) return { n: COLLOQ_BASE[base], scale: sv, classifier: false }   // ছশো / নশো (spoken short forms)
      if (HALF_MAP.has(base)) return { n: HALF_MAP.get(base)!, scale: sv, classifier: false }
      if (/^\d+(\.\d+)?$/.test(base)) return { n: Number(base), scale: sv, classifier: false }
    }
  }
  return null
}

const UNIT_CONTEXT = /^(কেজি|কিলো|কিলোগ্রাম|গ্রাম|লিটার|মিলি|পিস|প্যাকেট|বস্তা|ডজন|বোতল|কার্টন|টাকা|হাজার|শো|শ|শত)/

const round = (v: number) => Math.round(v * 1000) / 1000

/**
 * Tries to read a full number expression starting at tokens[i].
 * Returns the numeric value, how many tokens were used, and whether it
 * ended with a classifier (টা/টি) so the caller can append "পিস".
 */
function readNumber(tokens: string[], i: number): { value: number; used: number; classifier: boolean } | null {
  let j = i
  let prefix: number | null = null

  const first = nfc(tokens[j] || '')
  if (PREFIX_MAP.has(first)) { prefix = PREFIX_MAP.get(first)!; j++ }
  if (j >= tokens.length) return null

  // "নয়" also means "is not" — only read it as 9 when a unit / money word follows.
  if (nfc(tokens[j]) === 'নয়' && !UNIT_CONTEXT.test(nfc(tokens[j + 1] || ''))) return null
  const a = readAtom(tokens[j])
  if (!a) return null
  // A bare digit token that is just a plain number (e.g. "230") must stay as it is
  // unless a prefix / scale word is attached.
  j++

  let scale = a.scale
  // separate scale word: "দুই হাজার", "সাড়ে তিন শো"
  if (scale === null && j < tokens.length && SCALE_MAP.has(nfc(tokens[j]))) {
    scale = SCALE_MAP.get(nfc(tokens[j]))!
    j++
  }

  let base = a.n
  if (prefix !== null) base += prefix
  let value = base * (scale ?? 1)

  // trailing smaller part: "দুইশো পঞ্চাশ" → 250, "এক হাজার পাঁচশো" → 1500
  if (scale !== null && scale >= 100) {
    let lastScale = scale
    while (j < tokens.length) {
      const nxt = readAtom(tokens[j])
      if (!nxt || nxt.classifier) break
      let add = nxt.n
      let take = 1
      if (nxt.scale === null && j + take < tokens.length && SCALE_MAP.has(nfc(tokens[j + take]))) {
        add = nxt.n * SCALE_MAP.get(nfc(tokens[j + take]))!
        take++
      } else if (nxt.scale !== null) {
        add = nxt.n * nxt.scale
      }
      if (add <= 0 || add >= lastScale) break
      value += add
      lastScale = add >= 100 ? (nxt.scale ?? SCALE_MAP.get(nfc(tokens[j + take - 1])) ?? 1) : 0
      j += take
      if (lastScale < 100) break
    }
  }

  return { value: round(value), used: j - i, classifier: a.classifier && scale === null && prefix === null }
}

const PUNCT_EDGE = /^([,;:!?()"'“”‘’।]*)(.*?)([,;:!?()"'“”‘’।.]*)$/u

/** Bengali digits + number words → ASCII digits. Everything else is left as typed. */
export function normalizeMessage(input: string): string {
  const text = normalizeDigits(input || '')
  const lead = (text.match(/^\s*/) || [''])[0]
  const rest = text.slice(lead.length)

  // split into tokens, each remembering the whitespace that followed it
  const toks: { raw: string; pre: string; core: string; post: string; sep: string }[] = []
  const re = /(\S+)(\s*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rest))) {
    const e = m[1].match(PUNCT_EDGE) || []
    toks.push({ raw: m[1], pre: e[1] ?? '', core: e[2] ?? m[1], post: e[3] ?? '', sep: m[2] })
  }

  let out = lead
  let t = 0
  const cores = toks.map(x => x.core)
  while (t < toks.length) {
    const r = readNumber(cores.slice(t), 0)
    const plainDigit = !!r && r.used === 1 && /^\d+(\.\d+)?$/.test(toks[t].core)
    if (r && !plainDigit) {
      const last = t + r.used - 1
      out += toks[t].pre + String(r.value) + (r.classifier ? ' পিস' : '') + toks[last].post + toks[last].sep
      t += r.used
    } else {
      out += toks[t].raw + toks[t].sep
      t++
    }
  }
  return out
}
