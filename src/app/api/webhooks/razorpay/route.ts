import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

/**
 * Razorpay webhook.
 * Configure in Razorpay Dashboard → Settings → Webhooks:
 *   URL:    https://YOUR_DOMAIN/api/webhooks/razorpay
 *   Events: payment_link.paid
 *   Secret: put the same value in RAZORPAY_WEBHOOK_SECRET
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  if (expectedSignature !== signature) {
    console.error('Razorpay webhook: invalid signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === 'payment_link.paid') {
    const paymentLink = event.payload?.payment_link?.entity
    const payment = event.payload?.payment?.entity

    const userId: string | undefined = paymentLink?.notes?.user_id || paymentLink?.reference_id
    const paidPlan: string | undefined = paymentLink?.notes?.plan

    if (!userId) {
      console.error('Razorpay webhook: no user_id on payment_link', paymentLink?.id)
      return NextResponse.json({ received: true })
    }

    const admin = createAdminClient()
    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + 30)

    const update: Record<string, any> = {
      status: 'active',
      current_period_end: periodEnd.toISOString(),
      razorpay_payment_id: payment?.id ?? null,
      last_payment_at: now.toISOString(),
      updated_at: now.toISOString(),
    }
    // Only 'basic' and 'starter' are ever sold through Razorpay — 'business'
    // is granted manually via /admin, so we never overwrite a plan with
    // something unexpected here.
    if (paidPlan === 'basic' || paidPlan === 'starter') {
      update.plan = paidPlan
    }

    const { error } = await admin
      .from('subscriptions')
      .update(update)
      .eq('user_id', userId)

    if (error) {
      console.error('Razorpay webhook: failed to update subscription', error)
      return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
