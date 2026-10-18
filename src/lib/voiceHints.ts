// src/lib/voiceHints.ts
// Gives the speech model this shop's own words (product / menu / medicine names
// and a few customer names) so "কাতলা মাছ" is spelled the way the shop stores it.
// Only ever READS the signed-in user's own rows (RLS protects it) and never throws.
type Source = { table: string; columns: string[]; limit: number }

const PRODUCT_SOURCES: Record<string, Source> = {
  'dokan-manager':           { table: 'stock_items',        columns: ['item_name'],          limit: 30 },
  'mishti-dokan-manager':    { table: 'mishti_items',       columns: ['name_bn', 'name'],    limit: 30 },
  'kaporer-dokan-tracker':   { table: 'kapor_products',     columns: ['name'],               limit: 30 },
  'kaporer-dokan':           { table: 'kapor_products',     columns: ['name'],               limit: 30 },
  'hotel-and-dhaba-manager': { table: 'hotel_menu',         columns: ['name_bn', 'name'],    limit: 30 },
  'pharmacy-assistant':      { table: 'pharmacy_medicines', columns: ['name'],               limit: 30 },
}
const CUSTOMER_SOURCE: Source = { table: 'crm_customers', columns: ['name_bn', 'name'], limit: 10 }

async function readNames(db: any, userId: string, src: Source): Promise<string[]> {
  try {
    const { data, error } = await db.from(src.table).select(src.columns.join(',')).eq('user_id', userId).limit(src.limit)
    if (error || !Array.isArray(data)) return []
    return data.flatMap((row: any) => src.columns.map(c => String(row?.[c] ?? '').trim()).filter(Boolean).slice(0, 1))
  } catch { return [] }
}

/** Up to ~40 short names. Product names first (they matter most), then customers. */
export async function fetchVoiceHints(db: any, slug: string | undefined, userId: string | undefined): Promise<string[]> {
  if (!db || !userId) return []
  const product = slug ? PRODUCT_SOURCES[slug] : undefined
  const [products, customers] = await Promise.all([
    product ? readNames(db, userId, product) : Promise.resolve([] as string[]),
    readNames(db, userId, CUSTOMER_SOURCE),
  ])
  const seen = new Set<string>()
  return [...products, ...customers].filter(n => { const k = n.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 40)
}
