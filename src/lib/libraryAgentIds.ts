// Fixed, well-known agent_id values used to tag rows written by the 5
// prebuilt library agents in the canonical tables (daily_sales, stock_items,
// credit_entries, crm_customers, crm_purchases).
//
// These are NOT rows in public.agents — the FK on agent_id was intentionally
// dropped in supabase/migrations/010_unify_library_agents.sql so library
// agents don't need an owning user. Treat these as opaque tags, not real
// agent ids to join against.
//
// IMPORTANT: keep in sync with the literals in
// supabase/migrations/010_unify_library_agents.sql if you ever change one.

export const LIBRARY_AGENT_IDS = {
  dokan:    '00000000-0000-0000-0000-000000000001',
  hotel:    '00000000-0000-0000-0000-000000000002',
  mishti:   '00000000-0000-0000-0000-000000000003',
  kapor:    '00000000-0000-0000-0000-000000000004',
  pharmacy: '00000000-0000-0000-0000-000000000005',
} as const

export type LibraryVertical = keyof typeof LIBRARY_AGENT_IDS

export const LIBRARY_AGENT_NAMES_BN: Record<LibraryVertical, string> = {
  dokan:    'দোকান ম্যানেজার',
  hotel:    'হোটেল ম্যানেজার',
  mishti:   'মিষ্টির দোকান',
  kapor:    'কাপড়ের দোকান',
  pharmacy: 'ফার্মেসি সহায়ক',
}

export const LIBRARY_AGENT_SLUGS: Record<LibraryVertical, string> = {
  dokan:    'dokan-manager',
  hotel:    'hotel-and-dhaba-manager',
  mishti:   'mishti-dokan-manager',
  kapor:    'kaporer-dokan-tracker',
  pharmacy: 'pharmacy-assistant',
}

export const LIBRARY_AGENT_ICONS: Record<LibraryVertical, string> = {
  dokan:    '🏪',
  hotel:    '🍽️',
  mishti:   '🍬',
  kapor:    '👗',
  pharmacy: '💊',
}

export const LIBRARY_AGENT_COLORS: Record<LibraryVertical, string> = {
  dokan:    '#4F46E5',
  hotel:    '#EA580C',
  mishti:   '#C026D3',
  kapor:    '#7C3AED',
  pharmacy: '#0284C7',
}

// Single source of truth for "agent_id → display info" across every
// cross-agent view (Stock, Sales, CRM, Customer/Billing, etc). Each of
// those views used to build its own name/icon lookup from just the
// `agents` table, which meant the 5 canonical library agents (whose rows
// use these fixed ids, not a row in `agents`) silently fell back to
// "Unknown" or a blank label wherever a view forgot to special-case them.
// Merge this in ONCE per view instead of re-deriving it each time.
export function libraryAgentDisplayById(): Record<string, { name: string; icon: string; color: string }> {
  const map: Record<string, { name: string; icon: string; color: string }> = {}
  for (const v of Object.keys(LIBRARY_AGENT_IDS) as LibraryVertical[]) {
    map[LIBRARY_AGENT_IDS[v]] = { name: LIBRARY_AGENT_NAMES_BN[v], icon: LIBRARY_AGENT_ICONS[v], color: LIBRARY_AGENT_COLORS[v] }
  }
  return map
}
