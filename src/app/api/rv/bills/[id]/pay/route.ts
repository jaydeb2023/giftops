import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { recalcBill } from '@/lib/rv/finance'
import { round2 } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))
  const amount = round2(Number(b.amount))
  if (!(amount > 0)) return fail('Enter a valid amount')
  const { data: bill } = await db.from('rv_bills').select('*').eq('id', params.id).maybeSingle()
  if (!bill) return fail('Bill not found', 404)
  if (bill.status === 'cancelled') return fail('This bill is cancelled.')
  const due = round2(Number(bill.amount) - Number(bill.paid_amount))
  if (amount > due + 0.005) return fail(`Amount exceeds the balance of Rs ${due.toLocaleString('en-IN')}.`)
  const { error } = await db.from('rv_bill_payments').insert({
    bill_id: params.id, amount, paid_on: b.paid_on || new Date().toISOString().slice(0, 10), mode: b.mode || 'bank', reference: b.reference || null,
  })
  if (error) return fail(error.message, 400)
  await recalcBill(db, params.id)
  await audit(db, staff, 'rv_bills', params.id, 'payment', { amount, reference: b.reference })
  return NextResponse.json({ ok: true })
}
