import { NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

/**
 * Everything the WhatsApp dashboard header needs, in one round trip.
 * 7 days of messages is a few hundred rows at most for a shop, so we
 * aggregate in JS rather than adding SQL views.
 */
export async function GET() {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = Date.now()
  const d7 = new Date(now - 7 * 864e5).toISOString()
  const d1 = new Date(now - 864e5).toISOString()

  const [accountRes, contactsRes, msgRes, followRes, autoRes, kbRes] = await Promise.all([
    db.from('whatsapp_accounts').select('id, status').eq('user_id', user.id).maybeSingle(),
    db.from('whatsapp_contacts').select('id, created_at').eq('user_id', user.id),
    db.from('whatsapp_messages')
      .select('direction, ai_generated, response_ms, status, created_at')
      .eq('user_id', user.id).gte('created_at', d7).limit(5000),
    db.from('whatsapp_followups').select('id').eq('user_id', user.id).eq('status', 'pending'),
    db.from('whatsapp_automations').select('id').eq('user_id', user.id).eq('is_active', true),
    db.from('whatsapp_knowledge')
      .select('title, hit_count').eq('user_id', user.id).eq('is_active', true)
      .order('hit_count', { ascending: false }).limit(50),
  ])

  const msgs = msgRes.data || []
  const contacts = contactsRes.data || []

  const inbound7d  = msgs.filter(m => m.direction === 'inbound').length
  const outbound7d = msgs.filter(m => m.direction === 'outbound').length
  const inbound24h  = msgs.filter(m => m.direction === 'inbound'  && m.created_at >= d1).length
  const outbound24h = msgs.filter(m => m.direction === 'outbound' && m.created_at >= d1).length
  const aiReplies7d = msgs.filter(m => m.direction === 'outbound' && m.ai_generated).length
  const failed7d    = msgs.filter(m => m.status === 'failed').length

  // Only AI/automated replies carry response_ms — manual replies would
  // skew "how fast does the bot answer" into meaninglessness.
  const times = msgs
    .filter(m => m.direction === 'outbound' && typeof m.response_ms === 'number' && m.response_ms > 0)
    .map(m => m.response_ms as number)

  const avgResponseMs = times.length
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : null
  const fastestResponseMs = times.length ? Math.min(...times) : null

  // Daily buckets for the last 7 days (oldest → newest)
  const daily: { date: string; inbound: number; outbound: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now - i * 864e5).toISOString().slice(0, 10)
    daily.push({
      date: day,
      inbound:  msgs.filter(m => m.direction === 'inbound'  && m.created_at.startsWith(day)).length,
      outbound: msgs.filter(m => m.direction === 'outbound' && m.created_at.startsWith(day)).length,
    })
  }

  return NextResponse.json({
    connected: !!accountRes.data && accountRes.data.status === 'connected',
    totalContacts: contacts.length,
    newContacts7d: contacts.filter(c => c.created_at >= d7).length,
    inbound24h, outbound24h, inbound7d, outbound7d,
    aiReplies7d,
    autoReplyRate: inbound7d ? Math.round((aiReplies7d / inbound7d) * 100) : 0,
    avgResponseMs,
    fastestResponseMs,
    pendingFollowups: (followRes.data || []).length,
    activeAutomations: (autoRes.data || []).length,
    knowledgeEntries: (kbRes.data || []).length,
    failed7d,
    daily,
    topQuestions: (kbRes.data || []).filter(k => (k.hit_count ?? 0) > 0).slice(0, 5),
  })
}
