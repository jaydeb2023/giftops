import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseServer'
import { logComm, openTask } from '@/lib/rv/comms'
import { nextNo } from '@/lib/rv/server'
import { normMobile } from '@/lib/rv/util'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Meta handshake
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') && p.get('hub.verify_token') === process.env.RV_WA_VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

const STOP_WORDS = ['stop', 'unsubscribe', 'opt out', 'optout', 'cancel messages']
const LIVE = ['confirmed', 'procurement', 'packing', 'ready_dispatch', 'part_delivered', 'exception']

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const secret = process.env.RV_WA_APP_SECRET
  if (secret) {
    const sig = req.headers.get('x-hub-signature-256') || ''
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new NextResponse('Forbidden', { status: 403 })
  }
  try {
    const body = JSON.parse(raw)
    for (const entry of body.entry || []) for (const ch of entry.changes || []) await handle(ch.value)
  } catch (e) {
    console.error('[rv wa webhook]', e)
  }
  return NextResponse.json({ received: true })   // always 200 so Meta does not retry/disable
}

async function handle(value: any) {
  if (!value) return
  const db = createAdminClient()

  // delivery / read / failed receipts
  for (const st of value.statuses || []) {
    const failed = st.status === 'failed'
    await db.from('rv_communications').update({
      status: st.status,
      ...(failed ? { outcome: st.errors?.[0]?.title || 'failed' } : {}),
    }).eq('provider_ref', st.id)
  }

  for (const msg of value.messages || []) {
    const mobile = normMobile(msg.from)
    if (!mobile) continue
    const profileName = value.contacts?.find((c: any) => c.wa_id === msg.from)?.profile?.name || null
    const text: string = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || `[${msg.type}]`
    const optOut = STOP_WORDS.some(w => text.toLowerCase().trim() === w)

    // 1) is this a delivery recipient we are chasing for an address?
    const { data: recs } = await db.from('rv_recipients')
      .select('id,order_id,name,address_status,order:rv_orders!inner(id,status,customer_id)')
      .eq('mobile_norm', mobile).in('order.status', LIVE).neq('delivery_status', 'cancelled')
      .in('address_status', ['pending', 'reminder_sent', 'ai_call', 'human_call', 'replied'])
    if (recs && recs.length) {
      for (const r of recs as any[]) {
        await logComm(db, { recipient_id: r.id, order_id: r.order_id, customer_id: r.order?.customer_id, channel: 'whatsapp', direction: 'in', mobile, body: text, status: 'received', provider_ref: msg.id, outcome: optOut ? 'opt_out' : 'address_reply' })
        if (optOut) {
          await db.from('rv_recipients').update({ address_status: 'human_call' }).eq('id', r.id)
          await openTask(db, { kind: 'address', title: `Recipient opted out of WhatsApp - call to confirm address: ${r.name}`, order_id: r.order_id, recipient_id: r.id })
        } else {
          // reply is only a SUGGESTION until staff verify it - it never overwrites an address
          await db.from('rv_recipients').update({ suggested_address: text, address_status: 'replied', last_attempt_at: new Date().toISOString() }).eq('id', r.id)
          await openTask(db, { kind: 'address', title: `Confirm address reply from ${r.name}`, order_id: r.order_id, recipient_id: r.id, due_at: new Date(Date.now() + 2 * 3600e3).toISOString() })
        }
      }
      continue
    }

    // 2) customer?
    const { data: cust } = await db.from('rv_customers').select('id').eq('mobile_norm', mobile).maybeSingle()
    // 3) lead? (else create one from the WhatsApp contact)
    let { data: lead } = await db.from('rv_leads').select('id,customer_id').eq('mobile_norm', mobile).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!lead && !cust) {
      const { data: created } = await db.from('rv_leads').insert({
        lead_no: await nextNo(db, 'lead', 'RV-L-', 5),
        name: profileName || `WhatsApp ${mobile}`, mobile: mobile, mobile_norm: mobile, source: 'whatsapp', stage: 'new',
        notes: 'Created automatically from an incoming WhatsApp message.',
        next_followup_at: new Date().toISOString(),
      }).select('id,customer_id').single()
      lead = created
    }
    if (optOut) {
      await db.from('rv_leads').update({ opt_out: true }).eq('mobile_norm', mobile)
      await db.from('rv_customers').update({ opt_out: true }).eq('mobile_norm', mobile)
    }
    await logComm(db, { lead_id: lead?.id ?? null, customer_id: cust?.id ?? lead?.customer_id ?? null, channel: 'whatsapp', direction: 'in', mobile, body: text, status: 'received', provider_ref: msg.id, outcome: optOut ? 'opt_out' : null })
  }
}
