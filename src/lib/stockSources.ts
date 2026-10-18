// One view of "products" across every agent.
//   Dokan manager + built (custom) agents → shared table  stock_items
//   Kapor / Mishti / Hotel / Pharmacy      → their own tables (kapor_products, mishti_items, hotel_stock, pharmacy_medicines)
// The Stock page, the product catalog and the AI all go through this file so a product
// looks and behaves the same no matter which agent it belongs to.
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

export type StockSource = 'stock_items' | 'kapor_products' | 'mishti_items' | 'hotel_stock' | 'pharmacy_medicines'
type Field = 'item_name' | 'category' | 'current_qty' | 'unit' | 'min_qty' | 'unit_cost' | 'sell_price' | 'sku'

export const VERTICAL_SOURCES: StockSource[] = ['kapor_products', 'mishti_items', 'hotel_stock', 'pharmacy_medicines']

const COLS: Record<StockSource, Partial<Record<Field, string>>> = {
  stock_items:        { item_name: 'item_name', category: 'category', current_qty: 'current_qty', unit: 'unit', min_qty: 'min_qty', unit_cost: 'unit_cost', sell_price: 'sell_price', sku: 'sku' },
  kapor_products:     { item_name: 'name', category: 'category', current_qty: 'stock_qty', min_qty: 'min_stock', unit_cost: 'purchase_price', sell_price: 'sell_price', sku: 'sku' },
  mishti_items:       { item_name: 'name', category: 'category', current_qty: 'stock_kg', min_qty: 'min_stock_kg', unit_cost: 'cost_per_kg', sell_price: 'price_per_kg', sku: 'sku' },
  hotel_stock:        { item_name: 'name', category: 'category', current_qty: 'quantity', unit: 'unit', min_qty: 'min_quantity', unit_cost: 'cost_per_unit', sku: 'sku' },
  pharmacy_medicines: { item_name: 'name', category: 'category', current_qty: 'stock', unit: 'unit', min_qty: 'min_stock', unit_cost: 'cost_price', sell_price: 'mrp', sku: 'sku' },
}
const FIXED_UNIT: Partial<Record<StockSource, string>> = { kapor_products: 'পিস', mishti_items: 'কেজি' }
const AGENT_ID: Partial<Record<StockSource, string>> = {
  kapor_products: LIBRARY_AGENT_IDS.kapor, mishti_items: LIBRARY_AGENT_IDS.mishti,
  hotel_stock: LIBRARY_AGENT_IDS.hotel, pharmacy_medicines: LIBRARY_AGENT_IDS.pharmacy,
}

export interface UnifiedStockRow {
  id: string; source: StockSource; agent_id: string | null
  item_name: string; category: string; subcategory: string; sku: string
  current_qty: number; unit: string; min_qty: number; unit_cost: number; sell_price: number | null
  last_updated: string
}

/** Which table a product belongs to, from the agent chosen for it. */
export function sourceForAgentId(agentId?: string | null): StockSource {
  const hit = (Object.entries(AGENT_ID) as [StockSource, string][]).find(([, v]) => v === agentId)
  return hit ? hit[0] : 'stock_items'
}
export const agentIdForSource = (s: StockSource, fallback: string | null = null) => AGENT_ID[s] ?? fallback

export function readRow(source: StockSource, r: any): UnifiedStockRow {
  const c = COLS[source]
  const g = (f: Field) => (c[f] ? r[c[f] as string] : undefined)
  const name = source === 'mishti_items' ? (r.name_bn || r.name) : g('item_name')
  return {
    id: r.id, source,
    agent_id: source === 'stock_items' ? (r.agent_id ?? null) : (AGENT_ID[source] ?? null),
    item_name: String(name || ''),
    category: g('category') || 'অন্যান্য',
    subcategory: source === 'stock_items' ? (r.subcategory || '') : '',
    sku: g('sku') || '',
    current_qty: Number(g('current_qty') || 0),
    unit: g('unit') || FIXED_UNIT[source] || 'পিস',
    min_qty: Number(g('min_qty') || 0),
    unit_cost: Number(g('unit_cost') || 0),
    sell_price: g('sell_price') != null ? Number(g('sell_price')) : null,
    last_updated: r.last_updated || r.updated_at || r.created_at || new Date().toISOString(),
  }
}

/** Every product of this shop — all agents — in one list. */
export async function loadAllStock(sb: any, userId: string): Promise<UnifiedStockRow[]> {
  const sources: StockSource[] = ['stock_items', ...VERTICAL_SOURCES]
  const parts = await Promise.all(sources.map(async (src) => {
    const { data, error } = await sb.from(src).select('*').eq('user_id', userId).limit(3000)
    if (error) { console.warn(`loadAllStock: ${src}:`, error.message); return [] as UnifiedStockRow[] }
    return (data || []).map((r: any) => readRow(src, r))
  }))
  return parts.flat().sort((a, b) => a.item_name.localeCompare(b.item_name))
}

type Patch = Partial<Record<Field, any>> & { agent_id?: string | null; subcategory?: string }

function toRow(source: StockSource, p: Patch, omitSku: boolean) {
  const c = COLS[source]
  const out: Record<string, any> = {}
  ;(Object.keys(p) as (keyof Patch)[]).forEach((k) => {
    if (k === 'agent_id' || k === 'subcategory') return
    if (k === 'sku' && omitSku) return
    const col = c[k as Field]
    if (col && p[k] !== undefined) out[col] = p[k]
  })
  if (source === 'mishti_items' && p.item_name) out.name_bn = p.item_name
  if (source === 'stock_items') {
    if (p.agent_id !== undefined) out.agent_id = p.agent_id
    if (p.subcategory !== undefined) out.subcategory = p.subcategory
  }
  return out
}

// Older databases may not have the sku column on the other agents' tables yet → retry without it.
type Res = { data: any; error: any }
async function withSkuFallback(run: (omitSku: boolean) => PromiseLike<Res>): Promise<Res> {
  let r = await run(false)
  if (r.error && /sku/i.test(String(r.error.message || ''))) r = await run(true)
  return r
}

export const insertStock = (sb: any, source: StockSource, userId: string, p: Patch) =>
  withSkuFallback((omit) => sb.from(source).insert({ user_id: userId, ...toRow(source, p, omit) }).select().single())

export const updateStock = (sb: any, source: StockSource, id: string, p: Patch) =>
  withSkuFallback((omit) => sb.from(source).update({
    ...toRow(source, p, omit),
    ...(source === 'pharmacy_medicines' ? { updated_at: new Date().toISOString() } : {}),
  }).eq('id', id).select().single())

export const deleteStock = (sb: any, source: StockSource, ids: string[]) =>
  sb.from(source).delete().in('id', ids)

export const setStockCategory = (sb: any, source: StockSource, ids: string[], category: string) =>
  sb.from(source).update({ [COLS[source].category as string]: category }).in('id', ids)
