// ── Which dashboard tabs each team role can see ──────────────────
// Single source of truth, mirroring how planFeatures.ts is the single
// source for plan→feature gating. The dashboard sidebar and a top-level
// route guard both call canSeeView() instead of hardcoding role checks,
// so changing who sees what only ever touches this file.
//
// NOTE: DashboardView must stay in sync with the `View` type declared in
// src/app/dashboard/page.tsx — that file can't import from here without
// risking a cycle, so the two lists are kept manually in sync. If you add
// a tab there, add it here too (it defaults to hidden for restricted
// roles until you decide who should see it).

export type DashboardView =
  | 'overview' | 'my-agents' | 'library' | 'build-agent' | 'stock' | 'sales' | 'dues'
  | 'notebook' | 'invoice' | 'invoice-history' | 'customer' | 'supply' | 'followup'
  | 'reports' | 'crm' | 'whatsapp' | 'catalog' | 'settings'

export type TeamRole = 'owner' | 'admin' | 'sales' | 'stock'

// 'all' = full sidebar, exactly like today's single-user experience.
// Owner and (team) Admin both get the whole dashboard — only Sales and
// Stock are actually restricted.
export const ROLE_TABS: Record<TeamRole, DashboardView[] | 'all'> = {
  owner: 'all',
  admin: 'all',
  sales: ['sales', 'invoice', 'invoice-history', 'customer', 'crm', 'dues'],
  stock: ['stock', 'supply'],
}

// Where a restricted role lands right after login — never the combined
// Overview screen, since it mixes sales/stock/customer numbers a
// restricted role isn't meant to see all of at once.
export const ROLE_DEFAULT_VIEW: Record<TeamRole, DashboardView> = {
  owner: 'overview',
  admin: 'overview',
  sales: 'sales',
  stock: 'stock',
}

export const ROLE_LABELS_BN: Record<TeamRole, string> = {
  owner: 'মালিক',
  admin: 'অ্যাডমিন',
  sales: 'সেলস / বিলিং',
  stock: 'স্টক',
}

export function canSeeView(role: TeamRole, view: DashboardView): boolean {
  const tabs = ROLE_TABS[role]
  return tabs === 'all' || tabs.includes(view)
}
