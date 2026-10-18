import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, pick } from '@/lib/rv/server'
import { normMobile } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

const ADDRESS_FIELDS = ['name', 'mobile', 'address_line', 'landmark', 'pincode']
const OTHER_FIELDS = ['zone', 'instructions', 'items_note', 'card_message', 'qc_ok', 'rework_reason', 'delivery_cost', 'reattempt_date']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops', 'finance'])
  if (!g.ok) return g.res
  const { data, error } = await g.db.from('rv_recipients')
    .select('*, order:rv_orders(id,order_no,status,delivery_date,customer:rv_customers(id,name,company)), run:rv_delivery_runs(id,run_no,rider_name)')
    .eq('id', params.id).maybeSingle()
  if (error) return fail(error.message, 500)
  if (!data) return fail('Not found', 404)
  const { data: comms } = await g.db.from('rv_communications').select('*').eq('recipient_id', params.id).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ data, comms: comms || [] })
}

/** Edit one recipient. Changing address fields never leaves a stale "verified" flag behind. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))

  const { data: before } = await db.from('rv_recipients').select('*').eq('id', params.id).maybeSingle()
  if (!before) return fail('Not found', 404)

  const row = pick(body, [...ADDRESS_FIELDS, ...OTHER_FIELDS])
  if ('mobile' in row) row.mobile_norm = normMobile(row.mobile) || null

  // packing flag
  if (body.packed !== undefined) {
    row.packed = !!body.packed
    row.packed_by = body.packed ? staff.id : null
    row.packed_at = body.packed ? new Date().toISOString() : null
  }

  const addressChanged = ADDRESS_FIELDS.some(f => f in row && (row[f] ?? '') !== (before[f] ?? ''))
  if (addressChanged && before.address_status === 'verified') {
    row.address_status = 'pending'
    row.verified_at = null
    row.verified_by = null
  }
  if (!Object.keys(row).length) return fail('Nothing to update')

  const { data, error } = await db.from('rv_recipients').update(row).eq('id', params.id).select().single()
  if (error) return fail(error.message, 400)

  const changes: Record<string, any> = {}
  for (const k of Object.keys(row)) if (before[k] !== data[k]) changes[k] = { from: before[k], to: data[k] }
  if (Object.keys(changes).length) await audit(db, staff, 'rv_recipients', params.id, 'update', changes)
  return NextResponse.json({ data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops'])
  if (!g.ok) return g.res
  const { data: r } = await g.db.from('rv_recipients').select('id,delivery_status,order_id').eq('id', params.id).maybeSingle()
  if (!r) return fail('Not found', 404)
  if (['delivered', 'in_transit', 'picked_up'].includes(r.delivery_status)) return fail('This delivery is already in progress or completed and cannot be removed.')
  const { error } = await g.db.from('rv_recipients').delete().eq('id', params.id)
  if (error) return fail(error.message, 400)
  await audit(g.db, g.staff, 'rv_recipients', params.id, 'delete', r)
  return NextResponse.json({ ok: true })
}
