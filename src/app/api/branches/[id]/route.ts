import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

interface Params { params: { id: string } }

// PATCH /api/branches/[id] — { name?, address?, phone?, is_active? }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    const body = await req.json()
    const updates: Record<string, any> = {}
    if (typeof body.name === 'string') updates.name = body.name.trim()
    if (typeof body.address === 'string') updates.address = body.address.trim()
    if (typeof body.phone === 'string') updates.phone = body.phone.trim()
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'কিছু আপডেট করার নেই।' }, { status: 400 })
    }

    // RLS (auth.uid() = user_id) already stops this from touching another
    // owner's branch — the .eq('user_id', ...) below is a second guard.
    const { data, error } = await supabase
      .from('branches')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ branch: data })
  } catch (e: any) {
    console.error('branch PATCH error:', e)
    return NextResponse.json({ error: 'আপডেট করা যায়নি।' }, { status: 500 })
  }
}

// DELETE /api/branches/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'লগইন করা নেই।' }, { status: 401 })

    const { error } = await supabase
      .from('branches')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('branch DELETE error:', e)
    return NextResponse.json({ error: 'ডিলিট করা যায়নি।' }, { status: 500 })
  }
}
