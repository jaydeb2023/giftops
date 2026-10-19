import { NextResponse } from 'next/server'
import { guard, isSuperEmail } from '@/lib/rv/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard()
  if (!g.ok) {
    // platform owner without a company of their own is still allowed in
    const { data: { user } } = await createRouteClient().auth.getUser()
    if (user && isSuperEmail(user.email)) {
      const body = await g.res.clone().json().catch(() => ({}))
      if (body.code === 'NOT_STAFF') return NextResponse.json({ staff: null, org: null, is_super: true })
    }
    return g.res
  }
  const { staff, org, isSuper } = g
  return NextResponse.json({
    staff: { id: staff.id, email: staff.email, full_name: staff.full_name, role: staff.role },
    org: { id: org.id, name: org.name, slug: org.slug, status: org.status, plan: org.plan, trial_ends_at: org.trial_ends_at },
    is_super: isSuper,
  })
}
