import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/** GET ?contact_id=… — the thread, oldest first. Also clears unread. */
export async function GET(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: 'contact_id দরকার।' }, { status: 400 })

  const { data, error } = await db.from('whatsapp_messages')
    .select('id, contact_id, wa_message_id, direction, msg_type, body, media_url, status, error_message, ai_generated, response_ms, created_at')
    .eq('user_id', user.id)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('whatsapp_contacts')
    .update({ unread_count: 0 }).eq('id', contactId).eq('user_id', user.id)

  return NextResponse.json({ messages: data || [] })
}
