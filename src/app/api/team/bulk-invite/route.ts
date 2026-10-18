import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'
import { resolveEffectiveAccess } from '@/lib/teamAccess'
import { logAudit } from '@/lib/auditLog'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

interface BulkRow { name?: string; mobile?: string; email: string; positionTitle?: string }

// POST /api/team/bulk-invite — { userId, rows: BulkRow[] }
// Used by the "Import Excel" button: the client parses the workbook into
// rows client-side (name/mobile/email/position columns) and posts them
// here in one batch. Each row is invited independently — one bad row
// (missing/duplicate email) doesn't block the rest, and the response
// reports per-row success/failure so the UI can show a clear summary.
export async function POST(req: Request) {
  try {
    const { userId, rows } = await req.json()
    if (!userId) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: 'কোনো সারি পাওয়া যায়নি।' }, { status: 400 })
    if (rows.length > 200) return NextResponse.json({ error: 'একবারে সর্বোচ্চ ২০০ জন যোগ করা যায়।' }, { status: 400 })

    const supabase = getServiceClient()
    const access = await resolveEffectiveAccess(supabase, userId)
    if (access.role !== 'owner') {
      return NextResponse.json({ error: 'শুধু owner একাউন্ট থেকে টিম মেম্বার যোগ করা যায়।' }, { status: 403 })
    }

    const { data: sub } = await supabase.from('subscriptions').select('plan,status').eq('user_id', userId).maybeSingle()
    if (!sub || sub.status !== 'active' || sub.plan !== 'business') {
      return NextResponse.json({ error: 'টিম মেম্বার যোগ করা শুধু Business প্ল্যানে পাওয়া যায়।' }, { status: 403 })
    }

    const results: { email: string; ok: boolean; error?: string }[] = []

    for (const row of rows as BulkRow[]) {
      const email = String(row.email || '').trim().toLowerCase()
      if (!email || !email.includes('@')) {
        results.push({ email: row.email || '(খালি)', ok: false, error: 'সঠিক ইমেইল নেই' })
        continue
      }
      const inviteToken = randomUUID()
      const { error: insertErr } = await supabase.from('team_members').insert({
        owner_user_id: userId,
        email,
        name: row.name ? String(row.name).trim() : null,
        mobile: row.mobile ? String(row.mobile).trim() : null,
        position_title: row.positionTitle ? String(row.positionTitle).trim() : null,
        role: 'sales',
        status: 'invited',
        invite_token: inviteToken,
      })
      if (insertErr) {
        results.push({ email, ok: false, error: insertErr.message?.includes('duplicate') ? 'আগেই যোগ করা আছে' : 'সেভ করা যায়নি' })
        continue
      }
      results.push({ email, ok: true })
    }

    const successCount = results.filter(r => r.ok).length
    await logAudit(supabase, {
      ownerUserId: userId,
      actorId: userId,
      action: 'team.bulk_invite',
      targetTable: 'team_members',
      details: { total: rows.length, success: successCount },
    })

    return NextResponse.json({ results, successCount })
  } catch (e) {
    console.error('team/bulk-invite error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন।' }, { status: 500 })
  }
}
