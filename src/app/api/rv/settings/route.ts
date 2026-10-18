import { NextRequest, NextResponse } from 'next/server'
import { guard, fail, audit } from '@/lib/rv/server'
import { waConfigured, aiCallConfigured } from '@/lib/rv/wa'

export const dynamic = 'force-dynamic'

const KEYS = ['company', 'address_chase']

export async function GET() {
  const g = await guard()
  if (!g.ok) return g.res
  const { data } = await g.db.from('rv_settings').select('key,value').in('key', KEYS)
  const out: Record<string, any> = {}
  ;(data || []).forEach(r => { out[r.key] = r.value })
  return NextResponse.json({
    settings: out,
    providers: {
      whatsapp: waConfigured(),
      whatsapp_webhook_secret: !!process.env.RV_WA_APP_SECRET,
      ai_call: aiCallConfigured(),
      ai_call_callback_secret: !!process.env.RV_AI_CALL_SECRET,
      cron_secret: !!process.env.CRON_SECRET,
      app_url: process.env.NEXT_PUBLIC_APP_URL || '',
    },
  })
}

export async function PUT(req: NextRequest) {
  const g = await guard([])           // admin only
  if (!g.ok) return g.res
  const { key, value } = await req.json().catch(() => ({}))
  if (!KEYS.includes(key) || typeof value !== 'object' || !value) return fail('Invalid setting')
  const { error } = await g.db.from('rv_settings').upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) return fail(error.message, 400)
  await audit(g.db, g.staff, 'rv_settings', key, 'update', value)
  return NextResponse.json({ ok: true })
}
