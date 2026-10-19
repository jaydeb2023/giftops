import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabaseServer'
import { guard, fail, getSetting, isCronAuthorized, scopedDb, type Db } from '@/lib/rv/server'
import { sendWhatsApp, startAiCall, waConfigured, aiCallConfigured } from '@/lib/rv/wa'
import { logComm, openTask } from '@/lib/rv/comms'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const LIVE = ['confirmed', 'procurement', 'packing', 'ready_dispatch']

/**
 * Address-collection chain, one pass:
 *   pending        -> WhatsApp request            (status reminder_sent)
 *   reminder_sent  -> after N hours: AI call      (status ai_call)
 *   ai_call        -> after N hours: human queue  (status human_call + task)
 * Run it from a scheduler (hourly) using  Authorization: Bearer $CRON_SECRET,  or press
 * "Run address chase now" in the Address queue. Safe to run repeatedly.
 */
async function run(db: Db) {
  const cfg = await getSetting<any>(db, 'address_chase', {
    enabled: true, whatsapp_template: 'address_request', whatsapp_language: 'en',
    reminder_after_hours: 6, ai_call_after_hours: 12, human_after_hours: 24, max_attempts: 3,
  })
  if (!cfg.enabled) return { skipped: 'Address chase is switched off in Settings.' }

  const today = new Date().toISOString().slice(0, 10)
  const { data: recs, error } = await db.from('rv_recipients')
    .select('*, order:rv_orders!inner(id,order_no,status,delivery_date,customer_id,customer:rv_customers(name,company))')
    .in('address_status', ['pending', 'reminder_sent', 'ai_call'])
    .neq('delivery_status', 'cancelled')
    .in('order.status', LIVE)
    .limit(500)
  if (error) throw new Error(error.message)

  const stats = { checked: (recs || []).length, whatsapp_sent: 0, ai_calls: 0, to_human: 0, skipped_not_configured: 0, errors: 0 }
  const hoursSince = (t: string | null) => (t ? (Date.now() - new Date(t).getTime()) / 3600e3 : Infinity)

  for (const r of (recs || []) as any[]) {
    if (r.order?.delivery_date && r.order.delivery_date < today) continue
    const toHuman = async (why: string) => {
      await db.from('rv_recipients').update({ address_status: 'human_call', last_attempt_at: new Date().toISOString() }).eq('id', r.id)
      await openTask(db, { kind: 'address', title: `Call to confirm address: ${r.name} (${r.delivery_no}) - ${why}`, order_id: r.order_id, recipient_id: r.id })
      stats.to_human++
    }
    if (!r.mobile_norm) { await toHuman('no mobile number'); continue }

    // respect an opt-out reply on this recipient
    const { data: oo } = await db.from('rv_communications').select('id').eq('recipient_id', r.id).eq('outcome', 'opt_out').limit(1)
    if (oo && oo.length) { await toHuman('opted out of WhatsApp'); continue }

    if (r.address_status === 'pending') {
      if (!(await waConfigured(db))) { stats.skipped_not_configured++; continue }
      const who = r.order?.customer?.company || r.order?.customer?.name || 'a friend'
      const when = r.order?.delivery_date || 'the planned date'
      const res = await sendWhatsApp(db, {
        to: r.mobile, template: cfg.whatsapp_template, language: cfg.whatsapp_language, params: [r.name, who, String(when)],
        link: { recipient_id: r.id, order_id: r.order_id, customer_id: r.order?.customer_id },
      })
      if (res.ok) {
        await db.from('rv_recipients').update({ address_status: 'reminder_sent', address_attempts: (r.address_attempts || 0) + 1, last_attempt_at: new Date().toISOString() }).eq('id', r.id)
        stats.whatsapp_sent++
      } else stats.errors++
    } else if (r.address_status === 'reminder_sent' && hoursSince(r.last_attempt_at) >= (cfg.ai_call_after_hours - cfg.reminder_after_hours)) {
      if (!(await aiCallConfigured(db))) { await toHuman('AI calling not configured'); continue }
      const res = await startAiCall(db, { recipient_id: r.id, name: r.name, mobile: r.mobile, existing_address: r.address_line })
      await logComm(db, { recipient_id: r.id, order_id: r.order_id, customer_id: r.order?.customer_id, channel: 'ai_call', direction: 'out', mobile: r.mobile, status: res.ok ? 'queued' : 'failed', provider_ref: res.call_id ?? null, outcome: res.ok ? null : res.error })
      if (res.ok) {
        await db.from('rv_recipients').update({ address_status: 'ai_call', address_attempts: (r.address_attempts || 0) + 1, last_attempt_at: new Date().toISOString() }).eq('id', r.id)
        stats.ai_calls++
      } else { stats.errors++; await toHuman('AI call could not start') }
    } else if (r.address_status === 'ai_call' && hoursSince(r.last_attempt_at) >= (cfg.human_after_hours - cfg.ai_call_after_hours)) {
      await toHuman('no result from AI call')
    }
  }
  return stats
}

export async function POST(req: NextRequest) { return handle(req) }
export async function GET(req: NextRequest) { return handle(req) }

async function handle(req: NextRequest) {
  try {
    if (isCronAuthorized(req)) {
      // scheduler: one pass for every company that is live
      const raw = createAdminClient()
      const { data: orgs } = await raw.from('rv_orgs').select('id,name').in('status', ['trial', 'active'])
      const results: Record<string, any> = {}
      for (const o of orgs || []) {
        try { results[o.name] = await run(scopedDb(o.id, raw)) } catch (e: any) { results[o.name] = { error: e.message } }
      }
      return NextResponse.json({ result: results })
    }
    const g = await guard(['sales', 'ops'])
    if (!g.ok) return g.res
    return NextResponse.json({ result: await run(g.db) })
  } catch (e: any) {
    return fail(e.message || 'Address chase failed', 500)
  }
}
