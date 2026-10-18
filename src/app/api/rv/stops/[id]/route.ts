import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { openTask, logComm } from '@/lib/rv/comms'
import { recalcOrderStatus } from '@/lib/rv/orderStatus'
import { FAILED_REASONS } from '@/lib/rv/constants'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One delivery stop.
 *  pickup | transit | deliver (POD required) | fail (reason required) | return | reattempt
 * POD for "deliver": at least one of photo upload, OTP/reference, or received_by name.
 * Accepts JSON or multipart/form-data (photo).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await guard(['ops', 'rider'])
  if (!g.ok) return g.res
  const { db, staff } = g

  let body: Record<string, any> = {}
  let file: File | null = null
  const ct = req.headers.get('content-type') || ''
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    fd.forEach((v, k) => { if (v instanceof File) { if (k === 'photo') file = v } else body[k] = v })
  } else {
    body = await req.json().catch(() => ({}))
  }

  const { data: r } = await db.from('rv_recipients').select('*, run:rv_delivery_runs(id,rider_staff_id,status)').eq('id', params.id).maybeSingle()
  if (!r) return fail('Stop not found', 404)
  if (staff.role === 'rider' && r.run?.rider_staff_id !== staff.id) return fail('This stop is not on your run.', 403)

  const now = new Date().toISOString()
  const patch: Record<string, any> = {}
  const action = String(body.action || '')

  switch (action) {
    case 'pickup':
      if (r.delivery_status !== 'assigned') return fail('Only assigned stops can be picked up.')
      patch.delivery_status = 'picked_up'
      break
    case 'transit':
      if (!['assigned', 'picked_up'].includes(r.delivery_status)) return fail('This stop cannot be started.')
      patch.delivery_status = 'in_transit'
      break
    case 'deliver': {
      if (!['assigned', 'picked_up', 'in_transit', 'failed'].includes(r.delivery_status)) return fail('This stop cannot be marked delivered.')
      const receivedBy = String(body.received_by || '').trim()
      const podRef = String(body.pod_ref || '').trim()
      if (!file && !podRef && !receivedBy) return fail('Proof of delivery needed: add a photo, an OTP/reference, or the name of the person who received it.')
      let podPath: string | null = null
      if (file) {
        const f = file as File
        if (f.size > 8 * 1024 * 1024) return fail('Photo is too large (max 8 MB).')
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg'
        podPath = `${r.order_id}/${r.id}-${Date.now()}.${ext}`
        const buf = Buffer.from(await f.arrayBuffer())
        const { error: upErr } = await db.storage.from('rv-pod').upload(podPath, buf, { contentType: f.type || 'image/jpeg', upsert: true })
        if (upErr) return fail(`Photo upload failed: ${upErr.message}`, 500)
      }
      Object.assign(patch, {
        delivery_status: 'delivered', delivered_at: now, received_by: receivedBy || null,
        pod_type: file ? 'photo' : podRef ? 'reference' : 'name', pod_ref: podRef || null,
        failed_reason: null, attempt_count: (r.attempt_count || 0) + (r.delivery_status === 'failed' ? 0 : 1),
      })
      if (podPath) patch.pod_path = podPath
      break
    }
    case 'fail': {
      const reason = String(body.failed_reason || '')
      if (!(FAILED_REASONS as readonly string[]).includes(reason)) return fail('Choose a failure reason.')
      patch.delivery_status = 'failed'
      patch.failed_reason = reason + (body.note ? `: ${String(body.note).slice(0, 300)}` : '')
      patch.attempt_count = (r.attempt_count || 0) + 1
      if (body.reattempt_date) patch.reattempt_date = body.reattempt_date
      if (reason === 'incorrect_address' || reason === 'incomplete_address') {
        patch.address_status = 'human_call'   // send it back through address collection
      }
      break
    }
    case 'return':
      patch.delivery_status = 'returned'
      patch.run_id = r.run_id   // keep on the run for the record
      break
    case 'reattempt':
      // back into the pool so ops can put it on another run
      Object.assign(patch, { delivery_status: 'pending', run_id: null, stop_seq: null, failed_reason: null })
      if (body.reattempt_date) patch.reattempt_date = body.reattempt_date
      break
    default:
      return fail('Unknown action')
  }

  const { data, error } = await db.from('rv_recipients').update(patch).eq('id', params.id).select().single()
  if (error) return fail(error.message, 400)
  await audit(db, staff, 'rv_recipients', params.id, `delivery_${action}`, { from: r.delivery_status, to: patch.delivery_status, reason: patch.failed_reason })

  if (action === 'fail') {
    await openTask(db, {
      kind: 'exception',
      title: `Failed delivery: ${r.name} (${r.delivery_no}) - ${String(body.failed_reason).replace(/_/g, ' ')}`,
      order_id: r.order_id, recipient_id: r.id,
      due_at: body.reattempt_date ? new Date(body.reattempt_date).toISOString() : undefined,
    })
    await logComm(db, { recipient_id: r.id, order_id: r.order_id, channel: 'note', direction: 'out', body: `Delivery failed: ${patch.failed_reason}`, status: 'logged', owner_id: staff.id })
  }
  if (action === 'deliver') {
    await db.from('rv_tasks').update({ status: 'done', closed_at: now, closure_note: 'Delivered' })
      .eq('recipient_id', r.id).eq('kind', 'exception').eq('status', 'open')
  }
  await recalcOrderStatus(db, r.order_id, { force: true })
  return NextResponse.json({ data })
}
