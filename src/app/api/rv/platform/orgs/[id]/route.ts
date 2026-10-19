import { NextRequest, NextResponse } from 'next/server'
import { guardSuper, fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guardSuper()
  if (!g.ok) return g.res
  const b = await req.json().catch(() => ({}))
  const patch: Record<string, any> = {}
  if (b.status !== undefined) {
    if (!['trial', 'active', 'suspended'].includes(b.status)) return fail('Invalid status')
    patch.status = b.status
  }
  if (b.name !== undefined && String(b.name).trim()) patch.name = String(b.name).trim().slice(0, 120)
  if (b.plan !== undefined) patch.plan = b.plan || null
  if (b.notes !== undefined) patch.notes = b.notes || null
  if (b.contact_mobile !== undefined) patch.contact_mobile = b.contact_mobile || null
  if (b.trial_ends_at !== undefined) patch.trial_ends_at = b.trial_ends_at || null
  if (!Object.keys(patch).length) return fail('Nothing to change')
  const { data, error } = await g.raw.from('rv_orgs').update(patch).eq('id', params.id).select().single()
  if (error) return fail(error.message)
  await g.raw.from('rv_audit').insert({ org_id: params.id, actor_email: g.email, table_name: 'rv_orgs', record_id: params.id, action: 'platform_update', changes: patch })
  return NextResponse.json({ data })
}
