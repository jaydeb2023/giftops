// Server-side: who is really calling? Reads the Supabase access token the
// browser sends in `Authorization: Bearer …` — never trusts a userId in the body.
import { createClient } from '@supabase/supabase-js'

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env')
  return createClient(url, key)
}

export async function getCallerId(req: Request): Promise<string | null> {
  const h = req.headers.get('authorization') || ''
  const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
  if (!token) return null
  try {
    const { data, error } = await serviceClient().auth.getUser(token)
    return error ? null : data.user?.id ?? null
  } catch {
    return null
  }
}

/** Fire-and-forget "AI did something" row for the live activity feed. */
export async function logAiActivity(info: {
  ownerId: string; actorId: string; actorRole: string; agentSlug?: string | null
  kind: 'sales' | 'stock' | 'customer' | 'other'; text: string
}) {
  try {
    await serviceClient().from('ai_activity').insert({
      user_id: info.ownerId, actor_id: info.actorId, actor_role: info.actorRole,
      agent_slug: info.agentSlug || null, kind: info.kind, text: info.text.slice(0, 200),
    })
  } catch (e) {
    console.error('logAiActivity failed (run migration 011?):', e)
  }
}
