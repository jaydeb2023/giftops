// Server-only helpers for the GiftOps API routes.
// Every /api/rv/* route calls guard() first: it authenticates the Supabase
// session, finds the staff member and their COMPANY (org), checks the role, and hands
// back a service-role client that is SCOPED to that company: every read, update and delete
// is filtered by org_id, and every insert gets org_id stamped on it. A route therefore cannot
// read or write another company's rows by accident. The browser never talks to rv_* tables.

import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'
import type { RvRole } from './constants'
import { createOrg } from './orgs'

export interface Staff {
  id: string
  org_id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: RvRole
  active: boolean
}

export interface Org {
  id: string
  name: string
  slug: string
  status: 'trial' | 'active' | 'suspended'
  plan: string | null
  trial_ends_at: string | null
}

export type RawDb = ReturnType<typeof createAdminClient>
export type Db = RawDb

export type GuardResult =
  | { ok: true; db: Db; raw: RawDb; staff: Staff; org: Org; isSuper: boolean }
  | { ok: false; res: NextResponse }

/** Tables that belong to one company. (rv_orgs itself is platform-level.) */
export const TENANT_TABLES = new Set([
  'rv_staff', 'rv_settings', 'rv_counters', 'rv_customers', 'rv_contacts', 'rv_leads', 'rv_vendors', 'rv_orders',
  'rv_order_items', 'rv_delivery_runs', 'rv_recipients', 'rv_purchases', 'rv_invoices', 'rv_invoice_lines', 'rv_payments',
  'rv_bills', 'rv_bill_payments', 'rv_expenses', 'rv_communications', 'rv_tasks', 'rv_audit',
])

/** A service-role client locked to one company. */
export function scopedDb(orgId: string, base?: RawDb): Db {
  const raw = base || createAdminClient()
  const wrapFrom = (table: string) => {
    const qb: any = raw.from(table)
    if (!TENANT_TABLES.has(table)) return qb
    const stamp = (rows: any) => (Array.isArray(rows) ? rows.map(r => ({ ...r, org_id: orgId })) : { ...rows, org_id: orgId })
    return new Proxy(qb, {
      get(t, prop, recv) {
        if (prop === 'select') return (...a: any[]) => qb.select(...a).eq('org_id', orgId)
        if (prop === 'insert') return (rows: any, o?: any) => qb.insert(stamp(rows), o)
        if (prop === 'upsert') return (rows: any, o?: any) => qb.upsert(stamp(rows), o)
        if (prop === 'update') return (v: any, o?: any) => qb.update(v, o).eq('org_id', orgId)
        if (prop === 'delete') return (o?: any) => qb.delete(o).eq('org_id', orgId)
        const v = Reflect.get(t, prop, recv)
        return typeof v === 'function' ? v.bind(t) : v
      },
    })
  }
  return new Proxy(raw as any, {
    get(t, prop) {
      if (prop === '__orgId') return orgId
      if (prop === 'from') return wrapFrom
      if (prop === 'rpc') return (fn: string, args?: any, o?: any) => t.rpc(fn, fn === 'rv_next_number' ? { ...args, p_org: orgId } : args, o)
      const v = t[prop]
      return typeof v === 'function' ? v.bind(t) : v
    },
  }) as Db
}

export const orgIdOf = (db: Db): string => (db as any).__orgId

