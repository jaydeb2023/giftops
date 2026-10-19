import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseServer'
import { scopedDb } from '@/lib/rv/server'
import { logComm, openTask } from '@/lib/rv/comms'
import { checkAddress } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Result callback from the AI-calling provider. Header x-rv-secret must equal RV_AI_CALL_SECRET.
 * {
 *   recipient_id, call_id?, outcome: 'complete'|'incomplete'|'no_answer'|'refused'|'wrong_number'|'uncertain',
 *   address?: { line, landmark, pincode }, confidence?: 0..1, transcript_url?, duration_sec?, language?
 * }
 * Rules:
 *  - a VERIFIED address is never overwritten (the capture is stored as a suggestion only)
 *  - a complete, confident capture moves the recipient to "ai_captured" (staff confirm -> verified)
 *  - anything uncertain / incomplete / unanswered goes to the human-call queue with a task
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RV_AI_CALL_SECRET
  const got = req.headers.get('x-rv-secret') || ''
  if (!secret) return NextResponse.json({ error: 'RV_AI_CALL_SECRET is not set on the server.' }, { status: 503 })
  const a = Buffer.from(got), b = Buffer.from(secret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const p = await req.json().catch(() => ({}))
  if (!p.recipient_id) return NextResponse.json({ error: 'recipient_id required' }, { status: 400 })
  const raw = createAdminClient()
  const { data: rr } = await raw.from('rv_recipients').select('org_id').eq('id', p.recipient_id).maybeSingle()
  if (!rr) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  const db = scopedDb(rr.org_id, raw)
  const { data: r } = await db.from('rv_recipients').select('*, order:rv_orders(id,customer_id)').eq('id', p.recipient_id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  const outcome = String(p.outcome || 'incomplete')
  const confidence = Number(p.confidence ?? 0)
  const line = String(p.address?.line || '').trim()
  const landmark = String(p.address?.landmark || '').trim()
  const pincode = String(p.address?.pincode || '').trim()
  const chk = checkAddress({ name: r.name, address_line: line, pincode })
  const good = outcome === 'complete' && chk.ok && confidence >= 0.7

  await logComm(db, {
    recipient_id: r.id, order_id: r.order_id, customer_id: r.order?.customer_id, channel: 'ai_call', direction: 'out', mobile: r.mobile,
    body: line ? `${line}${landmark ? ', ' + landmark : ''} - ${pincode}` : null,
    status: 'completed', outcome: good ? 'address_captured' : outcome, provider_ref: p.call_id || null,
    meta: { confidence, transcript_url: p.transcript_url || null, duration_sec: p.duration_sec || null, language: p.language || null },
  })

  const patch: Record<string, any> = { address_attempts: (r.address_attempts || 0) + 1, last_attempt_at: new Date().toISOString() }
  const suggestion = line ? `${line}${landmark ? ', ' + landmark : ''}${pincode ? ' - ' + pincode : ''}` : null

  if (r.address_status === 'verified') {
    if (suggestion) patch.suggested_address = suggestion         // never overwrite verified
  } else if (good) {
    Object.assign(patch, { address_line: line, landmark: landmark || r.landmark, pincode, address_status: 'ai_captured', suggested_address: null })
    await openTask(db, { kind: 'address', title: `Confirm AI-captured address: ${r.name} (${r.delivery_no})`, order_id: r.order_id, recipient_id: r.id, due_at: new Date(Date.now() + 3 * 3600e3).toISOString() })
  } else {
    patch.address_status = outcome === 'wrong_number' || outcome === 'refused' ? 'exception' : 'human_call'
    if (suggestion) patch.suggested_address = suggestion
    await openTask(db, { kind: 'address', title: `Call to confirm address: ${r.name} (${r.delivery_no}) - AI call ${outcome}`, order_id: r.order_id, recipient_id: r.id })
  }
  await db.from('rv_recipients').update(patch).eq('id', r.id)
  await db.from('rv_audit').insert({ actor_email: 'ai-call-webhook', table_name: 'rv_recipients', record_id: r.id, action: 'ai_call_result', changes: { outcome, confidence, applied: patch.address_status } })
  return NextResponse.json({ ok: true, status: patch.address_status ?? r.address_status })
}
