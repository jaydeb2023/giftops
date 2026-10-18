import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'
import { round2 } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

/**
 * Order-level contribution report.
 * revenue  = taxable value of issued invoices less credit notes (falls back to the quoted value when not yet invoiced)
 * direct   = purchases + order-linked courier/other bills + recipient delivery costs + order expenses
 *            + this order's share of delivery-run cost (run cost + run bills, split by stops)
 * contribution = revenue - direct cost.  This is gross margin / contribution, NOT accounting profit.
 */
export async function GET(req: NextRequest) {
  const g = await guard(['finance', 'ops'])
  if (!g.ok) return g.res
  const { db } = g
  const sp = req.nextUrl.searchParams
  const from = sp.get('from'), to = sp.get('to'), orderId = sp.get('order_id')

  let oq = db.from('rv_orders').select('id,order_no,status,delivery_date,occasion,discount,customer:rv_customers(name,company)').neq('status', 'cancelled')
  if (orderId) oq = oq.eq('id', orderId)
  if (from) oq = oq.gte('delivery_date', from)
  if (to) oq = oq.lte('delivery_date', to)
  const { data: orders, error } = await oq.order('delivery_date', { ascending: false }).limit(2000)
  if (error) return fail(error.message, 500)
  const ids = (orders || []).map(o => o.id)
  if (!ids.length) return NextResponse.json({ rows: [], totals: { revenue: 0, cost: 0, contribution: 0 } })

  const chunk = <T,>(arr: T[], n = 150) => { const o: T[][] = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o }
  const fetchIn = async (table: string, col: string, select: string) => {
    const all: any[] = []
    for (const c of chunk(ids)) { const { data } = await db.from(table).select(select).in(col, c); all.push(...(data || [])) }
    return all
  }
  const [items, invoices, purchases, bills, recs, expenses] = await Promise.all([
    fetchIn('rv_order_items', 'order_id', 'order_id,qty,unit_price'),
    fetchIn('rv_invoices', 'order_id', 'order_id,doc_type,status,taxable_value'),
    fetchIn('rv_purchases', 'order_id', 'order_id,total_cost,status'),
    fetchIn('rv_bills', 'order_id', 'order_id,bill_type,amount,status,purchase_id'),
    fetchIn('rv_recipients', 'order_id', 'order_id,run_id,delivery_cost,delivery_status'),
    fetchIn('rv_expenses', 'order_id', 'order_id,amount'),
  ])

  // run cost allocation: (run_cost + run bills) split by number of non-cancelled stops per order
  const runIds = Array.from(new Set(recs.map(r => r.run_id).filter(Boolean)))
  const runCost: Record<string, number> = {}
  const runStops: Record<string, number> = {}
  if (runIds.length) {
    for (const c of chunk(runIds as string[])) {
      const { data: runs } = await db.from('rv_delivery_runs').select('id,run_cost').in('id', c)
      ;(runs || []).forEach(r => { runCost[r.id] = Number(r.run_cost || 0) })
      const { data: rb } = await db.from('rv_bills').select('run_id,amount,order_id,status').in('run_id', c).is('order_id', null).neq('status', 'cancelled')
      ;(rb || []).forEach(b => { runCost[b.run_id] = (runCost[b.run_id] || 0) + Number(b.amount) })
      const { data: rs } = await db.from('rv_recipients').select('run_id,delivery_status').in('run_id', c).neq('delivery_status', 'cancelled')
      ;(rs || []).forEach(s => { runStops[s.run_id] = (runStops[s.run_id] || 0) + 1 })
    }
  }

  const rows = (orders || []).map((o: any) => {
    const quote = items.filter(i => i.order_id === o.id).reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0) - Number(o.discount || 0)
    const inv = invoices.filter(i => i.order_id === o.id && i.status !== 'cancelled')
    const invoiced = inv.filter(i => i.doc_type === 'invoice').reduce((s, i) => s + Number(i.taxable_value), 0)
    const credited = inv.filter(i => i.doc_type === 'credit_note').reduce((s, i) => s + Number(i.taxable_value), 0)
    const revenue = invoiced > 0 ? invoiced - credited : Math.max(quote, 0)
    const purchaseCost = purchases.filter(p => p.order_id === o.id && p.status !== 'cancelled').reduce((s, p) => s + Number(p.total_cost), 0)
    // vendor bills linked to a purchase are the supplier's invoice for that purchase -> not counted twice
    const otherBills = bills.filter(b => b.order_id === o.id && b.status !== 'cancelled' && !(b.bill_type === 'vendor' && b.purchase_id)).reduce((s, b) => s + Number(b.amount), 0)
    const myRecs = recs.filter(r => r.order_id === o.id && r.delivery_status !== 'cancelled')
    const delivery = myRecs.reduce((s, r) => s + Number(r.delivery_cost || 0), 0)
    const exp = expenses.filter(e => e.order_id === o.id).reduce((s, e) => s + Number(e.amount), 0)
    const byRun: Record<string, number> = {}
    myRecs.forEach(r => { if (r.run_id) byRun[r.run_id] = (byRun[r.run_id] || 0) + 1 })
    const runShare = Object.entries(byRun).reduce((s, [rid, n]) => s + ((runCost[rid] || 0) * n) / Math.max(runStops[rid] || 1, 1), 0)
    const cost = purchaseCost + otherBills + delivery + exp + runShare
    return {
      order_id: o.id, order_no: o.order_no, status: o.status, delivery_date: o.delivery_date, occasion: o.occasion,
      customer: o.customer?.company || o.customer?.name || '',
      recipients: myRecs.length,
      revenue: round2(revenue), invoiced: invoiced > 0,
      product_cost: round2(purchaseCost), other_bills: round2(otherBills), delivery_cost: round2(delivery + runShare), expenses: round2(exp),
      cost: round2(cost), contribution: round2(revenue - cost),
      margin_pct: revenue > 0 ? round2(((revenue - cost) / revenue) * 100) : 0,
    }
  })
  const totals = {
    revenue: round2(rows.reduce((s, r) => s + r.revenue, 0)),
    cost: round2(rows.reduce((s, r) => s + r.cost, 0)),
    contribution: round2(rows.reduce((s, r) => s + r.contribution, 0)),
  }
  return NextResponse.json({ rows, totals, note: 'Contribution = revenue (ex-GST) less direct order costs. It is a gross-margin view, not accounting profit.' })
}
