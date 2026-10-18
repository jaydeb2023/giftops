import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'
import { round2 } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

/** Everything the order page needs in one call. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops', 'finance'])
  if (!g.ok) return g.res
  const { db } = g

  const { data: order } = await db.from('rv_orders')
    .select('*, customer:rv_customers(*), owner:rv_staff!rv_orders_owner_id_fkey(id,full_name)')
    .eq('id', params.id).maybeSingle()
  if (!order) return fail('Order not found', 404)

  const [items, recipients, purchases, invoices, payments, tasks] = await Promise.all([
    db.from('rv_order_items').select('*, vendor:rv_vendors(id,name)').eq('order_id', params.id).order('created_at'),
    db.from('rv_recipients').select('*, run:rv_delivery_runs(id,run_no,rider_name,run_date)').eq('order_id', params.id).order('delivery_no'),
    db.from('rv_purchases').select('*, vendor:rv_vendors(id,name)').eq('order_id', params.id).order('created_at'),
    db.from('rv_invoices').select('*').eq('order_id', params.id).order('created_at'),
    db.from('rv_payments').select('*').eq('order_id', params.id).order('received_on'),
    db.from('rv_tasks').select('*').eq('order_id', params.id).eq('status', 'open'),
  ])

  const it = items.data || []
  const gross = it.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0)
  const discount = Number(order.discount || 0)
  const taxable = Math.max(gross - discount, 0)
  const ratio = gross > 0 ? taxable / gross : 1
  const gst = it.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price) * ratio * Number(i.gst_rate) / 100, 0)
  const cost = it.reduce((s, i) => s + Number(i.qty) * Number(i.cost_price), 0)

  const rc = recipients.data || []
  const by = (f: (r: any) => boolean) => rc.filter(f).length
  return NextResponse.json({
    order,
    items: it,
    recipients: rc,
    purchases: purchases.data || [],
    invoices: invoices.data || [],
    payments: payments.data || [],
    tasks: tasks.data || [],
    totals: { gross: round2(gross), discount: round2(discount), taxable: round2(taxable), gst: round2(gst), total: round2(taxable + gst), est_cost: round2(cost) },
    counts: {
      recipients: rc.length,
      address_verified: by(r => r.address_status === 'verified'),
      address_open: by(r => r.address_status !== 'verified' && r.delivery_status !== 'cancelled'),
      packed: by(r => r.packed),
      delivered: by(r => r.delivery_status === 'delivered'),
      failed: by(r => r.delivery_status === 'failed'),
      in_transit: by(r => ['assigned', 'picked_up', 'in_transit'].includes(r.delivery_status)),
    },
  })
}
