import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseServer'
import { intakeLead } from '@/lib/rv/leadIntake'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Public lead capture for website forms, chatbots, IndiaMART / JustDial / Google Ads forwarders, Zapier / Make.
 * POST JSON or form data: { name, mobile, email, company, occasion, message, source }
 * Auth: header  x-api-key: <RV_LEAD_API_KEY>   (or ?key=... for tools that cannot set headers)
 * A hidden "hp" field must stay empty (spam trap).
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-api-key' }
const hits = new Map<string, { n: number; t: number }>()

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}
const json = (b: any, status = 200) => NextResponse.json(b, { status, headers: CORS })

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }) }

export async function POST(req: NextRequest) {
  const key = process.env.RV_LEAD_API_KEY
  if (!key) return json({ error: 'Lead capture is not enabled. Set RV_LEAD_API_KEY.' }, 503)
  const given = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key') || ''
  if (!given || !same(given, key)) return json({ error: 'Invalid key' }, 401)

  // light rate limit per IP (best effort on serverless)
  const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim()
  const now = Date.now(); const h = hits.get(ip)
  if (h && now - h.t < 60000) { h.n++; if (h.n > 30) return json({ error: 'Too many requests' }, 429) } else hits.set(ip, { n: 1, t: now })

  let b: any = {}
  const ct = req.headers.get('content-type') || ''
  try {
    if (ct.includes('application/json')) b = await req.json()
    else { const f = await req.formData(); f.forEach((v, k) => { b[k] = typeof v === 'string' ? v : '' }) }
  } catch { return json({ error: 'Could not read the request' }, 400) }

  if (b.hp) return json({ ok: true, status: 'ignored' })           // bots fill hidden fields
  const r = await intakeLead(createAdminClient(), {
    name: b.name || b.full_name, mobile: b.mobile || b.phone, email: b.email, company: b.company, occasion: b.occasion,
    message: b.message || b.notes, source: b.source || 'website', meta: { utm: b.utm_source || null, page: b.page || null },
  })
  if (r.status === 'rejected') return json({ error: r.reason }, 422)
  return json({ ok: true, status: r.status, lead_no: r.lead_no })
}
