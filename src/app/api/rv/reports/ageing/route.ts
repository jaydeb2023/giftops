import { NextResponse } from 'next/server'
import { guard } from '@/lib/rv/server'
import { round2 } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

const BUCKETS = ['not_due', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'] as const
type Bucket = typeof BUCKETS[number]
function bucketOf(due: string | null, today: Date): Bucket {
  if (!due) return 'not_due'
  const days = Math.floor((today.getTime() - new Date(due).getTime()) / 864e5)
  if (days <= 0) return 'not_due'
  if (days <= 30) return 'd1_30'
  if (days <= 60) return 'd31_60'
  if (days <= 90) return 'd61_90'
  return 'd90_plus'
}
const empty = () => ({ not_due: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0 })

/** Receivables (customers) and payables (vendors/couriers) ageing by due date. */
export async function GET() {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db } = g
  const today = new Date()

  const { data: invs } = await db.from('rv_invoices')
    .select('id,invoice_no,invoice_date,due_date,total,paid_amount,customer:rv_customers(id,name,company)')
    .eq('doc_type', 'invoice').in('status', ['issued', 'part_paid'])
  const { data: cns } = await db.from('rv_invoices').select('ref_invoice_id,total').eq('doc_type', 'credit_note').neq('status', 'cancelled')
  const credit: Record<string, number> = {}
  ;(cns || []).forEach(c => { if (c.ref_invoice_id) credit[c.ref_invoice_id] = (credit[c.ref_invoice_id] || 0) + Number(c.total) })

  const recTotals = empty()
  const byCustomer: Record<string, any> = {}
  const receivables = (invs || []).map((i: any) => {
    const out = round2(Number(i.total) - Number(i.paid_amount) - (credit[i.id] || 0))
    const b = bucketOf(i.due_date, today)
    const name = i.customer?.company || i.customer?.name || '-'
    return { id: i.id, invoice_no: i.invoice_no, customer: name, invoice_date: i.invoice_date, due_date: i.due_date, total: Number(i.total), outstanding: out, bucket: b }
  }).filter(r => r.outstanding > 0.005)
  receivables.forEach(r => {
    recTotals[r.bucket] += r.outstanding; recTotals.total += r.outstanding
    byCustomer[r.customer] = byCustomer[r.customer] || { name: r.customer, ...empty() }
    byCustomer[r.customer][r.bucket] += r.outstanding; byCustomer[r.customer].total += r.outstanding
  })

  const { data: bills } = await db.from('rv_bills')
    .select('id,bill_no,bill_type,bill_date,due_date,amount,paid_amount,party_name,vendor:rv_vendors(name)').in('status', ['unpaid', 'part_paid'])
  const payTotals = empty()
  const byParty: Record<string, any> = {}
  const payables = (bills || []).map((b: any) => {
    const out = round2(Number(b.amount) - Number(b.paid_amount))
    const bucket = bucketOf(b.due_date, today)
    return { id: b.id, bill_no: b.bill_no, bill_type: b.bill_type, party: b.vendor?.name || b.party_name || '-', bill_date: b.bill_date, due_date: b.due_date, amount: Number(b.amount), outstanding: out, bucket }
  }).filter(r => r.outstanding > 0.005)
  payables.forEach(r => {
    payTotals[r.bucket] += r.outstanding; payTotals.total += r.outstanding
    byParty[r.party] = byParty[r.party] || { name: r.party, ...empty() }
    byParty[r.party][r.bucket] += r.outstanding; byParty[r.party].total += r.outstanding
  })
  const rnd = (o: any) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? round2(v) : v]))
  return NextResponse.json({
    receivables: { rows: receivables, totals: rnd(recTotals), by_customer: Object.values(byCustomer).map(rnd) },
    payables: { rows: payables, totals: rnd(payTotals), by_party: Object.values(byParty).map(rnd) },
  })
}
