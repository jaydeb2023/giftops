import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'

async function requireAdmin() {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { user }
}

const EDITABLE_FIELDS = [
  'name', 'name_bn', 'description', 'description_bn',
  'category', 'tools', 'system_prompt', 'icon', 'color',
  'is_public', 'is_featured', 'user_id',
] as const

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const update: Record<string, any> = { updated_at: new Date().toISOString() }

  for (const field of EDITABLE_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error: updateError } = await admin
    .from('agents')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (updateError) {
    console.error('admin/agents PATCH:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ agent: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error

  const admin = createAdminClient()
  // Conversations for this agent cascade-delete automatically (FK ON DELETE CASCADE).
  const { error: deleteError } = await admin.from('agents').delete().eq('id', params.id)

  if (deleteError) {
    console.error('admin/agents DELETE:', deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
