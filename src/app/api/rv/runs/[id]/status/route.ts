import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['ops', 'rider'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { status } = await req.json().catch(() => ({}))
  if (!['planned', 'out_for_delivery', 'completed', 'cancelled'].includes(status)) return fail('Invalid status')

  const { data: run } = await db.from('rv_delivery_runs').select('*').eq('id', params.id).maybeSingle()
  if (!run) return fail('Run not found', 404)
  if (staff.role === 'rider' && (run.rider_staff_id !== staff.id || !['out_for_delivery', 'completed'].includes(status))) {
    return fail('Not allowed', 403)
  }

  const patch: Record<string, any> = { status }
  if (status === 'out_for_delivery' && !run.started_at) patch.started_at = new Date().toISOString()
  if (status === 'completed') {
    const { count } = await db.from('rv_recipients').select('id', { count: 'exact', head: true })
      .eq('run_id', params.id).in('delivery_status', ['assigned', 'picked_up', 'in_transit'])
    if ((count ?? 0) > 0) return fail(`${count} stop(s) are still open. Mark each as delivered or failed first.`)
    patch.completed_at = new Date().toISOString()
  }
  if (status === 'cancelled') {
    await db.from('rv_recipients').update({ run_id: null, stop_seq: null, delivery_status: 'pending' })
      .eq('run_id', params.id).eq('delivery_status', 'assigned')
  }
  const { data, error } = await db.from('rv_delivery_runs').update(patch).eq('id', params.id).select().single()
  if (error) return fail(error.message, 400)
  await audit(db, staff, 'rv_delivery_runs', params.id, 'status', { from: run.status, to: status })
  return NextResponse.json({ data })
}
