/**
 * Thin wrapper over Meta's WhatsApp Business Cloud API.
 * Server-only — never import into a 'use client' component.
 */

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`

export interface SendResult {
  ok: boolean
  waMessageId?: string
  error?: string
}

async function graph(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || `Graph API ${res.status}`
    throw new Error(msg)
  }
  return json
}

/** Verify credentials + pull the display number. */
export async function verifyCredentials(phoneNumberId: string, token: string) {
  const data = await graph(
    `${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
    token
  )
  return {
    display_phone: data.display_phone_number as string | undefined,
    verified_name: data.verified_name as string | undefined,
    quality_rating: data.quality_rating as string | undefined,
  }
}

/** Plain text message. Only allowed inside the 24-hour window. */
export async function sendText(
  phoneNumberId: string,
  token: string,
  to: string,
  body: string,
  previewUrl = true
): Promise<SendResult> {
  try {
    const data = await graph(`${phoneNumberId}/messages`, token, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: previewUrl, body: body.slice(0, 4096) },
      }),
    })
    return { ok: true, waMessageId: data?.messages?.[0]?.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/** Approved template — the only thing sendable outside the 24-hour window. */
export async function sendTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  templateName: string,
  languageCode = 'bn',
  bodyParams: string[] = []
): Promise<SendResult> {
  try {
    const components = bodyParams.length
      ? [{ type: 'body', parameters: bodyParams.map(t => ({ type: 'text', text: t })) }]
      : undefined
    const data = await graph(`${phoneNumberId}/messages`, token, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
      }),
    })
    return { ok: true, waMessageId: data?.messages?.[0]?.id }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

/** Blue ticks on the customer's side — improves quality rating. */
export async function markAsRead(phoneNumberId: string, token: string, waMessageId: string) {
  try {
    await graph(`${phoneNumberId}/messages`, token, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: waMessageId,
      }),
    })
  } catch {
    /* non-fatal */
  }
}

/** Resolve a media id to a temporary download URL. */
export async function getMediaUrl(mediaId: string, token: string): Promise<string | null> {
  try {
    const data = await graph(mediaId, token)
    return data?.url ?? null
  } catch {
    return null
  }
}

/** Normalise any number the user typed into a wa_id. */
export function toWaId(raw: string, defaultCc = '91'): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return defaultCc + digits
  if (digits.startsWith('0')) return defaultCc + digits.slice(1)
  return digits
}

/** Meta only accepts free-form text within 24h of the last inbound message. */
export function isInsideServiceWindow(lastInboundAt: string | null | undefined): boolean {
  if (!lastInboundAt) return false
  return Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000
}
