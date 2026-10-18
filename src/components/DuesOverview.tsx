'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { readCache, writeCache, useIsoLayoutEffect } from '@/lib/swrCache'
import { IndianRupee, RefreshCw, MessageCircle, Check, Plus, X, TrendingUp, Clock, Search } from 'lucide-react'
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import toast from 'react-hot-toast'
import { StatCard } from './SalesOverview'

import { tr } from '@/lib/i18n/tr'
interface Credit {
  id: string
  customer_name: string
  amount: number
  paid_amount: number
  status: string
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface Payment { credit_entry_id: string; amount: number; paid_at: string }

type FilterT = 'all' | 'due' | 'overdue' | 'collected'
type SortT = 'amount' | 'latest' | 'oldest' | 'name'
const AVATAR_COLORS = ['#7C3AED', '#0D9488', '#DB2777', '#4F46E5', '#D97706', '#0284C7', '#DC2626']
const avatarColor = (name: string) => AVATAR_COLORS[Array.from(name).reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length]

const AGING_BUCKETS = [
  { key: '0-7', label: '0–7 দিন', max: 7, color: '#22c55e' },
  { key: '8-30', label: '8–30 দিন', max: 30, color: '#3b82f6' },
  { key: '31-60', label: '31–60 দিন', max: 60, color: '#f59e0b' },
  { key: '61-90', label: '61–90 দিন', max: 90, color: '#ec4899' },
  { key: '90+', label: '90+ দিন', max: Infinity, color: '#8b5cf6' },
]

export default function DuesOverview({ userId }: { userId: string }) {
  const [credits, setCredits] = useState<Credit[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterT>('due')
  const [phoneByName, setPhoneByName] = useState<Record<string, string>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ customer_name: '', amount: '', due_date: '', notes: '' })
  const [payFor, setPayFor] = useState<Credit | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortT>('amount')
  const perPage = 10

  const applyBundle = (b: any) => {
    setCredits(b.credits || [])
    setPayments(b.payments || [])
    const map: Record<string, string> = {}
    for (const c of b.custs || []) if (c.phone) map[c.name.toLowerCase()] = c.phone
    setPhoneByName(map)
  }

