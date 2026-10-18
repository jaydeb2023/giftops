import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, getSetting } from '@/lib/rv/server'
import { logComm, openTask } from '@/lib/rv/comms'
import { checkAddress, normMobile } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'

/**
 * Address-collection actions on one recipient.
 *  verify       { address_line, landmark?, pincode, name?, mobile? }  -> staff-confirmed, status "verified"
 *  log_attempt  { channel: call|whatsapp|ai_call, outcome, note? }    -> logs the attempt, moves along the chain
 *  set_status   { status }                                            -> manual move (human_call, exception, pending ...)
 *  clear_suggestion
 * An AI / WhatsApp captured address only ever lands in `suggested_address` or the
 * "ai_captured" state - it never overwrites a verified address.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['sales', 'ops'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const body = await req.json().catch(() => ({}))

  const { data: r } = await db.from('rv_recipients').select('*, order:rv_orders(id,customer_id)').eq('id', params.id).maybeSingle()
  if (!r) return fail('Not found', 404)
  const chase = await getSetting(db, 'address_chase', { max_attempts: 3 })

  switch (body.action) {
    case 'verify': {
      const merged = {
        name: body.name ?? r.name,
        mobile: body.mobile ?? r.mobile,
        address_line: body.address_line ?? r.address_line,
        landmark: body.landmark ?? r.landmark,
        pincode: body.pincode ?? r.pincode,
      }
      const chk = checkAddress(merged)
      if (!chk.ok) return fail(chk.problems.join('. '))
      const { data, error } = await db.from('rv_recipients').update({
        ...merged,
        mobile_norm: normMobile(merged.mobile) || null,
        address_status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: staff.id,
        suggested_address: null,
      }).eq('id', params.id).select().single()
      if (error) return fail(error.message, 400)
      await db.from('rv_tasks').update({ status: 'done', closed_at: new Date().toISOString(), closure_note: 'Address verified' })
        .eq('recipient_id', params.id).eq('kind', 'address').eq('status', 'open')
      await audit(db, staff, 'rv_recipients', params.id, 'address_verified', { from: { address_line: r.address_line, pincode: r.pincode }, to: merged })
      return NextResponse.json({ data })
    }

    case 'log_attempt': {
      const channel = ['call', 'whatsapp', 'ai_call'].includes(body.channel) ? body.channel : 'call'
      const outcome = String(body.outcome || 'no_answer')
      await logComm(db, {
        recipient_id: r.id, order_id: r.order_id, customer_id: r.order?.customer_id, channel,
        mobile: r.mobile, body: body.note || null, status: 'completed', outcome, owner_id: staff.id,
      })
      const attempts = (r.address_attempts || 0) + 1
      const patch: Record<string, any> = { address_attempts: attempts, last_attempt_at: new Date().toISOString() }
      if (r.address_status !== 'verified') {
        if (outcome === 'wrong_number' || outcome === 'refused') patch.address_status = 'exception'
        else if (channel === 'call' && attempts >= (chase.max_attempts || 3) + 2) patch.address_status = 'exception'
        else if (channel === 'call') patch.address_status = 'human_call'
      }
      const { data, error } = await db.from('rv_recipients').update(patch).eq('id', params.id).select().single()
      if (error) return fail(error.message, 400)
      if (patch.address_status === 'exception') {
        await openTask(db, { kind: 'exception', title: `Address not reachable: ${r.name} (${r.delivery_no})`, order_id: r.order_id, recipient_id: r.id })
      }
      return NextResponse.json({ data })
    }

    case 'set_status': {
      const allowed = ['pending', 'reminder_sent', 'ai_call', 'human_call', 'exception']
      if (!allowed.includes(body.status)) return fail('Invalid status')
      if (r.address_status === 'verified') return fail('Address is already verified. Edit the address to re-open it.')
      const { data, error } = await db.from('rv_recipients').update({ address_status: body.status }).eq('id', params.id).select().single()
      if (error) return fail(error.message, 400)
      if (body.status === 'human_call') {
        await openTask(db, { kind: 'address', title: `Call to confirm address: ${r.name} (${r.delivery_no})`, order_id: r.order_id, recipient_id: r.id })
      }
      await audit(db, staff, 'rv_recipients', params.id, 'address_status', { from: r.address_status, to: body.status })
      return NextResponse.json({ data })
    }

    case 'clear_suggestion': {
      await db.from('rv_recipients').update({ suggested_address: null }).eq('id', params.id)
      return NextResponse.json({ ok: true })
    }
    default:
      return fail('Unknown action')
  }
}
