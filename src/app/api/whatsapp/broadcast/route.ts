import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'
import { sendText, sendTemplate, isInsideServiceWindow } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST — send one message to many contacts.
 *
 * Contacts still inside the 24h window get free-form text. Everyone else
 * needs an approved template, so pass `template_name` if you want to reach
 * them too — otherwise they're skipped (and reported back as such).
 */
export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message_body, contact_ids, tag, template_name, template_lang, name } = await req.json()
  if (!message_body?.trim() && !template_name) {
    return NextResponse.json({ error: 'মেসেজ লিখুন।' }, { status: 400 })
  }

  const { data: account } = await db
    .from('whatsapp_accounts').select('*').eq('user_id', user.id).maybeSingle()
  if (!account) return NextResponse.json({ error: 'WhatsApp কানেক্ট করা নেই।' }, { status: 400 })

  let q = db.from('whatsapp_contacts')
    .select('id, wa_id, name, last_inbound_at').eq('user_id', user.id)
  if (Array.isArray(contact_ids) && contact_ids.length) q = q.in('id', contact_ids)
  else if (tag) q = q.contains('tags', [tag])

  const { data: contacts } = await q.limit(500)
  if (!contacts?.length) return NextResponse.json({ error: 'কোনো কাস্টমার পাওয়া যায়নি।' }, { status: 400 })

  const { data: broadcast } = await db.from('whatsapp_broadcasts').insert({
    user_id: user.id,
    name: name || null,
    message_body: message_body || `[template: ${template_name}]`,
    recipients: contacts.length,
    status: 'running',
  }).select().single()

  let sent = 0, failed = 0, skipped = 0
  const rows: any[] = []

  for (const c of contacts) {
    const inWindow = isInsideServiceWindow(c.last_inbound_at)

    if (!inWindow && !template_name) { skipped++; continue }

    const res = inWindow
      ? await sendText(account.phone_number_id, account.access_token, c.wa_id, message_body)
      : await sendTemplate(
          account.phone_number_id, account.access_token, c.wa_id,
          template_name, template_lang || 'bn', [c.name || 'কাস্টমার']
        )

    res.ok ? sent++ : failed++

    rows.push({
      user_id: user.id,
      account_id: account.id,
      contact_id: c.id,
      wa_message_id: res.waMessageId ?? null,
      direction: 'outbound',
      msg_type: inWindow ? 'text' : 'template',
      body: message_body || `[template: ${template_name}]`,
      status: res.ok ? 'sent' : 'failed',
      error_message: res.error ?? null,
    })

    // Meta throttles hard on bursts — a small gap keeps quality rating healthy.
    await new Promise(r => setTimeout(r, 120))
  }

  if (rows.length) await db.from('whatsapp_messages').insert(rows)

  if (broadcast) {
    await db.from('whatsapp_broadcasts')
      .update({ sent, failed, status: 'done' }).eq('id', broadcast.id)
  }

  return NextResponse.json({ sent, failed, skipped, total: contacts.length })
}
