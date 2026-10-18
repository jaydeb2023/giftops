import { Subscription } from '@/lib/subscription'

// How many agents (library + custom, combined) each paid plan allows.
// 'trial' isn't a real `plan` value in the DB — trialing users are always
// capped at 1 regardless of what plan they eventually pick.
export const PLAN_AGENT_LIMITS: Record<string, number> = {
  basic: 1,
  starter: 3,
  business: Infinity,
}

export const PLAN_LABELS: Record<string, { name_bn: string; price_bn: string; limit_bn: string }> = {
  basic:    { name_bn: 'Basic',    price_bn: '₹৯৯/মাস',       limit_bn: '১টি এজেন্ট' },
  starter:  { name_bn: 'Starter',  price_bn: '₹১৯৯/মাস',      limit_bn: 'সর্বোচ্চ ৩টি এজেন্ট' },
  business: { name_bn: 'Business', price_bn: 'কাস্টম প্রাইসিং', limit_bn: 'আনলিমিটেড এজেন্ট + কাস্টম বিল্ড' },
}

// Representative monthly amounts in paise per self-checkout plan. 'business'
// has no fixed amount — it's sold manually (WhatsApp → admin grant-access),
// never through Razorpay, so it's intentionally left out here.
export const PLAN_AMOUNTS_PAISE: Record<string, number> = {
  basic: 9900,     // ₹99
  starter: 19900,  // ₹199
}

/** How many agents (library + custom, combined) this subscription currently allows. */
export function getAgentLimit(sub: Subscription | null): number {
  if (!sub) return 0
  if (sub.status === 'trialing') return 1
  if (sub.status === 'active') return PLAN_AGENT_LIMITS[sub.plan] ?? 1
  return 0
}
