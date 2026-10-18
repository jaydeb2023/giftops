import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { hasPermission } from '@/lib/permissions'
import { logAudit } from '@/lib/auditLog'
import { LIBRARY_AGENT_NAMES_BN, LibraryVertical } from '@/lib/libraryAgentIds'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

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

function agentLabel(kind: string, ref: string, customNames: Record<string, string>) {
  if (kind === 'library') return LIBRARY_AGENT_NAMES_BN[ref as LibraryVertical] || ref
  return customNames[ref] || 'কাস্টম এজেন্ট'
}

// GET /api/team?userId=... — list this owner's team, each with the
// agent(s) they can access, for the admin panel table.
export async function GET(req: Request) {
  try {
    const userId = new URL(req.url).searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (access.role !== 'owner') return NextResponse.json({ error: 'শুধু owner এই তালিকা দেখতে পারে।' }, { status: 403 })

    const { data: members, error } = await supabase
      .from('team_members')
      .select('id, name, email, mobile, position_title, role, status, created_at, last_active_at')
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false })
    if (error) { console.error('team GET error:', error.message); return NextResponse.json({ error: 'তালিকা আনা যায়নি।' }, { status: 500 }) }

    const ids = (members || []).map(m => m.id)
    let labelsByMember: Record<string, string[]> = {}
    // Raw {kind, ref} pairs too — the table only needs labels, but the
    // edit-member form needs these to pre-check the right agent boxes.
    let refsByMember: Record<string, { kind: string; ref: string }[]> = {}
    if (ids.length) {
      const { data: rows } = await supabase.from('team_member_agent_access').select('team_member_id, kind, ref').in('team_member_id', ids)
      const customIds = [...new Set((rows || []).filter((r: any) => r.kind === 'custom').map((r: any) => r.ref))]
      let customNames: Record<string, string> = {}
      if (customIds.length) {
        const { data: customAgents } = await supabase.from('agents').select('id, name, name_bn').in('id', customIds)
        for (const a of customAgents || []) customNames[a.id] = a.name_bn || a.name
      }
      for (const r of rows || []) {
        const label = agentLabel(r.kind, r.ref, customNames)
        labelsByMember[r.team_member_id] = [...(labelsByMember[r.team_member_id] || []), label]
        refsByMember[r.team_member_id] = [...(refsByMember[r.team_member_id] || []), { kind: r.kind, ref: r.ref }]
      }
    }

    const result = (members || []).map(m => ({
      ...m,
      agents: labelsByMember[m.id] || [],
      agentRefs: refsByMember[m.id] || [],
    }))
    return NextResponse.json({ members: result })
  } catch (e) {
    console.error('team GET error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে।' }, { status: 500 })
  }
}

// PATCH /api/team — { userId, memberId, status? ('revoked'), agents?, name?, mobile?, email?, positionTitle?, role? }
export async function PATCH(req: Request) {
  try {
    const { userId, memberId, status, agents, name, mobile, email, positionTitle, role } = await req.json()
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })
    if (!memberId) return NextResponse.json({ error: 'memberId লাগবে।' }, { status: 400 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (!hasPermission(access, 'manage_team')) return NextResponse.json({ error: 'এই কাজ করার অনুমতি নেই।' }, { status: 403 })

    const { data: member } = await supabase.from('team_members').select('id, owner_user_id').eq('id', memberId).maybeSingle()
    if (!member || member.owner_user_id !== access.ownerId) return NextResponse.json({ error: 'এই মেম্বার আপনার টিমে নেই।' }, { status: 404 })

    if (status) {
      const { error } = await supabase.from('team_members').update({ status }).eq('id', memberId)
      if (error) { console.error('team PATCH status error:', error.message); return NextResponse.json({ error: 'আপডেট করা যায়নি।' }, { status: 500 }) }
    }

    // Profile-field edits (from the row's "Edit" action) — all optional,
    // only the ones actually sent get updated.
    const profileUpdate: Record<string, any> = {}
    if (name !== undefined) profileUpdate.name = name ? String(name).trim() : null
    if (mobile !== undefined) profileUpdate.mobile = mobile ? String(mobile).trim() : null
    if (email !== undefined && email) profileUpdate.email = String(email).trim().toLowerCase()
    if (positionTitle !== undefined) profileUpdate.position_title = positionTitle ? String(positionTitle).trim() : null
    if (role !== undefined) profileUpdate.role = role === 'admin' ? 'admin' : 'sales'
    if (Object.keys(profileUpdate).length) {
      const { error } = await supabase.from('team_members').update(profileUpdate).eq('id', memberId)
      if (error) {
        const msg = error.message?.includes('duplicate') ? 'এই ইমেইল আগে থেকেই আরেকজন মেম্বারের।' : 'তথ্য আপডেট করা যায়নি।'
        console.error('team PATCH profile error:', error.message)
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    if (Array.isArray(agents)) {
      const { valid, allValid } = await validateOwnedAgents(supabase, access.ownerId, agents)
      if (!allValid) return NextResponse.json({ error: 'এক বা একাধিক এজেন্ট আপনার একাউন্টের নয়।' }, { status: 400 })

      await supabase.from('team_member_agent_access').delete().eq('team_member_id', memberId)
      if (valid.length) {
        const { error } = await supabase.from('team_member_agent_access').insert(valid.map((a: any) => ({ team_member_id: memberId, kind: a.kind, ref: a.ref })))
        if (error) { console.error('team PATCH agent_access error:', error.message); return NextResponse.json({ error: 'এজেন্ট অ্যাক্সেস আপডেট করা যায়নি।' }, { status: 500 }) }
      }
    }

    await logAudit(supabase, {
      ownerUserId: access.ownerId,
      actorId: userId,
      action: status ? 'team.status_change' : Object.keys(profileUpdate).length ? 'team.profile_updated' : 'team.agents_updated',
      targetTable: 'team_members',
      targetId: memberId,
      details: { status, agents, ...profileUpdate },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('team PATCH error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে।' }, { status: 500 })
  }
}

// DELETE /api/team — { userId, memberId } — permanently removes a member row
// (as opposed to PATCH status='revoked', which just locks them out but
// keeps the row/history). Used by the table's "ডিলিট" row action.
export async function DELETE(req: Request) {
  try {
    const { userId, memberId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })
    if (!memberId) return NextResponse.json({ error: 'memberId লাগবে।' }, { status: 400 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (!hasPermission(access, 'manage_team')) return NextResponse.json({ error: 'এই কাজ করার অনুমতি নেই।' }, { status: 403 })

    const { data: member } = await supabase.from('team_members').select('id, owner_user_id, email').eq('id', memberId).maybeSingle()
    if (!member || member.owner_user_id !== access.ownerId) return NextResponse.json({ error: 'এই মেম্বার আপনার টিমে নেই।' }, { status: 404 })

    await supabase.from('team_member_agent_access').delete().eq('team_member_id', memberId)
    const { error } = await supabase.from('team_members').delete().eq('id', memberId)
    if (error) { console.error('team DELETE error:', error.message); return NextResponse.json({ error: 'ডিলিট করা যায়নি।' }, { status: 500 }) }

    await logAudit(supabase, {
      ownerUserId: access.ownerId,
      actorId: userId,
      action: 'team.deleted',
      targetTable: 'team_members',
      targetId: memberId,
      details: { email: member.email },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('team DELETE error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে।' }, { status: 500 })
  }
}
