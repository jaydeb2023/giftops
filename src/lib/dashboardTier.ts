import { computeAccess, type Subscription } from '@/lib/subscription'

// ── How the dashboard LOOKS for each plan ───────────────────────────
// Single source of truth for plan → dashboard chrome (top bar / navigation).
// Same idea as planFeatures.ts (plan → features) and roleTabs.ts (team role →
// tabs): the dashboard never compares plan strings itself, it asks this file.
// To change what a plan sees in the dashboard header, edit TIER_UI below.
//
// Where the plan comes from (see subscription.ts / webhook / grant-access):
//   • New signup       → status 'trialing', plan 'monthly' (legacy default), 7 days
//   • Pays ₹99 / ₹199  → Razorpay webhook sets status 'active' + plan 'basic'|'starter'
//   • Enterprise       → admin grants status 'active' + plan 'business' by hand
//   • Platform admin   → bypasses subscriptions entirely (subscription is null)

export type DashboardTier = 'trial' | 'basic' | 'starter' | 'business'

export interface TierUI {
  /** ☰ button + sidebar drawer. Basic navigates with the bottom bar only. */
  sidebarMenu: boolean
  /** Language dropdown (বাংলা / हिन्दी / English) before the profile circle and in Settings. Shown on every plan. */
  languageToggle: boolean
  /** Profile circle opens a small Home / Logout menu instead of being static. */
  profileMenuOnly: boolean
}

export const TIER_UI: Record<DashboardTier, TierUI> = {
  basic:    { sidebarMenu: false, languageToggle: true,  profileMenuOnly: true  }, // ₹99
  starter:  { sidebarMenu: true,  languageToggle: true,  profileMenuOnly: false }, // ₹199
  business: { sidebarMenu: true,  languageToggle: true,  profileMenuOnly: false }, // Enterprise
  trial:    { sidebarMenu: true,  languageToggle: true,  profileMenuOnly: false }, // free 7 days — full experience
}

const isTier = (v: any): v is DashboardTier => v === 'basic' || v === 'starter' || v === 'business' || v === 'trial'

/**
 * Which tier is this account in RIGHT NOW?
 * The subscription's `plan` is the authority for anyone who currently has
 * access (paid period OR an admin-granted / running trial):
 *   • plan basic | starter | business  → that tier
 *   • trial row with the legacy default plan ('monthly') → 'trial' (full UI)
 * No access (expired / canceled / locked) never reaches the dashboard — the
 * page redirects to /subscribe — so it falls back to 'trial' here.
 *
 * Why not require status === 'active'? The admin panel can save plan=Basic on a
 * row whose status is still 'trialing', and the Plan column then reads "Basic".
 * Judging by status alone made that account look like a full-access user.
 */
export function getDashboardTier(
  sub: Subscription | null | undefined,
  isAdmin: boolean,
  adminPreview?: string | null,   // ?previewPlan=basic — honoured for platform admins only
): DashboardTier {
  if (isAdmin) return isTier(adminPreview) ? adminPreview : 'business'
  if (!sub) return 'trial'
  const access = computeAccess(sub)
  if (!access.hasAccess) return 'trial'
  const p = String(sub.plan || '').toLowerCase().trim()
  if (p === 'basic' || p === 'starter' || p === 'business') return p
  return access.isActive ? 'starter' : 'trial' // legacy paid plan → full; default trial → full
}
