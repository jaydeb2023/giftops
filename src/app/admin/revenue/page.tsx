'use client'

import { useEffect, useState } from 'react'
import { Loader2, IndianRupee } from 'lucide-react'
import { computeAccess, Subscription } from '@/lib/subscription'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', starter: 'Starter', business: 'Business', growth: 'Legacy Growth', monthly: 'Legacy ₹199' }

export default function RevenuePage() {
  const [rows, setRows] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/subscriptions').then((r) => r.json()).then((j) => { setRows(j.subscriptions || []); setLoading(false) })
  }, [])

  const active = rows.filter((r) => computeAccess(r).isActive)
  const mrr = active.reduce((s, r) => s + (r.amount || 0), 0) / 100
  const free = active.filter((r) => !r.amount).length
  const paying = active.length - free

  const byPlan = new Map<string, { subscribers: number; mrr: number }>()
  active.forEach((r) => {
    const cur = byPlan.get(r.plan) || { subscribers: 0, mrr: 0 }
    cur.subscribers += 1
    cur.mrr += (r.amount || 0) / 100
    byPlan.set(r.plan, cur)
  })
  const chartData = Array.from(byPlan.entries()).map(([plan, v]) => ({ plan: PLAN_LABEL[plan] || plan, mrr: v.mrr, subscribers: v.subscribers }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Revenue</h1>
      <p className="text-gray-400 text-sm mb-6">Computed live from active subscriptions — there's no separate payment ledger yet, so this reflects current MRR, not historical revenue collected</p>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2"><IndianRupee size={14} /> MRR</div>
              <div className="text-2xl font-bold text-gray-900">₹{mrr.toLocaleString('en-IN')}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-2">Paying subscribers</div>
              <div className="text-2xl font-bold text-gray-900">{paying}</div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="text-xs text-gray-400 mb-2">Complimentary / free</div>
              <div className="text-2xl font-bold text-gray-900">{free}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h3 className="font-bold text-gray-900 text-sm mb-4">MRR by Plan</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="plan" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip formatter={(v: number) => `₹${v.toLocaleString('en-IN')}`} />
                <Bar dataKey="mrr" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
