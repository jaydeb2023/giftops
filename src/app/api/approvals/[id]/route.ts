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

interface Params { params: { id: string } }

// PATCH /api/approvals/[id] — { userId, action: 'approve' | 'reject' }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId, action } = await req.json()
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })
    if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'অবৈধ action।' }, { status: 400 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (!hasPermission(access, 'delete_records')) {
      return NextResponse.json({ error: 'অনুমোদনের অনুমতি নেই।' }, { status: 403 })
    }

    const { data: reqRow } = await supabase.from('approval_requests').select('*').eq('id', params.id).maybeSingle()
    if (!reqRow || reqRow.owner_user_id !== access.ownerId) {
      return NextResponse.json({ error: 'এই অনুরোধ পাওয়া যায়নি।' }, { status: 404 })
    }
    if (reqRow.status !== 'pending') {
      return NextResponse.json({ error: 'এই অনুরোধ আগেই রিভিউ হয়ে গেছে।' }, { status: 400 })
    }

    if (action === 'approve') {
      if (!isApprovableTable(reqRow.table_name)) {
        return NextResponse.json({ error: 'অবৈধ টেবিল — ডিলিট করা যায়নি।' }, { status: 400 })
      }
      const { error: delErr } = await supabase
        .from(reqRow.table_name)
        .delete()
        .eq('id', reqRow.record_id)
        .eq('user_id', reqRow.owner_user_id)
      if (delErr) {
        console.error('approval delete error:', delErr.message)
        return NextResponse.json({ error: 'ডিলিট করা যায়নি।' }, { status: 500 })
      }
    }

    await supabase.from('approval_requests').update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', params.id)

    await logAudit(supabase, {
      ownerUserId: access.ownerId,
      actorId: userId,
      action: action === 'approve' ? 'approval.approve' : 'approval.reject',
      targetTable: reqRow.table_name,
      targetId: reqRow.record_id,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('approvals PATCH error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে।' }, { status: 500 })
  }
}
