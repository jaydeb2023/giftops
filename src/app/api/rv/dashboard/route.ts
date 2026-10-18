import { NextResponse } from 'next/server'
import { guard } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const g = await guard(['sales', 'ops', 'finance'])
  if (!g.ok) return g.res
  const { db } = g

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const in7 = new Date(now.getTime() + 7 * 864e5).toISOString().slice(0, 10)
  const ago7 = new Date(now.getTime() - 7 * 864e5).toISOString()
  const activeOrder = ['confirmed', 'procurement', 'packing', 'ready_dispatch', 'part_delivered', 'exception']

  const cnt = async (q: any) => { const { count } = await q; return count ?? 0 }

  // orders that are still live (for recipient-level counts)
  const { data: liveOrders } = await db.from('rv_orders').select('id,status').in('status', activeOrder)
  const liveIds = (liveOrders || []).map(o => o.id)
  const prePack = (liveOrders || []).filter(o => ['confirmed', 'procurement', 'packing'].includes(o.status)).map(o => o.id)

  const inLive = (q: any) => (liveIds.length ? q.in('order_id', liveIds) : q.eq('order_id', '00000000-0000-0000-0000-000000000000'))
  const inPre = (q: any) => (prePack.length ? q.in('order_id', prePack) : q.eq('order_id', '00000000-0000-0000-0000-000000000000'))

  const [
    leadsNew7, leadsTotal, leadsConverted, followupsDue,
    ordersToday, ordersWeek, missingAddr, packingBacklog, failed, podPending, openExceptions, dispatchToday,
    invRes, billRes, purchRes, leadFunnel,
  ] = await Promise.all([
    cnt(db.from('rv_leads').select('id', { count: 'exact', head: true }).gte('created_at', ago7)),
    cnt(db.from('rv_leads').select('id', { count: 'exact', head: true })),
    cnt(db.from('rv_leads').select('id', { count: 'exact', head: true }).eq('stage', 'converted')),
    cnt(db.from('rv_leads').select('id', { count: 'exact', head: true }).lte('next_followup_at', now.toISOString()).not('stage', 'in', '(converted,lost)')),
    cnt(db.from('rv_orders').select('id', { count: 'exact', head: true }).eq('delivery_date', today).not('status', 'in', '(cancelled,closed,delivered)')),
    cnt(db.from('rv_orders').select('id', { count: 'exact', head: true }).gte('delivery_date', today).lte('delivery_date', in7).not('status', 'in', '(cancelled,closed,delivered)')),
    cnt(inLive(db.from('rv_recipients').select('id', { count: 'exact', head: true }).neq('address_status', 'verified').neq('delivery_status', 'cancelled'))),
    cnt(inPre(db.from('rv_recipients').select('id', { count: 'exact', head: true }).eq('packed', false).neq('delivery_status', 'cancelled'))),
    cnt(db.from('rv_recipients').select('id', { count: 'exact', head: true }).eq('delivery_status', 'failed')),
    cnt(db.from('rv_recipients').select('id', { count: 'exact', head: true }).eq('delivery_status', 'delivered').is('pod_path', null).is('pod_ref', null)),
    cnt(db.from('rv_tasks').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('kind', 'exception')),
    cnt(db.from('rv_recipients').select('id', { count: 'exact', head: true }).in('delivery_status', ['assigned', 'picked_up', 'in_transit'])),
    db.from('rv_invoices').select('total,paid_amount,status,doc_type,invoice_date').neq('status', 'cancelled').eq('doc_type', 'invoice'),
    db.from('rv_bills').select('amount,paid_amount,status').neq('status', 'cancelled'),
    db.from('rv_purchases').select('status').in('status', ['requested', 'confirmed', 'issue']),
    db.from('rv_leads').select('stage'),
  ])

  const invoices = invRes.data || []
  const monthStart = today.slice(0, 7) + '-01'
  const invoicedMonth = invoices.filter(i => i.invoice_date >= monthStart).reduce((s, i) => s + Number(i.total), 0)
  const receivable = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid_amount)), 0)
  const payable = (billRes.data || []).reduce((s, b) => s + (Number(b.amount) - Number(b.paid_amount)), 0)

  const funnel: Record<string, number> = {}
  ;(leadFunnel.data || []).forEach((l: any) => { funnel[l.stage] = (funnel[l.stage] || 0) + 1 })

  // upcoming orders list
  const { data: upcoming } = await db.from('rv_orders')
    .select('id,order_no,status,delivery_date,occasion,customer:rv_customers(name,company),recipients:rv_recipients(count)')
    .gte('delivery_date', today).not('status', 'in', '(cancelled,closed,delivered)')
    .order('delivery_date', { ascending: true }).limit(8)

  return NextResponse.json({
    kpi: {
      leads_new_7d: leadsNew7,
      leads_total: leadsTotal,
      conversion_pct: leadsTotal ? Math.round((leadsConverted / leadsTotal) * 1000) / 10 : 0,
      followups_due: followupsDue,
      orders_today: ordersToday,
      orders_next_7d: ordersWeek,
      missing_addresses: missingAddr,
      packing_backlog: packingBacklog,
      out_for_delivery: dispatchToday,
      failed_deliveries: failed,
      pod_pending: podPending,
      open_exceptions: openExceptions,
      purchases_open: (purchRes.data || []).length,
      invoiced_this_month: invoicedMonth,
      receivable,
      payable,
    },
    funnel,
    upcoming: upcoming || [],
  })
}
