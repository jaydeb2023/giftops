import { NextResponse } from 'next/server'
import { guardSuper } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Platform-owner only (RV_SUPER_ADMIN_EMAILS). Company counts plus login activity of every account. */
export async function GET() {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const c = (t: string, f?: (q: any) => any) => { const q = g.raw.from(t).select('id', { count: 'exact', head: true }); return (f ? f(q) : q).then((r: any) => r.count || 0) }
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  const [orgs, trial, active, suspended, users, new7, leads, orders] = await Promise.all([
    c('rv_orgs'), c('rv_orgs', q => q.eq('status', 'trial')), c('rv_orgs', q => q.eq('status', 'active')), c('rv_orgs', q => q.eq('status', 'suspended')),
    c('rv_staff'), c('rv_orgs', q => q.gte('created_at', since)), c('rv_leads'), c('rv_orders'),
  ])

  // login activity comes from Supabase Auth
  const now = Date.now()
  const L = { accounts: 0, today: 0, d7: 0, d30: 0, never: 0, google: 0, email: 0, new7: 0 }
  for (let page = 1; page <= 20; page++) {
    const { data } = await g.raw.auth.admin.listUsers({ page, perPage: 1000 })
    const us = data?.users || []
    for (const u of us as any[]) {
      L.accounts++
      const last = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0
      if (!last) L.never++
      else {
        if (now - last < 864e5) L.today++
        if (now - last < 7 * 864e5) L.d7++
        if (now - last < 30 * 864e5) L.d30++
      }
      const providers: string[] = u.app_metadata?.providers || [u.app_metadata?.provider]
      if (providers.includes('google')) L.google++; else L.email++
      if (u.created_at && now - new Date(u.created_at).getTime() < 7 * 864e5) L.new7++
    }
    if (us.length < 1000) break
  }
  return NextResponse.json({ orgs, trial, active, suspended, users, new_companies_7d: new7, leads, orders, logins: L })
}
