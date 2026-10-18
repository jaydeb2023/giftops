import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { recalcInvoice } from '@/lib/rv/finance'
import { round2 } from '@/lib/rv/util'
import { PAYMENT_MODES } from '@/lib/rv/constants'

export const dynamic = 'force-dynamic'

/**
 * Record a receipt. { invoice_id?, customer_id?, order_id?, amount, received_on, mode, reference, notes, force? }
 * - against an invoice: cannot exceed the outstanding balance
 * - same reference + amount + mode already recorded -> 409 (duplicate prevention) unless force
 */
export async function POST(req: NextRequest) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))
  const amount = round2(Number(b.amount))
  if (!(amount > 0)) return fail('Enter a valid amount')
  const mode = (PAYMENT_MODES as readonly string[]).includes(b.mode) ? b.mode : 'upi'

  let customerId: string | null = b.customer_id || null
  let orderId: string | null = b.order_id || null
  if (b.invoice_id) {
    const { data: inv } = await db.from('rv_invoices').select('*').eq('id', b.invoice_id).maybeSingle()
    if (!inv || inv.doc_type !== 'invoice') return fail('Invoice not found', 404)
    if (['cancelled', 'draft'].includes(inv.status)) return fail('This invoice is not open for payment.')
    const { data: cns } = await db.from('rv_invoices').select('total').eq('ref_invoice_id', inv.id).eq('doc_type', 'credit_note').neq('status', 'cancelled')
    const credits = (cns || []).reduce((s, c) => s + Number(c.total), 0)
    const outstanding = round2(Number(inv.total) - credits - Number(inv.paid_amount))
    if (amount > outstanding + 0.005) return fail(`Amount exceeds the outstanding balance of Rs ${outstanding.toLocaleString('en-IN')}.`)
    customerId = inv.customer_id; orderId = inv.order_id
  }
  if (!customerId) return fail('Choose an invoice or a customer')

  const ref = String(b.reference || '').trim()
  if (ref && !b.force) {
    const { data: dup } = await db.from('rv_payments').select('id').eq('reference', ref).eq('amount', amount).eq('mode', mode).limit(1)
    if (dup && dup.length) return fail('A payment with the same reference, amount and mode is already recorded.', 409, { code: 'DUPLICATE_PAYMENT' })
  }

  const { data, error } = await db.from('rv_payments').insert({
    customer_id: customerId, invoice_id: b.invoice_id || null, order_id: orderId, amount, mode,
    received_on: b.received_on || new Date().toISOString().slice(0, 10), reference: ref || null, notes: b.notes || null, created_by: staff.id,
  }).select().single()
  if (error) return fail(error.message, 400)
  if (b.invoice_id) await recalcInvoice(db, b.invoice_id)
  await audit(db, staff, 'rv_payments', data.id, 'create', { amount, mode, reference: ref, invoice_id: b.invoice_id })
  return NextResponse.json({ data })
}
