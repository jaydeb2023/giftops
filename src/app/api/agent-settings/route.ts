// src/app/api/agent-settings/route.ts
// Saves and fetches per-agent settings (business name, currency, location)

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const { data } = await supabase
      .from('agent_settings')
      .select('settings')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({ settings: data?.settings || {} })
  } catch (error: any) {
    return NextResponse.json({ settings: {} })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { agentId, settings } = await req.json()
    if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

    const { error } = await supabase
      .from('agent_settings')
      .upsert({
        user_id:  user.id,
        agent_id: agentId,
        settings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agent_id' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
