import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/** GET — inbox list, newest conversation first. */
export async function GET(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()

  let query = db.from('whatsapp_contacts')
    .select('id, wa_id, name, last_message_at, last_inbound_at, unread_count, is_bot_paused, tags, notes')
    .eq('user_id', user.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(200)

  if (q) query = query.or(`name.ilike.%${q}%,wa_id.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contacts: data || [] })
}

/** PATCH — rename, tag, note, or resume/pause the bot for one contact. */
export async function PATCH(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, ...rest } = await req.json()
  if (!id) return NextResponse.json({ error: 'id দরকার।' }, { status: 400 })

  const ALLOWED = ['name', 'is_bot_paused', 'tags', 'notes', 'unread_count']
  const patch: Record<string, any> = {}
  for (const k of ALLOWED) if (k in rest) patch[k] = rest[k]

  const { data, error } = await db.from('whatsapp_contacts')
    .update(patch).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contact: data })
}
