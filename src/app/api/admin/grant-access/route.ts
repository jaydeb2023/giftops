import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'
import { PLAN_AMOUNTS_PAISE } from '@/lib/planLimits'

// Business has no fixed self-checkout amount (sold manually, custom pricing) —
// use 0 here so the admin dashboard's MRR estimate doesn't misreport it;
// adjust the actual `amount` for a given user by hand if you want it counted.
const PLAN_AMOUNTS: Record<string, number> = {
  ...PLAN_AMOUNTS_PAISE, // basic: 9900, starter: 19900
  business: 0,
}

export async function POST(req: Request) {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { user_id, status, plan, complimentary, extend_days } = body as {
    user_id: string
    status: 'trialing' | 'active' | 'locked' | 'canceled'
    plan: 'basic' | 'starter' | 'business'
    complimentary: boolean
    extend_days: number
  }

  if (!user_id || !status || !plan) {
    return NextResponse.json({ error: 'user_id, status, and plan are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const days = Number(extend_days) || 30
  const now = new Date()

  const update: any = {
    user_id, status, plan,
    amount: complimentary ? 0 : (PLAN_AMOUNTS[plan] || 0),
    updated_at: now.toISOString(),
  }

  if (status === 'trialing') {
    update.trial_ends_at = new Date(now.getTime() + days * 86400000).toISOString()
  } else if (status === 'active') {
    update.current_period_end = new Date(now.getTime() + days * 86400000).toISOString()
    // trial_ends_at is NOT NULL in the schema — keep it satisfied even for
    // users who are granted active access without ever trialing.
    update.trial_ends_at = update.trial_ends_at || now.toISOString()
  }

  const { data: existing } = await admin.from('subscriptions').select('id, trial_ends_at').eq('user_id', user_id).maybeSingle()

  if (existing) {
    if (!update.trial_ends_at) update.trial_ends_at = existing.trial_ends_at
    const { error } = await admin.from('subscriptions').update(update).eq('user_id', user_id)
    if (error) { console.error('subscriptions update (admin grant):', error); return NextResponse.json({ error: error.message }, { status: 500 }) }
  } else {
    if (!update.trial_ends_at) update.trial_ends_at = now.toISOString()
    const { error } = await admin.from('subscriptions').insert(update)
    if (error) { console.error('subscriptions insert (admin grant):', error); return NextResponse.json({ error: error.message }, { status: 500 }) }
  }

  return NextResponse.json({ ok: true })
}
