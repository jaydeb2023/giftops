// src/lib/localIntent.ts
// ─────────────────────────────────────────────────────────────────
// Deterministic (no-AI) reading of "add stock" messages. Because no
// language model is involved here, it can never invent a product,
// quantity or price: every value it returns was literally present in
// the message. Anything it is not sure about → returns null and the
// normal AI flow handles the message as before.
//
// The result is only a PROPOSAL. The server shows it to the shop owner
// on an editable confirmation card and writes nothing until they tap
// "সেভ করুন".
// ─────────────────────────────────────────────────────────────────
import { normalizeMessage } from './bnNormalize'

export interface AddStockIntent {
  type: 'add_stock'
  name: string      // product name as heard (before matching to the shop's own list)
  qty: number
  unit: string      // one of DOKAN_UNITS
  price: number     // sell price per unit, 0 = not said
  cost: number      // buy price per unit, 0 = not said
}

export const DOKAN_UNITS = ['কেজি', 'গ্রাম', 'লিটার', 'মিলি', 'পিস', 'প্যাকেট', 'বস্তা', 'ডজন', 'বোতল', 'কার্টন']

const UNIT_ALIASES: [RegExp, string][] = [
  [/^(কেজি|কেজিতে|কিলোগ্রাম|কিলো|kgs?)$/i, 'কেজি'],
  [/^(গ্রাম|gms?|g)$/i, 'গ্রাম'],
  [/^(লিটার|litres?|liters?|l)$/i, 'লিটার'],
  [/^(মিলি|ml)$/i, 'মিলি'],
  [/^(পিস|pcs?|pics?|pieces?|p)$/i, 'পিস'],
  [/^(প্যাকেট|packets?)$/i, 'প্যাকেট'],
  [/^(বস্তা)$/i, 'বস্তা'],
  [/^(ডজন|dozen)$/i, 'ডজন'],
  [/^(বোতল|bottles?)$/i, 'বোতল'],
  [/^(কার্টন|cartons?)$/i, 'কার্টন'],
]
const UNIT_WORDS = 'কেজিতে|কেজি|কিলোগ্রাম|কিলো|kgs?|গ্রাম|gms?|g|লিটার|litres?|liters?|l|মিলি|ml|পিস|pcs?|pics?|pieces?|p|প্যাকেট|packets?|বস্তা|ডজন|dozen|বোতল|bottles?|কার্টন|cartons?'
const QTY_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_WORDS})(?![a-zA-Z\\u0980-\\u09FF])`, 'i')

function canonicalUnit(u: string): string {
  for (const [re, name] of UNIT_ALIASES) if (re.test(u)) return name
  return 'কেজি'
}

// Words that say "add this to stock" (incl. the common mis-hearing "চ্যাট"/"আড").
const ADD_CUES = /(^|\s)(এড|অ্যাড|এ্যাড|আড|যোগ|জমা|চ্যাট|add|স্টকে|স্টক|stock|stok|stoke|নতুন\s*পণ্য|নতুন\s*মাল|মাল\s*(এসেছে|এলো|আনলাম|তুললাম))(\s|$|,)/i
// A question or a lookup is never a write.
const QUESTION = /\?|কত|কী আছে|কি আছে|আছে কি|আছে কী|দেখাও|দেখান|দেখি|বলো|বলুন|চেক|রিপোর্ট|হিসাব|(^|\s)কেন(\s|$)|কীভাবে|কিভাবে/
// Sales / payments are handled by the existing sale flow, never as "add stock".
const SALE_VERBS = /কিনেছে|কিনেছেন|কিনল|কিনলো|কিনলেন|কিনে নিয়েছে|নিয়েছে|নিয়েছেন|নিল|নিলো|বেচেছি|বেচলাম|বিক্রি করেছি|বিক্রি করলাম|বিক্রি হয়েছে|দিয়েছে|দিয়েছেন|kineche|kinlo|niyeche|beche|dilo|dise/i

const NAME_STOP = new Set([
  'add', 'koro', 'kore', 'kori', 'korte', 'a', 'e', 'the', 'to', 'in', 'of', 'at', 'for', 'and', 'stock', 'stok', 'stoke', 'new', 'product', 'item',
  'sell', 'selling', 'sale', 'price', 'buy', 'cost', 'mrp', 'per', 'taka', 'tk', 'rs', 'rate',
  'করো', 'কর', 'করি', 'করুন', 'করে', 'করা', 'করেছি', 'দাও', 'দিন', 'যোগ', 'জমা', 'পণ্য', 'নতুন', 'মাল', 'স্টক', 'স্টকে', 'এড', 'অ্যাড', 'এ্যাড', 'আড', 'চ্যাট',
  'বিক্রয়মূল্য', 'ক্রয়মূল্য', 'বিক্রয়', 'ক্রয়', 'বিক্রি', 'কেনা', 'টাকা', 'মূল্য', 'দাম', 'রেট', 'পার', 'প্রতি', 'আজকে', 'আজ', 'এখন', 'আমার', 'দোকানে', 'দোকান',
])

/** "5 কেজি" → sell/buy price phrases removed before name extraction. */
function pick(re: RegExp, text: string): RegExpMatchArray | null { return text.match(re) }

export function parseAddStockIntent(raw: string): AddStockIntent | null {
  const msg = normalizeMessage(raw || '').toLowerCase().trim()
  if (!msg || msg.length > 300) return null
  if (QUESTION.test(msg) || SALE_VERBS.test(msg)) return null
  if (!ADD_CUES.test(` ${msg} `)) return null

  const q = pick(QTY_RE, msg)
  if (!q) return null
  const qty = Number(q[1])
  if (!(qty > 0) || qty > 1_000_000) return null
  const unit = canonicalUnit(q[2])

  // Buy price first (so a "কেনা দাম" number is never mistaken for the sell price)
  const costRe = /(?:buy(?:ing)?\s*price|cost|(?<!বি)ক্রয়\s*(?:মূল্য|দাম|রেট)|কেনা\s*(?:দাম|মূল্য|রেট))\D{0,15}(\d+(?:\.\d+)?)/i
  const cm = pick(costRe, msg)
  const cost = cm ? Number(cm[1]) : 0
  const noCost = cm ? msg.replace(cm[0], ' ') : msg

  const priceRe1 = /(?:sell(?:ing)?\s*price|বিক্রয়\s*(?:মূল্য|দাম|রেট)|বিক্রি\s*(?:মূল্য|দাম|রেট)|bikroy|mrp|দাম|মূল্য|রেট|rate)\D{0,15}(\d+(?:\.\d+)?)/i
  const priceRe2 = /(\d+(?:\.\d+)?)\s*(?:taka|tk|টাকা|₹)\s*(?:per|\/|পার|প্রতি|কেজি|কিলো|লিটার|পিস)/i
  const pm = pick(priceRe1, noCost) || pick(priceRe2, noCost)
  const price = pm ? Number(pm[1]) : 0

  // ── name = whatever is left after removing the quantity, prices, numbers and command words
  let rest = msg.replace(q[0], ' ')
  if (cm) rest = rest.replace(cm[0], ' ')
  if (pm) rest = rest.replace(pm[0], ' ')
  rest = rest.replace(/\d+(?:\.\d+)?/g, ' ').replace(/[₹\/,.:;()"'“”‘’।!?\-]/g, ' ')
  const words = rest.split(/\s+/).filter(Boolean).filter(w => !NAME_STOP.has(w) && !UNIT_ALIASES.some(([re]) => re.test(w)))
  const name = words.join(' ').trim()
  if (!name || words.length > 5 || name.length > 60) return null

  return { type: 'add_stock', name, qty, unit, price, cost }
}

// ── matching what was heard against the shop's own product list ────
const key = (s: string) => (s || '').normalize('NFC').toLowerCase().replace(/[\s\u200c\u200d.\-_]/g, '')

function levenshtein(a: string[], b: string[]): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export function similarity(a: string, b: string): number {
  const x = Array.from(key(a)), y = Array.from(key(b))
  if (!x.length || !y.length) return 0
  if (x.join('') === y.join('')) return 1
  const shorter = x.length <= y.length ? x.join('') : y.join('')
  const longer = x.length <= y.length ? y.join('') : x.join('')
  if (shorter.length >= 3 && longer.includes(shorter)) return 0.9 // "কাতলা" ⊂ "কাতলা মাছ"
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length)
}

export interface ProductLite { item_name: string; current_qty?: number | null; unit?: string | null; sell_price?: number | null }

export function matchProduct<T extends ProductLite>(heard: string, products: T[], threshold = 0.8): { product: T; score: number; exact: boolean } | null {
  let best: { product: T; score: number } | null = null
  for (const p of products) {
    const sc = similarity(heard, p.item_name)
    if (!best || sc > best.score) best = { product: p, score: sc }
  }
  if (!best || best.score < threshold) return null
  return { ...best, exact: best.score === 1 }
}

// ── unit conversion so "500 গ্রাম" never becomes "500 কেজি" ─────────
const TO_BASE: Record<string, [string, number]> = {
  'কেজি': ['mass', 1000], 'গ্রাম': ['mass', 1],
  'লিটার': ['vol', 1000], 'মিলি': ['vol', 1],
}
/** Converts qty between units. Same unit → same qty. Incompatible → null. */
export function convertQty(qty: number, from: string, to: string): number | null {
  if (from === to) return qty
  const a = TO_BASE[from], b = TO_BASE[to]
  if (!a || !b || a[0] !== b[0]) return null
  return Math.round((qty * a[1] / b[1]) * 1000) / 1000
}

// ── generic product-name grounding for the free-form AI chat ───────
// Used by business-chat's system prompt so the model is handed a
// deterministic, pre-checked answer for "which of the shop's real
// products (if any) is the user talking about", instead of guessing
// from spelling/sound similarity — which is what causes it to answer
// about one product while implying it's a different one (e.g. "লাউ"
// bottle gourd vs "আলু" potato). No AI is involved in this check, so
// it can never invent a match that isn't backed by real data.
const CHAT_STOP = new Set<string>([
  ...NAME_STOP,
  'ki', 'ache', 'achi', 'achen', 'jano', 'jani', 'janen', 'kt', 'koto', 'kotota', 'koyta',
  'dekhao', 'dekhan', 'bolo', 'bolun', 'hobe', 'hoyeche', 'koro', 'korle', 'ta', 'ta',
  'কি', 'আছে', 'আছি', 'আছেন', 'জানো', 'জানি', 'জানেন', 'কত', 'কতটা', 'কয়টা',
  'দেখাও', 'দেখান', 'বলো', 'বলুন', 'হবে', 'হয়েছে', 'টা', 'টি',
])

function extractCandidatePhrases(msg: string): string[] {
  const words = msg
    .replace(/[₹/,.:;()"'""''।!?-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !/^\d+(\.\d+)?$/.test(w))
    .filter(w => !CHAT_STOP.has(w) && !UNIT_ALIASES.some(([re]) => re.test(w)))
  const phrases = new Set<string>()
  for (let i = 0; i < words.length; i++) {
    phrases.add(words[i])
    if (i + 1 < words.length) phrases.add(`${words[i]} ${words[i + 1]}`)
  }
  return [...phrases].filter(p => p.replace(/\s/g, '').length >= 2)
}

/**
 * Checks every product-like word/phrase in the user's message against
 * the shop's real product names. Returns a short block to inject into
 * the AI's context: a confirmed match, or an explicit "not the same
 * product" warning for a near-spelling. Never invents a product that
 * isn't in `productNames`.
 */
function buildNameMatchNote(
  rawMsg: string,
  names: string[],
  opts: { heading: string; ownerPhrase: string; matchVerb: string; missingVerb: string },
): string {
  const uniqueNames = [...new Set(names.filter(Boolean))]
  if (!uniqueNames.length) return ''
  const msg = normalizeMessage(rawMsg || '').toLowerCase().trim()
  if (!msg) return ''
  const candidates = extractCandidatePhrases(msg)
  if (!candidates.length) return ''

  const lines: string[] = []
  const seen = new Set<string>()
  for (const cand of candidates) {
    let best: { name: string; score: number } | null = null
    for (const name of uniqueNames) {
      const sc = similarity(cand, name)
      if (!best || sc > best.score) best = { name, score: sc }
    }
    if (!best) continue
    let line = ''
    if (best.score >= 0.82) {
      line = `"${cand}" → ${opts.ownerPhrase} "${best.name}"-${opts.matchVerb} (নিশ্চিত মিল)।`
    } else if (best.score >= 0.55) {
      line = `"${cand}" → এই হুবহু নামে ${opts.ownerPhrase} কিছু নেই। কাছাকাছি বানানের "${best.name}" আছে, কিন্তু সেটা ভিন্ন হতে পারে — "${cand}" আর "${best.name}"-কে এক ধরে নিও না। ${opts.missingVerb}`
    }
    if (line && !seen.has(line)) { lines.push(line); seen.add(line) }
    if (lines.length >= 4) break
  }
  if (!lines.length) return ''
  return `\n== ${opts.heading} (deterministic, AI-এর অনুমান নয় — এটাই একমাত্র সত্য উৎস) ==\n${lines.join('\n')}\n== যাচাই শেষ ==\n`
}

export function buildProductMatchNote(rawMsg: string, productNames: string[]): string {
  return buildNameMatchNote(rawMsg, productNames, {
    heading: 'পণ্যের নাম যাচাই',
    ownerPhrase: 'তোমার স্টকের',
    matchVerb: 'এর কথা বলা হচ্ছে',
    missingVerb: 'স্পষ্ট করে "স্টকে নেই" বলো, বা user-কে জিজ্ঞাসা করো।',
  })
}

export function buildCustomerMatchNote(rawMsg: string, customerNames: string[]): string {
  return buildNameMatchNote(rawMsg, customerNames, {
    heading: 'খদ্দেরের নাম যাচাই',
    ownerPhrase: 'তোমার খদ্দের তালিকার',
    matchVerb: 'এর কথা বলা হচ্ছে',
    missingVerb: 'এটা নতুন খদ্দের হতে পারে — নতুন হিসেবেই যোগ করো, পুরনো কোনো ভিন্ননামা খদ্দেরের সাথে মিশিয়ে ফেলো না।',
  })
}
