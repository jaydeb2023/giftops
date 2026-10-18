// src/lib/stockParser.ts
// ─────────────────────────────────────────────────────────────────
// Deterministic (no-AI) reader for "add these products" / "sold these
// products" messages — typed OR spoken, ONE or MANY products at once.
//
//   "প্যারাসিটামল ৫০০ পাতা পার পাতা দশ টাকা মেয়াদ মার্চ দুই হাজার সাতাশ আর
//    গ্যাস্ট্রো ২০০ পিস ১০ টাকা"            → 2 separate items
//
// Rules that stop hallucination:
//   • Every number it returns was literally in the message.
//   • A product name is matched against the shop's own list + the built-in
//     dictionary; if nothing is close it stays as heard and is flagged
//     UNKNOWN — it is never replaced by a guess.
//   • Anything missing / unclear is flagged so the UI shows an editable
//     form for that item instead of the chat model "filling in" values.
// ─────────────────────────────────────────────────────────────────
import { normalizeMessage } from '@/lib/bnNormalize'
import { resolveProduct, nameSimilarity, kindsForVertical, type DictVertical, type ShopProductLite, type Candidate } from '@/lib/productDictionary'

export type Vertical = DictVertical

export function defaultUnit(v: Vertical): string {
  return v === 'pharmacy' ? 'পাতা' : v === 'kapor' || v === 'general' ? 'পিস' : 'কেজি'
}

