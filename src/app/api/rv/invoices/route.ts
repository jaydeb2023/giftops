import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, getSetting } from '@/lib/rv/server'
import { computeInvoice, nextInvoiceNo, LineIn } from '@/lib/rv/finance'
import { round2 } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const g = await guard(['finance', 'sales'])
  if (!g.ok) return g.res
  const sp = req.nextUrl.searchParams
  let q = g.db.from('rv_invoices')
    .select('*, customer:rv_customers(id,name,company,gstin), order:rv_orders(id,order_no)', { count: 'exact' })
  for (const k of ['status', 'customer_id', 'order_id', 'doc_type']) { const v = sp.get(k); if (v) q = q.eq(k, v) }
  const term = (sp.get('q') || '').trim().replace(/[,()%]/g, ' ')
  if (term) q = q.ilike('invoice_no', `%${term}%`)
  if (sp.get('from')) q = q.gte('invoice_date', sp.get('from')!)
  if (sp.get('to')) q = q.lte('invoice_date', sp.get('to')!)
  const { data, error, count } = await q.order('created_at', { ascending: false }).limit(Math.min(Number(sp.get('limit') || 300), 1000))
  if (error) return fail(error.message, 500)
  return NextResponse.json({ data: data || [], count: count ?? 0 })
}

/**
 * Create an invoice.
 *  { order_id }                            -> lines built from the order items (discount spread pro-rata)
 *  { order_id, extra_lines: [...] }        -> plus e.g. delivery charges
 *  { customer_id, lines: [...] }           -> manual invoice
 * One live invoice per order unless allow_multiple (prevents accidental double invoicing).
 */
export async function POST(req: NextRequest) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))
  const company = await getSetting<any>(db, 'company', { state_code: '19', invoice_prefix: 'RV', default_gst_rate: 18 })

  let customerId: string | null = body.customer_id || null
  let orderId: string | null = body.order_id || null
  let lines: LineIn[] = []
  let pos: string | null = body.place_of_supply || null
  let customer: any = null

  if (orderId) {
    const { data: order } = await db.from('rv_orders').select('*, customer:rv_customers(*)').eq('id', orderId).maybeSingle()
    if (!order) return fail('Order not found', 404)
    customerId = order.customer_id
    customer = order.customer
    pos = pos || order.place_of_supply || order.customer?.state_code || company.state_code
    if (!body.allow_multiple) {
      const { count } = await db.from('rv_invoices').select('id', { count: 'exact', head: true })
        .eq('order_id', orderId).eq('doc_type', 'invoice').neq('status', 'cancelled')
      if ((count ?? 0) > 0) return fail('This order already has an invoice. Cancel it or issue a credit note instead (duplicate prevention).', 409, { code: 'DUPLICATE_INVOICE' })
    }
    if (body.use_order_items !== false) {
      const { data: items } = await db.from('rv_order_items').select('*').eq('order_id', orderId).order('created_at')
      const its = items || []
      const gross = its.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0)
      const discount = Number(order.discount || 0)
      const ratio = gross > 0 ? Math.max(gross - discount, 0) / gross : 1
      lines = its.map(i => ({
        description: i.name + (i.customization ? ` (${i.customization})` : ''),
        hsn: i.hsn, qty: Number(i.qty), rate: round2(Number(i.unit_price) * ratio), gst_rate: Number(i.gst_rate),
      }))
    }
  } else if (customerId) {
    const { data: c } = await db.from('rv_customers').select('*').eq('id', customerId).maybeSingle()
    customer = c
    pos = pos || c?.state_code || company.state_code
  }
  if (!customerId) return fail('customer_id or order_id is required')

  const extra: LineIn[] = (Array.isArray(body.extra_lines) ? body.extra_lines : Array.isArray(body.lines) ? body.lines : [])
    .filter((l: any) => l && String(l.description || '').trim() && Number(l.qty) > 0)
    .map((l: any) => ({ description: String(l.description).trim(), hsn: l.hsn || null, qty: Number(l.qty), rate: Number(l.rate || 0), gst_rate: Number(l.gst_rate ?? company.default_gst_rate ?? 18) }))
  lines = [...lines, ...extra]
  if (!lines.length) return fail('Add at least one line (the order has no items).')

  const sameState = String(pos || company.state_code) === String(company.state_code)
  const c = computeInvoice(lines, sameState)
  const invoiceDate = body.invoice_date || new Date().toISOString().slice(0, 10)
  const credit = Number(customer?.credit_days || 0)
  const due = body.due_date || new Date(new Date(invoiceDate).getTime() + credit * 864e5).toISOString().slice(0, 10)

  const invoiceNo = await nextInvoiceNo(db, company.invoice_prefix || 'RV', 'invoice', new Date(invoiceDate))
  const { data: inv, error } = await db.from('rv_invoices').insert({
    invoice_no: invoiceNo, doc_type: 'invoice', order_id: orderId, customer_id: customerId,
    invoice_date: invoiceDate, due_date: due, status: body.draft ? 'draft' : 'issued',
    place_of_supply: pos, taxable_value: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, total: c.total,
    notes: body.notes || null,
  }).select().single()
  if (error) return fail(error.message, 400)
  const { error: le } = await db.from('rv_invoice_lines').insert(c.lines.map(l => ({ ...l, invoice_id: inv.id })))
  if (le) { await db.from('rv_invoices').delete().eq('id', inv.id); return fail(le.message, 400) }
  await audit(db, staff, 'rv_invoices', inv.id, 'create', { invoice_no: invoiceNo, total: c.total, order_id: orderId })
  return NextResponse.json({ data: inv })
}
