import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!callerProfile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [{ data: profiles, error: profilesError }, { data: subs, error: subsError }, { data: agents }] =
    await Promise.all([
      admin.from('profiles').select('id, email, full_name, created_at, is_admin').order('created_at', { ascending: false }),
      admin.from('subscriptions').select('*'),
      admin.from('agents').select('user_id'),
    ])

  if (profilesError || subsError) {
    console.error(profilesError, subsError)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }

  const subByUser = new Map((subs || []).map((s) => [s.user_id, s]))
  const agentCountByUser = new Map<string, number>()
  ;(agents || []).forEach((a) => {
    agentCountByUser.set(a.user_id, (agentCountByUser.get(a.user_id) || 0) + 1)
  })

  const users = (profiles || []).map((p) => ({
    ...p,
    subscription: subByUser.get(p.id) || null,
    agent_count: agentCountByUser.get(p.id) || 0,
  }))

  return NextResponse.json({ users })
}
