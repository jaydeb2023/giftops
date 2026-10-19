// Shared (client + server) constants for the Raahvia CRM module.

export type RvRole = 'admin' | 'sales' | 'ops' | 'finance' | 'rider'
export const RV_ROLES: RvRole[] = ['admin', 'sales', 'ops', 'finance', 'rider']

export const ROLE_LABEL: Record<RvRole, string> = {
  admin: 'Admin',
  sales: 'Sales / Customer care',
  ops: 'Operations',
  finance: 'Finance',
  rider: 'Rider / Delivery partner',
}

export const LEAD_SOURCES = ['phone', 'website', 'whatsapp', 'facebook', 'instagram', 'linkedin', 'google_ads', 'indiamart', 'justdial', 'email', 'chatbot', 'referral', 'social', 'manual'] as const
export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'quotation_sent', 'negotiation', 'converted', 'lost', 'on_hold'] as const
export const ORDER_STATUSES = [
  'enquiry', 'quotation', 'confirmed', 'procurement', 'packing', 'ready_dispatch',
  'part_delivered', 'delivered', 'exception', 'cancelled', 'closed',
] as const
export const ADDRESS_STATUSES = [
  'pending', 'reminder_sent', 'replied', 'ai_call', 'ai_captured', 'human_call', 'verified', 'exception',
] as const
export const DELIVERY_STATUSES = [
  'pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled',
] as const
export const PURCHASE_STATUSES = ['requested', 'confirmed', 'ready', 'received', 'issue', 'cancelled'] as const
export const RUN_STATUSES = ['planned', 'out_for_delivery', 'completed', 'cancelled'] as const
export const INVOICE_STATUSES = ['draft', 'issued', 'part_paid', 'paid', 'cancelled'] as const
export const PAYMENT_MODES = ['upi', 'bank', 'cash', 'cheque', 'card', 'other'] as const
export const BILL_TYPES = ['vendor', 'courier', 'other'] as const
export const EXPENSE_CLASSES = ['fixed', 'variable', 'semi_variable'] as const
export const FAILED_REASONS = [
  'recipient_not_available', 'incorrect_address', 'incomplete_address', 'phone_not_reachable',
  'refused', 'premises_closed', 'out_of_zone', 'other',
] as const

export const GST_RATES = [0, 5, 12, 18, 28] as const

export const ORDER_STATUS_COLOR: Record<string, string> = {
  enquiry: 'bg-slate-100 text-slate-700',
  quotation: 'bg-sky-100 text-sky-800',
  confirmed: 'bg-indigo-100 text-indigo-800',
  procurement: 'bg-amber-100 text-amber-800',
  packing: 'bg-orange-100 text-orange-800',
  ready_dispatch: 'bg-violet-100 text-violet-800',
  part_delivered: 'bg-lime-100 text-lime-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  exception: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-200 text-gray-600',
  closed: 'bg-gray-100 text-gray-700',
}

export const STATUS_COLOR: Record<string, string> = {
  ...ORDER_STATUS_COLOR,
  // leads
  new: 'bg-sky-100 text-sky-800',
  contacted: 'bg-indigo-100 text-indigo-800',
  qualified: 'bg-violet-100 text-violet-800',
  quotation_sent: 'bg-amber-100 text-amber-800',
  negotiation: 'bg-orange-100 text-orange-800',
  converted: 'bg-emerald-100 text-emerald-800',
  lost: 'bg-red-100 text-red-800',
  on_hold: 'bg-gray-200 text-gray-700',
  // address
  pending: 'bg-slate-100 text-slate-700',
  reminder_sent: 'bg-sky-100 text-sky-800',
  replied: 'bg-teal-100 text-teal-800',
  ai_call: 'bg-fuchsia-100 text-fuchsia-800',
  ai_captured: 'bg-purple-100 text-purple-800',
  human_call: 'bg-orange-100 text-orange-800',
  verified: 'bg-emerald-100 text-emerald-800',
  // delivery
  assigned: 'bg-indigo-100 text-indigo-800',
  picked_up: 'bg-violet-100 text-violet-800',
  in_transit: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  returned: 'bg-rose-100 text-rose-800',
  // purchases / runs / invoices / bills
  requested: 'bg-slate-100 text-slate-700',
  ready: 'bg-violet-100 text-violet-800',
  received: 'bg-emerald-100 text-emerald-800',
  issue: 'bg-red-100 text-red-800',
  planned: 'bg-slate-100 text-slate-700',
  out_for_delivery: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-800',
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-sky-100 text-sky-800',
  part_paid: 'bg-amber-100 text-amber-800',
  paid: 'bg-emerald-100 text-emerald-800',
  unpaid: 'bg-red-100 text-red-800',
  open: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
}

export function labelize(v: string | null | undefined): string {
  if (!v) return '-'
  return v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
}

/** Which sidebar items each role sees. `href` is relative to /app. */
export interface NavItem { href: string; label: string; roles: RvRole[]; group: string }
export const NAV: NavItem[] = [
  { group: 'Overview', href: '', label: 'Dashboard', roles: ['admin', 'sales', 'ops', 'finance'] },
  { group: 'Sales', href: '/leads', label: 'Leads', roles: ['admin', 'sales'] },
  { group: 'Sales', href: '/customers', label: 'Customers', roles: ['admin', 'sales', 'finance'] },
  { group: 'Sales', href: '/orders', label: 'Orders', roles: ['admin', 'sales', 'ops', 'finance'] },
  { group: 'Sales', href: '/inbox', label: 'Inbox & calls', roles: ['admin', 'sales', 'ops'] },
  { group: 'Operations', href: '/addresses', label: 'Address queue', roles: ['admin', 'sales', 'ops'] },
  { group: 'Operations', href: '/vendors', label: 'Vendors', roles: ['admin', 'ops'] },
  { group: 'Operations', href: '/purchases', label: 'Purchases', roles: ['admin', 'ops'] },
  { group: 'Operations', href: '/packing', label: 'Packing & QC', roles: ['admin', 'ops'] },
  { group: 'Operations', href: '/delivery', label: 'Delivery runs', roles: ['admin', 'ops'] },
  { group: 'Operations', href: '/exceptions', label: 'Exceptions', roles: ['admin', 'sales', 'ops'] },
  { group: 'Operations', href: '/rider', label: 'Rider app', roles: ['admin', 'ops', 'rider'] },
  { group: 'Finance', href: '/invoices', label: 'Invoices', roles: ['admin', 'finance', 'sales'] },
  { group: 'Finance', href: '/payments', label: 'Payments received', roles: ['admin', 'finance'] },
  { group: 'Finance', href: '/bills', label: 'Vendor & courier bills', roles: ['admin', 'finance', 'ops'] },
  { group: 'Finance', href: '/expenses', label: 'Expenses', roles: ['admin', 'finance'] },
  { group: 'Finance', href: '/reports', label: 'Reports', roles: ['admin', 'finance', 'ops'] },
  { group: 'Admin', href: '/settings', label: 'Settings & staff', roles: ['admin'] },
]

export function canSee(role: RvRole, href: string): boolean {
  const item = NAV.find(n => n.href === href)
  return !!item && item.roles.includes(role)
}

export function defaultPath(role: RvRole): string {
  return role === 'rider' ? '/app/rider' : '/app'
}
