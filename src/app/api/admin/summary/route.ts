import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [{ count: users }, { count: agents }, { count: publicAgents }, { count: admins }] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('agents').select('*', { count: 'exact', head: true }),
    admin.from('agents').select('*', { count: 'exact', head: true }).eq('is_public', true),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', true),
  ])

  return NextResponse.json({
    users: users || 0,
    agents: agents || 0,
    publicAgents: publicAgents || 0,
    admins: admins || 0,
  })
}
