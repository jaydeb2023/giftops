// ── Enterprise team access ──────────────────────────────────────
// Central place every API route calls to answer two questions:
//   1. Whose DATA should this request read/write? (the "owner" — for a
//      normal single-user account, that's just themselves)
//   2. Which agent(s) is the person allowed to touch, and with which
//      permissions?
// A normal (non-enterprise) account has no team_members row at all, so
// resolveEffectiveAccess() falls through to "owner, full access" — this
// is why nothing about the existing single-user product changes.
//
// Agents come in two kinds, matching user_agent_activations:
//   'library' → ref is the slug (e.g. 'dokan-manager', from LIBRARY_AGENT_SLUGS)
//   'custom'  → ref is the row id in public.agents

import { Permission, ROLE_DEFAULT_PERMISSIONS } from '@/lib/permissions'

export interface AgentRef {
  kind: 'library' | 'custom'
  ref: string
}

export interface EffectiveAccess {
  ownerId: string          // whose stock_items/crm_customers/etc. to query
  callerId: string         // the actual logged-in auth user
  role: 'owner' | 'admin' | 'sales' | 'stock'
  permissions: Permission[]  // ignored/all-true when role === 'owner'
  allowedAgents: AgentRef[] | 'all'
  teamMemberId: string | null
}

export async function resolveEffectiveAccess(supabase: any, authUserId: string): Promise<EffectiveAccess> {
  try {
    const { data: membership } = await supabase
      .from('team_members')
      .select('id, owner_user_id, role, permissions')
      .eq('member_user_id', authUserId)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) {
      return { ownerId: authUserId, callerId: authUserId, role: 'owner', permissions: [], allowedAgents: 'all', teamMemberId: null }
    }

    const { data: access } = await supabase
      .from('team_member_agent_access')
      .select('kind, ref')
      .eq('team_member_id', membership.id)

    const role: 'admin' | 'sales' | 'stock' = membership.role === 'admin' ? 'admin' : membership.role === 'stock' ? 'stock' : 'sales'
    // permissions column may be empty on very old rows (pre-migration-011) —
    // fall back to the role's default set rather than locking them out entirely.
    const permissions: Permission[] = (membership.permissions?.length ? membership.permissions : ROLE_DEFAULT_PERMISSIONS[role])

    return {
      ownerId: membership.owner_user_id,
      callerId: authUserId,
      role,
      permissions,
      allowedAgents: (access || []).map((r: any) => ({ kind: r.kind, ref: r.ref })),
      teamMemberId: membership.id,
    }
  } catch (e) {
    console.error('resolveEffectiveAccess error:', e)
    // Fail closed toward "just themselves", never toward broader access.
    return { ownerId: authUserId, callerId: authUserId, role: 'owner', permissions: [], allowedAgents: 'all', teamMemberId: null }
  }
}

/** True if this access grant may use the given agent. */
export function canAccessAgent(access: EffectiveAccess, kind: 'library' | 'custom', ref: string | null | undefined): boolean {
  if (access.allowedAgents === 'all') return true
  if (!ref) return false
  return access.allowedAgents.some(a => a.kind === kind && a.ref === ref)
}
