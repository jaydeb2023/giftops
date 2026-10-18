import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'
import { PLAN_AMOUNTS_PAISE } from '@/lib/planLimits'

/**
 * Creates a Razorpay Payment Link scoped to the logged-in user
 * (reference_id = user id) so the webhook can tell whose payment it is.
 * Docs: https://razorpay.com/docs/api/payments/payment-links/
 */
export async function POST(req: NextRequest) {
  const supabase = createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const plan: string = body?.plan === 'starter' ? 'starter' : 'basic' // 'business' is never sold here
  const amount = PLAN_AMOUNTS_PAISE[plan] ?? PLAN_AMOUNTS_PAISE.basic

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const res = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      accept_partial: false,
      description: `Kaaj AI — ${plan === 'starter' ? 'Starter' : 'Basic'} Monthly Subscription`,
      customer: {
        email: user.email,
      },
      notify: { sms: false, email: true },
      reference_id: user.id,
      callback_url: `${appUrl}/subscribe?status=success&plan=${plan}`,
      callback_method: 'get',
      notes: {
        user_id: user.id,
        plan,
      },
    }),
  })

  const link = await res.json()

  if (!res.ok) {
    console.error('Razorpay create-link error', link)
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 })
  }

  // Save the link id + chosen plan against the user's subscription row so the
  // webhook can cross-check, and so `plan` is set even before payment completes.
  const admin = createAdminClient()
  await admin
    .from('subscriptions')
    .update({ razorpay_payment_link_id: link.id, plan, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ short_url: link.short_url })
}
