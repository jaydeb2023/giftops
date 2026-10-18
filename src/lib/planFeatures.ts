// ── Feature flags per plan ──────────────────────────────────────
// Single source of truth for "can this plan see/use feature X".
// Sidebar items, page guards, and API routes should all call
// hasFeature() instead of comparing plan strings directly, so a
// pricing change only ever touches this one file.
//
// Plans stay 3-key, matching planLimits.ts (basic / starter /
// business) — 'business' is the merged SMB+Enterprise tier.

export type PlanId = 'basic' | 'starter' | 'business'

export type Feature =
  // core (every paid plan)
  | 'dashboard' | 'stock' | 'sales' | 'baki' | 'billing'
  | 'ai_chat' | 'ai_notebook' | 'library' | 'build_agent_basic'
  | 'whatsapp_basic' | 'insights_basic' | 'automations_basic'
  // starter+
  | 'build_agent_full' | 'whatsapp_full'
  // business only
  | 'employees' | 'roles_permissions' | 'branches' | 'approvals'
  | 'audit_logs' | 'ai_workforce' | 'insights_advanced' | 'automations_advanced'

const BASIC_FEATURES: Feature[] = [
  'dashboard', 'stock', 'sales', 'baki', 'billing',
  'ai_chat', 'ai_notebook', 'library', 'build_agent_basic',
  'whatsapp_basic', 'insights_basic', 'automations_basic',
]

const STARTER_FEATURES: Feature[] = [
  ...BASIC_FEATURES,
  'build_agent_full', 'whatsapp_full',
]

const BUSINESS_FEATURES: Feature[] = [
  ...STARTER_FEATURES,
  'employees', 'roles_permissions', 'branches', 'approvals',
  'audit_logs', 'ai_workforce', 'insights_advanced', 'automations_advanced',
]

export const PLAN_FEATURES: Record<PlanId, Feature[]> = {
  basic: BASIC_FEATURES,
  starter: STARTER_FEATURES,
  business: BUSINESS_FEATURES,
}

/**
 * True if the given plan includes this feature.
 * `plan` may be null/undefined/unrecognized (e.g. expired, no sub) —
 * always fails closed to "no access" in that case.
 */
export function hasFeature(plan: string | null | undefined, feature: Feature): boolean {
  if (!plan) return false
  const features = PLAN_FEATURES[plan as PlanId]
  if (!features) return false
  return features.includes(feature)
}

/** Human label (Bengali) for why a feature is locked — for upgrade prompts. */
export function lockedMessageBn(feature: Feature): string {
  const isStarterFeature = STARTER_FEATURES.includes(feature) && !BASIC_FEATURES.includes(feature)
  return isStarterFeature
    ? 'এই ফিচারটি Starter বা তার উপরের প্ল্যানে পাওয়া যায়।'
    : 'এই ফিচারটি শুধু Business প্ল্যানে পাওয়া যায়।'
}
