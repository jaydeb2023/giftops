import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateAgentWithAI } from '@/lib/agentUtils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, category, business_type, tools } = body

    if (!name || !description) {
      return NextResponse.json({ error: 'Name and description required' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    const generated = await generateAgentWithAI({ name, description, category, business_type, tools })

    const { data, error } = await supabase
      .from('agents')
      .insert({
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        name,
        name_bn: name,
        description,
        description_bn: description,
        category,
        business_type: business_type || 'general',
        tools,
        system_prompt: generated.system_prompt,
        icon: generated.icon,
        color: generated.color,
        is_public: false,
        is_featured: false,
        use_count: 0,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ agent: data })
  } catch (error: any) {
    console.error('Create agent error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const publicOnly = searchParams.get('public') === 'true'

    let query = supabase.from('agents').select('*').order('use_count', { ascending: false })

    if (category) query = query.eq('category', category)
    if (publicOnly) query = query.eq('is_public', true)

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ agents: data })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
