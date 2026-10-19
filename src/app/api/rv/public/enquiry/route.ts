import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseServer'
import { scopedDb } from '@/lib/rv/server'
import { intakeLead } from '@/lib/rv/leadIntake'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Public contact form on the GiftOps website. No key needed; protected by a hidden spam field and a per-IP limit. */
const hits = new Map<string, { n: number; t: number }>()

export async function POST(req: NextRequest) {
  const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim()
  const now = Date.now(); const h = hits.get(ip)
  if (h && now - h.t < 10 * 60000) { h.n++; if (h.n > 5) return NextResponse.json({ error: 'Too many requests. Please try later.' }, { status: 429 }) } else hits.set(ip, { n: 1, t: now })

  const b = await req.json().catch(() => ({}))
  if (b.hp) return NextResponse.json({ ok: true })
  const raw = createAdminClient()
  const { data: org } = await raw.from('rv_orgs').select('id').eq('slug', process.env.RV_SITE_ORG_SLUG || 'evynta').maybeSingle()
  if (!org) return NextResponse.json({ ok: true })
  const r = await intakeLead(scopedDb(org.id, raw), {
    name: String(b.name || '').slice(0, 120), mobile: b.mobile, email: String(b.email || '').slice(0, 200) || null,
    company: String(b.company || '').slice(0, 160) || null, message: b.message, source: 'website', meta: { form: 'giftops-site' },
  })
  if (r.status === 'rejected') return NextResponse.json({ error: r.reason }, { status: 422 })
  return NextResponse.json({ ok: true })
}
