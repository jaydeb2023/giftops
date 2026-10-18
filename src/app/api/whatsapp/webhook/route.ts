import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseServer'
import { sendText, markAsRead, getMediaUrl } from '@/lib/whatsapp'
import { searchKnowledge, buildSystemPrompt, generateReply, isBusinessHours } from '@/lib/whatsappAI'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * ONE webhook serves every user on the platform. Meta posts here with a
 * `metadata.phone_number_id`; we look up which of our users owns that number.
 */

// ── GET: Meta's subscription handshake ──────────────────────
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  if (
    p.get('hub.mode') === 'subscribe' &&
    p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new NextResponse(p.get('hub.challenge') || '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST: events ────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const raw = await req.text()

  // Verify X-Hub-Signature-256 so nobody can spoof messages into your DB.
  const secret = process.env.WHATSAPP_APP_SECRET
  if (secret) {
    const sig = req.headers.get('x-hub-signature-256') || ''
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn('[wa-webhook] bad signature')
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // Always 200 fast — Meta retries aggressively and disables webhooks that
  // time out. Work happens before we return, but errors never bubble up.
  try {
    const body = JSON.parse(raw)
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        await handleChange(change.value)
      }
    }
  } catch (e) {
    console.error('[wa-webhook] error', e)
  }

  return NextResponse.json({ received: true })
}

async function handleChange(value: any) {
  if (!value) return
  const phoneNumberId = value?.metadata?.phone_number_id
  if (!phoneNumberId) return

  const db = createAdminClient()

  const { data: account } = await db
    .from('whatsapp_accounts')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle()

  if (!account) {
    console.warn('[wa-webhook] unknown phone_number_id', phoneNumberId)
    return
  }

  // ── Delivery / read receipts ──────────────────────────────
  for (const st of value.statuses || []) {
    await db
      .from('whatsapp_messages')
      .update({
        status: st.status,
        error_message: st.errors?.[0]?.title ?? null,
      })
      .eq('wa_message_id', st.id)
  }

  // ── Inbound messages ──────────────────────────────────────
  for (const msg of value.messages || []) {
    await handleInbound(db, account, value, msg)
  }
}

