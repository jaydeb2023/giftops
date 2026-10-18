import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceKey)
}

// POST /api/team/accept — { token, password }
// Creates the employee's own login and links it to the owner's invite.
// The frontend still has to call supabase.auth.signInWithPassword itself
// afterwards — this route only creates the account and does the linking,
// it never returns a session.
export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()
    if (!token) return NextResponse.json({ error: 'অবৈধ লিংক।' }, { status: 400 })
    if (!password || String(password).length < 6) return NextResponse.json({ error: 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।' }, { status: 400 })

    const supabase = getServiceClient()
    const { data: invite } = await supabase.from('team_members').select('id, email, status').eq('invite_token', token).maybeSingle()
    if (!invite || invite.status !== 'invited') {
      return NextResponse.json({ error: 'এই invite লিংকটা আর কার্যকর নেই।' }, { status: 400 })
    }

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    })

    if (createErr || !created?.user) {
      console.error('team/accept createUser error:', createErr?.message)
      const alreadyExists = createErr?.message?.toLowerCase().includes('already') || createErr?.message?.toLowerCase().includes('registered')
      return NextResponse.json({
        error: alreadyExists
          ? 'এই ইমেইলে আগে থেকেই একটা একাউন্ট আছে। মালিকের সাথে যোগাযোগ করুন।'
          : 'একাউন্ট তৈরি করা যায়নি।',
      }, { status: 400 })
    }

    const { error: linkErr } = await supabase.from('team_members').update({
      member_user_id: created.user.id,
      status: 'active',
      invite_token: null,
      last_active_at: new Date().toISOString(),
    }).eq('id', invite.id)

    if (linkErr) {
      console.error('team/accept link error:', linkErr.message)
      return NextResponse.json({ error: 'একাউন্ট তৈরি হয়েছে কিন্তু লিংক করা যায়নি। মালিকের সাথে যোগাযোগ করুন।' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, email: invite.email })
  } catch (e) {
    console.error('team/accept error:', e)
    return NextResponse.json({ error: 'সমস্যা হয়েছে, আবার চেষ্টা করুন।' }, { status: 500 })
  }
}
