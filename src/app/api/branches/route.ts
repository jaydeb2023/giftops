import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { hasFeature } from '@/lib/planFeatures'

// GET /api/branches — list the logged-in owner's branches
export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ branches: data || [] })
  } catch (e: any) {
    console.error('branches GET error:', e)
    return NextResponse.json({ error: 'তালিকা আনা যায়নি।' }, { status: 500 })
  }
}

// POST /api/branches — { name, address?, phone? }
export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    // Branches is a Business-plan feature — check server-side too, never
    // trust the client-side lock icon alone.
    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) {
      const { data: sub } = await supabase.from('subscriptions').select('plan,status').eq('user_id', user.id).maybeSingle()
      if (!sub || sub.status !== 'active' || !hasFeature(sub.plan, 'branches')) {
        return NextResponse.json({ error: 'ব্রাঞ্চ যোগ করা শুধু Business প্ল্যানে পাওয়া যায়।' }, { status: 403 })
      }
    }

    const body = await req.json()
    const name = String(body?.name || '').trim()
    if (!name) return NextResponse.json({ error: 'ব্রাঞ্চের নাম দিন।' }, { status: 400 })

    const { data, error } = await supabase
      .from('branches')
      .insert({
        user_id: user.id,
        name,
        address: body?.address ? String(body.address).trim() : '',
        phone: body?.phone ? String(body.phone).trim() : '',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ branch: data })
  } catch (e: any) {
    console.error('branches POST error:', e)
    return NextResponse.json({ error: 'ব্রাঞ্চ তৈরি করা যায়নি।' }, { status: 500 })
  }
}
