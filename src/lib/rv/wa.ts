// Each company has its OWN WhatsApp number and AI-calling provider, stored on its rv_orgs row
// (wa_phone_number_id + integrations.wa_token / ai_call_api_url / ai_call_api_key / ai_call_script).
// Platform-wide secrets stay in env: RV_WA_APP_SECRET, RV_WA_VERIFY_TOKEN, RV_AI_CALL_SECRET.
import { sendText, sendTemplate, toWaId, isInsideServiceWindow } from '@/lib/whatsapp'
import { orgIdOf, type Db } from './server'
import { logComm, CommInput } from './comms'
import { normMobile } from './util'

export interface OrgCfg {
  wa_phone_number_id: string | null
  meta_page_id: string | null
  integrations: Record<string, any>
}

export async function orgCfg(db: Db): Promise<OrgCfg> {
  const { data } = await db.from('rv_orgs').select('wa_phone_number_id,meta_page_id,integrations').eq('id', orgIdOf(db)).maybeSingle()
  return { wa_phone_number_id: data?.wa_phone_number_id ?? null, meta_page_id: data?.meta_page_id ?? null, integrations: (data?.integrations as any) || {} }
}
export const waReady = (c: OrgCfg) => !!(c.wa_phone_number_id && c.integrations.wa_token)
export const aiReady = (c: OrgCfg) => !!c.integrations.ai_call_api_url
export const waConfigured = async (db: Db) => waReady(await orgCfg(db))
export const aiCallConfigured = async (db: Db) => aiReady(await orgCfg(db))

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
  const cfg = await orgCfg(db)
  if (!waReady(cfg)) return { ok: false, error: 'WhatsApp is not connected for this company. Add it in Settings > Connections.', code: 'NOT_CONFIGURED' }
  const wa = toWaId(m.to)
  if (!wa) return { ok: false, error: 'Invalid mobile number.' }
  const pid = cfg.wa_phone_number_id!
  const token = String(cfg.integrations.wa_token)

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
export async function startAiCall(db: Db, args: {
  recipient_id: string; name: string; mobile: string; existing_address?: string | null; language?: string
}): Promise<{ ok: boolean; call_id?: string; error?: string }> {
  const ic = (await orgCfg(db)).integrations
  const url = ic.ai_call_api_url
  if (!url) return { ok: false, error: 'AI calling is not connected for this company.' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ic.ai_call_api_key ? { Authorization: `Bearer ${ic.ai_call_api_key}` } : {}) },
      body: JSON.stringify({
        recipient_id: args.recipient_id,
        name: args.name,
        phone: toWaId(args.mobile),
        existing_address: args.existing_address || null,
        languages: ['bn', 'hi', 'en'],
        script: ic.ai_call_script || 'address_collection',
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
