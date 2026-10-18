import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { logAudit } from '@/lib/auditLog'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

// Only these three ever get written to team_members.role — anything else
// sent from the client (a typo, a stale build, whatever) quietly becomes
// 'sales' rather than failing the request. Keep this in sync with
// src/lib/roleTabs.ts's TeamRole (minus 'owner', which is never invited).
function normalizeRole(role: unknown): 'admin' | 'sales' | 'stock' {
  return role === 'admin' || role === 'stock' ? role : 'sales'
}

// NOTE ON AUTH: like every other route in this app, this trusts the
// `userId` the client sends rather than re-verifying a server-side
// session — that's the existing pattern (see business-chat/route.ts),
// kept here for consistency. Because this route grants data access to a
// second person, it's worth eventually hardening to a verified session
// token; flagging that rather than silently matching the weaker pattern.

// agents sent from the client look like [{ kind: 'library', ref: 'dokan-manager' }, { kind: 'custom', ref: '<agents.id>' }]
async function validateOwnedAgents(supabase: any, userId: string, agents: { kind: string; ref: string }[]) {
  const libraryRefs = agents.filter(a => a.kind === 'library').map(a => a.ref)
  const customRefs = agents.filter(a => a.kind === 'custom').map(a => a.ref)

  const validLibrary = new Set<string>()
  if (libraryRefs.length) {
    const { data } = await supabase.from('user_agent_activations').select('ref').eq('user_id', userId).eq('kind', 'library').in('ref', libraryRefs)
    for (const r of data || []) validLibrary.add(r.ref)
  }
  const validCustom = new Set<string>()
  if (customRefs.length) {
    const { data } = await supabase.from('agents').select('id').eq('user_id', userId).in('id', customRefs)
    for (const r of data || []) validCustom.add(r.id)
  }

  const valid = agents.filter(a => (a.kind === 'library' ? validLibrary.has(a.ref) : validCustom.has(a.ref)))
  return { valid, allValid: valid.length === agents.length }
}

export async function POST(req: Request) {
  try {
    const { userId, name, mobile, email, role, positionTitle, agents } = await req.json()
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })
    if (!email || !String(email).includes('@')) return NextResponse.json({ error: 'সঠিক ইমেইল দিন।' }, { status: 400 })
    // Agent access is optional at invite time now — some positions (e.g.
    // Admin, HR-only roles) may not need any single agent assigned up
    // front; the owner can always add access later from the row's edit action.
    const agentList: { kind: string; ref: string }[] = Array.isArray(agents) ? agents : []
    const normalizedRole = normalizeRole(role)

    const supabase = getServiceClient()

    // Only the real owner may invite — not a team member, even an admin one,
    // in this first version.
    const access = await resolveEffectiveAccess(supabase, userId)
    if (access.role !== 'owner') {
      return NextResponse.json({ error: 'শুধু owner একাউন্ট থেকে টিম মেম্বার যোগ করা যায়।' }, { status: 403 })
    }

    // Enterprise team access is a Business-plan feature.
    const { data: sub } = await supabase.from('subscriptions').select('plan,status').eq('user_id', userId).maybeSingle()
    if (!sub || sub.status !== 'active' || sub.plan !== 'business') {
      return NextResponse.json({ error: 'টিম মেম্বার যোগ করা শুধু Business প্ল্যানে পাওয়া যায়। যোগাযোগ করুন WhatsApp-এ।' }, { status: 403 })
    }

    // Every agent must actually be this owner's (activated library agent,
    // or their own custom agent) — otherwise an owner could grant an
    // employee access to something that isn't theirs.
    const { valid: validAgents, allValid } = await validateOwnedAgents(supabase, userId, agentList)
    if (!allValid) {
      return NextResponse.json({ error: 'এক বা একাধিক এজেন্ট আপনার একাউন্টের নয়।' }, { status: 400 })
    }

    const inviteToken = randomUUID()
    const { data: member, error: insertErr } = await supabase.from('team_members').insert({
      owner_user_id: userId,
      email: String(email).trim().toLowerCase(),
      name: name ? String(name).trim() : null,
      mobile: mobile ? String(mobile).trim() : null,
      position_title: positionTitle ? String(positionTitle).trim() : null,
      role: normalizedRole,
      status: 'invited',
      invite_token: inviteToken,
    }).select('id').single()

    if (insertErr) {
      // Most likely cause: unique(owner_user_id, email) — already invited.
      const msg = insertErr.message?.includes('duplicate') ? 'এই ইমেইলে আগেই একটা invite পাঠানো হয়েছে।' : 'ডেটাবেজে সেভ করা যায়নি।'
      console.error('team/invite insert error:', insertErr.message)
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (validAgents.length) {
      const accessRows = validAgents.map((a: { kind: string; ref: string }) => ({ team_member_id: member.id, kind: a.kind, ref: a.ref }))
      const { error: accessErr } = await supabase.from('team_member_agent_access').insert(accessRows)
      if (accessErr) {
        console.error('team/invite agent_access error:', accessErr.message)
        // Roll back the half-created member so retrying doesn't hit the unique-email conflict.
        await supabase.from('team_members').delete().eq('id', member.id)
        return NextResponse.json({ error: 'এজেন্ট অ্যাক্সেস সেভ করা যায়নি।' }, { status: 400 })
      }
    }

    await logAudit(supabase, {
      ownerUserId: userId,
      actorId: userId,
      action: 'team.invite',
      targetTable: 'team_members',
      targetId: member.id,
      details: { email, mobile, positionTitle, role: normalizedRole },
    })

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://sahayakai.tech'
    return NextResponse.json({ inviteLink: `${origin}/team/accept?token=${inviteToken}` })
  } catch (e) {
    console.error('team/invite error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন।' }, { status: 500 })
  }
}
