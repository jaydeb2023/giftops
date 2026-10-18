export type Permission =
  | 'manage_team'
  | 'manage_settings'
  | 'delete_records'
  | 'view_reports'
  | 'record_sales'

export const ALL_PERMISSIONS: Permission[] = [
  'manage_team', 'manage_settings', 'delete_records', 'view_reports', 'record_sales',
]

export const ROLE_DEFAULT_PERMISSIONS: Record<'admin' | 'sales' | 'stock', Permission[]> = {
  admin: ['manage_team', 'manage_settings', 'delete_records', 'view_reports', 'record_sales'],
  sales: ['view_reports', 'record_sales'],
  // Stock role only ever sees Stock + Supply tabs (see roleTabs.ts) — no
  // reports, no sales entry, so it gets no extra permission flags either.
  stock: [],
}

export const PERMISSION_LABELS_BN: Record<Permission, string> = {
  manage_team: 'টিম মেম্বার যোগ/বাদ দেওয়া',
  manage_settings: 'সেটিংস ও ব্রাঞ্চ পরিবর্তন',
  delete_records: 'রেকর্ড ডিলিট করা',
  view_reports: 'রিপোর্ট দেখা',
  record_sales: 'বিক্রি/স্টক এন্ট্রি করা',
}

/**
 * True if this access grant has the given permission.
 * The owner always has every permission — only team_members rows carry
 * a restricted permission set.
 */
export function hasPermission(
  access: { role: 'owner' | 'admin' | 'sales' | 'stock'; permissions?: Permission[] },
  permission: Permission
): boolean {
  if (access.role === 'owner') return true
  return !!access.permissions?.includes(permission)
}
