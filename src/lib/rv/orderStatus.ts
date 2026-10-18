// Keeps the order-level status honest as the many recipient deliveries progress.
import type { Db } from './server'

const DISPATCH_STAGES = ['ready_dispatch', 'part_delivered', 'delivered', 'exception']

/**
 * Re-derive an order's status from its recipients.
 *  - all delivered/cancelled (>=1 delivered)  -> delivered
 *  - some delivered, others still open        -> part_delivered
 *  - any failed/returned with none open       -> exception
 * Only moves orders that are already at/after dispatch (or when the caller
 * passes force) — procurement/packing stages stay under manual control.
 */
export async function recalcOrderStatus(db: Db, orderId: string, opts: { respectManual?: boolean; force?: boolean } = {}) {
  const { data: order } = await db.from('rv_orders').select('id,status').eq('id', orderId).maybeSingle()
  if (!order || order.status === 'cancelled' || order.status === 'closed') return order?.status
  if (opts.respectManual && !DISPATCH_STAGES.includes(order.status)) return order.status

  const { data: recs } = await db.from('rv_recipients').select('delivery_status').eq('order_id', orderId)
  const all = recs || []
  if (!all.length) return order.status

  const live = all.filter(r => r.delivery_status !== 'cancelled')
  if (!live.length) return order.status
  const delivered = live.filter(r => r.delivery_status === 'delivered').length
  const failed = live.filter(r => r.delivery_status === 'failed' || r.delivery_status === 'returned').length
  const open = live.length - delivered - failed

  let next = order.status
  const anyMoved = live.some(r => r.delivery_status !== 'pending')
  if (!anyMoved && !opts.force) return order.status

  if (delivered === live.length) next = 'delivered'
  else if (open === 0 && failed > 0) next = 'exception'
  else if (delivered > 0) next = 'part_delivered'
  else if (failed > 0) next = 'exception'
  else if (DISPATCH_STAGES.includes(order.status)) next = order.status

  if (next !== order.status) await db.from('rv_orders').update({ status: next }).eq('id', orderId)
  return next
}
