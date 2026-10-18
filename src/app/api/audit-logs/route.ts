import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { hasPermission } from '@/lib/permissions'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

// GET /api/audit-logs?userId=...&limit=50
// Visible to the owner, or a team member with manage_team (the same
// people who can already see/manage the team, can see what happened).
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (!hasPermission(access, 'manage_team')) {
      return NextResponse.json({ error: 'অডিট লগ দেখার অনুমতি নেই।' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('owner_user_id', access.ownerId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return NextResponse.json({ logs: data || [] })
  } catch (e: any) {
    console.error('audit-logs GET error:', e)
    return NextResponse.json({ error: 'লগ আনা যায়নি।' }, { status: 500 })
  }
}
