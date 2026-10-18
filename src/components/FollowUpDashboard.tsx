'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'
import {
  Bell, Search, Plus, X, ChevronDown, Sparkles, Send, AlertCircle, CalendarClock, Clock3,
  CheckCircle2, Users, PhoneCall, MessageCircle, CalendarPlus, MoreVertical, Download,
  Loader2, Check, Ban, Pencil,
} from 'lucide-react'

interface Credit { id: string; customer_name: string; amount: number; paid_amount: number; due_date: string | null; status: string; created_at: string }
interface Customer { id: string; name: string; phone: string | null }
interface FollowupRow {
  id: string; customer_id: string | null; customer_name: string; phone: string | null
  type: 'general' | 'sales' | 'new_customer' | 'due'; note: string | null; ai_suggestion: string | null
  scheduled_at: string; status: 'scheduled' | 'completed' | 'canceled'
  last_contact_at: string | null; last_contact_channel: string | null
}

type Status = 'overdue' | 'due_today' | 'scheduled' | 'completed' | 'canceled'
type Item = {
  id: string; source: 'due' | 'task'; type: FollowupRow['type']
  name: string; phone: string | null; amount?: number
  note: string; suggestion: string; scheduledAt: string; status: Status
  lastContactAt: string | null; lastContactChannel: string | null
  raw?: FollowupRow
}
type Tab = 'all' | 'overdue' | 'due_today' | 'scheduled' | 'completed' | 'sales' | 'new_customer'

const todayStr = () => new Date().toISOString().slice(0, 10)
const daysBetween = (a: string, b: string) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
const shortDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short' }) : '—'
const relDate = (d?: string | null) => {
  if (!d) return 'কখনো যোগাযোগ হয়নি'
  const days = daysBetween(todayStr(), d.slice(0, 10))
  if (days === 0) return 'আজ'
  if (days === 1) return '১ দিন আগে'
  return `${days} দিন আগে`
}
const waLink = (phone: string, msg: string) => `https://wa.me/91${phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(msg)}`

function computeStatus(scheduledAt: string, raw?: 'scheduled' | 'completed' | 'canceled'): Status {
  if (raw === 'completed') return 'completed'
  if (raw === 'canceled') return 'canceled'
  const d = daysBetween(scheduledAt, todayStr())
  if (d < 0) return 'overdue'
  if (d === 0) return 'due_today'
  return 'scheduled'
}

function suggestFor(type: FollowupRow['type'], name: string, amount: number | undefined, scheduledAt: string, note: string | null): string {
  if (note) return note
  const days = daysBetween(todayStr(), scheduledAt)
  if (type === 'due' && amount) {
    if (days > 20) return 'বাকি অনেকদিন হলো। আজই ফোন করুন।'
    if (days > 10) return 'বেশি বাকি হয়েছে। আজ ফোন করা ভালো।'
    if (days > 3) return 'বাকি বেশ কয়েকদিন হলো। আজই যোগাযোগ করুন।'
    return 'আজ একটি friendly reminder পাঠানো ভালো।'
  }
  if (type === 'sales') return `${name} নিয়মিত ক্রেতা। পুনরায় অর্ডারের জন্য যোগাযোগ করুন।`
  if (type === 'new_customer') return `${name}-কে স্বাগত জানান, নতুন কাস্টমারদের সাথে সম্পর্ক তৈরি করুন।`
  return 'একটি polite মেসেজ পাঠানো ভালো।'
}

const TYPE_LABEL: Record<FollowupRow['type'], string> = { due: 'বাকি', sales: 'বিক্রয়', new_customer: 'নতুন কাস্টমার', general: 'সাধারণ' }
const QUICK_TYPES: { type: FollowupRow['type']; label: string }[] = [
  { type: 'general', label: 'সাধারণ ফলো-আপ' },
  { type: 'sales', label: 'বিক্রয় ফলো-আপ' },
  { type: 'new_customer', label: 'নতুন কাস্টমার ফলো-আপ' },
]
const EMPTY_FORM = { customer_id: '', customer_name: '', phone: '', type: 'general' as FollowupRow['type'], note: '', scheduled_at: todayStr() }