export function fail(message: string, status = 400, extra: Record<string, any> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

/** Platform owners (you at Evynta): RV_SUPER_ADMIN_EMAILS=a@x.com,b@y.com */
export function superEmails(): string[] {
  return (process.env.RV_SUPER_ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}
export const isSuperEmail = (email?: string | null) => !!email && superEmails().includes(email.toLowerCase())

/**
 * Authenticate + authorise. `roles` omitted => any active staff member of a company in good standing.
 * First sign-in after self-signup creates the company (the person becomes its admin).
 */
export async function guard(roles?: RvRole[]): Promise<GuardResult> {
  try { return await guardInner(roles) }
  catch (e: any) { return { ok: false, res: fail(`Server setup problem: ${e?.message || e}`, 500) } }
}

async function guardInner(roles?: RvRole[]): Promise<GuardResult> {
  const authClient = createRouteClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return { ok: false, res: fail('Please sign in.', 401) }

  const raw = createAdminClient()
  let { data: staff, error: staffErr } = await raw.from('rv_staff').select('*').eq('user_id', user.id).maybeSingle()
  if (staffErr) return { ok: false, res: fail(`Database problem: ${staffErr.message}. Did you run the SQL migrations (010, 011, 012) in this Supabase project?`, 500) }

  if (!staff) {
    // a colleague invited this email: link the pre-created staff row on first sign-in
    const { data: byEmail } = await raw.from('rv_staff').select('*')
      .ilike('email', user.email || '__none__').is('user_id', null).order('created_at').limit(1)
    if (byEmail && byEmail[0]) {
      const { data: linked } = await raw.from('rv_staff').update({ user_id: user.id }).eq('id', byEmail[0].id).select().single()
      staff = linked
    }
  }

  if (!staff) {
    // brand-new company signup (company name travels in the sign-up form)
    const companyName = String((user.user_metadata as any)?.company_name || '').trim()
    if (companyName && process.env.RV_SIGNUP_OPEN !== 'false') {
      const made = await createOrg(raw, {
        name: companyName, ownerEmail: user.email || '', ownerUserId: user.id,
        ownerName: (user.user_metadata as any)?.full_name || (user.email || '').split('@')[0], status: 'trial', trialDays: 14,
      })
      if (!made.ok) return { ok: false, res: fail(made.error, 500) }
      staff = made.staff
    }
  }

  const isSuper = isSuperEmail(user.email)
  if (!staff || !staff.active) {
    return { ok: false, res: fail('Your account is not linked to a company yet. Ask your company admin to add you, or create a company account.', 403, { code: 'NOT_STAFF', is_super: isSuper }) }
  }

  const { data: org } = await raw.from('rv_orgs').select('id,name,slug,status,plan,trial_ends_at').eq('id', staff.org_id).single()
  if (!org) return { ok: false, res: fail('Company not found.', 403, { code: 'NOT_STAFF' }) }
  if (org.status === 'suspended') {
    return { ok: false, res: fail('This company account is suspended. Please contact Evynta.', 403, { code: 'ORG_SUSPENDED' }) }
  }
  if (roles && staff.role !== 'admin' && !roles.includes(staff.role)) {
    return { ok: false, res: fail('You do not have permission for this action.', 403, { code: 'FORBIDDEN' }) }
  }
  return { ok: true, db: scopedDb(org.id, raw), raw, staff: staff as Staff, org: org as Org, isSuper }
}

export type SuperResult = { ok: true; raw: RawDb; email: string } | { ok: false; res: NextResponse }

/** Platform console (all companies). Only emails listed in RV_SUPER_ADMIN_EMAILS. */
export async function guardSuper(): Promise<SuperResult> {
  try {
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (!user) return { ok: false, res: fail('Please sign in.', 401) }
    if (!isSuperEmail(user.email)) return { ok: false, res: fail('Not allowed.', 403, { code: 'FORBIDDEN' }) }
    return { ok: true, raw: createAdminClient(), email: user.email! }
  } catch (e: any) { return { ok: false, res: fail(`Server setup problem: ${e?.message || e}`, 500) } }
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
const NOT_NULL_BOOL = ['active', 'consent_whatsapp', 'opt_out', 'quote_approved', 'packed', 'approved']

export function pick(body: Record<string, any>, allowed: string[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of allowed) {
    if (body[k] === undefined) continue
    if (NOT_NULL_BOOL.includes(k)) { out[k] = !!body[k]; continue }   // these columns are NOT NULL
    out[k] = body[k] === '' ? null : body[k]
  }
  return out
}

export function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const h = req.headers.get('authorization') || ''
  return h === `Bearer ${secret}`
}
