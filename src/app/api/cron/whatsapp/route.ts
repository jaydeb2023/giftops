import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseServer'
import { sendText, isInsideServiceWindow } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runs every 15 minutes (see vercel.json).
 *
 * 1. Flushes the due follow-up queue.
 * 2. Generates new follow-ups from `no_reply` and `due_payment` automations.
 *
 * Protected by CRON_SECRET — Vercel Cron sends it as a Bearer token.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createAdminClient()
  const nowIso = new Date().toISOString()

  // ── 1. Send due follow-ups ────────────────────────────────
  const { data: due } = await db
    .from('whatsapp_followups')
    .select('id, user_id, contact_id, message_body')
    .eq('status', 'pending')
    .lte('due_at', nowIso)
    .limit(100)

  let sent = 0, failed = 0

  for (const f of due || []) {
    if (!f.contact_id) continue

    const { data: contact } = await db
      .from('whatsapp_contacts')
      .select('id, wa_id, last_inbound_at, account_id')
      .eq('id', f.contact_id).maybeSingle()
    if (!contact) continue

    const { data: account } = await db
      .from('whatsapp_accounts').select('*').eq('id', contact.account_id).maybeSingle()
    if (!account || account.status !== 'connected') continue

    if (!isInsideServiceWindow(contact.last_inbound_at)) {
      await db.from('whatsapp_followups').update({
        status: 'failed',
        error_message: '24h window বন্ধ — template ছাড়া পাঠানো যায় না',
      }).eq('id', f.id)
      failed++
      continue
    }

    const res = await sendText(account.phone_number_id, account.access_token, contact.wa_id, f.message_body)

    await db.from('whatsapp_messages').insert({
      user_id: f.user_id,
      account_id: account.id,
      contact_id: contact.id,
      wa_message_id: res.waMessageId ?? null,
      direction: 'outbound',
      msg_type: 'text',
      body: f.message_body,
      status: res.ok ? 'sent' : 'failed',
      error_message: res.error ?? null,
      ai_generated: false,
    })

    await db.from('whatsapp_followups').update({
      status: res.ok ? 'sent' : 'failed',
      sent_at: res.ok ? new Date().toISOString() : null,
      error_message: res.error ?? null,
    }).eq('id', f.id)

    res.ok ? sent++ : failed++
    await new Promise(r => setTimeout(r, 120))
  }

  // ── 2. Queue new follow-ups from active rules ─────────────
  const { data: rules } = await db
    .from('whatsapp_automations')
    .select('*')
    .eq('is_active', true)
    .in('trigger_type', ['no_reply', 'due_payment'])

  let queued = 0

  for (const rule of rules || []) {
    if (rule.trigger_type === 'no_reply') {
      const hours = Number(rule.trigger_value) || 24
      const cutoff = new Date(Date.now() - hours * 3600e3).toISOString()
      const floor  = new Date(Date.now() - (hours + 6) * 3600e3).toISOString()

      // Customers whose last inbound sits in the [floor, cutoff] band and
      // who we haven't answered since — the narrow band stops us re-queueing
      // the same person on every run.
      const { data: stale } = await db
        .from('whatsapp_contacts')
        .select('id, name, last_inbound_at, last_outbound_at')
        .eq('user_id', rule.user_id)
        .gte('last_inbound_at', floor)
        .lte('last_inbound_at', cutoff)
        .limit(50)

      for (const c of stale || []) {
        const { data: existing } = await db
          .from('whatsapp_followups')
          .select('id').eq('contact_id', c.id).eq('automation_id', rule.id)
          .eq('status', 'pending').maybeSingle()
        if (existing) continue

        await db.from('whatsapp_followups').insert({
          user_id: rule.user_id,
          contact_id: c.id,
          automation_id: rule.id,
          reason: `${hours} ঘণ্টা উত্তর নেই`,
          message_body: (rule.message_body || 'আপনার কি আরও কিছু জানার আছে? 🙂')
            .replace(/\{name\}/g, c.name || 'কাস্টমার'),
          due_at: new Date(Date.now() + (rule.delay_minutes || 0) * 60e3).toISOString(),
        })
        queued++
      }
    }

    if (rule.trigger_type === 'due_payment') {
      const daysAfter = Number(rule.trigger_value) || 0
      const cutoff = new Date(Date.now() - daysAfter * 864e5).toISOString().slice(0, 10)

      const { data: credits } = await db
        .from('credit_entries')
        .select('id, customer_name, amount, paid_amount, due_date')
        .eq('user_id', rule.user_id)
        .neq('status', 'paid')
        .lte('due_date', cutoff)
        .limit(50)

      for (const cr of credits || []) {
        const { data: contact } = await db
          .from('whatsapp_contacts')
          .select('id, name')
          .eq('user_id', rule.user_id)
          .ilike('name', cr.customer_name)
          .maybeSingle()
        if (!contact) continue

        const { data: existing } = await db
          .from('whatsapp_followups')
          .select('id').eq('contact_id', contact.id).eq('automation_id', rule.id)
          .eq('status', 'pending').maybeSingle()
        if (existing) continue

        const outstanding = Number(cr.amount || 0) - Number(cr.paid_amount || 0)

        await db.from('whatsapp_followups').insert({
          user_id: rule.user_id,
          contact_id: contact.id,
          automation_id: rule.id,
          reason: 'বাকি বকেয়া',
          message_body: (rule.message_body || 'নমস্কার {name} 🙏 আপনার ₹{amount} বাকি আছে। সুবিধা মতো দিয়ে দেবেন।')
            .replace(/\{name\}/g, contact.name || cr.customer_name)
            .replace(/\{amount\}/g, String(outstanding)),
          due_at: new Date(Date.now() + (rule.delay_minutes || 0) * 60e3).toISOString(),
        })
        queued++
      }
    }

    await db.from('whatsapp_automations')
      .update({ last_run_at: new Date().toISOString() }).eq('id', rule.id)
  }

  return NextResponse.json({ ok: true, sent, failed, queued })
}
