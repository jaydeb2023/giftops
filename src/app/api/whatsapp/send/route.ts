import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'
import { sendText, toWaId, isInsideServiceWindow } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

/** POST — owner sends a manual message from the inbox. */
export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contact_id, to, body, pause_bot } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'মেসেজ খালি।' }, { status: 400 })

  const { data: account } = await db
    .from('whatsapp_accounts').select('*').eq('user_id', user.id).maybeSingle()
  if (!account) return NextResponse.json({ error: 'WhatsApp কানেক্ট করা নেই।' }, { status: 400 })

  // Resolve (or create) the contact
  let contact: any = null
  if (contact_id) {
    const { data } = await db.from('whatsapp_contacts')
      .select('*').eq('id', contact_id).eq('user_id', user.id).maybeSingle()
    contact = data
  } else if (to) {
    const waId = toWaId(to)
    if (!waId) return NextResponse.json({ error: 'নম্বরটি ঠিক নয়।' }, { status: 400 })
    const { data } = await db.from('whatsapp_contacts')
      .upsert({ user_id: user.id, account_id: account.id, wa_id: waId }, { onConflict: 'account_id,wa_id' })
      .select().single()
    contact = data
  }
  if (!contact) return NextResponse.json({ error: 'কাস্টমার পাওয়া যায়নি।' }, { status: 404 })

  // Meta rejects free-form text outside 24h of the last inbound message.
  if (!isInsideServiceWindow(contact.last_inbound_at)) {
    return NextResponse.json({
      error: '২৪ ঘণ্টার উইন্ডো শেষ — এই কাস্টমারকে এখন শুধু approved template পাঠানো যাবে।',
      code: 'WINDOW_CLOSED',
    }, { status: 409 })
  }

  const res = await sendText(account.phone_number_id, account.access_token, contact.wa_id, body)

  const { data: saved } = await db.from('whatsapp_messages').insert({
    user_id: user.id,
    account_id: account.id,
    contact_id: contact.id,
    wa_message_id: res.waMessageId ?? null,
    direction: 'outbound',
    msg_type: 'text',
    body,
    status: res.ok ? 'sent' : 'failed',
    error_message: res.error ?? null,
    ai_generated: false,
  }).select().single()

  const patch: any = {
    last_outbound_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    unread_count: 0,
  }
  // A human replying usually means the bot should stand down on this thread.
  if (pause_bot !== false) patch.is_bot_paused = true
  await db.from('whatsapp_contacts').update(patch).eq('id', contact.id)

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 })
  return NextResponse.json({ message: saved })
}
