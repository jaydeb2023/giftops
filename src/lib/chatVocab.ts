// Shop vocabulary + fuzzy matching, shared by the voice and photo readers.
// Goal: whatever the owner says or photographs — in Bengali, Banglish, Hindi or
// English, with dialect spellings — lands on the shop's OWN product / customer
// names and SKUs instead of a loose guess.
import { toLatin } from '@/lib/catalogSlug'

export interface VocabProduct { name: string; sku?: string; unit?: string; price?: number }
export interface Vocab { products: VocabProduct[]; customers: string[] }

export interface VisionItem {
  name: string; qty?: number; unit?: string; price?: number; amount?: number
  sku?: string; mrp?: number; batch?: string; expiry?: string; size?: string; color?: string; note?: string
  matched?: { name: string; sku?: string; unit?: string; price?: number } | null
}
export interface VisionResult {
  kind: string               // handwritten_list | printed_bill | purchase_bill | prescription | product_label | price_list | order_note | other
  summary: string
  text: string               // everything readable, line by line
  party?: { name?: string; phone?: string; address?: string } | null
  partyMatched?: string | null
  date?: string
  items: VisionItem[]
  totals?: { subtotal?: number; discount?: number; total?: number; paid?: number; due?: number } | null
  confidence?: 'high' | 'medium' | 'low'
}

// ── fuzzy matching ────────────────────────────────────────────────
const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
const norm = (s: string) =>
  (s || '').toLowerCase().replace(/[০-৯]/g, d => String(BN_DIGITS.indexOf(d))).replace(/[^\p{L}\p{N}]+/gu, '')

function lev(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}
const sim = (a: string, b: string) => (!a || !b ? 0 : a === b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length))

export function nameScore(a: string, b: string): number {
  const na = norm(a), nb = norm(b)
  if (!na || !nb) return 0
  let best = sim(na, nb)
  const la = toLatin(a), lb = toLatin(b)           // চাল ↔ Chal ↔ chaal
  if (la.length >= 3 && lb.length >= 3) best = Math.max(best, sim(la, lb))
  if (Math.min(na.length, nb.length) >= 3 && (na.includes(nb) || nb.includes(na))) best = Math.max(best, 0.86)
  return best
}

export function matchProduct(name: string, products: VocabProduct[], min = 0.74): VocabProduct | null {
  const n = norm(name)
  let best: VocabProduct | null = null, bestScore = 0
  for (const p of products) {
    let s = nameScore(name, p.name)
    if (p.sku && norm(p.sku) === n) s = 1
    if (s > bestScore) { bestScore = s; best = p }
  }
  return bestScore >= min ? best : null
}

export function matchCustomer(name: string, customers: string[], min = 0.78): string | null {
  let best: string | null = null, bestScore = 0
  for (const c of customers) { const s = nameScore(name, c); if (s > bestScore) { bestScore = s; best = c } }
  return bestScore >= min ? best : null
}

// ── what the chat model sees when a photo is attached ─────────────
export const IMAGE_CTX_MARK = '[ATTACHED_IMAGE_DATA'

export function formatImageContext(v: VisionResult): string {
  const rows = v.items.map((it, i) =>
    `${i + 1}. ${it.name} | qty=${it.qty ?? ''} ${it.unit ?? ''} | rate=${it.price ?? ''} | amount=${it.amount ?? ''}` +
    `${it.sku ? ` | sku=${it.sku}` : ''}${it.mrp ? ` | mrp=${it.mrp}` : ''}${it.batch ? ` | batch=${it.batch}` : ''}${it.expiry ? ` | expiry=${it.expiry}` : ''}` +
    `${it.matched ? ` | existing_product="${it.matched.name}"` : ' | new_product'}`)
  return `${IMAGE_CTX_MARK} kind=${v.kind}]\n` +
    `${v.party?.name ? `party=${v.party.name}${v.partyMatched ? ` (existing customer "${v.partyMatched}")` : ''}\n` : ''}` +
    `${rows.join('\n')}\n${v.totals?.total ? `total=${v.totals.total}\n` : ''}[/ATTACHED_IMAGE_DATA]`
}
export const stripImageContext = (t: string) => (t || '').split('\n\n' + IMAGE_CTX_MARK)[0]

// ── server only: load this shop's own words ───────────────────────
const pick = (r: any, keys: string[]) => { for (const k of keys) if (r?.[k] !== undefined && r[k] !== null && r[k] !== '') return r[k]; return undefined }

const PRODUCT_SOURCES: Record<string, string> = {
  'pharmacy-assistant': 'pharmacy_medicines',
  'mishti-dokan-manager': 'mishti_items',
  'kaporer-dokan-tracker': 'kapor_products',
  'hotel-and-dhaba-manager': 'hotel_menu',
}

export async function loadVocab(sb: any, ownerId: string, agentSlug?: string | null, withCustomers = true): Promise<Vocab> {
  const table = (agentSlug && PRODUCT_SOURCES[agentSlug]) || 'stock_items'
  const run = async (t: string) => {
    try { const { data } = await sb.from(t).select('*').eq('user_id', ownerId).limit(300); return data || [] } catch { return [] }
  }
  let rows = await run(table)
  if (!rows.length && table !== 'stock_items') rows = await run('stock_items')   // library table not used yet → shared stock
  const products: VocabProduct[] = rows
    .map((r: any) => ({
      name: String(pick(r, ['item_name', 'name_bn', 'name', 'medicine_name', 'product_name', 'title']) || '').trim(),
      sku: pick(r, ['sku', 'barcode', 'code']) as string | undefined,
      unit: pick(r, ['unit']) as string | undefined,
      price: Number(pick(r, ['sell_price', 'price', 'mrp', 'selling_price'])) || undefined,
    }))
    .filter((p: VocabProduct) => p.name)
  let customers: string[] = []
  if (withCustomers) {
    try {
      const { data } = await sb.from('crm_customers').select('name').eq('user_id', ownerId).limit(120)
      customers = (data || []).map((c: any) => String(c.name || '').trim()).filter(Boolean)
    } catch { /* optional */ }
  }
  return { products, customers }
}
