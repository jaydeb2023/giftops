import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

const TRIGGERS = ['keyword', 'first_message', 'no_reply', 'due_payment', 'low_stock', 'schedule']
const ACTIONS  = ['send_message', 'ai_reply', 'create_followup']

export async function GET() {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await db.from('whatsapp_automations')
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automations: data || [] })
}

export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json()
  if (!b?.name?.trim()) return NextResponse.json({ error: 'একটি নাম দিন।' }, { status: 400 })
  if (!TRIGGERS.includes(b.trigger_type)) return NextResponse.json({ error: 'ট্রিগার ঠিক নয়।' }, { status: 400 })
  if (b.action_type && !ACTIONS.includes(b.action_type)) return NextResponse.json({ error: 'অ্যাকশন ঠিক নয়।' }, { status: 400 })

  const { data, error } = await db.from('whatsapp_automations').insert({
    user_id: user.id,
    name: String(b.name).trim(),
    trigger_type: b.trigger_type,
    trigger_value: b.trigger_value ? String(b.trigger_value).trim() : null,
    delay_minutes: Number(b.delay_minutes) || 0,
    action_type: b.action_type || 'send_message',
    message_body: b.message_body ? String(b.message_body) : null,
    is_active: b.is_active !== false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: data })
}

export async function PATCH(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const patch: Record<string, any> = {}
  for (const k of ['name', 'trigger_type', 'trigger_value', 'delay_minutes', 'action_type', 'message_body', 'is_active']) {
    if (k in rest) patch[k] = rest[k]
  }

  const { data, error } = await db.from('whatsapp_automations')
    .update(patch).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ automation: data })
}

export async function DELETE(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const { error } = await db.from('whatsapp_automations').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
