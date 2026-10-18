import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'
import { sendWhatsApp } from '@/lib/rv/wa'

export const dynamic = 'force-dynamic'

/**
 * Send a WhatsApp message from the CRM and log it on the right record.
 * { lead_id | customer_id | recipient_id | to, text? , template?, params?[], language? }
 * Opt-out is always honoured. Free text only inside the 24-hour window; otherwise a template.
 */
export async function POST(req: NextRequest) {
  const g = await guard(['sales', 'ops'])
  if (!g.ok) return g.res
  const { db, staff } = g
  const b = await req.json().catch(() => ({}))

  let to: string | null = b.to || null
  const link: any = { owner_id: staff.id, lead_id: b.lead_id || null, customer_id: b.customer_id || null, order_id: b.order_id || null, recipient_id: b.recipient_id || null }

  if (b.lead_id) {
    const { data: l } = await db.from('rv_leads').select('mobile,opt_out,consent_whatsapp,customer_id').eq('id', b.lead_id).maybeSingle()
    if (!l) return fail('Lead not found', 404)
    if (l.opt_out || l.consent_whatsapp === false) return fail('This contact has opted out of WhatsApp messages.', 403, { code: 'OPT_OUT' })
    to = to || l.mobile; link.customer_id = link.customer_id || l.customer_id
  }
  if (b.customer_id) {
    const { data: c } = await db.from('rv_customers').select('mobile,opt_out,consent_whatsapp').eq('id', b.customer_id).maybeSingle()
    if (!c) return fail('Customer not found', 404)
    if (c.opt_out || c.consent_whatsapp === false) return fail('This contact has opted out of WhatsApp messages.', 403, { code: 'OPT_OUT' })
    to = to || c.mobile
  }
  if (b.recipient_id) {
    const { data: r } = await db.from('rv_recipients').select('mobile,order_id').eq('id', b.recipient_id).maybeSingle()
    if (!r) return fail('Recipient not found', 404)
    to = to || r.mobile; link.order_id = link.order_id || r.order_id
  }
  if (!to) return fail('No mobile number to send to.')
  if (!b.text && !b.template) return fail('Type a message or choose a template.')

  const res = await sendWhatsApp(db, { to, text: b.text, template: b.template, language: b.language, params: b.params, link })
  if (!res.ok) return fail(res.error || 'Send failed', res.code === 'WINDOW_CLOSED' ? 409 : res.code === 'NOT_CONFIGURED' ? 503 : 502, { code: res.code })
  return NextResponse.json({ ok: true })
}