export const DOKAN_UNITS = ['কেজি', 'গ্রাম', 'লিটার', 'মিলি', 'পিস', 'প্যাকেট', 'বস্তা', 'ডজন', 'বোতল', 'কার্টন']
export const PHARMA_UNITS = ['পাতা', 'পিস', 'ট্যাবলেট', 'ক্যাপসুল', 'বোতল', 'প্যাকেট', 'বক্স', 'টিউব', 'ভায়াল']
export const OTHER_UNITS = ['জোড়া', 'সেট', 'মিটার', 'ভাঁড়', 'প্লেট', 'কাপ', 'গ্লাস', 'বাটি']
export const ALL_UNITS = Array.from(new Set([...PHARMA_UNITS, ...DOKAN_UNITS, ...OTHER_UNITS]))

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(কেজি|কেজিতে|কিলোগ্রাম|কিলো|কেজী|kgs?|kilo)$/i, 'কেজি'],
  [/^(গ্রাম|gms?|grams?)$/i, 'গ্রাম'],
  [/^(লিটার|লিটর|litres?|liters?|ltr)$/i, 'লিটার'],
  [/^(মিলি|ml)$/i, 'মিলি'],
  [/^(পিস|পিছ|পিচ|পিসি|pcs?|pics?|pieces?|টা|টি|টে|খানা)$/i, 'পিস'],
  [/^(পাতা|পাত্তা|পাতি|স্ট্রিপ|স্ট্রীপ|strips?|strip|ষ্ট্রিপ)$/i, 'পাতা'],
  [/^(ট্যাবলেট|ট্যাবলেটস|টাবলেট|টেবলেট|টাবল|ট্যাবল|টেবল|tablets?|tabs?|বড়ি)$/i, 'ট্যাবলেট'],
  [/^(ক্যাপসুল|ক্যাপসুলস|ক্যাপ|capsules?|caps?)$/i, 'ক্যাপসুল'],
  [/^(প্যাকেট|পাকেট|প্যাক|packets?|pack|packs|পেকেট)$/i, 'প্যাকেট'],
  [/^(বস্তা|বস্তাতে|bosta|sack)$/i, 'বস্তা'],
  [/^(ডজন|dozen|doz)$/i, 'ডজন'],
  [/^(বোতল|বোতোল|শিশি|bottles?|সিরাপ|syrup)$/i, 'বোতল'],
  [/^(কার্টন|কার্টুন|cartons?)$/i, 'কার্টন'],
  [/^(বক্স|বাক্স|ডিব্বা|box|boxes)$/i, 'বক্স'],
  [/^(টিউব|tubes?)$/i, 'টিউব'],
  [/^(ভায়াল|vials?)$/i, 'ভায়াল'],
  [/^(জোড়া|জোড়|জোড়ি|pairs?)$/i, 'জোড়া'],
  [/^(সেট|set|sets)$/i, 'সেট'],
  [/^(মিটার|মিটর|meters?|metres?)$/i, 'মিটার'],
  [/^(ভাঁড়|ভাড়|ভাঁড়ে)$/i, 'ভাঁড়'],
  [/^(প্লেট|plates?)$/i, 'প্লেট'],
  [/^(কাপ|cups?)$/i, 'কাপ'],
  [/^(গ্লাস|glass|glasses)$/i, 'গ্লাস'],
  [/^(বাটি|bowls?)$/i, 'বাটি'],
]
const UNIT_WORDS = 'কেজিতে|কেজি|কেজী|কিলোগ্রাম|কিলো|kgs?|kilo|গ্রাম|gms?|grams?|লিটার|লিটর|litres?|liters?|ltr|মিলি|ml|পিস|পিছ|পিচ|পিসি|pcs?|pics?|pieces?|পাতা|পাত্তা|পাতি|স্ট্রিপ|স্ট্রীপ|strips?|ট্যাবলেটস|ট্যাবলেট|টাবলেট|টেবলেট|টাবল|ট্যাবল|টেবল|tablets?|tabs?|বড়ি|ক্যাপসুলস|ক্যাপসুল|ক্যাপ|capsules?|caps?|প্যাকেট|পাকেট|প্যাক|packets?|packs?|পেকেট|বস্তা|ডজন|dozen|doz|বোতল|বোতোল|শিশি|bottles?|সিরাপ|syrup|কার্টন|কার্টুন|cartons?|বক্স|বাক্স|ডিব্বা|box|boxes|টিউব|tubes?|ভায়াল|vials?|জোড়া|জোড়|জোড়ি|pairs?|সেট|sets?|মিটার|মিটর|meters?|metres?|ভাঁড়|প্লেট|plates?|কাপ|cups?|গ্লাস|glass|বাটি|bowls?|টা|টি|খানা'
const UNIT_WORDS_RE = new RegExp(`^(${UNIT_WORDS})$`, 'i')
const QTY_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_WORDS})(?![a-zA-Z\\u0980-\\u09FF])`, 'ig')

export function canonicalUnit(u: string): string | '' {
  for (const [re, name] of UNIT_ALIASES) if (re.test(u)) return name
  return ''
}

// ── months / expiry ───────────────────────────────────────────────
const MONTHS: [number, string[]][] = [
  [1, ['জানুয়ারি', 'জানুয়ারী', 'জানুআরি', 'জানুয়ারি', 'জানু', 'january', 'jan', 'পৌষ', 'মাঘ']],
  [2, ['ফেব্রুয়ারি', 'ফেব্রুয়ারী', 'ফেব্রুআরি', 'ফেব', 'february', 'feb', 'ফাল্গুন']],
  [3, ['মার্চ', 'মার্চে', 'মাচ', 'ম্যাত', 'মাত', 'march', 'mar', 'চৈত্র']],
  [4, ['এপ্রিল', 'এপ্রিলে', 'অ্যাপ্রিল', 'এপ্রীল', 'april', 'apr', 'বৈশাখ']],
  [5, ['মে', 'মের', 'may', 'জ্যৈষ্ঠ']],
  [6, ['জুন', 'জুনে', 'june', 'jun', 'আষাঢ়']],
  [7, ['জুলাই', 'জুলাইয়ে', 'july', 'jul', 'শ্রাবণ']],
  [8, ['আগস্ট', 'অগাস্ট', 'আগষ্ট', 'অগস্ট', 'august', 'aug', 'ভাদ্র']],
  [9, ['সেপ্টেম্বর', 'সেপ্টেম্বরে', 'সেপ্টেমবর', 'সেপ্ট', 'september', 'sep', 'sept', 'আশ্বিন']],
  [10, ['অক্টোবর', 'অক্টোবরে', 'অক্টবর', 'october', 'oct', 'কার্তিক']],
  [11, ['নভেম্বর', 'নভেম্বরে', 'নভেমবর', 'নভে', 'november', 'nov', 'অগ্রহায়ণ']],
  [12, ['ডিসেম্বর', 'ডিসেম্বরে', 'ডিসেমবর', 'ডিসে', 'december', 'dec', 'পৌষ']],
]
// Bengali calendar names clash with each other (পৌষ is Dec/Jan) — keep Gregorian-only for safety.
const GREG_MONTHS: [number, string[]][] = MONTHS.map(([n, w]) => [n, w.filter(x => !/^(পৌষ|মাঘ|ফাল্গুন|চৈত্র|বৈশাখ|জ্যৈষ্ঠ|আষাঢ়|শ্রাবণ|ভাদ্র|আশ্বিন|কার্তিক|অগ্রহায়ণ)$/.test(x))])
const MONTH_LOOKUP = new Map<string, number>()
for (const [n, ws] of GREG_MONTHS) for (const w of ws) MONTH_LOOKUP.set(w.normalize('NFC').toLowerCase(), n)

function monthOf(word: string): number | null {
  const w = word.normalize('NFC').toLowerCase()
  if (MONTH_LOOKUP.has(w)) return MONTH_LOOKUP.get(w)!
  for (const suf of ['ের', 'য়ে', 'এ', 'ে', 'র']) {       // মার্চের / জানুয়ারিতে-style endings
    if (w.length > suf.length + 2 && w.endsWith(suf) && MONTH_LOOKUP.has(w.slice(0, -suf.length))) return MONTH_LOOKUP.get(w.slice(0, -suf.length))!
  }
  return null
}

const EXPIRY_CUE = /(মেয়াদ|মেয়াদে|মিয়াদ|মিযাদ|মেয়াদের|expiry|expire|exp|এক্সপায়ারি|এক্সপায়ার|এক্সপাইরি|শেষ\s*হবে|শেষ\s*তারিখ|সেস|সেষ)/i

export interface ParsedItem {
  raw: string
  name: string            // matched product name, or the name as heard when unknown
  heardAs: string         // what was actually said (set when it differs from `name`)
  qty: number | ''
  unit: string
  price: number | ''      // sell price per unit (MRP for medicines)
  cost: number | ''
  expiry: string          // YYYY-MM or ''
  strength: string        // e.g. "500mg"
  category: string
  /** fields the owner must look at: 'name' | 'qty' | 'unit' | 'price' | 'expiry' */
  flags: string[]
  note: string            // short Bengali explanation shown on the card
  status: 'ok' | 'check' | 'unknown'
  known: boolean          // matched to the shop's own list
  alternatives: string[]
}

export interface ParseContext {
  vertical: Vertical
  shop: ShopProductLite[]
  now?: Date
}

const QUESTION = /\?|কত|কী আছে|কি আছে|আছে কি|আছে কী|দেখাও|দেখান|দেখি|বলো|বলুন|চেক|রিপোর্ট|হিসাব|(^|\s)কেন(\s|$)|কীভাবে|কিভাবে|ডোজ|খাওয়ার নিয়ম|কিসের ওষুধ|কি কাজ|কী কাজ/
const SALE_VERBS = /বিক্রি|বেচ|বেচা|কিনেছে|কিনেছেন|কিনল|কিনলো|নিয়েছে|নিয়েছেন|নিল|নিলো|দিলাম|দিয়েছি|দিয়েছে|দিলো|বাকি|kineche|kinlo|niyeche|beche|dilo|dise|sell|sold/i
// "add stock" cues incl. the mis-hearings seen in real voice logs (এট/আড = এড, যোক্করো/যোপ = যোগ, স্টাকে = স্টকে)
const ADD_CUES = /(^|\s)(এড|এট|অ্যাড|এ্যাড|আড|যো(গ|প|ক্?ক?)\S*|জমা|চ্যাট|add|স্টক\S*|স্টাক\S*|stock|stok|stoke|নতুন\s*(পণ্য|মাল|ওষুধ)|মাল\s*(এসেছে|এলো|আনলাম|তুললাম)|তুলেছি|তুললাম)(\s|$|,)/i

export type Intent = 'add_stock' | 'sale' | 'unknown'
export function detectIntent(msg: string): Intent {
  const t = normalizeMessage(msg || '').toLowerCase()
  if (!t.trim() || t.length > 900) return 'unknown'
  if (QUESTION.test(t)) return 'unknown'
  if (SALE_VERBS.test(t) && !ADD_CUES.test(` ${t} `)) return 'sale'
  if (ADD_CUES.test(` ${t} `)) return 'add_stock'
  // an expiry date only makes sense for incoming stock ("… মেয়াদ মার্চ ২০২৭")
  if (EXPIRY_CUE.test(t) && /\d/.test(t)) return 'add_stock'
  return 'unknown'
}

const NAME_STOP = new Set([
  'add', 'koro', 'kore', 'kori', 'korte', 'a', 'e', 'the', 'to', 'in', 'of', 'at', 'for', 'and', 'stock', 'stok', 'stoke', 'new', 'product', 'item', 'items',
  'sell', 'selling', 'sale', 'sold', 'price', 'buy', 'cost', 'mrp', 'per', 'taka', 'tk', 'rs', 'rate', 'each', 'one',
  'করো', 'কর', 'করি', 'করুন', 'করে', 'করা', 'করেছি', 'করলাম', 'করবো', 'দাও', 'দিন', 'দিলাম', 'যোগ', 'যোপ', 'জমা', 'পণ্য', 'নতুন', 'মাল', 'ওষুধ', 'ঔষধ', 'ওষুধটা', 'এড', 'এট', 'অ্যাড', 'এ্যাড', 'আড', 'চ্যাট',
  'স্টক', 'স্টকে', 'স্টাকে', 'স্টাক', 'স্টকের', 'বিক্রয়মূল্য', 'ক্রয়মূল্য', 'বিক্রয়', 'ক্রয়', 'বিক্রি', 'কেনা', 'টাকা', 'টাকায়', 'টাকার', 'মূল্য', 'দাম', 'দামে', 'রেট', 'পার', 'প্রতি', 'আজকে', 'আজ', 'এখন', 'আমার', 'দোকানে', 'দোকান', 'মেয়াদ', 'মেয়াদে', 'শেষ', 'সেস', 'সেষ', 'হবে', 'সালে', 'সাল', 'মাসে', 'মাস', 'তারিখ', 'তারিখে', 'এবং', 'আর', 'ও', 'আরও', 'তারপর', 'এরপর', 'পরে', 'হলো', 'হলে', 'যোককোর', 'যোক্করো', 'টাকা।', 'এর', 'এই', 'ওই', 'একটা', 'কিছু', 'মোট', 'ম্যাত', 'হয়েছে', 'হোয়েছে', 'হয়ে', 'হোলো', 'হল', 'করেছি', 'যাট', 'পোডাক্ট', 'পোডাক', 'প্রোডাক্ট', 'প্রডাক্ট', 'product', 'products', 'মুডলো', 'আছে', 'নেই', 'আজকের', 'আজিকের', 'আজিকে', 'কোনো', 'কোন',
])

const clean = (s: string) => s.replace(/[₹\/,.:;()"'“”‘’।!?\-–—]/g, ' ').replace(/\s+/g, ' ').trim()

/** Split one spoken/typed message into per-product chunks. */
export function splitSegments(msg: string): string[] {
  const t = normalizeMessage(msg || '').replace(/\r/g, '\n')
  const hasQty = (x: string) => { QTY_RE.lastIndex = 0; return QTY_RE.test(x) }
  // hard separators first
  const hard = t.split(/\n+|;|।|\s+(?:আর|এবং|আরও|তারপর|এরপর|then|and then|also|plus|এছাড়া|আরেকটা|পরেরটা|next)\s+/i).map(p => p.trim()).filter(Boolean)
  // a comma only starts a new product when the part after it has its own "<number> <unit>";
  // otherwise it is just a pause inside one product ("500 tablet, 150 taka, expiry …")
  const parts: string[] = []
  for (const h of hard) {
    for (const c of h.split(/\s*,\s*/).map(x => x.trim()).filter(Boolean)) {
      if (parts.length && !hasQty(c) && !(hard.length > 1 && parts.length === 0)) parts[parts.length - 1] += ' ' + c
      else parts.push(c)
    }
  }
  // A chunk with several "<number> <unit>" anchors holds several products:
  // "চাল 10 কেজি ময়দা 5 কেজি" → cut before the name that precedes each later quantity.
  const out: string[] = []
  for (const p of parts) {
    QTY_RE.lastIndex = 0
    const anchors = Array.from(p.matchAll(QTY_RE))
    if (anchors.length < 2) { out.push(p); continue }
    const cuts: number[] = [0]
    for (let k = 0; k < anchors.length - 1; k++) {
      const endOfThis = (anchors[k].index || 0) + anchors[k][0].length
      const startOfNext = anchors[k + 1].index || 0
      const between = p.slice(endOfThis, startOfNext)
      const toks = Array.from(between.matchAll(/\S+/g)).map(m => ({ w: m[0], i: m.index || 0 }))
      let n = 0
      for (let w = toks.length - 1; w >= 0 && n < 3; w--) {
        const wd = toks[w].w
        // "জিন্স 30 সাইজ" — a size belongs to the product name, so the cut goes before the product, not before "সাইজ"
        if (/^(সাইজ|size)$/i.test(wd) && w >= 1 && /^\d{2}$|^(xxxl|xxl|xl|xs|s|m|l)$/i.test(toks[w - 1].w)) { n += 2; w--; continue }
        if (/\d/.test(wd) || NAME_STOP.has(wd.toLowerCase()) || EXPIRY_CUE.test(wd) || monthOf(wd) !== null || UNIT_WORDS_RE.test(wd)) break
        n++
      }
      if (n > 0) cuts.push(endOfThis + toks[toks.length - n].i)
    }
    cuts.push(p.length)
    for (let k = 0; k < cuts.length - 1; k++) { const piece = p.slice(cuts[k], cuts[k + 1]).trim(); if (piece) out.push(piece) }
  }
  return out
}

function extractExpiry(text: string, now: Date): { expiry: string; rest: string; past: boolean; found: boolean } {
  let rest = text
  const words = text.split(/\s+/)
  let month: number | null = null
  let monthWord = ''
  const hasCue = EXPIRY_CUE.test(text)
  for (const w of words) {
    const m = monthOf(w.replace(/[,.।]/g, ''))
    if (m) { month = m; monthWord = w; break }
  }
  // spoken month names get garbled (মার্চ → মার্ছ / ম্যাত): fuzzy-match only when the owner is clearly giving an expiry
  if (month === null && (hasCue || /\b20\d{2}\b/.test(text))) {
    let bestS = 0
    for (const w of words) {
      const wd = w.replace(/[,.।]/g, '')
      if (wd.length < 3 || /\d/.test(wd)) continue
      for (const [n, ws] of GREG_MONTHS) for (const mw of ws) {
        if (mw.length < 3 || /^[a-z]+$/.test(mw)) continue
        const sc = nameSimilarity(wd, mw)
        if (sc > bestS && sc >= 0.8) { bestS = sc; month = n; monthWord = w }
      }
    }
  }
  // "03/2027", "3-27", "2027-03"
  let year: number | null = null
  const num = (s: string) => Number(s)
  let m: RegExpMatchArray | null
  if ((m = rest.match(/\b(20\d{2})[-/.](\d{1,2})\b/))) { year = num(m[1]); month = num(m[2]); rest = rest.replace(m[0], ' ') }
  else if ((m = rest.match(/\b(\d{1,2})[-/.](20\d{2}|\d{2})\b/)) && (hasCue || month === null)) {
    const mm = num(m[1]); if (mm >= 1 && mm <= 12) { month = mm; year = m[2].length === 2 ? 2000 + num(m[2]) : num(m[2]); rest = rest.replace(m[0], ' ') }
  }
  if (year === null) {
    // a 4-digit year that is NOT a quantity (not followed by a unit)
    const unitAfter = new RegExp(`^\\s*(${UNIT_WORDS})(?![a-zA-Z\\u0980-\\u09FF])`, 'i')
    const ym = Array.from(rest.matchAll(/\b(20\d{2})\b/g))
      .find(x => !unitAfter.test(rest.slice((x.index || 0) + x[0].length)))
    if (ym && (hasCue || month !== null || /সাল/.test(rest))) { year = num(ym[1]); rest = rest.replace(ym[0], ' ') }
    else if ((hasCue || month !== null) && (m = rest.match(/(?:সাল|সালে|মেয়াদ|মেয়াদে|expiry|exp)\D{0,12}\b(\d{2})\b(?!\s*(?:\d))/i))) { year = 2000 + num(m[1]); rest = rest.replace(m[1], ' ') }
  }
  if (monthWord) rest = rest.replace(monthWord, ' ')
  rest = rest.replace(new RegExp(EXPIRY_CUE.source, 'gi'), ' ')
  const found = year !== null || month !== null
  if (year !== null && (year < 2020 || year > 2099)) { year = null }   // "২০০০" from a garbled "দুহাজার …" is not a real expiry year
  if (year === null) return { expiry: '', rest, past: false, found }
  if (month === null) month = 12            // only a year heard → end of that year
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const nowYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return { expiry: ym, rest, past: ym < nowYm, found }
}

const PRICE_PER = new RegExp(`(?:পার|প্রতি|per|each|প্রতিটা|প্রতিটি)\\s*(?:${UNIT_WORDS})?\\s*(\\d+(?:\\.\\d+)?)(?:\\s*(?:টাকা|টাকায়|tk|rs|₹|rupees?))?`, 'i')
const PRICE_TAKA = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:টাকা|টাকায়|tk|rs|₹|rupees?)(?:\\s*(?:পার|প্রতি|per)(?:\\s*(?:${UNIT_WORDS}))?)?`, 'i')
const PRICE_WORD = /(?:দাম|মূল্য|রেট|price|rate|mrp|sell(?:ing)?\s*price|বিক্রয়\s*(?:মূল্য|দাম))\D{0,12}(\d+(?:\.\d+)?)/i
const COST_WORD = /(?:কেনা|ক্রয়|buy(?:ing)?|cost|purchase)\s*(?:দাম|মূল্য|রেট|price)?\D{0,12}(\d+(?:\.\d+)?)/i
const STRENGTH = /(\d+(?:\.\d+)?)\s*(mg|এমজি|মিগ্রা|মি\.গ্রা|মিলিগ্রাম|mcg|মাইক্রোগ্রাম|iu)\b/i

