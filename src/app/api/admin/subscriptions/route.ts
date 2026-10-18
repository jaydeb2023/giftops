import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'

export async function GET() {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const [{ data: subs, error }, { data: profiles }] = await Promise.all([
    admin.from('subscriptions').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, email, full_name'),
  ])
  if (error) return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 })

  const profileById = new Map((profiles || []).map((p) => [p.id, p]))
  const subscriptions = (subs || []).map((s) => ({ ...s, user: profileById.get(s.user_id) || null }))

  return NextResponse.json({ subscriptions })
}
