import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { recalcInvoice } from '@/lib/rv/finance'

export const dynamic = 'force-dynamic'

/** Reverse a wrongly recorded receipt (admin/finance). Invoice balance is recalculated. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['finance'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const { data: p } = await db.from('rv_payments').select('*').eq('id', params.id).maybeSingle()
  if (!p) return fail('Payment not found', 404)
  const { error } = await db.from('rv_payments').delete().eq('id', params.id)
  if (error) return fail(error.message, 400)
  if (p.invoice_id) await recalcInvoice(db, p.invoice_id)
  await audit(db, staff, 'rv_payments', params.id, 'delete', p)
  return NextResponse.json({ ok: true })
}
