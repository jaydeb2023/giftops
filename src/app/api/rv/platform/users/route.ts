import { NextResponse } from 'next/server'
import { guardSuper, fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Everyone who has an account, with their company and last sign-in. */
export async function GET() {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const { data: staff, error } = await g.raw.from('rv_staff')
    .select('id,user_id,email,full_name,role,active,created_at,org:rv_orgs(id,name,status)').order('created_at', { ascending: false }).limit(2000)
  if (error) return fail(error.message, 500)
  const last: Record<string, string | null> = {}
  const prov: Record<string, string> = {}
  for (let page = 1; page <= 10; page++) {
    const { data } = await g.raw.auth.admin.listUsers({ page, perPage: 1000 })
    const us = data?.users || []
    us.forEach((u: any) => {
      last[u.id] = u.last_sign_in_at || null
      const ps: string[] = u.app_metadata?.providers || [u.app_metadata?.provider]
      prov[u.id] = ps.includes('google') ? 'Google' : 'Email'
    })
    if (us.length < 1000) break
  }
  return NextResponse.json({ data: (staff || []).map((s: any) => ({ ...s, last_sign_in: s.user_id ? last[s.user_id] ?? null : null, provider: s.user_id ? prov[s.user_id] || '-' : 'invited' })) })
}
