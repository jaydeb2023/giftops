import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Run sheet: run + ordered stops + planned/completed/failed summary. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['ops', 'finance', 'rider'])
  if (!g.ok) return g.res
  const { db, staff } = g

  const { data: run } = await db.from('rv_delivery_runs')
    .select('*, rider:rv_staff!rv_delivery_runs_rider_staff_id_fkey(id,full_name)').eq('id', params.id).maybeSingle()
  if (!run) return fail('Run not found', 404)
  if (staff.role === 'rider' && run.rider_staff_id !== staff.id) return fail('This run is not assigned to you.', 403)

  const { data: stops } = await db.from('rv_recipients')
    .select('*, order:rv_orders(id,order_no,occasion,customer:rv_customers(name,company))')
    .eq('run_id', params.id).order('stop_seq', { ascending: true })
  const s = stops || []
  const summary = {
    planned: s.length,
    delivered: s.filter(x => x.delivery_status === 'delivered').length,
    failed: s.filter(x => x.delivery_status === 'failed').length,
    returned: s.filter(x => x.delivery_status === 'returned').length,
    open: s.filter(x => ['assigned', 'picked_up', 'in_transit'].includes(x.delivery_status)).length,
    cost_per_completed: 0,
  }
  const done = summary.delivered
  summary.cost_per_completed = done ? Math.round((Number(run.run_cost || 0) / done) * 100) / 100 : 0
  return NextResponse.json({ run, stops: s, summary })
}
