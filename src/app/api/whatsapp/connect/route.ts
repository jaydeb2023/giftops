import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabaseServer'
import { verifyCredentials } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

/** GET — current connection (token never leaves the server). */
export async function GET() {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await db
    .from('whatsapp_accounts')
    .select('id, phone_number_id, waba_id, display_phone, verified_name, status, auto_reply, ai_tone, language, business_hours_start, business_hours_end, away_message, greeting_message, handoff_keywords, last_error, connected_at')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({ account: data ?? null })
}

/** POST — connect (or re-connect) a WhatsApp Business number. */
export async function POST(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone_number_id, access_token, waba_id } = await req.json()
  if (!phone_number_id || !access_token) {
    return NextResponse.json(
      { error: 'Phone Number ID এবং Access Token দুটোই দিন।' },
      { status: 400 }
    )
  }

  // Fail fast if Meta rejects the credentials — don't store a dead connection.
  let profile
  try {
    profile = await verifyCredentials(String(phone_number_id).trim(), String(access_token).trim())
  } catch (e: any) {
    return NextResponse.json(
      { error: `Meta যাচাই করতে পারেনি: ${e.message}` },
      { status: 400 }
    )
  }

  const payload = {
    user_id: user.id,
    phone_number_id: String(phone_number_id).trim(),
    waba_id: waba_id ? String(waba_id).trim() : null,
    access_token: String(access_token).trim(),
    display_phone: profile.display_phone ?? null,
    verified_name: profile.verified_name ?? null,
    status: 'connected',
    last_error: null,
    connected_at: new Date().toISOString(),
  }

  const { data, error } = await db
    .from('whatsapp_accounts')
    .upsert(payload, { onConflict: 'user_id' })
    .select('id, phone_number_id, display_phone, verified_name, status, connected_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'এই নম্বরটি ইতিমধ্যে অন্য অ্যাকাউন্টে কানেক্ট করা আছে।' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ account: data, quality: profile.quality_rating })
}

/** PATCH — update behaviour settings (auto-reply, hours, tone, messages). */
export async function PATCH(req: NextRequest) {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const ALLOWED = [
    'auto_reply', 'ai_tone', 'language', 'business_hours_start',
    'business_hours_end', 'away_message', 'greeting_message', 'handoff_keywords',
  ]
  const patch: Record<string, any> = {}
  for (const k of ALLOWED) if (k in body) patch[k] = body[k]
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'কিছু পরিবর্তন পাওয়া যায়নি।' }, { status: 400 })
  }

  const { data, error } = await db
    .from('whatsapp_accounts')
    .update(patch)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { access_token, ...safe } = data as any
  return NextResponse.json({ account: safe })
}

/** DELETE — disconnect. */
export async function DELETE() {
  const db = createRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await db.from('whatsapp_accounts').delete().eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
