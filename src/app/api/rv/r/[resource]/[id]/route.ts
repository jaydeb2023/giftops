import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, pick } from '@/lib/rv/server'
import { recalcBill } from '@/lib/rv/finance'
import { RESOURCES } from '@/lib/rv/resources'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg) return fail('Unknown resource', 404)
  const g = await guard(cfg.read)
  if (!g.ok) return g.res
  const { data, error } = await g.db.from(cfg.table).select(cfg.select).eq('id', params.id).maybeSingle()
  if (error) return fail(error.message, 500)
  if (!data) return fail('Not found', 404)
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg) return fail('Unknown resource', 404)
  const g = await guard(cfg.write)
  if (!g.ok) return g.res
  const { db, staff } = g

  const body = await req.json().catch(() => ({}))
  let row = pick(body, cfg.fields)
  if (!Object.keys(row).length) return fail('Nothing to update')
  if (cfg.prepare) row = cfg.prepare(row)

  const { data: before } = await db.from(cfg.table).select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail('Not found', 404)

  if (params.resource === 'leads' && row.stage === 'lost' && !(row.lost_reason || before.lost_reason)) {
    return fail('Lost reason is required when a lead is marked lost')
  }
  // Invoiced orders cannot silently change customer
  if (params.resource === 'orders' && row.customer_id && row.customer_id !== before.customer_id) {
    const { count } = await db.from('rv_invoices').select('id', { count: 'exact', head: true }).eq('order_id', params.id)
    if ((count ?? 0) > 0) return fail('This order already has invoices, so the customer cannot be changed.')
  }

  const { data, error } = await db.from(cfg.table).update(row).eq('id', params.id).select().single()
  if (error) return fail(error.message, 400)

  const changes: Record<string, { from: any; to: any }> = {}
  for (const k of Object.keys(row)) if (before[k] !== data[k]) changes[k] = { from: before[k], to: data[k] }
  if (!cfg.noAudit && Object.keys(changes).length) await audit(db, staff, cfg.table, params.id, 'update', changes)

  if (params.resource === 'bills' && ('amount' in row)) await recalcBill(db, params.id)

  // Cancelling an order cancels deliveries that have not happened yet.
  if (params.resource === 'orders' && row.status === 'cancelled') {
    await db.from('rv_recipients').update({ delivery_status: 'cancelled' })
      .eq('order_id', params.id).in('delivery_status', ['pending', 'assigned'])
  }
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { resource: string; id: string } }) {
  const cfg = RESOURCES[params.resource]
  if (!cfg) return fail('Unknown resource', 404)
  const g = await guard(cfg.remove)
  if (!g.ok) return g.res
  const { db, staff } = g

  // Protect financial history
  if (params.resource === 'orders') {
    const { count } = await db.from('rv_invoices').select('id', { count: 'exact', head: true }).eq('order_id', params.id)
    if ((count ?? 0) > 0) return fail('This order has invoices. Cancel it instead of deleting.')
  }
  if (params.resource === 'customers') {
    const { count } = await db.from('rv_orders').select('id', { count: 'exact', head: true }).eq('customer_id', params.id)
    if ((count ?? 0) > 0) return fail('This customer has orders and cannot be deleted.')
  }

  const { data: before } = await db.from(cfg.table).select('*').eq('id', params.id).maybeSingle()
  const { error } = await db.from(cfg.table).delete().eq('id', params.id)
  if (error) return fail(error.message, 400)
  if (!cfg.noAudit) await audit(db, staff, cfg.table, params.id, 'delete', before)
  return NextResponse.json({ ok: true })
}