async function handleInbound(db: any, account: any, value: any, msg: any) {
  const waId: string = msg.from
  const profileName: string | undefined = value?.contacts?.[0]?.profile?.name
  const receivedAt = new Date()

  // 1. Upsert contact
  const upsertPayload: Record<string, any> = {
    user_id: account.user_id,
    account_id: account.id,
    wa_id: waId,
    last_message_at: receivedAt.toISOString(),
    last_inbound_at: receivedAt.toISOString(),
  }
  // Only write `name` when Meta actually sent one — otherwise an upsert
  // would wipe a name the owner typed in manually.
  if (profileName) upsertPayload.name = profileName

  const { data: contact } = await db
    .from('whatsapp_contacts')
    .upsert(upsertPayload, { onConflict: 'account_id,wa_id' })
    .select()
    .single()

  if (!contact) return

  const isFirstEver = !contact.last_outbound_at && (contact.unread_count ?? 0) === 0

  await db
    .from('whatsapp_contacts')
    .update({ unread_count: (contact.unread_count ?? 0) + 1 })
    .eq('id', contact.id)

  // 2. Extract the text body across message types
  let body = ''
  let mediaUrl: string | null = null
  const type = msg.type as string

  if (type === 'text') body = msg.text?.body ?? ''
  else if (type === 'interactive')
    body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ''
  else if (type === 'button') body = msg.button?.text ?? ''
  else if (['image', 'document', 'audio', 'video', 'sticker'].includes(type)) {
    body = msg[type]?.caption || `[${type}]`
    const mediaId = msg[type]?.id
    if (mediaId) mediaUrl = await getMediaUrl(mediaId, account.access_token)
  } else body = `[${type}]`

  // 3. Store it
  await db.from('whatsapp_messages').insert({
    user_id: account.user_id,
    account_id: account.id,
    contact_id: contact.id,
    wa_message_id: msg.id,
    direction: 'inbound',
    msg_type: type,
    body,
    media_url: mediaUrl,
    status: 'received',
  })

  await markAsRead(account.phone_number_id, account.access_token, msg.id)

  // 4. Should we reply automatically?
  if (!account.auto_reply || contact.is_bot_paused) return

  // Explicit "get me a human" keywords pause the bot for this contact.
  const handoffWords: string[] = account.handoff_keywords || []
  const lower = body.toLowerCase()
  if (handoffWords.some(w => w && lower.includes(String(w).toLowerCase()))) {
    await db.from('whatsapp_contacts').update({ is_bot_paused: true }).eq('id', contact.id)
    await reply(db, account, contact, 'ঠিক আছে 🙏 আমি মালিককে জানিয়ে দিচ্ছি, উনি শীঘ্রই আপনাকে মেসেজ করবেন।', receivedAt, false)
    return
  }

  // Outside business hours → away message, nothing else.
  if (!isBusinessHours(account.business_hours_start, account.business_hours_end)) {
    if (account.away_message) {
      await reply(db, account, contact, account.away_message, receivedAt, false)
    }
    return
  }

  // 5. Keyword automations win over the AI — they're deterministic.
  const { data: rules } = await db
    .from('whatsapp_automations')
    .select('*')
    .eq('user_id', account.user_id)
    .eq('is_active', true)

  const keywordRule = (rules || []).find(
    (r: any) =>
      r.trigger_type === 'keyword' &&
      r.action_type === 'send_message' &&
      String(r.trigger_value || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean)
        .some(k => lower.includes(k))
  )

  if (keywordRule?.message_body) {
    await reply(db, account, contact, keywordRule.message_body, receivedAt, false, keywordRule.id)
    await db
      .from('whatsapp_automations')
      .update({ run_count: (keywordRule.run_count ?? 0) + 1, last_run_at: new Date().toISOString() })
      .eq('id', keywordRule.id)
    return
  }

  // 6. First-ever message → greeting, then still let AI answer the question.
  if (isFirstEver) {
    const greetRule = (rules || []).find((r: any) => r.trigger_type === 'first_message')
    const greeting = greetRule?.message_body || account.greeting_message
    if (greeting) await reply(db, account, contact, greeting, receivedAt, false, greetRule?.id)
  }

  // 7. AI reply from the knowledge base
  if (!body || body.startsWith('[')) return // media with no caption — nothing to answer

  const kb = await searchKnowledge(db, account.user_id, body)

  const { data: recent } = await db
    .from('whatsapp_messages')
    .select('direction, body')
    .eq('contact_id', contact.id)
    .order('created_at', { ascending: false })
    .limit(9)

  const history = (recent || [])
    .slice(1) // drop the message we just stored
    .reverse()
    .map((m: any) => ({
      role: m.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: m.body || '',
    }))
    .filter((m: any) => m.content)

  const systemPrompt = buildSystemPrompt({
    businessName: account.verified_name,
    tone: account.ai_tone,
    language: account.language,
    knowledge: kb,
  })

  const ai = await generateReply({
    question: body,
    systemPrompt,
    history,
    kbIds: kb.map(k => k.id),
  })

  if (!ai?.text) return

  await reply(db, account, contact, ai.text, receivedAt, true, null, ai.kbUsed)

  // Count knowledge hits so the dashboard can show "top questions"
  for (const id of ai.kbUsed) {
    const { data: row } = await db
      .from('whatsapp_knowledge').select('hit_count').eq('id', id).maybeSingle()
    if (row) {
      await db.from('whatsapp_knowledge')
        .update({ hit_count: (row.hit_count ?? 0) + 1 }).eq('id', id)
    }
  }

  // The model asked for a human — pause the bot and queue a follow-up.
  if (ai.handoff) {
    await db.from('whatsapp_contacts').update({ is_bot_paused: true }).eq('id', contact.id)
    await db.from('whatsapp_followups').insert({
      user_id: account.user_id,
      contact_id: contact.id,
      reason: 'AI could not answer — needs owner',
      message_body: `⚠️ ${contact.name || waId} একটি প্রশ্ন করেছেন যার উত্তর Knowledge Base-এ নেই:\n\n"${body}"`,
      due_at: new Date().toISOString(),
      status: 'pending',
    })
  }
}

/** Send + persist an outbound message, recording how fast we answered. */
async function reply(
  db: any,
  account: any,
  contact: any,
  text: string,
  inboundAt: Date,
  aiGenerated: boolean,
  automationId: string | null = null,
  kbUsed: string[] = []
) {
  const res = await sendText(account.phone_number_id, account.access_token, contact.wa_id, text)

  await db.from('whatsapp_messages').insert({
    user_id: account.user_id,
    account_id: account.id,
    contact_id: contact.id,
    wa_message_id: res.waMessageId ?? null,
    direction: 'outbound',
    msg_type: 'text',
    body: text,
    status: res.ok ? 'sent' : 'failed',
    error_message: res.error ?? null,
    ai_generated: aiGenerated,
    automation_id: automationId,
    response_ms: Date.now() - inboundAt.getTime(),
    kb_used: kbUsed.length ? kbUsed : null,
  })

  await db
    .from('whatsapp_contacts')
    .update({ last_outbound_at: new Date().toISOString(), last_message_at: new Date().toISOString() })
    .eq('id', contact.id)

  if (!res.ok) {
    await db
      .from('whatsapp_accounts')
      .update({ last_error: res.error, status: 'error' })
      .eq('id', account.id)
  }
}
