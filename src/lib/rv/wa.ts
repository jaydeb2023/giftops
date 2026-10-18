// Raahvia's single WhatsApp Business number + AI-calling provider hooks.
// Credentials live in environment variables (never in the browser):
//   RV_WA_PHONE_NUMBER_ID, RV_WA_TOKEN, RV_WA_VERIFY_TOKEN, RV_WA_APP_SECRET
//   RV_AI_CALL_API_URL, RV_AI_CALL_API_KEY, RV_AI_CALL_SECRET, RV_AI_CALL_SCRIPT
import { sendText, sendTemplate, toWaId, isInsideServiceWindow } from '@/lib/whatsapp'
import type { Db } from './server'
import { logComm, CommInput } from './comms'
import { normMobile } from './util'

export const waConfigured = () => !!(process.env.RV_WA_PHONE_NUMBER_ID && process.env.RV_WA_TOKEN)
export const aiCallConfigured = () => !!process.env.RV_AI_CALL_API_URL

export interface WaSend {
  to: string
  text?: string
  template?: string
  language?: string
  params?: string[]
  link: Omit<CommInput, 'channel' | 'direction' | 'body' | 'mobile' | 'status' | 'provider_ref'>
}

/** Last inbound WhatsApp from this mobile (for the 24-hour free-text window). */
async function lastInbound(db: Db, mobile: string): Promise<string | null> {
  const { data } = await db.from('rv_communications').select('created_at')
    .eq('channel', 'whatsapp').eq('direction', 'in').eq('mobile_norm', normMobile(mobile))
    .order('created_at', { ascending: false }).limit(1)
  return data?.[0]?.created_at ?? null
}

export async function sendWhatsApp(db: Db, m: WaSend): Promise<{ ok: boolean; error?: string; code?: string }> {
  if (!waConfigured()) return { ok: false, error: 'WhatsApp is not configured (set RV_WA_PHONE_NUMBER_ID and RV_WA_TOKEN).', code: 'NOT_CONFIGURED' }
  const wa = toWaId(m.to)
  if (!wa) return { ok: false, error: 'Invalid mobile number.' }
  const pid = process.env.RV_WA_PHONE_NUMBER_ID!
  const token = process.env.RV_WA_TOKEN!

  let res
  let body: string
  if (m.template) {
    res = await sendTemplate(pid, token, wa, m.template, m.language || 'en', m.params || [])
    body = `[template:${m.template}] ${(m.params || []).join(' | ')}`
  } else if (m.text) {
    const inside = isInsideServiceWindow(await lastInbound(db, m.to))
    if (!inside) return { ok: false, error: 'The 24-hour reply window is closed. Send an approved template instead.', code: 'WINDOW_CLOSED' }
    res = await sendText(pid, token, wa, m.text, false)
    body = m.text
  } else {
    return { ok: false, error: 'Nothing to send.' }
  }

  await logComm(db, {
    ...m.link, channel: 'whatsapp', direction: 'out', mobile: m.to, body,
    status: res.ok ? 'sent' : 'failed', provider_ref: res.waMessageId ?? null,
    outcome: res.ok ? null : res.error ?? 'failed',
  })
  return res.ok ? { ok: true } : { ok: false, error: res.error }
}

/** Ask the AI-calling provider to phone a recipient. The provider calls back /api/rv/webhooks/ai-call with the result. */
export async function startAiCall(args: {
  recipient_id: string; name: string; mobile: string; existing_address?: string | null; language?: string
}): Promise<{ ok: boolean; call_id?: string; error?: string }> {
  const url = process.env.RV_AI_CALL_API_URL
  if (!url) return { ok: false, error: 'AI calling is not configured (set RV_AI_CALL_API_URL).' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.RV_AI_CALL_API_KEY ? { Authorization: `Bearer ${process.env.RV_AI_CALL_API_KEY}` } : {}) },
      body: JSON.stringify({
        recipient_id: args.recipient_id,
        name: args.name,
        phone: toWaId(args.mobile),
        existing_address: args.existing_address || null,
        languages: ['bn', 'hi', 'en'],
        script: process.env.RV_AI_CALL_SCRIPT || 'address_collection',
        callback_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/rv/webhooks/ai-call`,
        callback_secret_header: 'x-rv-secret',
      }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: j?.error || `AI call provider returned ${res.status}` }
    return { ok: true, call_id: j?.call_id || j?.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
