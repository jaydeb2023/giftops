'use client'

import { useEffect, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { computeAccess, Subscription } from '@/lib/subscription'

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', starter: 'Starter', business: 'Business', growth: 'Legacy Growth', monthly: 'Legacy ₹199' }

interface Row extends Subscription { user: { email: string; full_name: string | null } | null }

function StatusBadge({ sub }: { sub: Subscription }) {
  const { isActive, isTrialing, daysLeftInTrial } = computeAccess(sub)
  if (isActive) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">Active</span>
  if (isTrialing) return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">Trial · {daysLeftInTrial}d left</span>
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Expired</span>
}

export default function SubscriptionsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')

  useEffect(() => {
    fetch('/api/admin/subscriptions').then((r) => r.json()).then((j) => { setRows(j.subscriptions || []); setLoading(false) })
  }, [])

  const plans = Array.from(new Set(rows.map((r) => r.plan)))
  const filtered = rows.filter((r) => {
    const q = search.toLowerCase()
    const matches = !q || (r.user?.email || '').toLowerCase().includes(q) || (r.user?.full_name || '').toLowerCase().includes(q)
    if (!matches) return false
    if (planFilter !== 'all' && r.plan !== planFilter) return false
    return true
  })

  const totalActive = rows.filter((r) => computeAccess(r).isActive).length
  const mrr = rows.filter((r) => computeAccess(r).isActive).reduce((s, r) => s + (r.amount || 0), 0) / 100

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Subscriptions</h1>
      <p className="text-gray-400 text-sm mb-6">{totalActive} active · ₹{mrr.toLocaleString('en-IN')} MRR</p>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user email or name..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400" />
        </div>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
          <option value="all">All plans</option>
          {plans.map((p) => <option key={p} value={p}>{PLAN_LABEL[p] || p}</option>)}
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Period ends</th>
                <th className="px-4 py-3 font-medium">Last payment</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{r.user?.full_name || '—'}</div>
                    <div className="text-gray-400 text-xs">{r.user?.email}</div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge sub={r} /></td>
                  <td className="px-4 py-3 text-gray-600">{PLAN_LABEL[r.plan] || r.plan}</td>
                  <td className="px-4 py-3 text-gray-600">₹{((r.amount || 0) / 100).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-500">{r.current_period_end ? new Date(r.current_period_end).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.last_payment_at ? new Date(r.last_payment_at).toLocaleDateString('en-IN') : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No subscriptions match.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
