import { NextResponse } from 'next/server'
import { createRouteClient, createAdminClient } from '@/lib/supabaseServer'

type Sub = {
  user_id: string
  status: string
  plan: string
  amount: number
  trial_ends_at: string
  current_period_end: string | null
  last_payment_at: string | null
  created_at: string
}

// Pure re-derivation of access state from dates, same rule as src/lib/subscription.ts,
// duplicated here so this server route has no client-side supabase import.
function bucketFor(sub: Sub | undefined, now: number): 'active' | 'trialing' | 'expired' {
  if (!sub) return 'expired'
  const trialEnds = new Date(sub.trial_ends_at).getTime()
  const periodEnds = sub.current_period_end ? new Date(sub.current_period_end).getTime() : null
  if (sub.status === 'trialing' && now < trialEnds) return 'trialing'
  if (sub.status === 'active' && periodEnds !== null && now < periodEnds) return 'active'
  return 'expired'
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const supabase = createRouteClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!callerProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [{ data: profiles }, { data: subs }, { data: agents }, { data: conversations }] = await Promise.all([
    admin.from('profiles').select('id, email, full_name, created_at').order('created_at', { ascending: false }),
    admin.from('subscriptions').select('user_id, status, plan, amount, trial_ends_at, current_period_end, last_payment_at, created_at'),
    admin.from('agents').select('id, user_id, name, name_bn, category, is_public, is_featured, use_count, created_at').order('created_at', { ascending: false }),
    admin.from('conversations').select('agent_id'),
  ])

  const now = Date.now()
  const subByUser = new Map((subs || []).map((s) => [s.user_id, s as Sub]))
  const profileById = new Map((profiles || []).map((p) => [p.id, p]))

  // ---- Users buckets ----
  const buckets = (profiles || []).map((p) => bucketFor(subByUser.get(p.id), now))
  const totalUsers = profiles?.length || 0
  const activeUsers = buckets.filter((b) => b === 'active').length
  const trialUsers = buckets.filter((b) => b === 'trialing').length
  const expiredUsers = buckets.filter((b) => b === 'expired').length
  const newThisMonth = (profiles || []).filter((p) => {
    const c = new Date(p.created_at)
    const n = new Date()
    return c.getFullYear() === n.getFullYear() && c.getMonth() === n.getMonth()
  }).length

  // ---- Agents ----
  const totalAgents = agents?.length || 0
  const featuredAgents = (agents || []).filter((a) => a.is_featured).length
  const publicNonFeatured = (agents || []).filter((a) => a.is_public && !a.is_featured).length
  const privateAgents = (agents || []).filter((a) => !a.is_public).length

  // ---- Conversations per agent ----
  const convCountByAgent = new Map<string, number>()
  ;(conversations || []).forEach((c: any) => {
    convCountByAgent.set(c.agent_id, (convCountByAgent.get(c.agent_id) || 0) + 1)
  })

  // ---- MRR ----
  const mrr = (subs || [])
    .filter((s) => bucketFor(s as Sub, now) === 'active')
    .reduce((sum, s) => sum + (s.amount || 0), 0) / 100

  // ---- Top plans by revenue ----
  const planMap = new Map<string, { subscribers: number; mrr: number }>()
  ;(subs || []).forEach((s) => {
    if (bucketFor(s as Sub, now) !== 'active') return
    const key = s.plan || 'unknown'
    const cur = planMap.get(key) || { subscribers: 0, mrr: 0 }
    cur.subscribers += 1
    cur.mrr += (s.amount || 0) / 100
    planMap.set(key, cur)
  })
  const topPlans = Array.from(planMap.entries())
    .map(([plan, v]) => ({ plan, ...v }))
    .sort((a, b) => b.mrr - a.mrr)

  // ---- 30-day user growth (cumulative signups, split by *current* status bucket) ----
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(dayKey(d))
  }
  const growth = days.map((day) => {
    const cutoff = new Date(day + 'T23:59:59Z').getTime()
    let total = 0, active = 0, trialing = 0, expired = 0
    ;(profiles || []).forEach((p) => {
      if (new Date(p.created_at).getTime() > cutoff) return
      total++
      const b = bucketFor(subByUser.get(p.id), now)
      if (b === 'active') active++
      else if (b === 'trialing') trialing++
      else expired++
    })
    return { day, total, active, trialing, expired }
  })

  // ---- 30-day revenue trend (sum of amount by last_payment_at day; only latest payment per user is stored) ----
  const revenueByDay = new Map<string, number>()
  ;(subs || []).forEach((s) => {
    if (!s.last_payment_at) return
    const key = dayKey(new Date(s.last_payment_at))
    revenueByDay.set(key, (revenueByDay.get(key) || 0) + (s.amount || 0) / 100)
  })
  const revenueTrend = days.map((day) => ({ day, amount: revenueByDay.get(day) || 0 }))

  // ---- Recent signups ----
  const recentSignups = (profiles || []).slice(0, 5).map((p) => ({
    id: p.id,
    email: p.email,
    full_name: p.full_name,
    created_at: p.created_at,
  }))

  // ---- Latest agents ----
  const latestAgents = (agents || []).slice(0, 5).map((a) => ({
    id: a.id,
    name: a.name,
    name_bn: a.name_bn,
    is_public: a.is_public,
    is_featured: a.is_featured,
    created_at: a.created_at,
    owner_email: profileById.get(a.user_id)?.email || null,
  }))

  // ---- Top agents by use ----
  const topAgents = [...(agents || [])]
    .sort((a, b) => (b.use_count || 0) - (a.use_count || 0))
    .slice(0, 5)
    .map((a) => ({
      id: a.id,
      name: a.name,
      use_count: a.use_count || 0,
      conversations: convCountByAgent.get(a.id) || 0,
      is_public: a.is_public,
      is_featured: a.is_featured,
    }))

  return NextResponse.json({
    stats: { totalUsers, activeUsers, trialUsers, expiredUsers, newThisMonth, totalAgents, featuredAgents, publicNonFeatured, privateAgents, mrr },
    growth,
    revenueTrend,
    topPlans,
    recentSignups,
    latestAgents,
    topAgents,
  })
}
