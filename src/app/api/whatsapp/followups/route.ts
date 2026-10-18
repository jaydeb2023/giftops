import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/** GET ?status=pending — the follow-up queue with contact names joined in. */
export async function GET(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')

  let q = db.from('whatsapp_followups')
    .select('id, contact_id, reason, message_body, due_at, status, sent_at, error_message, whatsapp_contacts(name, wa_id)')
    .eq('user_id', user.id)
    .order('due_at', { ascending: true })
    .limit(200)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followups: data || [] })
}

/** POST — schedule a follow-up manually. */
export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const b = await req.json()
  if (!b?.message_body?.trim()) return NextResponse.json({ error: 'মেসেজ লিখুন।' }, { status: 400 })

  const { data, error } = await db.from('whatsapp_followups').insert({
    user_id: user.id,
    contact_id: b.contact_id || null,
    reason: b.reason || null,
    message_body: String(b.message_body),
    due_at: b.due_at || new Date().toISOString(),
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followup: data })
}

/** PATCH — cancel or reschedule. */
export async function PATCH(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const patch: Record<string, any> = {}
  for (const k of ['status', 'due_at', 'message_body', 'reason']) if (k in rest) patch[k] = rest[k]

  const { data, error } = await db.from('whatsapp_followups')
    .update(patch).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followup: data })
}

export async function DELETE(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const { error } = await db.from('whatsapp_followups').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
