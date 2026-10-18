import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

const LIVE = ['confirmed', 'procurement', 'packing', 'ready_dispatch', 'part_delivered', 'exception']

/**
 * Cross-order recipient list used by the address queue, packing queue,
 * delivery planning and exceptions screens.
 * Query: order_id, address_status(csv), delivery_status(csv), run_id, packed, zone, q,
 *        live=1 (only orders in progress), unassigned=1 (no run yet), limit, offset
 */
export async function GET(req: NextRequest) {
  const g = await guard(['sales', 'ops', 'finance'])
  if (!g.ok) return g.res
  const { db } = g
  const sp = req.nextUrl.searchParams

  const live = sp.get('live') === '1'
  const sel = `*, order:rv_orders${live || sp.get('delivery_date') ? '!inner' : ''}(id,order_no,status,delivery_date,occasion,customer:rv_customers(id,name,company)), run:rv_delivery_runs(id,run_no,rider_name,zone)`
  let q = db.from('rv_recipients').select(sel, { count: 'exact' })

  const one = (k: string) => { const v = sp.get(k); if (v) q = q.eq(k, v) }
  one('order_id'); one('run_id'); one('zone'); one('pincode')
  const csv = (k: string) => { const v = sp.get(k); if (v) q = q.in(k, v.split(',')) }
  csv('address_status'); csv('delivery_status')
  if (sp.get('packed') === 'true') q = q.eq('packed', true)
  if (sp.get('packed') === 'false') q = q.eq('packed', false)
  if (sp.get('unassigned') === '1') q = q.is('run_id', null).neq('delivery_status', 'cancelled').neq('delivery_status', 'delivered')
  if (live) q = q.in('order.status', LIVE)
  if (sp.get('delivery_date')) q = q.eq('order.delivery_date', sp.get('delivery_date')!)

  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term) q = q.or(`name.ilike.%${term}%,mobile.ilike.%${term}%,address_line.ilike.%${term}%,delivery_no.ilike.%${term}%,pincode.ilike.%${term}%`)

  const limit = Math.min(Number(sp.get('limit') || 300), 1000)
  const offset = Math.max(Number(sp.get('offset') || 0), 0)
  q = q.order('delivery_no', { ascending: true }).range(offset, offset + limit - 1)
  const { data, error, count } = await q
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [], count: count ?? (data || []).length })
}
