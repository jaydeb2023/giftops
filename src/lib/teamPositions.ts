// Single source of truth for the "পদবী" (position/job-title) dropdown on
// the Team & Employees admin panel, and for grouping members into the
// filter tabs (সেলস / স্টক / ক্যাশ / অন্যান্য) shown there.
//
// `position_title` itself is free text in the DB (a shop owner may type
// anything when editing), but new members are created from this fixed
// list so filtering/reporting stays meaningful for the common cases.

export const POSITION_OPTIONS_BN = [
  'Sales / Employee',
  'Manager',
  'Cashier',
  'Stock',
  'Delivery',
  'Support',
  'Admin',
] as const

export type PositionCategory = 'admin' | 'sales' | 'stock' | 'cash' | 'other'

/** Buckets a free-text position into one of the filter-tab categories. */
export function categorizePosition(position: string | null | undefined, role: string | null | undefined): PositionCategory {
  const p = (position || '').toLowerCase()
  if (role === 'admin' || p.includes('admin')) return 'admin'
  if (p.includes('sales') || p.includes('সেলস')) return 'sales'
  if (p.includes('stock') || p.includes('স্টক')) return 'stock'
  if (p.includes('cash') || p.includes('ক্যাশ')) return 'cash'
  return 'other'
}

export const POSITION_CATEGORY_LABELS_BN: Record<PositionCategory, string> = {
  admin: 'এডমিন',
  sales: 'সেলস',
  stock: 'স্টক',
  cash: 'ক্যাশ',
  other: 'অন্যান্য',
}
