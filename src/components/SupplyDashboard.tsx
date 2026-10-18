'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import {
  Truck, Plus, X, Phone, Search, Download, ShoppingCart, Users, IndianRupee, Wallet,
  History, PhoneCall, MessageCircle, MapPin, ChevronLeft, ChevronRight, AlertTriangle, Loader2,
} from 'lucide-react'

import { tr } from '@/lib/i18n/tr'
interface Vendor {
  id: string; name: string; phone: string | null; notes: string | null; due_amount: number
  address?: string | null; category?: string | null; created_at?: string
}
interface Purchase { id: string; vendor_id: string; bill_no: string | null; amount: number; paid_amount: number; purchase_date: string }
interface Payment { id: string; vendor_id: string; amount: number; type: string; created_at: string }

const N = (v: unknown) => Number(v || 0)
const rupee = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const short = (d?: string | null) => d ? new Date(d).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short' }) : '—'
const monthKey = (d: string | Date) => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}` }
const AGING = [
  { label: '০–৭ দিন', max: 7, color: '#10B981' },
  { label: '৮–৩০ দিন', max: 30, color: '#3B82F6' },
  { label: '৩১–৬০ দিন', max: 60, color: '#F59E0B' },
  { label: '৬১–৯০ দিন', max: 90, color: '#F97316' },
  { label: '৯০+ দিন', max: Infinity, color: '#EF4444' },
]
type Tab = 'all' | 'due' | 'paid'
const EMPTY_VENDOR = { name: '', phone: '', category: '', address: '', due_amount: '', notes: '' }
const today = () => new Date().toISOString().slice(0, 10)

export default function SupplyDashboard({ userId, refreshSignal = 0 }: { userId: string; refreshSignal?: number }) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [saving, setSaving] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_VENDOR)
  const [payFor, setPayFor] = useState<Vendor | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [showBuy, setShowBuy] = useState(false)
  const [buy, setBuy] = useState({ vendor_id: '', bill_no: '', amount: '', paid: '', date: today() })
  const [historyFor, setHistoryFor] = useState<Vendor | null>(null)

  const load = async () => {
    setLoading(true)
    const [v, p, pay] = await Promise.all([
      supabase.from('vendors').select('*').eq('user_id', userId).order('due_amount', { ascending: false }),
      supabase.from('vendor_purchases').select('*').eq('user_id', userId).order('purchase_date', { ascending: false }),
      supabase.from('vendor_payments').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])
    if (v.error) console.error('vendors fetch:', v.error)
    setVendors((v.data as Vendor[]) || [])
    // vendor_purchases only exists after migration 010 — degrade gracefully
    setNeedsMigration(!!p.error)
    setPurchases(p.error ? [] : ((p.data as Purchase[]) || []))
    setPayments((pay.data as Payment[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [userId, refreshSignal])
  useEffect(() => { setPage(1) }, [tab, q, pageSize])

  // ── per-vendor rollup ──────────────────────────────────────────
  const rows = useMemo(() => vendors.map(v => {
    const ps = purchases.filter(p => p.vendor_id === v.id)
    const pays = payments.filter(p => p.vendor_id === v.id && p.type === 'payment')
    const total = ps.reduce((s, p) => s + N(p.amount), 0)
    const paid = ps.reduce((s, p) => s + N(p.paid_amount), 0) + pays.reduce((s, p) => s + N(p.amount), 0)
    const last = ps.length ? ps.map(p => p.purchase_date).sort().slice(-1)[0] : null
    return { v, total, paid, due: N(v.due_amount), last, count: ps.length }
  }), [vendors, purchases, payments])

  // ── KPIs, chart, aging ─────────────────────────────────────────
  const now = new Date()
  const thisKey = monthKey(now)
  const lastKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const kpi = useMemo(() => {
    const cur = purchases.filter(p => monthKey(p.purchase_date) === thisKey)
    const prev = purchases.filter(p => monthKey(p.purchase_date) === lastKey)
    const curSum = cur.reduce((s, p) => s + N(p.amount), 0)
    const prevSum = prev.reduce((s, p) => s + N(p.amount), 0)
    const paidThis = payments.filter(p => p.type === 'payment' && monthKey(p.created_at) === thisKey)
    return {
      curSum, count: cur.length,
      trend: prevSum > 0 ? Math.round((curSum - prevSum) / prevSum * 100) : null,
      newVendors: vendors.filter(v => v.created_at && monthKey(v.created_at) === thisKey).length,
      totalDue: vendors.reduce((s, v) => s + N(v.due_amount), 0),
      dueVendors: vendors.filter(v => N(v.due_amount) > 0).length,
      paidSum: paidThis.reduce((s, p) => s + N(p.amount), 0) + cur.reduce((s, p) => s + N(p.paid_amount), 0),
      paidCount: paidThis.length,
    }
  }, [purchases, payments, vendors]) // eslint-disable-line

  const monthly = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const k = monthKey(d)
    return {
      name: d.toLocaleDateString('bn-IN', { month: 'short' }),
      ক্রয়: purchases.filter(p => monthKey(p.purchase_date) === k).reduce((s, p) => s + N(p.amount), 0),
      পরিশোধ: payments.filter(p => p.type === 'payment' && monthKey(p.created_at) === k).reduce((s, p) => s + N(p.amount), 0)
        + purchases.filter(p => monthKey(p.purchase_date) === k).reduce((s, p) => s + N(p.paid_amount), 0),
    }
  }), [purchases, payments]) // eslint-disable-line

  const aging = useMemo(() => {
    const buckets = AGING.map(a => ({ ...a, value: 0 }))
    rows.filter(r => r.due > 0).forEach(r => {
      const ref = r.last || r.v.created_at
      const days = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86400000) : 0
      const b = buckets.find(x => days <= x.max)!
      b.value += r.due
    })
    return buckets
  }, [rows])
  const agingTotal = aging.reduce((s, a) => s + a.value, 0)

  // ── filter + paginate ──────────────────────────────────────────
  const counts = { all: rows.length, due: rows.filter(r => r.due > 0).length, paid: rows.filter(r => r.due <= 0).length }
  const filtered = rows.filter(r => {
    if (tab === 'due' && r.due <= 0) return false
    if (tab === 'paid' && r.due > 0) return false
    const s = q.trim().toLowerCase()
    return !s || [r.v.name, r.v.phone, r.v.category, r.v.address].some(x => (x || '').toLowerCase().includes(s))
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  // ── actions ────────────────────────────────────────────────────
  const addVendor = async () => {
    if (!form.name.trim() || saving) return
    setSaving(true)
    const base = { user_id: userId, name: form.name.trim(), phone: form.phone || null, due_amount: N(form.due_amount), notes: form.notes || null }
    let { error } = await supabase.from('vendors').insert({ ...base, category: form.category || null, address: form.address || null })
    if (error) ({ error } = await supabase.from('vendors').insert(base)) // columns missing (migration 010 not run yet)
    setSaving(false)
    if (error) { console.error('vendors insert:', error); return }
    setForm(EMPTY_VENDOR); setShowAdd(false); load()
  }

  const recordPayment = async () => {
    const amt = N(payAmount)
    if (!payFor || amt <= 0 || saving) return
    setSaving(true)
    const { error: e1 } = await supabase.from('vendors').update({ due_amount: Math.max(0, N(payFor.due_amount) - amt) }).eq('id', payFor.id)
    const { error: e2 } = await supabase.from('vendor_payments').insert({ vendor_id: payFor.id, user_id: userId, amount: amt, type: 'payment' })
    if (e1) console.error('vendors update:', e1)
    if (e2) console.error('vendor_payments insert:', e2)
    setSaving(false); setPayFor(null); setPayAmount(''); load()
  }

  const recordPurchase = async () => {
    const amt = N(buy.amount), paid = Math.min(N(buy.paid), amt)
    const vendor = vendors.find(v => v.id === buy.vendor_id)
    if (!vendor || amt <= 0 || saving) return
    setSaving(true)
    const { error } = await supabase.from('vendor_purchases').insert({
      vendor_id: vendor.id, user_id: userId, bill_no: buy.bill_no || null, amount: amt, paid_amount: paid, purchase_date: buy.date || today(),
    })
    if (error) { console.error('vendor_purchases insert:', error); setSaving(false); setNeedsMigration(true); return }
    await supabase.from('vendors').update({ due_amount: N(vendor.due_amount) + (amt - paid) }).eq('id', vendor.id)
    setSaving(false); setShowBuy(false); setBuy({ vendor_id: '', bill_no: '', amount: '', paid: '', date: today() }); load()
  }

  const exportXlsx = () => {
    const data = filtered.map(r => ({
      Name: r.v.name, Category: r.v.category || '', Phone: r.v.phone || '', Address: r.v.address || '',
      'Total Purchase (₹)': r.total, 'Paid (₹)': r.paid, 'Due (₹)': r.due, 'Last Purchase': r.last || '',
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Suppliers')
    XLSX.writeFile(wb, `suppliers-${today()}.xlsx`)
  }

  // ── small pieces ───────────────────────────────────────────────
  const Status = ({ due }: { due: number }) => due > 0
    ? <span className="inline-flex px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10.5px] font-bold bengali whitespace-nowrap">{tr('বাকি আছে')}</span>
    : <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10.5px] font-bold bengali whitespace-nowrap">{tr('পরিশোধিত')}</span>
  const Avatar = ({ name }: { name: string }) => (
    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[13px] flex items-center justify-center flex-shrink-0">{name.trim().charAt(0).toUpperCase()}</div>
  )
  const Actions = ({ v, size = 'w-8 h-8' }: { v: Vendor; size?: string }) => (
    <div className="flex items-center justify-center gap-1.5">
      <button onClick={() => setHistoryFor(v)} title={tr('ইতিহাস')} className={`${size} rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 inline-flex items-center justify-center flex-shrink-0`}><History size={13} /></button>
      {N(v.due_amount) > 0 && (
        <button onClick={() => setPayFor(v)} title={tr('পরিশোধ')} className={`${size} rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 inline-flex items-center justify-center flex-shrink-0`}><Wallet size={13} /></button>
      )}
      {v.phone && (<>
        <a href={`tel:${v.phone}`} title={tr('কল করুন')} className={`${size} rounded-lg bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 inline-flex items-center justify-center flex-shrink-0`}><PhoneCall size={13} /></a>
        <a href={`https://wa.me/${v.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className={`${size} rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 inline-flex items-center justify-center flex-shrink-0`}><MessageCircle size={13} /></a>
      </>)}
    </div>
  )
  const Card = ({ icon, bg, label, value, sub, badge }: { icon: React.ReactNode; bg: string; label: string; value: string; sub: string; badge?: string }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-2.5 min-w-0">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[10.5px] text-gray-500 bengali leading-tight">{label}</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-gray-900 text-[17px] leading-tight">{value}</span>
          {badge && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <div className="text-[10.5px] text-gray-400 bengali">{sub}</div>
      </div>
    </div>
  )
  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100'
  const historyPurchases = historyFor ? purchases.filter(p => p.vendor_id === historyFor.id) : []
  const historyPayments = historyFor ? payments.filter(p => p.vendor_id === historyFor.id && p.type === 'payment') : []

  return (
    <div className="min-w-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 bengali flex items-center gap-2"><Truck size={20} className="text-indigo-500" /> {tr('সরবরাহ / সাপ্লায়ার')}</h1>
          <p className="text-gray-400 text-[13px] bengali mt-0.5">{tr('পণ্য ক্রয়, সরবরাহকারীর ব্যবস্থাপনা ও পরিশোধের হিসাব')}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <button onClick={exportXlsx} disabled={filtered.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[13px] font-bold bengali whitespace-nowrap disabled:opacity-50"><Download size={14} /> {tr('Excel ডাউনলোড')}</button>
          <button onClick={() => setShowBuy(true)} disabled={vendors.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-indigo-600 text-white text-[13px] font-bold bengali whitespace-nowrap disabled:opacity-50"><ShoppingCart size={14} /> {tr('নতুন ক্রয়')}</button>
          <button onClick={() => setShowAdd(true)}
            className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-100 text-gray-700 text-[13px] font-bold bengali whitespace-nowrap"><Plus size={14} /> {tr('সাপ্লায়ার যোগ করুন')}</button>
        </div>
      </div>

      {needsMigration && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-[12px] bengali">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {tr('ক্রয়ের হিসাব দেখাতে Supabase-এ')} <b>010_supplier_purchases.sql</b> {tr('মাইগ্রেশনটি একবার চালান।')}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <Card icon={<ShoppingCart size={16} className="text-rose-500" />} bg="bg-rose-50" label={tr('মোট ক্রয় (এই মাস)')} value={rupee(kpi.curSum)}
          badge={kpi.trend === null ? undefined : `${kpi.trend >= 0 ? '↑' : '↓'} ${Math.abs(kpi.trend)}%`} sub={`${kpi.count} টি ক্রয়`} />
        <Card icon={<Users size={16} className="text-blue-500" />} bg="bg-blue-50" label={tr('মোট সরবরাহকারী')} value={String(vendors.length)} sub={`${kpi.newVendors} নতুন এই মাসে`} />
        <Card icon={<IndianRupee size={16} className="text-red-500" />} bg="bg-red-50" label={tr('মোট বাকি')} value={rupee(kpi.totalDue)} sub={`${kpi.dueVendors} জনের বাকি`} />
        <Card icon={<Wallet size={16} className="text-indigo-500" />} bg="bg-indigo-50" label={tr('এই মাসে পরিশোধ')} value={rupee(kpi.paidSum)} sub={`${kpi.paidCount} টি পেমেন্ট`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3 sm:gap-4 mb-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 min-w-0">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <h3 className="font-bold text-[13px] text-gray-900 bengali">{tr('মাসিক ক্রয় ও পরিশোধ')}</h3>
            <div className="flex items-center gap-3 text-[11px] text-gray-500 bengali">
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> {tr('ক্রয়')}</span>
              <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> {tr('পরিশোধ')}</span>
            </div>
          </div>
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthly} margin={{ top: 5, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)} />
                <Tooltip formatter={(v: number) => rupee(v)} cursor={{ fill: '#F8FAFC' }} />
                <Bar dataKey="ক্রয়" fill="#FB7185" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="পরিশোধ" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 min-w-0">
          <h3 className="font-bold text-[13px] text-gray-900 bengali mb-2">{tr('সরবরাহকারীর বাকি (Aging)')}</h3>
          {agingTotal === 0 ? (
            <div className="h-[190px] flex items-center justify-center text-gray-400 text-[12px] bengali">{tr('কোনো বাকি নেই')}</div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="w-[120px] h-[120px] flex-shrink-0 mx-auto sm:mx-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={aging.filter(a => a.value > 0)} dataKey="value" innerRadius={34} outerRadius={56} paddingAngle={2} stroke="none">
                      {aging.filter(a => a.value > 0).map(a => <Cell key={a.label} fill={a.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => rupee(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="flex-1 min-w-[140px] space-y-1.5">
                {aging.map(a => (
                  <li key={a.label} className="flex items-center justify-between gap-2 text-[11.5px] bengali">
                    <span className="flex items-center gap-1.5 text-gray-600"><i className="w-2 h-2 rounded-full inline-block" style={{ background: a.color }} />{a.label}</span>
                    <span className="font-semibold text-gray-800">{Math.round(a.value / agingTotal * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[10.5px] text-gray-400 bengali mt-2">{tr('শেষ ক্রয়ের তারিখ থেকে বাকির বয়স গণনা করা হয়।')}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {([['all', `সব সরবরাহকারী (${counts.all})`], ['due', `বাকি আছে (${counts.due})`], ['paid', `পরিশোধিত (${counts.paid})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold bengali transition-colors whitespace-nowrap flex-shrink-0 ${tab === k ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>{label}</button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('সরবরাহকারীর নাম, ফোন, ধরন বা ঠিকানা দিয়ে খুঁজুন...')}
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100" />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm bengali flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> {tr('লোড হচ্ছে...')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <Truck size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm bengali">{vendors.length === 0 ? tr('এখনো কোনো সাপ্লায়ার যোগ করা হয়নি।') : tr('কোনো সরবরাহকারী পাওয়া যায়নি।')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Desktop / tablet table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] bengali">
                  <th className="px-3 py-3 font-semibold">{tr('সরবরাহকারীর নাম')}</th>
                  <th className="px-3 py-3 font-semibold hidden 2xl:table-cell">{tr('যোগাযোগ')}</th>
                  <th className="px-3 py-3 font-semibold hidden 2xl:table-cell">{tr('অবস্থান')}</th>
                  <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">{tr('মোট ক্রয়')}</th>
                  <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">{tr('পরিশোধ')}</th>
                  <th className="px-3 py-3 font-semibold text-right">{tr('বাকি')}</th>
                  <th className="px-3 py-3 font-semibold hidden 2xl:table-cell whitespace-nowrap">{tr('শেষ ক্রয়')}</th>
                  <th className="px-3 py-3 font-semibold text-center">{tr('স্ট্যাটাস')}</th>
                  <th className="px-3 py-3 font-semibold text-center">{tr('অ্যাকশন')}</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(r => (
                  <tr key={r.v.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-3 py-3 max-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.v.name} />
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 bengali truncate">{r.v.name}</div>
                          <div className="text-[11px] text-gray-400 bengali truncate">{r.v.category || (r.v.notes ? r.v.notes : '—')}</div>
                          {r.v.phone && <div className="2xl:hidden text-[11.5px] text-gray-500">{r.v.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden 2xl:table-cell">{r.v.phone || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 bengali max-w-[140px] truncate hidden 2xl:table-cell">{r.v.address || '—'}</td>
                    <td className="px-3 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{rupee(r.total)}</td>
                    <td className="px-3 py-3 text-right text-gray-600 whitespace-nowrap">{rupee(r.paid)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap"><span className={`font-bold ${r.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupee(r.due)}</span></td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden 2xl:table-cell">{short(r.last)}</td>
                    <td className="px-3 py-3 text-center"><Status due={r.due} /></td>
                    <td className="px-3 py-3"><Actions v={r.v} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {paged.map(r => (
              <div key={r.v.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={r.v.name} />
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 bengali truncate">{r.v.name}</div>
                      <div className="text-[12px] text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {r.v.category && <span className="bengali">{r.v.category}</span>}
                        {r.v.phone && <span className="flex items-center gap-1"><Phone size={10} />{r.v.phone}</span>}
                        {r.v.address && <span className="flex items-center gap-1 bengali"><MapPin size={10} /><span className="truncate max-w-[120px]">{r.v.address}</span></span>}
                      </div>
                    </div>
                  </div>
                  <Status due={r.due} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-gray-50 py-2"><div className="text-[10.5px] text-gray-400 bengali">{tr('মোট ক্রয়')}</div><div className="font-bold text-gray-900 text-[13px]">{rupee(r.total)}</div></div>
                  <div className="rounded-xl bg-gray-50 py-2"><div className="text-[10.5px] text-gray-400 bengali">{tr('পরিশোধ')}</div><div className="font-bold text-gray-700 text-[13px]">{rupee(r.paid)}</div></div>
                  <div className="rounded-xl bg-gray-50 py-2"><div className="text-[10.5px] text-gray-400 bengali">{tr('বাকি')}</div><div className={`font-bold text-[13px] ${r.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{rupee(r.due)}</div></div>
                </div>
                <div className="mt-3"><Actions v={r.v} size="w-10 h-10" /></div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-t border-gray-100">
            <span className="text-[12px] text-gray-400 bengali">{tr('মোট')} {filtered.length} {tr('জন সরবরাহকারী')}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 inline-flex items-center justify-center"><ChevronLeft size={14} /></button>
              <span className="text-[12px] font-semibold text-gray-600 px-2">{pageSafe} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages} className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 inline-flex items-center justify-center"><ChevronRight size={14} /></button>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="ml-1 px-2 py-1.5 rounded-lg border border-gray-200 text-[12px] bg-white">
                {[10, 25, 50].map(n => <option key={n} value={n}>{n} {tr('/ পৃষ্ঠা')}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Add supplier */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{tr('নতুন সাপ্লায়ার')}</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder={tr('নাম')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
              <input placeholder={tr('ধরন (যেমন: চাল সাপ্লায়ার)')} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls} />
              <input placeholder={tr('ফোন নম্বর')} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              <input placeholder={tr('ঠিকানা / শহর')} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
              <input placeholder={tr('বর্তমান বাকি (₹)')} type="number" value={form.due_amount} onChange={e => setForm(f => ({ ...f, due_amount: e.target.value }))} className={inputCls} />
              <textarea placeholder={tr('নোট (ঐচ্ছিক)')} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} rows={2} />
              <button onClick={addVendor} disabled={saving} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">{saving ? tr('সেভ হচ্ছে...') : tr('যোগ করুন')}</button>
            </div>
          </div>
        </div>
      )}

      {/* New purchase */}
      {showBuy && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowBuy(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{tr('নতুন ক্রয়')}</h3>
              <button onClick={() => setShowBuy(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={buy.vendor_id} onChange={e => setBuy(b => ({ ...b, vendor_id: e.target.value }))} className={`${inputCls} bg-white`}>
                <option value="">{tr('সরবরাহকারী বাছুন')}</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input placeholder={tr('বিল / ইনভয়েস নম্বর (ঐচ্ছিক)')} value={buy.bill_no} onChange={e => setBuy(b => ({ ...b, bill_no: e.target.value }))} className={inputCls} />
              <input type="date" value={buy.date} onChange={e => setBuy(b => ({ ...b, date: e.target.value }))} className={inputCls} />
              <input placeholder={tr('মোট বিল (₹)')} type="number" value={buy.amount} onChange={e => setBuy(b => ({ ...b, amount: e.target.value }))} className={inputCls} />
              <input placeholder={tr('এখনই পরিশোধ (₹)')} type="number" value={buy.paid} onChange={e => setBuy(b => ({ ...b, paid: e.target.value }))} className={inputCls} />
              {N(buy.amount) > 0 && <div className="text-[12px] text-gray-500 bengali">{tr('নতুন বাকি:')} <b className="text-red-600">{rupee(Math.max(0, N(buy.amount) - Math.min(N(buy.paid), N(buy.amount))))}</b></div>}
              <button onClick={recordPurchase} disabled={saving || !buy.vendor_id || N(buy.amount) <= 0} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">{saving ? tr('সেভ হচ্ছে...') : tr('ক্রয় সেভ করুন')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment */}
      {payFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setPayFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{payFor.name} {tr('— পরিশোধ')}</h3>
              <button onClick={() => setPayFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="text-[12px] text-gray-500 bengali mb-2">{tr('বর্তমান বাকি:')} {rupee(N(payFor.due_amount))}</div>
            <input placeholder={tr('পরিশোধের পরিমাণ (₹)')} type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className={`${inputCls} mb-3`} />
            <button onClick={recordPayment} disabled={saving} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">{tr('নিশ্চিত করুন')}</button>
          </div>
        </div>
      )}

      {/* History */}
      {historyFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setHistoryFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 bengali">{historyFor.name} {tr('— ইতিহাস')}</h3>
              <button onClick={() => setHistoryFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            {historyPurchases.length === 0 && historyPayments.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-[13px] bengali">{tr('কোনো রেকর্ড নেই')}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {[
                  ...historyPurchases.map(p => ({ id: p.id, date: p.purchase_date, kind: 'ক্রয়', text: p.bill_no ? `বিল ${p.bill_no}` : 'ক্রয়', amount: N(p.amount), color: 'text-rose-600' })),
                  ...historyPayments.map(p => ({ id: p.id, date: p.created_at, kind: 'পরিশোধ', text: 'পরিশোধ', amount: N(p.amount), color: 'text-emerald-600' })),
                ].sort((a, b) => +new Date(b.date) - +new Date(a.date)).map(e => (
                  <li key={e.kind + e.id} className="flex items-center justify-between py-2.5 text-[13px] bengali">
                    <div><div className="font-semibold text-gray-800">{e.text}</div><div className="text-[11px] text-gray-400">{short(e.date)}</div></div>
                    <div className={`font-bold ${e.color}`}>{e.kind === 'ক্রয়' ? '+' : '−'}{rupee(e.amount)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
