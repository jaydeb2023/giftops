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

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const admin = createAdminClient()

  const [{ data: agents, error: agentsError }, { data: profiles }] = await Promise.all([
    admin.from('agents').select('*').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, email, full_name'),
  ])

  if (agentsError) {
    console.error('admin/agents GET:', agentsError)
    return NextResponse.json({ error: 'Failed to load agents' }, { status: 500 })
  }

  const ownerById = new Map((profiles || []).map((p) => [p.id, p]))

  const enriched = (agents || []).map((a) => ({
    ...a,
    owner: ownerById.get(a.user_id) || null,
  }))

  return NextResponse.json({ agents: enriched })
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await req.json()
  const {
    user_id, name, name_bn, description, description_bn,
    category, tools, system_prompt, icon, color,
    is_public, is_featured,
  } = body as {
    user_id: string
    name: string
    name_bn?: string
    description: string
    description_bn?: string
    category: string
    tools?: string[]
    system_prompt: string
    icon?: string
    color?: string
    is_public?: boolean
    is_featured?: boolean
  }

  if (!user_id || !name || !description || !category || !system_prompt) {
    return NextResponse.json(
      { error: 'user_id, name, description, category, and system_prompt are required' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data, error: insertError } = await admin
    .from('agents')
    .insert({
      user_id,
      name,
      name_bn: name_bn || name,
      description,
      description_bn: description_bn || description,
      category,
      tools: tools && tools.length ? tools : ['memory', 'calculations'],
      system_prompt,
      icon: icon || '⚡',
      color: color || '#EEF2FF',
      is_public: !!is_public,
      is_featured: !!is_featured,
      use_count: 0,
    })
    .select()
    .single()

  if (insertError) {
    console.error('admin/agents POST:', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ agent: data })
}