export function parseSegment(seg: string, ctx: ParseContext): ParsedItem | null {
  const now = ctx.now || new Date()
  let text = ' ' + normalizeMessage(seg).toLowerCase() + ' '
  const flags: string[] = []
  const notes: string[] = []

  // strength (pharmacy only — "500 mg" is a strength, never a quantity)
  let strength = ''
  if (ctx.vertical === 'pharmacy') {
    const sm = text.match(STRENGTH)
    if (sm) {
      const u = sm[2].toLowerCase()
      strength = `${sm[1]}${/mg|এমজি|মিগ্রা|মি\.গ্রা|মিলিগ্রাম/.test(u) ? 'mg' : /mcg|মাইক্রো/.test(u) ? 'mcg' : 'IU'}`
      text = text.replace(sm[0], ' ')
    }
  }

  // clothing size (S / M / L / XL / ফ্রি সাইজ / সাইজ ৪০) — kept as part of the product name so each size is its own stock row
  let size = ''
  if (ctx.vertical === 'kapor') {
    const SIZE_RE = /(?:^|\s)(xxxl|xxl|xl|xs|এক্সএক্সএল|এক্সএল|এক্সএস|ফ্রি\s*সাইজ|free\s*size|সাইজ\s*(\d{2})|(\d{2})\s*সাইজ|(?:সাইজ|size)\s*(s|m|l)|(s|m|l)\s*(?:সাইজ|size)|এস সাইজ|এম সাইজ|এল সাইজ)(?=\s|$)/i
    const zm = text.match(SIZE_RE)
    if (zm) {
      const raw = zm[1].toLowerCase()
      size = /ফ্রি|free/.test(raw) ? 'ফ্রি সাইজ' : zm[2] || zm[3] ? (zm[2] || zm[3]) : zm[4] || zm[5] ? (zm[4] || zm[5]).toUpperCase()
        : raw.startsWith('এক্সএক্সএল') ? 'XXL' : raw.startsWith('এক্সএল') ? 'XL' : raw.startsWith('এক্সএস') ? 'XS'
        : raw.startsWith('এস') ? 'S' : raw.startsWith('এম') ? 'M' : raw.startsWith('এল') ? 'L' : raw.toUpperCase()
      text = text.replace(zm[0], ' ')
    }
  }

  // expiry
  const ex = extractExpiry(text, now)
  text = ' ' + ex.rest + ' '
  const expiry = ex.expiry
  if (ex.found && !expiry) { flags.push('expiry'); notes.push('মেয়াদের সাল বুঝতে পারিনি') }
  if (expiry && ex.past) { flags.push('expiry'); notes.push(`মেয়াদ ${expiry} — তারিখটা আগের, ঠিক আছে কি?`) }

  // cost, then price
  let cost: number | '' = ''
  const cm = text.match(COST_WORD)
  if (cm) { cost = Number(cm[1]); text = text.replace(cm[0], ' ') }
  let price: number | '' = ''
  const pm = text.match(PRICE_WORD) || text.match(PRICE_PER) || text.match(PRICE_TAKA)
  if (pm) { price = Number(pm[1]); text = text.replace(pm[0], ' ') }

  // quantity = first "<number> <unit>"
  let qty: number | '' = ''
  let unit = ''
  let qtyAt = -1
  QTY_RE.lastIndex = 0
  const qm = QTY_RE.exec(text)
  if (qm) {
    qty = Number(qm[1]); unit = canonicalUnit(qm[2]); qtyAt = qm.index
    if (['টা', 'টি', 'খানা'].includes(qm[2])) unit = ctx.vertical === 'pharmacy' ? 'পাতা' : 'পিস'
    text = text.replace(qm[0], ' ')
  } else {
    // "500 <one garbled word> tablet": a unit word exists but isn't glued to a number → nearest number before it
    const toks = Array.from(text.matchAll(/\S+/g)).map(m => ({ w: m[0].replace(/[,.।]/g, ''), i: m.index || 0 }))
    const ui = toks.findIndex(t => UNIT_WORDS_RE.test(t.w) && !['টা', 'টি', 'খানা'].includes(t.w))
    if (ui > 0) {
      for (let k = ui - 1; k >= Math.max(0, ui - 3); k--) {
        if (/^\d+(\.\d+)?$/.test(toks[k].w)) {
          qty = Number(toks[k].w); unit = canonicalUnit(toks[ui].w); qtyAt = toks[k].i
          flags.push('qty'); notes.push(`পরিমাণ ${qty} ধরেছি — ঠিক কি?`)
          text = text.slice(0, toks[k].i) + ' '.repeat(toks[k].w.length) + text.slice(toks[k].i + toks[k].w.length)
          text = text.replace(new RegExp(`(^|\\s)${toks[ui].w}(?=\\s|$)`), ' ')
          break
        }
      }
    }
  }

  // leftover bare numbers
  const bare = Array.from(text.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)).map(x => x[1])
  if (qty === '' && bare.length === 1) {
    qty = Number(bare[0]); text = text.replace(bare[0], ' ')
    flags.push('unit'); notes.push('একক বুঝতে পারিনি — বেছে নিন')
    unit = defaultUnit(ctx.vertical)
  } else if (qty === '' && bare.length > 1) {
    flags.push('qty'); notes.push(`কয়েকটা সংখ্যা শুনেছি (${bare.join(', ')}) — কোনটা পরিমাণ/দাম বুঝতে পারিনি`)
    text = text.replace(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g, ' ')
  } else if (bare.length >= 1 && qty !== '') {
    if (price === '' && bare.length === 1) { price = Number(bare[0]); flags.push('price'); notes.push(`দাম ₹${bare[0]} ধরেছি — মিলিয়ে নিন`) }
    else { flags.push('price'); notes.push(`বাড়তি সংখ্যা: ${bare.join(', ')}`) }
    text = text.replace(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g, ' ')
  }

  // ── name: pick the window of 1–3 words that best matches a known product ──
  const keep = (w: string) => !NAME_STOP.has(w.toLowerCase()) && !UNIT_WORDS_RE.test(w) && !EXPIRY_CUE.test(w) && monthOf(w) === null
  const words = clean(text).split(/\s+/).filter(Boolean).filter(keep)
  if (!words.length && qty === '' && price === '') return null            // nothing usable in this chunk

  const kinds = kindsForVertical(ctx.vertical)
  type Win = { text: string; res: ReturnType<typeof resolveProduct>; start: number; len: number }
  let bestWin: Win | null = null
  for (let st = 0; st < words.length; st++) {
    for (let len = 1; len <= 3 && st + len <= words.length; len++) {
      const t = words.slice(st, st + len).join(' ')
      const res = resolveProduct(t, ctx.shop, kinds)
      if (!res.best) continue
      const sc = res.best.score
      if (!bestWin || sc > bestWin.res.best!.score + 0.001 || (Math.abs(sc - bestWin.res.best!.score) <= 0.001 && len > bestWin.len)) bestWin = { text: t, res, start: st, len }
    }
  }

  let name = '', heardAs = '', known = false, category = '', status: ParsedItem['status'] = 'ok'
  let alternatives: string[] = []
  const leftover: string[] = []
  if (bestWin && bestWin.res.best) {
    const best = bestWin.res.best
    name = best.name; known = best.source === 'shop'; category = best.entry?.category || ''
    alternatives = bestWin.res.alternatives.map(a => a.name)
    if (!bestWin.res.confident && flat2(best.name) !== flat2(bestWin.text)) heardAs = bestWin.text
    if (!bestWin.res.confident) { status = 'check'; flags.push('name'); notes.push(`"${bestWin.text}" → "${best.name}" ধরেছি — ঠিক কি?`) }
    leftover.push(...words.slice(0, bestWin.start), ...words.slice(bestWin.start + bestWin.len))
    if (!unit && qty !== '') unit = best.shopUnit || best.entry?.unit || ''
  } else {
    // nothing recognised → keep what was said (never swap in a guess). The name usually sits right before the quantity.
    let heard = ''
    if (words.length) {
      const before = qtyAt >= 0 ? clean(text.slice(0, Math.min(qtyAt, text.length))).split(/\s+/).filter(Boolean).filter(keep) : []
      const pick = before.length ? before.slice(-2) : words.slice(0, 2)
      heard = pick.join(' ')
    }
    const near = heard ? resolveProduct(heard, ctx.shop, kinds) : null
    alternatives = near ? near.alternatives.map(a => a.name) : []
    name = heard; status = 'unknown'; flags.push('name')
    notes.push(heard
      ? `"${heard}" চিনতে পারিনি${alternatives.length ? ` — কাছাকাছি: ${alternatives.join(', ')}` : ''}। নতুন পণ্য হলে নাম ঠিক করে সেভ করুন`
      : 'পণ্যের নাম শুনতে পাইনি')
    leftover.push(...words.filter(w => !heard.split(' ').includes(w)))
  }
  if (leftover.length && status !== 'unknown') notes.push(`বুঝতে পারিনি: ${leftover.join(' ')}`)

  if (qty === '') { if (!flags.includes('qty')) flags.push('qty'); if (!notes.some(n => n.includes('সংখ্যা'))) notes.push('পরিমাণ বলা হয়নি') }
  if (!unit && qty !== '') { unit = defaultUnit(ctx.vertical); if (!flags.includes('unit')) flags.push('unit') }
  if (price === '' && !flags.includes('price')) { flags.push('price'); if (ctx.vertical === 'pharmacy') notes.push('দাম বলা হয়নি') }
  if (ctx.vertical === 'pharmacy' && !expiry && !flags.includes('expiry')) { flags.push('expiry'); notes.push('মেয়াদ বলা হয়নি') }

  if (size && name) name = `${name} (${size})`
  const displayName = strength && name && !new RegExp(strength.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(name) ? `${name} ${strength}` : name
  if (status === 'ok' && flags.some(f => f === 'qty' || f === 'name')) status = 'check'

  return {
    raw: seg.trim(), name: displayName, heardAs, qty, unit, price, cost, expiry, strength,
    category: category || '', flags: Array.from(new Set(flags)), note: notes.join(' · '),
    status, known, alternatives,
  }
}
const flat2 = (s: string) => (s || '').toLowerCase().replace(/[\s\u200c\u200d]/g, '')

