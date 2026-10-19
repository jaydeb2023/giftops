import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseServer'
import { intakeLead } from '@/lib/rv/leadIntake'
import { logComm } from '@/lib/rv/comms'
import { scopedDb } from '@/lib/rv/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One webhook for Facebook + Instagram (Meta app):
 *  - Lead Ads form submissions   (page field "leadgen")
 *  - Messenger and Instagram DMs (messaging events)  -> become / update a lead
 * Env: RV_META_VERIFY_TOKEN, RV_META_APP_SECRET, (page token + page id are stored per company)
 */
const GRAPH = `https://graph.facebook.com/${process.env.RV_META_GRAPH_VERSION || 'v21.0'}`

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const t = process.env.RV_META_VERIFY_TOKEN
  if (t && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === t) return new NextResponse(p.get('hub.challenge') || '', { status: 200 })
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  const raw = await req.text()
  const secret = process.env.RV_META_APP_SECRET
  if (!secret) return new NextResponse('Not configured', { status: 503 })
  const sig = req.headers.get('x-hub-signature-256') || ''
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(raw).digest('hex')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return new NextResponse('Forbidden', { status: 403 })

  try {
    const body = JSON.parse(raw)
    const adm = createAdminClient()
    const isIg = body.object === 'instagram'
    for (const entry of body.entry || []) {
      const col = isIg ? 'meta_ig_id' : 'meta_page_id'
      const { data: org } = await adm.from('rv_orgs').select('id,status,integrations').eq(col, String(entry.id)).maybeSingle()
      if (!org || org.status === 'suspended') continue
      const db = scopedDb(org.id, adm)
      const token: string | undefined = (org.integrations as any)?.meta_page_token
      for (const ch of entry.changes || []) if (ch.field === 'leadgen') await leadAd(db, ch.value, token)
      for (const m of entry.messaging || []) await dm(db, m, isIg ? 'instagram' : 'facebook', token)
    }
  } catch (e) { console.error('[rv meta webhook]', e) }
  return NextResponse.json({ received: true })
}

async function leadAd(db: any, v: any, token?: string) {
  if (!token || !v?.leadgen_id) return
  const res = await fetch(`${GRAPH}/${v.leadgen_id}?access_token=${encodeURIComponent(token)}`)
  const j: any = await res.json().catch(() => null)
  if (!j?.field_data) { console.error('[rv meta] lead fetch failed', j?.error?.message); return }
  const f: Record<string, string> = {}
  const extra: string[] = []
  for (const x of j.field_data) { const val = (x.values || []).join(', '); f[x.name] = val; if (!/name|email|phone|company/i.test(x.name)) extra.push(`${x.name}: ${val}`) }
  const name = f.full_name || [f.first_name, f.last_name].filter(Boolean).join(' ')
  await intakeLead(db, {
    name, mobile: f.phone_number || f.phone, email: f.email, company: f.company_name || f.company,
    message: extra.join(' | ') || 'Facebook / Instagram lead form', source: j.platform === 'ig' ? 'instagram' : 'facebook',
    external_id: `lead:${v.leadgen_id}`, meta: { form_id: v.form_id, page_id: v.page_id },
  })
}

async function dm(db: any, m: any, source: 'facebook' | 'instagram', token?: string) {
  const sender = m?.sender?.id
  const text = m?.message?.text
  if (!sender || !m?.message || m.message.is_echo) return
  const body = text || `[${m.message.attachments?.[0]?.type || 'attachment'}]`
  let name = ''
  if (token) {
    try {
      const r = await fetch(`${GRAPH}/${sender}?fields=${source === 'instagram' ? 'name,username' : 'name'}&access_token=${encodeURIComponent(token)}`)
      const j: any = await r.json(); name = j.name || j.username || ''
    } catch { /* name is optional */ }
  }
  const res = await intakeLead(db, { name: name || `${source === 'instagram' ? 'Instagram' : 'Facebook'} user`, message: body, source, external_id: sender })
  if (res.lead_id) {
    // intake logs a note on its own; store the DM in the inbox thread too
    await logComm(db, { lead_id: res.lead_id, channel: source === 'instagram' ? 'instagram' : 'messenger', direction: 'in', body, status: 'received', provider_ref: m.message.mid })
  }
}
