import type { Db } from './server'
import { round2, splitGst, financialYear } from './util'

export interface LineIn { description: string; hsn?: string | null; qty: number; rate: number; gst_rate: number }

export interface Computed {
  lines: { description: string; hsn: string | null; qty: number; rate: number; gst_rate: number; amount: number }[]
  taxable: number; cgst: number; sgst: number; igst: number; total: number
}

/** Line amounts are taxable values; GST is split CGST+SGST (same state) or IGST (inter-state), rounded per line. */
export function computeInvoice(lines: LineIn[], sameState: boolean): Computed {
  let taxable = 0, cgst = 0, sgst = 0, igst = 0
  const out = lines.map(l => {
    const amount = round2(Number(l.qty) * Number(l.rate))
    const s = splitGst(amount, Number(l.gst_rate), sameState)
    taxable += amount; cgst += s.cgst; sgst += s.sgst; igst += s.igst
    return { description: l.description, hsn: l.hsn || null, qty: Number(l.qty), rate: Number(l.rate), gst_rate: Number(l.gst_rate), amount }
  })
  taxable = round2(taxable); cgst = round2(cgst); sgst = round2(sgst); igst = round2(igst)
  return { lines: out, taxable, cgst, sgst, igst, total: round2(taxable + cgst + sgst + igst) }
}

/** Re-derive paid_amount + status of an invoice from its payments and credit notes. */
export async function recalcInvoice(db: Db, invoiceId: string) {
  const { data: inv } = await db.from('rv_invoices').select('id,doc_type,total,status').eq('id', invoiceId).maybeSingle()
  if (!inv || inv.doc_type !== 'invoice' || inv.status === 'draft') return null
  const [{ data: pays }, { data: cns }] = await Promise.all([
    db.from('rv_payments').select('amount').eq('invoice_id', invoiceId),
    db.from('rv_invoices').select('total,status').eq('ref_invoice_id', invoiceId).eq('doc_type', 'credit_note').neq('status', 'cancelled'),
  ])
  const paid = round2((pays || []).reduce((s, p) => s + Number(p.amount), 0))
  const credits = round2((cns || []).reduce((s, c) => s + Number(c.total), 0))
  const net = round2(Number(inv.total) - credits)
  let status: string
  if (net <= 0.005) status = paid > 0 ? 'paid' : 'cancelled'
  else if (paid >= net - 0.005) status = 'paid'
  else if (paid > 0) status = 'part_paid'
  else status = 'issued'
  await db.from('rv_invoices').update({ paid_amount: paid, status }).eq('id', invoiceId)
  return { paid, credits, net, status, outstanding: round2(Math.max(net - paid, 0)) }
}

export async function recalcBill(db: Db, billId: string) {
  const { data: bill } = await db.from('rv_bills').select('id,amount,status').eq('id', billId).maybeSingle()
  if (!bill || bill.status === 'cancelled') return
  const { data: pays } = await db.from('rv_bill_payments').select('amount').eq('bill_id', billId)
  const paid = round2((pays || []).reduce((s, p) => s + Number(p.amount), 0))
  const status = paid >= Number(bill.amount) - 0.005 ? 'paid' : paid > 0 ? 'part_paid' : 'unpaid'
  await db.from('rv_bills').update({ paid_amount: paid, status }).eq('id', billId)
}

export async function nextInvoiceNo(db: Db, prefix: string, kind: 'invoice' | 'credit_note', date = new Date()) {
  const fy = financialYear(date)
  const { data, error } = await db.rpc('rv_next_number', { p_name: `${kind}-${fy}` })
  if (error) throw new Error(error.message)
  const tag = kind === 'invoice' ? prefix : 'CN'
  return `${tag}/${fy}/${String(data).padStart(4, '0')}`
}
