import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, getSetting } from '@/lib/rv/server'
import { computeInvoice, nextInvoiceNo, recalcInvoice, LineIn } from '@/lib/rv/finance'

export const dynamic = 'force-dynamic'

/** Credit note against an invoice. { full: true } reverses every line; or pass { lines: [...] }. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))
  const company = await getSetting<any>(db, 'company', { state_code: '19' })

  const { data: inv } = await db.from('rv_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!inv || inv.doc_type !== 'invoice') return fail('Invoice not found', 404)
  if (inv.status === 'cancelled' || inv.status === 'draft') return fail('Cannot raise a credit note on this invoice.')

  let lines: LineIn[] = []
  if (body.full) {
    const { data: ls } = await db.from('rv_invoice_lines').select('*').eq('invoice_id', params.id)
    lines = (ls || []).map(l => ({ description: l.description, hsn: l.hsn, qty: Number(l.qty), rate: Number(l.rate), gst_rate: Number(l.gst_rate) }))
  } else {
    lines = (Array.isArray(body.lines) ? body.lines : [])
      .filter((l: any) => l && String(l.description || '').trim() && Number(l.qty) > 0 && Number(l.rate) > 0)
      .map((l: any) => ({ description: String(l.description).trim(), hsn: l.hsn || null, qty: Number(l.qty), rate: Number(l.rate), gst_rate: Number(l.gst_rate ?? 18) }))
  }
  if (!lines.length) return fail('Add at least one line for the credit note.')

  const sameState = String(inv.place_of_supply || company.state_code) === String(company.state_code)
  const c = computeInvoice(lines, sameState)

  // never credit more than the invoice value
  const { data: existing } = await db.from('rv_invoices').select('total').eq('ref_invoice_id', params.id).eq('doc_type', 'credit_note').neq('status', 'cancelled')
  const already = (existing || []).reduce((s, e) => s + Number(e.total), 0)
  if (already + c.total > Number(inv.total) + 0.01) return fail('Credit notes cannot exceed the invoice total.')

  const no = await nextInvoiceNo(db, 'CN', 'credit_note')
  const { data: cn, error } = await db.from('rv_invoices').insert({
    invoice_no: no, doc_type: 'credit_note', ref_invoice_id: inv.id, order_id: inv.order_id, customer_id: inv.customer_id,
    invoice_date: new Date().toISOString().slice(0, 10), status: 'issued', place_of_supply: inv.place_of_supply,
    taxable_value: c.taxable, cgst: c.cgst, sgst: c.sgst, igst: c.igst, total: c.total, notes: body.reason || null,
  }).select().single()
  if (error) return fail(error.message, 400)
  await db.from('rv_invoice_lines').insert(c.lines.map(l => ({ ...l, invoice_id: cn.id })))
  await recalcInvoice(db, inv.id)
  await audit(db, staff, 'rv_invoices', cn.id, 'credit_note', { against: inv.invoice_no, total: c.total, reason: body.reason })
  return NextResponse.json({ data: cn })
}