  const load = async () => {
    const ck = `dues:${userId}`
    const cached = readCache<any>(ck)
    if (cached) { applyBundle(cached); setLoading(false) } else setLoading(true)
    const [creditRes, custRes, payRes] = await Promise.all([
      supabase.from('credit_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('crm_customers').select('name, phone').eq('user_id', userId),
      supabase.from('credit_payments').select('credit_entry_id, amount, paid_at').eq('user_id', userId),
    ])
    if (creditRes.error) console.error('credit_entries fetch:', creditRes.error)
    if (payRes.error) console.error('credit_payments fetch:', payRes.error) // table may not exist yet if migration 010 hasn't run
    const bundle = { credits: creditRes.data || [], payments: payRes.data || [], custs: custRes.data || [] }
    applyBundle(bundle)
    if (!creditRes.error) writeCache(ck, bundle)
    setLoading(false)
  }

  useIsoLayoutEffect(() => { load() }, [userId])

  const today = new Date().toISOString().slice(0, 10)
  const remainingOf = (c: Credit) => Number(c.amount) - Number(c.paid_amount || 0)
  const ageRefDate = (c: Credit) => c.due_date || c.created_at.slice(0, 10)
  const isOverdue = (c: Credit) => !!c.due_date && c.due_date < today && remainingOf(c) > 0

  // ── KPI cards, each vs. the same period last month where relevant ────
  const kpis = useMemo(() => {
    const monthStart = today.slice(0, 8) + '01'
    const d = new Date(); d.setMonth(d.getMonth() - 1)
    const prevMonthStart = d.toISOString().slice(0, 8) + '01'
    const prevMonthEnd = today.slice(0, 8) + '01' // exclusive

    const totalDueNet = credits.reduce((s, c) => s + Math.max(0, remainingOf(c)), 0)
    const customersWithDue = new Set(credits.filter(c => remainingOf(c) > 0).map(c => c.customer_name)).size

    const collectedThisMonth = payments.filter(p => p.paid_at >= monthStart).reduce((s, p) => s + Number(p.amount), 0)
    const collectedPrevMonth = payments.filter(p => p.paid_at >= prevMonthStart && p.paid_at < prevMonthEnd).reduce((s, p) => s + Number(p.amount), 0)

    const newDuesThisMonth = credits.filter(c => c.created_at >= monthStart).reduce((s, c) => s + Number(c.amount), 0)
    const newDuesPrevMonth = credits.filter(c => c.created_at >= prevMonthStart && c.created_at < prevMonthEnd).reduce((s, c) => s + Number(c.amount), 0)

    const overdueCredits = credits.filter(isOverdue)
    const overdueAmount = overdueCredits.reduce((s, c) => s + remainingOf(c), 0)
    const overdueCustomers = new Set(overdueCredits.map(c => c.customer_name)).size

    const pct = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null

    return {
      totalDueNet, customersWithDue,
      collectedThisMonth, collectedDelta: pct(collectedThisMonth, collectedPrevMonth),
      newDuesThisMonth, newDuesDelta: pct(newDuesThisMonth, newDuesPrevMonth),
      overdueAmount, overdueCustomers,
    }
  }, [credits, payments, today])

  // ── Aging donut — buckets remaining balance by days since due_date (or created_at if no due_date) ──
  const aging = useMemo(() => {
    const buckets = AGING_BUCKETS.map(b => ({ ...b, amount: 0 }))
    for (const c of credits) {
      const rem = remainingOf(c)
      if (rem <= 0) continue
      const days = Math.floor((Date.now() - new Date(ageRefDate(c) + 'T00:00:00').getTime()) / 86400000)
      const bucket = buckets.find(b => days <= b.max) || buckets[buckets.length - 1]
      bucket.amount += rem
    }
    const total = buckets.reduce((s, b) => s + b.amount, 0)
    return buckets.map(b => ({ ...b, pct: total ? Math.round((b.amount / total) * 100) : 0 }))
  }, [credits])

  // ── 30-day trend: cumulative outstanding balance + daily new বাকি added ──
  const trend = useMemo(() => {
    const days = 30
    const pointsRaw: { key: string; label: string; added: number; outstanding: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const addedToday = credits.filter(c => c.created_at.slice(0, 10) === key).reduce((s, c) => s + Number(c.amount), 0)
      const addedTotal = credits.filter(c => c.created_at.slice(0, 10) <= key).reduce((s, c) => s + Number(c.amount), 0)
      const paidTotal = payments.filter(p => p.paid_at.slice(0, 10) <= key).reduce((s, p) => s + Number(p.amount), 0)
      pointsRaw.push({ key, label: d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }), added: addedToday, outstanding: Math.max(0, addedTotal - paidTotal) })
    }
    return pointsRaw
  }, [credits, payments])

  // ── Group entries by customer for the table ───────────────────────
  const customerRows = useMemo(() => {
    const byName: Record<string, { entries: Credit[] }> = {}
    for (const c of credits) (byName[c.customer_name] ||= { entries: [] }).entries.push(c)
    return Object.entries(byName).map(([name, v]) => {
      const totalAmount = v.entries.reduce((s, c) => s + Number(c.amount), 0)
      const totalPaid = v.entries.reduce((s, c) => s + Number(c.paid_amount || 0), 0)
      const remaining = Math.max(0, totalAmount - totalPaid)
      const lastDate = v.entries.reduce((max, c) => (c.updated_at || c.created_at) > max ? (c.updated_at || c.created_at) : max, v.entries[0].created_at)
      const unpaid = v.entries.filter(c => remainingOf(c) > 0)
      const overdue = unpaid.some(isOverdue)
      const oldestUnpaidRef = unpaid.length ? unpaid.reduce((min, c) => ageRefDate(c) < min ? ageRefDate(c) : min, ageRefDate(unpaid[0])) : null
      const daysOutstanding = oldestUnpaidRef ? Math.floor((Date.now() - new Date(oldestUnpaidRef + 'T00:00:00').getTime()) / 86400000) : 0
      const status: 'due' | 'overdue' | 'paid' = remaining <= 0 ? 'paid' : overdue ? 'overdue' : 'due'
      return { name, phone: phoneByName[name.toLowerCase()] || null, totalAmount, totalPaid, remaining, lastDate, daysOutstanding, status, entries: v.entries }
    }).sort((a, b) => b.remaining - a.remaining)
  }, [credits, phoneByName])

  const filteredRows = customerRows.filter(r => {
    const q = search.trim().toLowerCase()
    if (q && !(r.name.toLowerCase().includes(q) || (r.phone || '').includes(q))) return false
    if (filter === 'all') return true
    if (filter === 'due') return r.status === 'due' || r.status === 'overdue'
    if (filter === 'overdue') return r.status === 'overdue'
    return r.status === 'paid'
  }).sort((a, b) =>
    sort === 'latest' ? (b.lastDate > a.lastDate ? 1 : -1)
    : sort === 'oldest' ? (a.lastDate > b.lastDate ? 1 : -1)
    : sort === 'name' ? a.name.localeCompare(b.name)
    : b.remaining - a.remaining)
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / perPage))
  const pageRows = filteredRows.slice((page - 1) * perPage, page * perPage)

  const addCredit = async () => {
    if (!form.customer_name.trim() || !form.amount) { toast.error('নাম ও পরিমাণ দিন'); return }
    const { error } = await supabase.from('credit_entries').insert({
      user_id: userId, customer_name: form.customer_name.trim(),
      amount: Number(form.amount), paid_amount: 0, status: 'pending',
      due_date: form.due_date || null, notes: form.notes || null,
    })
    if (error) { console.error('credit_entries insert:', error); toast.error('সেভ করতে সমস্যা হয়েছে'); return }
    toast.success('বাকি যোগ হয়েছে')
    setForm({ customer_name: '', amount: '', due_date: '', notes: '' }); setShowAdd(false); load()
  }

  const markPaid = async () => {
    if (!payFor) return
    const amt = Number(payAmount || 0)
    if (amt <= 0) { toast.error('সঠিক পরিমাণ দিন'); return }
    const newPaid = Number(payFor.paid_amount || 0) + amt
    const status = newPaid >= Number(payFor.amount) ? 'paid' : 'pending'
    const { error } = await supabase.from('credit_entries').update({ paid_amount: newPaid, status, updated_at: new Date().toISOString() }).eq('id', payFor.id)
    if (error) { console.error('credit_entries update:', error); toast.error('আপডেট করতে সমস্যা হয়েছে'); return }
    // Ledger row — if migration 010 hasn't run yet, this fails but the payment itself above already succeeded.
    const { error: payErr } = await supabase.from('credit_payments').insert({ user_id: userId, credit_entry_id: payFor.id, amount: amt })
    if (payErr) console.error('credit_payments insert (run migration 010_credit_payments.sql to enable):', payErr)
    toast.success('পরিশোধ রেকর্ড হয়েছে')
    setPayFor(null); setPayAmount(''); load()
  }

  const waLink = (name: string, remaining: number) => {
    const phone = phoneByName[name.toLowerCase()]
    if (!phone) return null
    const msg = `নমস্কার ${name}, আপনার ₹${remaining.toFixed(0)} বাকি আছে। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।`
    return `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`
  }

  const agingCard = (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 max-sm:p-3.5">
      <h3 className="text-[13px] font-bold text-gray-800 bengali mb-3 flex items-center gap-1.5">{tr('📊 বাকির বয়স অনুযায়ী')}</h3>
      <div className="space-y-2">
        {aging.map(b => (
          <div key={b.key}>
            <div className="flex justify-between text-[11px] mb-0.5">
              <span className="font-semibold text-gray-600 bengali">{b.label}</span>
              <span className="font-bold text-gray-900">₹{b.amount.toFixed(0)} · {b.pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${b.pct}%`, background: b.color }}/>
            </div>
          </div>
        ))}
        <p className="max-sm:hidden text-[10px] text-gray-400 bengali pt-1">{tr('বাকি যোগ করার সময় "মেয়াদ" না দিলে, বাকি যোগ করার তারিখ থেকে বয়স গণনা হয়')}</p>
      </div>
    </div>
  )

  return (
    <div className="max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col">
      <div className="flex items-start justify-between mb-4 max-sm:mb-2 gap-2">
        <div className="min-w-0">
          <h2 className="text-lg max-sm:text-xl font-bold text-gray-900 bengali flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center"><IndianRupee size={17} className="text-red-600"/></span> {tr('বাকি')}
          </h2>
          <p className="max-sm:hidden text-[12px] text-gray-400 bengali">{tr('কাস্টমারদের বাকি টাকা, সংগ্রহ, পরিশোধ ও রিপোর্ট দেখুন')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 bengali">
            <RefreshCw size={12}/> Refresh
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[12px] font-bold bengali">
            <Plus size={12}/> {tr('বাকি যোগ করুন')}
          </button>
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 max-sm:grid-cols-4 lg:grid-cols-4 gap-3 max-sm:gap-1.5 mb-4 max-sm:mb-2">
        <StatCard icon="📕" label={tr('মোট বাকি (নেট)')} bg="bg-red-50" text="text-red-700"
          value={`₹${kpis.totalDueNet.toFixed(0)}`} delta={null}
          sub={`${kpis.customersWithDue} জন কাস্টমার`}/>
        <StatCard icon="📗" label={tr('আদায় হয়েছে (এই মাসে)')} bg="bg-emerald-50" text="text-emerald-700"
          value={`₹${kpis.collectedThisMonth.toFixed(0)}`} delta={kpis.collectedDelta}/>
        <StatCard icon="📈" label={tr('বাকি বৃদ্ধি (এই মাসে)')} bg="bg-amber-50" text="text-amber-700"
          value={`₹${kpis.newDuesThisMonth.toFixed(0)}`} delta={kpis.newDuesDelta}/>
        <StatCard icon="⏰" label={tr('মেয়াদোত্তীর্ণ বাকি')} bg="bg-pink-50" text="text-pink-700"
          value={`₹${kpis.overdueAmount.toFixed(0)}`} delta={null}
          sub={`${kpis.overdueCustomers} জন কাস্টমার`}/>
      </div>

      {/* ── Filter tabs ────────────────────────────────────────── */}
      <div className="flex gap-2 mb-3 sm:mb-4 max-sm:mb-2 sm:flex-wrap max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:-mx-3 max-sm:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          { id: 'all', label: `সব কাস্টমার (${customerRows.length})` },
          { id: 'due', label: `বাকি আছে (${customerRows.filter(r => r.status !== 'paid').length})` },
          { id: 'overdue', label: `মেয়াদোত্তীর্ণ (${customerRows.filter(r => r.status === 'overdue').length})` },
          { id: 'collected', label: `পরিশোধিত (${customerRows.filter(r => r.status === 'paid').length})` },
        ] as { id: FilterT; label: string }[]).map(f => (
          <button key={f.id} onClick={() => { setFilter(f.id); setPage(1) }}
            className={`whitespace-nowrap shrink-0 px-4 max-sm:px-3.5 py-2 rounded-lg text-[12px] font-bold bengali ${filter===f.id ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Search + sort ──────────────────────────────────────── */}
      <div className="flex gap-2 mb-4 max-sm:mb-2">
        <div className="flex-1 relative min-w-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={tr('কাস্টমার নাম বা মোবাইল নম্বর খুঁজুন...')}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-red-100"/>
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as SortT)}
          className="px-2.5 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 bengali bg-white max-w-[130px]">
          <option value="amount">{tr('সর্বোচ্চ বাকি')}</option>
          <option value="latest">{tr('সর্বশেষ বাকি')}</option>
          <option value="oldest">{tr('পুরনো বাকি')}</option>
          <option value="name">{tr('নাম (অ-হ)')}</option>
        </select>
      </div>

      {/* ── Trend + aging ──────────────────────────────────────── */}
      {!loading && credits.length > 0 && (
        <div className="max-sm:hidden grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-4">
          <div className="max-sm:hidden bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-[13px] font-bold text-gray-800 bengali flex items-center gap-1.5 mb-3">
              <TrendingUp size={14} className="text-red-500"/> {tr('বাকির ট্রেন্ড (গত ৩০ দিন)')}
            </h3>
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                <ComposedChart data={trend} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4}/>
                  <YAxis tick={{ fontSize: 10 }}/>
                  <Tooltip formatter={(v: any) => `₹${Number(v).toFixed(0)}`} contentStyle={{ fontSize: 12 }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => v === 'outstanding' ? 'মোট বাকি (জমাকৃত)' : 'নতুন বাকি (দৈনিক)'}/>
                  <Bar dataKey="added" fill="#bbf7d0" radius={[4,4,0,0]} barSize={10}/>
                  <Line type="monotone" dataKey="outstanding" stroke="#6366f1" strokeWidth={2} dot={false}/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="max-sm:hidden">{agingCard}</div>
        </div>
      )}

      {/* ── Customer table ─────────────────────────────────────── */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</div>
      ) : filteredRows.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <Clock size={32} className="mx-auto text-gray-300 mb-2"/>
          <p className="text-gray-400 text-sm bengali">{tr('কোনো তথ্য নেই।')}</p>
        </div>
      ) : (
        <>
        <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50 max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto">
          {pageRows.map(r => {
            const link = r.remaining > 0 ? waLink(r.name, r.remaining) : null
            const unpaidEntry = r.entries.find(e => remainingOf(e) > 0)
            return (
              <div key={r.name} className="flex items-center justify-between p-3.5 max-sm:p-3 gap-2.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0" style={{ background: avatarColor(r.name) }}>
                  {String(Array.from(String(r.name).trim())[0] || '?').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-[13px] bengali truncate">{r.name}</span>
                    {r.status === 'overdue' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 bengali">{tr('মেয়াদোত্তীর্ণ')}</span>}
                  </div>
                  <div className="text-[11px] text-gray-400 bengali mt-0.5">
                    {tr('মোট ₹')}{r.totalAmount.toFixed(0)} {tr('· পরিশোধ ₹')}{r.totalPaid.toFixed(0)}
                    {r.phone ? ` · ${r.phone}` : ''}
                    {r.remaining > 0 ? ` · ${r.daysOutstanding} দিন বাকি` : ''}
                  </div>
                </div>
                <div className={`font-extrabold text-[14px] flex-shrink-0 ${r.remaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  ₹{r.remaining.toFixed(0)}
                </div>
                {r.remaining > 0 && unpaidEntry && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {link && (
                      <a href={link} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <MessageCircle size={13}/>
                      </a>
                    )}
                    <button onClick={() => { setPayFor(unpaidEntry); setPayAmount('') }} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Check size={13}/>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button disabled={page===1} onClick={() => setPage(p => p-1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold disabled:opacity-30">←</button>
            <span className="text-[12px] text-gray-500 bengali">{page} / {pageCount}</span>
            <button disabled={page===pageCount} onClick={() => setPage(p => p+1)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold disabled:opacity-30">→</button>
          </div>
        )}
        </>
      )}

      {/* Add credit modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{tr('নতুন বাকি')}</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="space-y-3">
              <input placeholder={tr('কাস্টমারের নাম')} value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali"/>
              <input placeholder={tr('মোট বাকির পরিমাণ (₹)')} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]"/>
              <div>
                <label className="text-[11px] text-gray-500 bengali block mb-1">{tr('পরিশোধের মেয়াদ (ঐচ্ছিক — মেয়াদোত্তীর্ণ ট্র্যাক করতে সাহায্য করে)')}</label>
                <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]"/>
              </div>
              <input placeholder={tr('নোট (ঐচ্ছিক)')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali"/>
              <button onClick={addCredit} className="w-full py-2.5 rounded-lg bg-red-600 text-white font-bold text-[13px] bengali">{tr('যোগ করুন')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setPayFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{payFor.customer_name} {tr('— পরিশোধ')}</h3>
              <button onClick={() => setPayFor(null)}><X size={18} className="text-gray-400"/></button>
            </div>
            <div className="text-[12px] text-gray-500 bengali mb-2">
              {tr('বর্তমান বাকি: ₹')}{(Number(payFor.amount) - Number(payFor.paid_amount || 0)).toFixed(0)}
            </div>
            <input placeholder={tr('পরিশোধের পরিমাণ (₹)')} type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] mb-3"/>
            <button onClick={markPaid} className="w-full py-2.5 rounded-lg bg-red-600 text-white font-bold text-[13px] bengali">{tr('নিশ্চিত করুন')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
