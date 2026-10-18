// Only these tables can ever be targeted by an approval request — this
// is the one thing standing between "team member asks for a review" and
// "team member can delete any row in any table by naming it in an API
// call." Every entry must be a table whose rows are scoped by user_id,
// matching the RLS pattern used everywhere else in this app.
export const ALLOWED_APPROVAL_TABLES = [
  'dokan_sales', 'dokan_customers', 'dokan_suppliers',
  'hotel_orders', 'hotel_stock', 'hotel_customers',
  'mishti_sales', 'mishti_items', 'mishti_customers',
  'kapor_sales', 'kapor_products', 'kapor_customers',
  'invoices', 'vendors', 'stock_items', 'daily_sales', 'crm_customers',
] as const

export type ApprovableTable = typeof ALLOWED_APPROVAL_TABLES[number]

export function isApprovableTable(table: string): table is ApprovableTable {
  return (ALLOWED_APPROVAL_TABLES as readonly string[]).includes(table)
}
