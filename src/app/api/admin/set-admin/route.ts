import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'

export async function PATCH(req: Request) {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, is_admin } = await req.json()
  if (!user_id || typeof is_admin !== 'boolean') {
    return NextResponse.json({ error: 'user_id and is_admin are required' }, { status: 400 })
  }
  if (user_id === user.id && !is_admin) {
    return NextResponse.json({ error: "You can't remove your own admin access" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('profiles').update({ is_admin }).eq('id', user_id)
  if (error) return NextResponse.json({ error: 'Failed to update' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