export default function FollowUpDashboard({ userId, agentId }: { userId: string; agentId?: string }) {
  const [credits, setCredits] = useState<Credit[]>([])
  const [tasks, setTasks] = useState<FollowupRow[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customersByName, setCustomersByName] = useState<Record<string, Customer>>({})
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)

  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | FollowupRow['type']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [timeFilter, setTimeFilter] = useState<'all' | '7' | '30'>('all')
  const [page, setPage] = useState(1)
  const pageSize = 10

  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [scheduleFor, setScheduleFor] = useState<Item | null>(null)
  const [scheduleDate, setScheduleDate] = useState(todayStr())
  const [menuFor, setMenuFor] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    let creditQ = supabase.from('credit_entries').select('*').eq('user_id', userId).neq('status', 'paid').order('due_date', { ascending: true })
    let taskQ = supabase.from('followups').select('*').eq('user_id', userId).order('scheduled_at', { ascending: true })
    let customerQ = supabase.from('crm_customers').select('id, name, phone').eq('user_id', userId)
    if (agentId) { creditQ = creditQ.eq('agent_id', agentId); taskQ = taskQ.eq('agent_id', agentId); customerQ = customerQ.eq('agent_id', agentId) }
    const [creditRes, taskRes, customerRes] = await Promise.all([creditQ, taskQ, customerQ])
    if (creditRes.error) console.error('credit_entries fetch:', creditRes.error)
    setNeedsMigration(!!taskRes.error)
    if (taskRes.error) console.error('followups fetch:', taskRes.error)
    setCredits(creditRes.data || [])
    setTasks(taskRes.error ? [] : ((taskRes.data as FollowupRow[]) || []))
    const custs = (customerRes.data as Customer[]) || []
    setCustomers(custs)
    const map: Record<string, Customer> = {}
    for (const c of custs) map[c.name.toLowerCase()] = c
    setCustomersByName(map)
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [userId, agentId])
  useEffect(() => { setPage(1) }, [tab, q, typeFilter, statusFilter, timeFilter]) // eslint-disable-line

  // ── unify dues + scheduled tasks into one list ───────────────
  const items: Item[] = useMemo(() => {
    const dueItems: Item[] = credits.map(c => {
      const remaining = Number(c.amount) - Number(c.paid_amount || 0)
      const scheduledAt = c.due_date || c.created_at.slice(0, 10)
      return {
        id: `due-${c.id}`, source: 'due', type: 'due', name: c.customer_name,
        phone: customersByName[c.customer_name.toLowerCase()]?.phone || null, amount: remaining,
        note: '', suggestion: suggestFor('due', c.customer_name, remaining, scheduledAt, null),
        scheduledAt, status: computeStatus(scheduledAt), lastContactAt: null, lastContactChannel: null,
      }
    })
    const taskItems: Item[] = tasks.map(t => ({
      id: t.id, source: 'task', type: t.type, name: t.customer_name, phone: t.phone,
      note: t.note || '', suggestion: suggestFor(t.type, t.customer_name, undefined, t.scheduled_at, t.note),
      scheduledAt: t.scheduled_at, status: computeStatus(t.scheduled_at, t.status),
      lastContactAt: t.last_contact_at, lastContactChannel: t.last_contact_channel, raw: t,
    }))
    return [...dueItems, ...taskItems].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
  }, [credits, tasks, customersByName])

  const counts = {
    all: items.length,
    overdue: items.filter(i => i.status === 'overdue').length,
    due_today: items.filter(i => i.status === 'due_today').length,
    scheduled: items.filter(i => i.status === 'scheduled').length,
    completed: items.filter(i => i.status === 'completed').length,
    sales: items.filter(i => i.type === 'sales').length,
    new_customer: items.filter(i => i.type === 'new_customer').length,
  }

  const filtered = items.filter(i => {
    if (tab === 'overdue' && i.status !== 'overdue') return false
    if (tab === 'due_today' && i.status !== 'due_today') return false
    if (tab === 'scheduled' && i.status !== 'scheduled') return false
    if (tab === 'completed' && i.status !== 'completed') return false
    if (tab === 'sales' && i.type !== 'sales') return false
    if (tab === 'new_customer' && i.type !== 'new_customer') return false
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (timeFilter !== 'all') {
      const days = daysBetween(i.scheduledAt, todayStr())
      if (timeFilter === '7' && (days < -7 || days > 7)) return false
      if (timeFilter === '30' && (days < -30 || days > 30)) return false
    }
    const s = q.trim().toLowerCase()
    return !s || i.name.toLowerCase().includes(s) || (i.phone || '').includes(s) || i.note.toLowerCase().includes(s)
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize)

  // ── actions ───────────────────────────────────────────────────
  const markContacted = async (item: Item, channel: 'whatsapp' | 'call') => {
    if (item.source === 'due') return // dues are settled from the Dues page, not here
    await supabase.from('followups').update({ last_contact_at: new Date().toISOString(), last_contact_channel: channel }).eq('id', item.id)
    load()
  }

  const completeTask = async (item: Item) => {
    if (item.source !== 'task') return
    await supabase.from('followups').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', item.id)
    setMenuFor(null); load()
  }
  const cancelTask = async (item: Item) => {
    if (item.source !== 'task') return
    await supabase.from('followups').update({ status: 'canceled' }).eq('id', item.id)
    setMenuFor(null); load()
  }

  const openSchedule = (item: Item) => { setScheduleFor(item); setScheduleDate(item.scheduledAt); setMenuFor(null) }
  const saveSchedule = async () => {
    if (!scheduleFor || saving) return
    setSaving(true)
    if (scheduleFor.source === 'task') {
      await supabase.from('followups').update({ scheduled_at: scheduleDate, status: 'scheduled' }).eq('id', scheduleFor.id)
    } else {
      // scheduling a "due" reminder creates a real follow-up task tied to that customer
      const cust = customersByName[scheduleFor.name.toLowerCase()]
      await supabase.from('followups').insert({
        user_id: userId, agent_id: agentId || null, customer_id: cust?.id || null,
        customer_name: scheduleFor.name, phone: scheduleFor.phone, type: 'due',
        note: `৳${scheduleFor.amount?.toFixed(0)} বাকি নিয়ে যোগাযোগ`, scheduled_at: scheduleDate, status: 'scheduled',
      })
    }
    setSaving(false); setScheduleFor(null); load()
  }

  const addTask = async () => {
    if (!form.customer_name.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('followups').insert({
      user_id: userId, agent_id: agentId || null, customer_id: form.customer_id || null,
      customer_name: form.customer_name.trim(), phone: form.phone || null, type: form.type,
      note: form.note || null, scheduled_at: form.scheduled_at || todayStr(), status: 'scheduled',
    })
    setSaving(false)
    if (error) { console.error('followups insert:', error); setNeedsMigration(true); return }
    setForm(EMPTY_FORM); setShowAdd(false); load()
  }

  const exportXlsx = () => {
    const data = filtered.map(i => ({
      Customer: i.name, Phone: i.phone || '', Type: TYPE_LABEL[i.type], Status: i.status,
      'Scheduled Date': i.scheduledAt, 'Amount Due (৳)': i.amount || '', Note: i.note,
    }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Followups')
    XLSX.writeFile(wb, `followups-${todayStr()}.xlsx`)
  }

  // ── presentation helpers ─────────────────────────────────────
  const StatusPill = ({ s }: { s: Status }) => {
    const map: Record<Status, [string, string]> = {
      overdue: ['bg-rose-50 text-rose-600', 'সময় পার হয়েছে'], due_today: ['bg-amber-50 text-amber-600', 'আজ'],
      scheduled: ['bg-blue-50 text-blue-600', 'নির্ধারিত'], completed: ['bg-emerald-50 text-emerald-600', 'সম্পন্ন'],
      canceled: ['bg-gray-100 text-gray-400', 'বাতিল'],
    }
    const [cls, label] = map[s]
    return <span className={`inline-flex px-2.5 py-1 rounded-full text-[10.5px] font-bold bengali whitespace-nowrap ${cls}`}>{label}</span>
  }
  const TypeChip = ({ t }: { t: FollowupRow['type'] }) => (
    <span className="inline-flex px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-semibold bengali">{TYPE_LABEL[t]}</span>
  )
  const Avatar = ({ name }: { name: string }) => (
    <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 font-bold text-[13px] flex items-center justify-center flex-shrink-0">{name.trim().charAt(0).toUpperCase()}</div>
  )
  const waMsg = (i: Item) => i.type === 'due' && i.amount
    ? `নমস্কার ${i.name}, আপনার ৳${i.amount.toFixed(0)} বাকি আছে। অনুগ্রহ করে পরিশোধ করুন। ধন্যবাদ।`
    : `নমস্কার ${i.name}, ${i.note || 'কেমন আছেন? যোগাযোগ করছি।'}`

  const Actions = ({ item }: { item: Item }) => (
    <div className="flex items-center gap-1.5 flex-wrap">
      {item.phone ? (
        <a href={waLink(item.phone, waMsg(item))} target="_blank" rel="noreferrer" onClick={() => markContacted(item, 'whatsapp')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-bold bengali whitespace-nowrap"><MessageCircle size={12} /> WhatsApp</a>
      ) : (
        <span className="text-[11px] text-gray-300 bengali">ফোন নেই</span>
      )}
      {item.phone && (
        <a href={`tel:${item.phone}`} onClick={() => markContacted(item, 'call')}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold bengali whitespace-nowrap"><PhoneCall size={12} /> Call</a>
      )}
      {item.status !== 'completed' && item.status !== 'canceled' && (
        <button onClick={() => openSchedule(item)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold bengali whitespace-nowrap"><CalendarPlus size={12} /> Schedule</button>
      )}
      {item.source === 'task' && item.status !== 'completed' && item.status !== 'canceled' && (
        <div className="relative">
          <button onClick={() => setMenuFor(menuFor === item.id ? null : item.id)} className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 inline-flex items-center justify-center"><MoreVertical size={13} /></button>
          {menuFor === item.id && (
            <div className="absolute right-0 top-8 z-20 bg-white border border-gray-100 rounded-xl shadow-lg w-40 py-1">
              <button onClick={() => completeTask(item)} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 bengali"><Check size={13} className="text-emerald-500" /> সম্পন্ন করুন</button>
              <button onClick={() => cancelTask(item)} className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 bengali"><Ban size={13} className="text-rose-500" /> বাতিল করুন</button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100'

  return (
    <div className="min-w-0" onClick={() => menuFor && setMenuFor(null)}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 bengali flex items-center gap-2"><Bell size={20} className="text-indigo-500" /> ফলো-আপ</h1>
          <p className="text-gray-400 text-[13px] bengali mt-0.5">প্রাহকদের সাথে সহজে যোগাযোগ করুন, বাকি আদায় করুন এবং সম্পর্ক আরও ভালো রাখুন।</p>
        </div>
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setShowAddMenu(v => !v) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-[13px] font-bold bengali whitespace-nowrap">
            <Plus size={14} /> নতুন ফলো-আপ যোগ করুন <ChevronDown size={13} />
          </button>
          {showAddMenu && (
            <div className="absolute right-0 mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-lg w-56 py-1" onClick={e => e.stopPropagation()}>
              {QUICK_TYPES.map(qt => (
                <button key={qt.type} onClick={() => { setForm(f => ({ ...EMPTY_FORM, type: qt.type })); setShowAdd(true); setShowAddMenu(false) }}
                  className="w-full text-left px-3.5 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 bengali">{qt.label}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {needsMigration && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-[12px] bengali">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          ফলো-আপ শিডিউল করতে Supabase-এ <b>011_followups.sql</b> মাইগ্রেশনটি একবার চালান।
        </div>
      )}

      {/* AI banner */}
      <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0"><Sparkles size={20} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 text-[14px] bengali">Sahayak AI আপনাকে সাহায্য করবে</div>
          <div className="text-[12px] text-gray-500 bengali">প্রাহকদের ফলো-আপ, বাকি আদায়, পুনরায় অর্ডার এবং সম্পর্ক বজায় রাখতে।</div>
        </div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2 w-full sm:w-auto sm:min-w-[280px]">
          <span className="text-[12px] text-gray-400 bengali truncate">যেমন: "আজ যাদের বাকি আছে তাদের WhatsApp পাঠাও"</span>
          <Send size={14} className="text-indigo-500 ml-auto flex-shrink-0" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-4">
        {[
          { icon: <AlertCircle size={16} className="text-rose-500" />, bg: 'bg-rose-50', v: counts.overdue, l: 'Overdue', sub: 'সময় পার হয়ে গেছে' },
          { icon: <CalendarClock size={16} className="text-amber-500" />, bg: 'bg-amber-50', v: counts.due_today, l: 'Due Today', sub: 'আজ ফলো-আপ করুন' },
          { icon: <Clock3 size={16} className="text-blue-500" />, bg: 'bg-blue-50', v: counts.scheduled, l: 'Scheduled', sub: 'নির্ধারিত ফলো-আপ' },
          { icon: <CheckCircle2 size={16} className="text-emerald-500" />, bg: 'bg-emerald-50', v: counts.completed, l: 'Completed', sub: 'সম্পন্ন হয়েছে' },
          { icon: <Users size={16} className="text-indigo-500" />, bg: 'bg-indigo-50', v: customers.length, l: 'Total Customers', sub: 'মোট প্রাহক' },
        ].map((c, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>{c.icon}</div>
            <div className="min-w-0">
              <div className="font-extrabold text-gray-900 text-[17px] leading-tight">{c.v}</div>
              <div className="text-[10.5px] text-gray-500 leading-tight">{c.l}</div>
              <div className="text-[10px] text-gray-400 bengali">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-3 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {([
          ['all', `সকল (${counts.all})`], ['overdue', `Overdue (${counts.overdue})`], ['due_today', `Due Today (${counts.due_today})`],
          ['scheduled', `Scheduled (${counts.scheduled})`], ['completed', `Completed (${counts.completed})`],
          ['sales', `Sales Follow-up (${counts.sales})`], ['new_customer', `New Customers (${counts.new_customer})`],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold bengali transition-colors whitespace-nowrap flex-shrink-0 ${tab === k ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>{label}</button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="কাস্টমারের নাম বা ফোন নম্বর দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
          <option value="all">সব ধরন</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
          <option value="all">সব স্ট্যাটাস</option>
          <option value="overdue">Overdue</option><option value="due_today">Due Today</option>
          <option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="canceled">Canceled</option>
        </select>
        <select value={timeFilter} onChange={e => setTimeFilter(e.target.value as any)} className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
          <option value="all">সব সময়</option><option value="7">৭ দিনের মধ্যে</option><option value="30">৩০ দিনের মধ্যে</option>
        </select>
        <button onClick={exportXlsx} disabled={filtered.length === 0}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[13px] font-bold bengali whitespace-nowrap disabled:opacity-50"><Download size={14} /> Export</button>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm bengali flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> লোড হচ্ছে...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <Bell size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 text-sm bengali">{items.length === 0 ? 'এখনো কোনো ফলো-আপ নেই 🎉' : 'কোনো ফলো-আপ পাওয়া যায়নি।'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] bengali">
                  <th className="px-3 py-3 font-semibold">প্রাহক</th>
                  <th className="px-3 py-3 font-semibold">বিবরণ</th>
                  <th className="px-3 py-3 font-semibold hidden xl:table-cell">AI পরামর্শ</th>
                  <th className="px-3 py-3 font-semibold whitespace-nowrap hidden lg:table-cell">শেষ যোগাযোগ</th>
                  <th className="px-3 py-3 font-semibold text-center">স্ট্যাটাস</th>
                  <th className="px-3 py-3 font-semibold">করণীয়</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 align-top">
                    <td className="px-3 py-3 max-w-[170px]">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={item.name} />
                        <div className="min-w-0">
                          <div className="font-bold text-gray-900 bengali truncate">{item.name}</div>
                          {item.phone && <div className="text-[11px] text-gray-400">{item.phone}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[160px]">
                      {item.type === 'due' && item.amount ? (
                        <div className="font-bold text-red-600 whitespace-nowrap">৳{item.amount.toFixed(0)} বাকি</div>
                      ) : <TypeChip t={item.type} />}
                      <div className="text-[10.5px] text-gray-400 bengali mt-0.5">{shortDate(item.scheduledAt)}</div>
                    </td>
                    <td className="px-3 py-3 max-w-[220px] hidden xl:table-cell">
                      <div className="flex items-start gap-1.5 text-gray-600 bengali">
                        <Sparkles size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span>{item.suggestion}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden lg:table-cell bengali">
                      {relDate(item.lastContactAt)}{item.lastContactChannel && <div className="text-[10.5px] text-gray-400">{item.lastContactChannel === 'whatsapp' ? 'WhatsApp' : 'Call'}</div>}
                    </td>
                    <td className="px-3 py-3 text-center"><StatusPill s={item.status} /></td>
                    <td className="px-3 py-3"><Actions item={item} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {paged.map(item => (
              <div key={item.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={item.name} />
                    <div className="min-w-0">
                      <div className="font-bold text-gray-900 bengali truncate">{item.name}</div>
                      {item.phone && <div className="text-[11.5px] text-gray-500">{item.phone}</div>}
                    </div>
                  </div>
                  <StatusPill s={item.status} />
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {item.type === 'due' && item.amount ? <span className="font-bold text-red-600 text-[13px]">৳{item.amount.toFixed(0)} বাকি</span> : <TypeChip t={item.type} />}
                  <span className="text-[10.5px] text-gray-400 bengali">{shortDate(item.scheduledAt)}</span>
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-[12px] text-gray-600 bengali bg-indigo-50/50 rounded-lg p-2">
                  <Sparkles size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" /><span>{item.suggestion}</span>
                </div>
                <div className="mt-2 text-[11px] text-gray-400 bengali">শেষ যোগাযোগ: {relDate(item.lastContactAt)}</div>
                <div className="mt-3"><Actions item={item} /></div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-t border-gray-100">
              <span className="text-[12px] text-gray-400 bengali">মোট {filtered.length} টি ফলো-আপ</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[12px] disabled:opacity-30">আগে</button>
                <span className="text-[12px] font-semibold text-gray-600 px-2">{pageSafe} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-[12px] disabled:opacity-30">পরে</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add follow-up modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">নতুন ফলো-আপ যোগ করুন</h3>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as FollowupRow['type'] }))} className={`${inputCls} bg-white`}>
                {QUICK_TYPES.map(qt => <option key={qt.type} value={qt.type}>{qt.label}</option>)}
              </select>
              <select value={form.customer_id} onChange={e => {
                const cust = customers.find(c => c.id === e.target.value)
                setForm(f => ({ ...f, customer_id: e.target.value, customer_name: cust?.name || f.customer_name, phone: cust?.phone || f.phone }))
              }} className={`${inputCls} bg-white`}>
                <option value="">কাস্টমার বাছুন (ঐচ্ছিক)</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input placeholder="কাস্টমারের নাম" value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} className={inputCls} />
              <input placeholder="ফোন নম্বর" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              <input type="date" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} className={inputCls} />
              <textarea placeholder="নোট (ঐচ্ছিক)" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={inputCls} rows={2} />
              <button onClick={addTask} disabled={saving || !form.customer_name.trim()} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'যোগ করুন'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule / reschedule modal */}
      {scheduleFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setScheduleFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{scheduleFor.name} — শিডিউল</h3>
              <button onClick={() => setScheduleFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className={`${inputCls} mb-3`} />
            <button onClick={saveSchedule} disabled={saving} className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">{saving ? 'সেভ হচ্ছে...' : 'নিশ্চিত করুন'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
