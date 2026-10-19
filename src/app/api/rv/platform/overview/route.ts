import { NextResponse } from 'next/server'
import { guardSuper } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const c = (t: string, f?: (q: any) => any) => { const q = g.raw.from(t).select('id', { count: 'exact', head: true }); return (f ? f(q) : q).then((r: any) => r.count || 0) }
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  const [orgs, trial, active, suspended, users, new7, leads, orders] = await Promise.all([
    c('rv_orgs'), c('rv_orgs', q => q.eq('status', 'trial')), c('rv_orgs', q => q.eq('status', 'active')), c('rv_orgs', q => q.eq('status', 'suspended')),
    c('rv_staff'), c('rv_orgs', q => q.gte('created_at', since)), c('rv_leads'), c('rv_orders'),
  ])
  return NextResponse.json({ orgs, trial, active, suspended, users, new_companies_7d: new7, leads, orders })
}
