// Turns a business name (Bengali, Banglish or English) into a clean, shareable
// URL slug, e.g. "রাহুল মিট শপ" -> "rahul-mit-shop". The owner can edit the result.

const VOWELS: Record<string, string> = {
  'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u', 'ঋ': 'ri', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
}
const SIGNS: Record<string, string> = {
  'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
}
const CONSONANTS: Record<string, string> = {
  'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng', 'চ': 'ch', 'ছ': 'ch', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
  'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n', 'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
  'প': 'p', 'ফ': 'f', 'ব': 'b', 'ভ': 'bh', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh',
  'স': 's', 'হ': 'h', 'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't', 'ং': 'ng', 'ঃ': 'h',
}
const HASANT = '্'
const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

function transliterateWord(word: string): string {
  const chars = Array.from(word.normalize('NFC'))
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const bd = BN_DIGITS.indexOf(c)
    if (bd >= 0) { out += String(bd); continue }
    if (VOWELS[c]) { out += VOWELS[c]; continue }
    if (SIGNS[c]) { out += SIGNS[c]; continue }
    if (CONSONANTS[c]) {
      out += CONSONANTS[c]
      const next = chars[i + 1]
      const startsWord = i === 0
      // First consonant of a word followed by another consonant carries the
      // inherent "o" (শপ -> shop). Elsewhere it is normally silent (হালদার -> haldar).
      if (startsWord && next && CONSONANTS[next] && next !== HASANT) out += 'o'
      continue
    }
    if (c === '়') { // nukta: য+় = য় (y), ড+় = ড় (r), ঢ+় = ঢ় (rh)
      const prev = chars[i - 1]
      if (prev === 'য' && out.endsWith('j')) out = out.slice(0, -1) + 'y'
      else if (prev === 'ড' && out.endsWith('d')) out = out.slice(0, -1) + 'r'
      else if (prev === 'ঢ' && out.endsWith('dh')) out = out.slice(0, -2) + 'rh'
      continue
    }
    if (c === HASANT || c === 'ঁ') continue
    out += c
  }
  return out
}

export function slugify(name: string): string {
  const latin = (name || '')
    .split(/\s+/)
    .map(transliterateWord)
    .join(' ')
  const slug = latin
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return slug.length >= 3 ? slug : 'shop'
}

/** Rough Latin spelling of any name (Bengali or English) for fuzzy matching — no fallbacks. */
export function toLatin(name: string): string {
  return (name || '').split(/\s+/).map(transliterateWord).join('').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Live-clean what the owner types into the link box. */
export function cleanSlugInput(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-').slice(0, 40)
}

export const isValidSlug = (s: string) => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s)
