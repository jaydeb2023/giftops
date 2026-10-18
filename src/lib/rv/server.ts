// Server-only helpers for the Raahvia API routes.
// Every /api/rv/* route calls guard() first: it authenticates the Supabase
// session, looks the user up in rv_staff, checks the role, and hands back a
// service-role client. The browser never talks to rv_* tables directly.

import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'
import type { RvRole } from './constants'

export interface Staff {
  id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: RvRole
  active: boolean
}

export type Db = ReturnType<typeof createAdminClient>

export type GuardResult =
  | { ok: true; db: Db; staff: Staff }
  | { ok: false; res: NextResponse }

export function fail(message: string, status = 400, extra: Record<string, any> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/**
 * Authenticate + authorise. `roles` omitted => any active staff member.
 * The very first signed-in user becomes admin when rv_staff is empty
 * (restricted to RV_ADMIN_EMAILS if that env var is set).
 */
export async function guard(roles?: RvRole[]): Promise<GuardResult> {
  try { return await guardInner(roles) }
  catch (e: any) { return { ok: false, res: fail(`Server setup problem: ${e?.message || e}`, 500) } }
}

async function guardInner(roles?: RvRole[]): Promise<GuardResult> {
  const authClient = createRouteClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, res: fail('Please sign in.', 401) }

  const db = createAdminClient()
  let { data: staff, error: staffErr } = await db.from('rv_staff').select('*').eq('user_id', user.id).maybeSingle()
  if (staffErr) return { ok: false, res: fail(`Database problem: ${staffErr.message}. Did you run the 010 SQL migration in this Supabase project?`, 500) }

  if (!staff) {
    // Link a pre-created staff row (added by an admin) to this login by email.
    const { data: byEmail } = await db.from('rv_staff').select('*')
      .ilike('email', user.email || '__none__').is('user_id', null).maybeSingle()
    if (byEmail) {
      const { data: linked } = await db.from('rv_staff').update({ user_id: user.id }).eq('id', byEmail.id).select().single()
      staff = linked
    }
  }

  if (!staff) {
    const { count } = await db.from('rv_staff').select('id', { count: 'exact', head: true })
    const allowList = (process.env.RV_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    const emailOk = allowList.length === 0 || allowList.includes((user.email || '').toLowerCase())
    if ((count ?? 0) === 0 && emailOk) {
      const { data: created, error } = await db.from('rv_staff').insert({
        user_id: user.id,
        email: user.email || '',
        full_name: (user.user_metadata as any)?.full_name || (user.email || '').split('@')[0],
        role: 'admin',
      }).select().single()
      if (error) return { ok: false, res: fail(error.message, 500) }
      staff = created
    }
  }

  if (!staff || !staff.active) {
    return { ok: false, res: fail('Your account is not set up for GiftOps. Ask an admin to add you.', 403, { code: 'NOT_STAFF' }) }
  }
  if (roles && staff.role !== 'admin' && !roles.includes(staff.role)) {
    return { ok: false, res: fail('You do not have permission for this action.', 403, { code: 'FORBIDDEN' }) }
  }
  return { ok: true, db, staff: staff as Staff }
}

export async function audit(
  db: Db, staff: Pick<Staff, 'id' | 'email'> | null, table: string, recordId: string | null,
  action: string, changes?: any,
) {
  try {
    await db.from('rv_audit').insert({
      actor_id: staff?.id ?? null,
      actor_email: staff?.email ?? null,
      table_name: table,
      record_id: recordId,
      action,
      changes: changes ?? null,
    })
  } catch (e) {
    console.error('[rv audit] failed', e)
  }
}

/** Sequential human-readable number, e.g. nextNo(db,'order','RV-ORD-',5) => RV-ORD-00042 */
export async function nextNo(db: Db, counter: string, prefix: string, pad = 5): Promise<string> {
  const { data, error } = await db.rpc('rv_next_number', { p_name: counter })
  if (error) throw new Error(error.message)
  return prefix + String(data).padStart(pad, '0')
}

export async function getSetting<T = any>(db: Db, key: string, fallback: T): Promise<T> {
  const { data } = await db.from('rv_settings').select('value').eq('key', key).maybeSingle()
  return { ...(fallback as any), ...((data?.value as any) || {}) } as T
}

/** Pick only allowed keys from a body, dropping undefined. */
export function pick(body: Record<string, any>, allowed: string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of allowed) {
    if (body[k] !== undefined) out[k] = body[k] === '' ? null : body[k]
  }
  return out
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers.get('authorization') || ''
  return h === `Bearer ${secret}`
}
