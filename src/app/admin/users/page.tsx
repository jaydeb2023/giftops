'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Users, TrendingUp, Clock, XCircle, Settings2, X } from 'lucide-react'
import { computeAccess, Subscription } from '@/lib/subscription'
import toast from 'react-hot-toast'

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', starter: 'Starter', business: 'Business', growth: 'Legacy Growth', monthly: 'Legacy ₹199' }

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  is_admin: boolean
  agent_count: number
  subscription: Subscription | null
}

function StatusBadge({ sub }: { sub: Subscription | null }) {
  const { isActive, isTrialing, daysLeftInTrial } = computeAccess(sub)
  if (isActive) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">Active</span>
  if (isTrialing) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">Trial · {daysLeftInTrial}d left</span>
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Expired</span>
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">{icon}{label}</div>
      <div className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'trialing' | 'expired'>('all')
  const [manageFor, setManageFor] = useState<AdminUser | null>(null)
  const [grantStatus, setGrantStatus] = useState<'trialing' | 'active' | 'locked' | 'canceled'>('active')
  const [grantPlan, setGrantPlan] = useState<'basic' | 'starter' | 'business'>('basic')
  const [grantFree, setGrantFree] = useState(true)
  const [grantDays, setGrantDays] = useState('30')
  const [granting, setGranting] = useState(false)

  const reloadUsers = async () => {
    const res = await fetch('/api/admin/users')
    const json = await res.json()
    setUsers(json.users || [])
  }

  useEffect(() => {
    reloadUsers().finally(() => setLoading(false))
  }, [])

  // opened from the top search bar (/admin/users?q=...)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) setSearch(q)
  }, [])

  const openManage = (u: AdminUser) => {
    setManageFor(u)
    setGrantStatus((u.subscription?.status as any) || 'active')
    setGrantPlan((u.subscription?.plan as any) && ['basic', 'starter', 'business'].includes(u.subscription!.plan) ? (u.subscription!.plan as any) : 'basic')
    setGrantFree(!u.subscription?.amount)
    setGrantDays('30')
  }

  const submitGrant = async () => {
    if (!manageFor) return
    setGranting(true)
    const res = await fetch('/api/admin/grant-access', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: manageFor.id, status: grantStatus, plan: grantPlan, complimentary: grantFree, extend_days: Number(grantDays) || 30 }),
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed to update access') }
    else { toast.success('Access updated'); setManageFor(null); reloadUsers() }
    setGranting(false)
  }

  const stats = {
    total: users.length,
    active: users.filter((u) => computeAccess(u.subscription).isActive).length,
    trialing: users.filter((u) => computeAccess(u.subscription).isTrialing).length,
    expired: users.filter((u) => computeAccess(u.subscription).isExpired).length,
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch = u.email.toLowerCase().includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filter === 'all') return true
    const access = computeAccess(u.subscription)
    if (filter === 'active') return access.isActive
    if (filter === 'trialing') return access.isTrialing
    if (filter === 'expired') return access.isExpired
    return true
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Users</h1>
      <p className="text-gray-400 text-sm mb-6">Every signup, their trial/subscription status, and agent count</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Users size={16} />} label="Total users" value={stats.total} />
        <StatCard icon={<TrendingUp size={16} />} label="Active subs" value={stats.active} accent="text-emerald-600" />
        <StatCard icon={<Clock size={16} />} label="On trial" value={stats.trialing} accent="text-amber-600" />
        <StatCard icon={<XCircle size={16} />} label="Expired" value={stats.expired} accent="text-gray-400" />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(['all', 'active', 'trialing', 'expired'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                filter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Agents</th>
                <th className="px-4 py-3 font-medium">Last payment</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{u.full_name || '—'}</div>
                    <div className="text-gray-400 text-xs">
                      {u.email} {u.is_admin && <span className="text-violet-500 font-semibold">· admin</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3"><StatusBadge sub={u.subscription} /></td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.subscription?.plan ? (PLAN_LABEL[u.subscription.plan] || u.subscription.plan) : '—'}
                    {u.subscription?.amount === 0 && u.subscription?.plan && (
                      <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600">FREE</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.agent_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {u.subscription?.last_payment_at ? new Date(u.subscription.last_payment_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => openManage(u)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                      <Settings2 size={12} /> Manage
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No users match.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {manageFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setManageFor(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900">Manage access</h3>
              <button onClick={() => setManageFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-gray-400 text-xs mb-4">{manageFor.email}</p>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
            <select value={grantStatus} onChange={(e) => setGrantStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3">
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="canceled">Canceled</option>
            </select>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Plan</label>
            <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3">
              <option value="basic">Basic (1 agent, ₹99)</option>
              <option value="starter">Starter (3 agents, ₹199)</option>
              <option value="business">Business (unlimited, custom)</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <input type="checkbox" checked={grantFree} onChange={(e) => setGrantFree(e.target.checked)} className="rounded" />
              Complimentary (no charge / free)
            </label>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              {grantStatus === 'trialing' ? 'Extend trial by (days)' : 'Access period (days)'}
            </label>
            <input type="number" value={grantDays} onChange={(e) => setGrantDays(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-5" />

            <button onClick={submitGrant} disabled={granting}
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm disabled:opacity-50">
              {granting ? 'Saving...' : 'Save access'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
