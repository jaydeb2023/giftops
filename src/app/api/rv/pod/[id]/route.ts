import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Redirects to a 5-minute signed URL of the POD photo for a recipient (private bucket). */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops', 'finance', 'rider'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: r } = await db.from('rv_recipients').select('pod_path,run:rv_delivery_runs(rider_staff_id)').eq('id', params.id).maybeSingle()
  if (!r?.pod_path) return fail('No POD photo', 404)
  if (staff.role === 'rider' && (r.run as any)?.rider_staff_id !== staff.id) return fail('Not allowed', 403)
  const { data, error } = await db.storage.from('rv-pod').createSignedUrl(r.pod_path, 300)
  if (error || !data) return fail(error?.message || 'Could not sign URL', 500)
  return NextResponse.redirect(data.signedUrl)
}
