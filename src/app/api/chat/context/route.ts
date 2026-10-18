import { NextRequest, NextResponse } from 'next/server'
import { getCallerId, serviceClient } from '@/lib/chatAuth'
import { resolveEffectiveAccess, canAccessAgent } from '@/lib/teamAccess'
import { LIBRARY_META } from '@/lib/chatPolicy'

// Who am I in this business, and which agents may I chat with?
// For an employee this is the OWNER's agents narrowed to the ones they were granted.
export async function GET(req: NextRequest) {
  const callerId = await getCallerId(req)
  if (!callerId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = serviceClient()
  const access = await resolveEffectiveAccess(sb, callerId)

  const [{ data: acts }, { data: custom }] = await Promise.all([
    sb.from('user_agent_activations').select('kind, ref').eq('user_id', access.ownerId),
    sb.from('agents').select('id, name, name_bn, icon, color').eq('user_id', access.ownerId).order('created_at', { ascending: false }),
  ])

  const agents: any[] = []
  for (const a of acts || []) {
    if (a.kind !== 'library') continue
    const meta = LIBRARY_META[a.ref]
    if (!meta || !canAccessAgent(access, 'library', a.ref)) continue
    agents.push({ isLibrary: true, slug: a.ref, name: meta.name, icon: meta.icon, color: meta.color })
  }
  for (const c of custom || []) {
    if (!canAccessAgent(access, 'custom', c.id)) continue
    agents.push({ isLibrary: false, id: c.id, name: c.name_bn || c.name, name_bn: c.name_bn || c.name, icon: c.icon || '🤖', color: c.color })
  }
  return NextResponse.json({ role: access.role, ownerId: access.ownerId, agents })
}
