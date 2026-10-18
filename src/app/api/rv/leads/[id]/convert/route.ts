import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, nextNo } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'

/** Convert a lead -> customer (re-using an existing customer with the same mobile) and optionally open an order. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))

  const { data: lead } = await db.from('rv_leads').select('*').eq('id', params.id).maybeSingle()
  if (!lead) return fail('Lead not found', 404)

  let customerId: string | null = lead.customer_id
  if (!customerId && lead.mobile_norm) {
    const { data: existing } = await db.from('rv_customers').select('id').eq('mobile_norm', lead.mobile_norm).maybeSingle()
    if (existing) customerId = existing.id
  }
  if (!customerId) {
    const { data: cust, error } = await db.from('rv_customers').insert({
      customer_no: await nextNo(db, 'customer', 'RV-C-', 5),
      type: lead.company ? 'corporate' : 'personal',
      name: lead.name,
      company: lead.company,
      mobile: lead.mobile,
      mobile_norm: lead.mobile_norm,
      email: lead.email,
      consent_whatsapp: lead.consent_whatsapp,
      opt_out: lead.opt_out,
    }).select().single()
    if (error) return fail(error.message, 400)
    customerId = cust.id
    await audit(db, staff, 'rv_customers', cust.id, 'create', { from_lead: lead.id })
  }

  let orderId: string | null = null
  if (body.create_order !== false) {
    const { data: order, error } = await db.from('rv_orders').insert({
      order_no: await nextNo(db, 'order', 'RV-ORD-', 5),
      customer_id: customerId,
      lead_id: lead.id,
      occasion: body.occasion || lead.occasion || null,
      delivery_date: body.delivery_date || null,
      status: 'enquiry',
      owner_id: lead.owner_id || staff.id,
    }).select().single()
    if (error) return fail(error.message, 400)
    orderId = order.id
    await audit(db, staff, 'rv_orders', order.id, 'create', { from_lead: lead.id })
  }

  await db.from('rv_leads').update({ stage: 'converted', customer_id: customerId }).eq('id', lead.id)
  await db.from('rv_communications').update({ customer_id: customerId }).eq('lead_id', lead.id)
  await audit(db, staff, 'rv_leads', lead.id, 'convert', { customer_id: customerId, order_id: orderId })
  return NextResponse.json({ customer_id: customerId, order_id: orderId })
}