export interface MultiParse {
  intent: Intent
  items: ParsedItem[]
}

/**
 * Reads a whole message. Returns null if it is clearly not a stock/sale
 * list (a question, chit-chat, …) so the normal chat flow handles it.
 */
export function parseMultiStock(raw: string, ctx: ParseContext, force?: Intent): MultiParse | null {
  const intent = force || detectIntent(raw)
  if (intent === 'unknown') return null
  const segs = splitSegments(raw)
  const items: ParsedItem[] = []
  for (const s of segs) {
    const it = parseSegment(s, ctx)
    if (it) items.push(it)
  }
  // a lone cue word like "স্টকে যোগ করো" with no product at all → still return an empty form
  if (!items.length) return { intent, items: [] }
  // drop empty shells (name unknown AND no numbers at all)
  const useful = items.filter(i => i.name || i.qty !== '' || i.price !== '')
  return { intent, items: useful }
}

/** Bulk-card row shape used by AgentRunner's add_stock_bulk card. */
export function toBulkItem(it: ParsedItem) {
  return {
    name: it.name, qty: it.qty, unit: it.unit,
    unit_cost: it.cost, sell_price: it.price,
    category: it.category || 'অন্যান্য', expiry: it.expiry,
    heardAs: it.heardAs, flags: it.flags, note: it.note, status: it.status,
  }
}

/** True if every given number really appears in what the user said (anti-hallucination for model-written writes). */
export function numbersPresent(userText: string, nums: (number | string | undefined | null)[]): boolean {
  const t = normalizeMessage(userText || '')
  const found = new Set((t.match(/\d+(?:\.\d+)?/g) || []).map(Number))
  return nums.every(n => n === undefined || n === null || n === '' || Number(n) === 0 || found.has(Number(n)))
}
