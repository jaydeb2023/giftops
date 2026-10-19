import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit, orgIdOf } from '@/lib/rv/server'
import { orgCfg, waReady, aiReady } from '@/lib/rv/wa'
import { newKey } from '@/lib/rv/orgs'

export const dynamic = 'force-dynamic'

const KEYS = ['company', 'address_chase']
const SECRET_FIELDS = ['wa_token', 'ai_call_api_key', 'meta_page_token']
const TEXT_FIELDS = ['ai_call_api_url', 'ai_call_script']

export async function GET() {
  const g = await guard()
  if (!g.ok) return g.res
  const { data } = await g.db.from('rv_settings').select('key,value').in('key', KEYS)
  const out: Record<string, any> = {}
  ;(data || []).forEach(r => { out[r.key] = r.value })
  const cfg = await orgCfg(g.db)
  const admin = g.staff.role === 'admin'
  const { data: org } = await g.raw.from('rv_orgs').select('lead_api_key,meta_ig_id').eq('id', g.org.id).single()
  const ic = cfg.integrations
  return NextResponse.json({
    settings: out,
    org: { name: g.org.name, slug: g.org.slug, status: g.org.status, plan: g.org.plan, trial_ends_at: g.org.trial_ends_at },
    providers: {
      whatsapp: waReady(cfg),
      ai_call: aiReady(cfg),
      lead_api: !!org?.lead_api_key,
      meta: !!(cfg.meta_page_id || org?.meta_ig_id),
      meta_page_token: !!ic.meta_page_token,
      platform_whatsapp_webhook: !!process.env.RV_WA_APP_SECRET,
      platform_meta_webhook: !!(process.env.RV_META_APP_SECRET && process.env.RV_META_VERIFY_TOKEN),
      app_url: process.env.NEXT_PUBLIC_APP_URL || '',
    },
    // admin only: the company's own connection details (secrets are never sent back, only whether they are set)
    connections: admin ? {
      lead_api_key: org?.lead_api_key || null,
      wa_phone_number_id: cfg.wa_phone_number_id, meta_page_id: cfg.meta_page_id, meta_ig_id: org?.meta_ig_id || null,
      ai_call_api_url: ic.ai_call_api_url || '', ai_call_script: ic.ai_call_script || '',
      has: Object.fromEntries(SECRET_FIELDS.map(k => [k, !!ic[k]])),
    } : null,
  })
}

export async function PUT(req: NextRequest) {
  const g = await guard([])           // admin only
  if (!g.ok) return g.res
  const b = await req.json().catch(() => ({}))
  const orgId = orgIdOf(g.db)

  if (b.rotate_lead_key) {
    const { error } = await g.raw.from('rv_orgs').update({ lead_api_key: newKey() }).eq('id', orgId)
    if (error) return fail(error.message, 400)
    await audit(g.db, g.staff, 'rv_orgs', orgId, 'rotate_lead_key')
    return NextResponse.json({ ok: true })
  }

  if (b.connections && typeof b.connections === 'object') {
    const c = b.connections
    const { data: cur } = await g.raw.from('rv_orgs').select('integrations').eq('id', orgId).single()
    const ic: Record<string, any> = { ...((cur?.integrations as any) || {}) }
    for (const k of SECRET_FIELDS) if (typeof c[k] === 'string' && c[k].trim()) ic[k] = c[k].trim()   // blank = keep
    for (const k of TEXT_FIELDS) if (typeof c[k] === 'string') ic[k] = c[k].trim()
    const clean = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const { error } = await g.raw.from('rv_orgs').update({
      wa_phone_number_id: clean(c.wa_phone_number_id), meta_page_id: clean(c.meta_page_id), meta_ig_id: clean(c.meta_ig_id), integrations: ic,
    }).eq('id', orgId)
    if (error) return fail(error.code === '23505' ? 'That WhatsApp number / page is already connected to another company.' : error.message, 400)
    await audit(g.db, g.staff, 'rv_orgs', orgId, 'update_connections', { fields: Object.keys(c) })
    return NextResponse.json({ ok: true })
  }

  const { key, value } = b
  if (!KEYS.includes(key) || typeof value !== 'object' || !value) return fail('Invalid setting')
  const { error } = await g.db.from('rv_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'org_id,key' })
  if (error) return fail(error.message, 400)
  await audit(g.db, g.staff, 'rv_settings', key, 'update', value)
  return NextResponse.json({ ok: true })
}
