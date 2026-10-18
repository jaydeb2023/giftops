import { supabase } from '@/lib/supabaseClient'

export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled'

export interface Subscription {
  id: string
  user_id: string
  status: SubscriptionStatus
  plan: string
  amount: number
  trial_ends_at: string
  current_period_end: string | null
  razorpay_payment_link_id: string | null
  razorpay_payment_id: string | null
  last_payment_at: string | null
  created_at: string
  updated_at: string
}

export interface AccessState {
  subscription: Subscription | null
  hasAccess: boolean
  isTrialing: boolean
  isActive: boolean
  isExpired: boolean
  daysLeftInTrial: number
  loading: boolean
}

/**
 * Computes whether the current status + dates give the user access right now.
 * A row can be stale (e.g. status still 'trialing' after trial_ends_at passed)
 * because we only flip status on payment events / periodic checks — so we
 * always re-derive from the dates rather than trusting `status` alone.
 */
export function computeAccess(sub: Subscription | null): {
  hasAccess: boolean
  isTrialing: boolean
  isActive: boolean
  isExpired: boolean
  daysLeftInTrial: number
} {
  if (!sub) {
    return { hasAccess: false, isTrialing: false, isActive: false, isExpired: true, daysLeftInTrial: 0 }
  }

  const now = Date.now()
  const trialEnds = new Date(sub.trial_ends_at).getTime()
  const periodEnds = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null

  const stillInTrial = sub.status === 'trialing' && now < trialEnds
  const stillActivePaid = sub.status === 'active' && periodEnds !== null && now < periodEnds

  const daysLeftInTrial = stillInTrial ? Math.max(0, Math.ceil((trialEnds - now) / (1000 * 60 * 60 * 24))) : 0

  return {
    hasAccess: stillInTrial || stillActivePaid,
    isTrialing: stillInTrial,
    isActive: stillActivePaid,
    isExpired: !stillInTrial && !stillActivePaid,
    daysLeftInTrial,
  }
}

export async function fetchSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('fetchSubscription error', error)
    return null
  }
  return data as Subscription | null
}
