import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, getSetting } from '@/lib/rv/server'
import { recalcInvoice } from '@/lib/rv/finance'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance', 'sales'])
  if (!g.ok) return g.res
  const { db } = g
  const { data: invoice } = await db.from('rv_invoices')
    .select('*, customer:rv_customers(*), order:rv_orders(id,order_no,occasion,delivery_date)').eq('id', params.id).maybeSingle()
  if (!invoice) return fail('Invoice not found', 404)
  const [lines, payments, credits, company] = await Promise.all([
    db.from('rv_invoice_lines').select('*').eq('invoice_id', params.id).order('id'),
    db.from('rv_payments').select('*').eq('invoice_id', params.id).order('received_on'),
    db.from('rv_invoices').select('id,invoice_no,total,invoice_date,status').eq('ref_invoice_id', params.id).eq('doc_type', 'credit_note'),
    getSetting<any>(db, 'company', {}),
  ])
  const paid = (payments.data || []).reduce((s, p) => s + Number(p.amount), 0)
  const cr = (credits.data || []).filter(c => c.status !== 'cancelled').reduce((s, c) => s + Number(c.total), 0)
  return NextResponse.json({
    invoice, lines: lines.data || [], payments: payments.data || [], credit_notes: credits.data || [], company: company,
    outstanding: Math.max(Number(invoice.total) - cr - paid, 0),
  })
}

/** PATCH { due_date?, notes?, status: 'cancelled'|'issued' } */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))
  const { data: inv } = await db.from('rv_invoices').select('*').eq('id', params.id).maybeSingle()
  if (!inv) return fail('Invoice not found', 404)

  const patch: Record<string, any> = {}
  if (body.due_date !== undefined) patch.due_date = body.due_date || null
  if (body.notes !== undefined) patch.notes = body.notes || null
  if (body.status === 'cancelled') {
    const { count } = await db.from('rv_payments').select('id', { count: 'exact', head: true }).eq('invoice_id', params.id)
    if ((count ?? 0) > 0) return fail('This invoice has payments. Issue a credit note instead of cancelling.')
    patch.status = 'cancelled'
  }
  if (body.status === 'issued' && inv.status === 'draft') patch.status = 'issued'
  if (!Object.keys(patch).length) return fail('Nothing to update')
  const { data, error } = await db.from('rv_invoices').update(patch).eq('id', params.id).select().single()
  if (error) return fail(error.message, 400)
  await audit(db, staff, 'rv_invoices', params.id, 'update', patch)
  if (inv.doc_type === 'invoice' && !patch.status) await recalcInvoice(db, params.id)
  return NextResponse.json({ data })
}
