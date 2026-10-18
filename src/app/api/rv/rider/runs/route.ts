import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Runs (with stops) for the rider app. Riders see only their own; ops/admin see a day's runs. */
export async function GET(req: NextRequest) {
  const g = await guard(['ops', 'rider'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const date = req.nextUrl.searchParams.get('date') || new Date().toISOString().slice(0, 10)

  let q = db.from('rv_delivery_runs').select('*').neq('status', 'cancelled')
  if (staff.role === 'rider') {
    const from = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10)
    q = q.eq('rider_staff_id', staff.id).gte('run_date', from).neq('status', 'completed')
  } else {
    q = q.eq('run_date', date)
  }
  const { data: runs, error } = await q.order('run_date').order('run_no')
  if (error) return fail(error.message, 500)
  const ids = (runs || []).map(r => r.id)
  const { data: stops } = ids.length
    ? await db.from('rv_recipients')
        .select('id,run_id,stop_seq,delivery_no,name,mobile,address_line,landmark,pincode,zone,instructions,items_note,card_message,delivery_status,failed_reason,received_by,pod_path,pod_ref,delivered_at,order:rv_orders(order_no,occasion)')
        .in('run_id', ids).order('stop_seq')
    : { data: [] as any[] }
  const out = (runs || []).map(r => ({ ...r, stops: (stops || []).filter((s: any) => s.run_id === r.id) }))
  return NextResponse.json({ data: out })
}
