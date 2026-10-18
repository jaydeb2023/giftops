import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { hasPermission } from '@/lib/permissions'
import { isApprovableTable } from '@/lib/approvals'
import { logAudit } from '@/lib/auditLog'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

// POST /api/approvals — { userId, tableName, recordId, recordLabel?, reason? }
export async function POST(req: NextRequest) {
  try {
    const { userId, tableName, recordId, recordLabel, reason } = await req.json()
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })
    if (!tableName || !isApprovableTable(tableName)) return NextResponse.json({ error: 'অবৈধ টেবিল।' }, { status: 400 })
    if (!recordId) return NextResponse.json({ error: 'recordId লাগবে।' }, { status: 400 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)

    if (hasPermission(access, 'delete_records')) {
      return NextResponse.json({ error: 'আপনার সরাসরি ডিলিট করার অনুমতি আছে, অনুরোধের দরকার নেই।' }, { status: 400 })
    }

    const { data, error } = await supabase.from('approval_requests').insert({
      owner_user_id: access.ownerId,
      requested_by: userId,
      team_member_id: access.teamMemberId,
      table_name: tableName,
      record_id: recordId,
      record_label: recordLabel ? String(recordLabel).slice(0, 200) : '',
      reason: reason ? String(reason).slice(0, 500) : '',
    }).select().single()

    if (error) throw error

    await logAudit(supabase, {
      ownerUserId: access.ownerId,
      actorId: userId,
      action: 'approval.request',
      targetTable: tableName,
      targetId: recordId,
      details: { reason },
    })

    return NextResponse.json({ request: data })
  } catch (e: any) {
    console.error('approvals POST error:', e)
    return NextResponse.json({ error: 'অনুরোধ পাঠানো যায়নি।' }, { status: 500 })
  }
}

// GET /api/approvals?userId=...&status=pending — list requests for review.
export async function GET(req: NextRequest) {
  try {
    const userId = new URL(req.url).searchParams.get('userId')
    const status = new URL(req.url).searchParams.get('status') || 'pending'
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (!hasPermission(access, 'delete_records')) {
      return NextResponse.json({ error: 'অনুমোদন দেখার অনুমতি নেই।' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('owner_user_id', access.ownerId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ requests: data || [] })
  } catch (e: any) {
    console.error('approvals GET error:', e)
    return NextResponse.json({ error: 'তালিকা আনা যায়নি।' }, { status: 500 })
  }
}
