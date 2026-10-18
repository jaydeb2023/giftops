import { NextRequest, NextResponse } from 'next/server'
import { getCallerId, serviceClient } from '@/lib/chatAuth'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { effectiveScope } from '@/lib/chatPolicy'

// Live feed of what the AI actually did (newest first), narrowed to what this
// role may see: stock role → stock work only, sales role → sales/customer work.
export async function GET(req: NextRequest) {
  const callerId = await getCallerId(req)
  if (!callerId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = serviceClient()
  const access = await resolveEffectiveAccess(sb, callerId)
  const scope = effectiveScope(access.role, new URL(req.url).searchParams.get('focus'))

  let q = sb.from('ai_activity').select('id, kind, text, agent_slug, actor_role, created_at')
    .eq('user_id', access.ownerId).order('created_at', { ascending: false }).limit(12)
  if (scope === 'stock') q = q.eq('kind', 'stock')
  if (scope === 'sales') q = q.in('kind', ['sales', 'customer', 'other'])
  const { data, error } = await q
  if (error) return NextResponse.json({ items: [], error: error.message })
  return NextResponse.json({
    items: (data || []).map((r: any) => ({ id: r.id, kind: r.kind, text: r.text, agent: r.agent_slug, role: r.actor_role, ts: new Date(r.created_at).getTime() })),
  })
}
