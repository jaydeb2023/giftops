'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LIBRARY_AGENT_NAMES_BN, LibraryVertical } from '@/lib/libraryAgentIds'
import { POSITION_OPTIONS_BN, categorizePosition, POSITION_CATEGORY_LABELS_BN, type PositionCategory } from '@/lib/teamPositions'
import BusinessSidebar from '@/components/BusinessSidebar'
import MemberForm, { type AgentOption, type MemberFormValues } from '@/components/team/MemberForm'
import TeamAIAssistant from '@/components/team/TeamAIAssistant'
import ImportExcelModal from '@/components/team/ImportExcelModal'
import {
  Users, UserCheck, UserX, Bot, Upload, Plus, Search, Filter, Copy, Check,
  Pencil, Eye, MoreVertical, X, ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Member {
  id: string
  name: string | null
  email: string
  mobile: string | null
  position_title: string | null
  role: string
  status: string
  created_at: string
  last_active_at: string | null
  agents: string[]
  agentRefs: { kind: string; ref: string }[]
}

type TabKey = 'all' | 'active' | 'inactive' | PositionCategory

const AVATAR_PALETTE = ['#EF4444', '#F97316', '#F59E0B', '#22C55E', '#06B6D4', '#6366F1', '#A855F7', '#EC4899']
function avatarColor(seed: string) {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length]
}

// The dashboard's role-based sidebar gating (see src/lib/roleTabs.ts) only
// understands three DB roles: 'admin' | 'sales' | 'stock'. The পদবী dropdown
// here has more options than that (Cashier, Delivery, Support, ...), so this
// maps the free-text position down to the role that actually controls what
// the person can see once they log in. Kept in sync with categorizePosition's
// own buckets: 'admin' and 'stock' map 1:1, everything else (sales, cash,
// other) becomes 'sales' — cashiers and delivery/support staff get the
// billing/customer view rather than no view at all.
function dbRoleForPosition(positionTitle: string): 'admin' | 'sales' | 'stock' {
  const cat = categorizePosition(positionTitle, null)
  if (cat === 'admin') return 'admin'
  if (cat === 'stock') return 'stock'
  return 'sales'
}

function StatusPill({ status }: { status: string }) {
  if (status === 'active') return <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 bengali">সক্রিয়</span>
  if (status === 'revoked') return <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-red-50 text-red-500 bengali">বাতিল</span>
  return <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-600 bengali">Invite পাঠানো হয়েছে</span>
}

function StatCard({ icon, iconBg, value, label, sub }: { icon: React.ReactNode; iconBg: string; value: number | string; label: string; sub: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs font-semibold text-gray-600 bengali truncate">{label}</div>
        <div className="text-[11px] text-gray-400 bengali truncate">{sub}</div>
      </div>
    </div>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TeamPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [agentOptions, setAgentOptions] = useState<AgentOption[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // Add-member (persistent panel on desktop, modal on mobile)
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [mobileAddOpen, setMobileAddOpen] = useState(false)
  const [formNonce, setFormNonce] = useState(0) // bump to reset the form after a successful add
  const panelRef = useRef<HTMLDivElement>(null)

  // Edit modal
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editBusy, setEditBusy] = useState(false)
  const [editError, setEditError] = useState('')

  // Import Excel
  const [importOpen, setImportOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [positionFilter, setPositionFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [sortByLastActive, setSortByLastActive] = useState(false)

  // Table
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const loadMembers = async (uid: string) => {
    const res = await fetch(`/api/team?userId=${uid}`)
    const data = await res.json()
    if (res.ok) setMembers(data.members || [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)

      const { data: customAgents } = await supabase.from('agents').select('id, name, name_bn').eq('user_id', uid)
      const customOptions: AgentOption[] = (customAgents || []).map(a => ({ kind: 'custom', ref: a.id, label: a.name_bn || a.name }))

      const { data: activations } = await supabase.from('user_agent_activations').select('ref').eq('user_id', uid).eq('kind', 'library')
      const libraryOptions: AgentOption[] = (activations || []).map(a => ({
        kind: 'library', ref: a.ref, label: LIBRARY_AGENT_NAMES_BN[a.ref as LibraryVertical] || a.ref,
      }))

      setAgentOptions([...libraryOptions, ...customOptions])
      await loadMembers(uid)
      setLoading(false)
    })
  }, [])

  useEffect(() => { setPage(1) }, [search, tab, positionFilter, statusFilter, agentFilter])

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = members.length
    const active = members.filter(m => m.status === 'active').length
    const inactive = members.filter(m => m.status !== 'active').length
    const asAgent = members.filter(m => m.agents.length > 0).length
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const newThisMonth = members.filter(m => new Date(m.created_at).getTime() > thirtyDaysAgo).length
    return { total, active, inactive, asAgent, newThisMonth }
  }, [members])

  const tabCounts = useMemo(() => {
    const counts: Record<TabKey, number> = { all: members.length, active: 0, inactive: 0, admin: 0, sales: 0, stock: 0, cash: 0, other: 0 }
    for (const m of members) {
      if (m.status === 'active') counts.active++
      else counts.inactive++
      const cat = categorizePosition(m.position_title, m.role)
      counts[cat]++
    }
    return counts
  }, [members])

  // ── Filtering + sorting ───────────────────────────────────────
  const filtered = useMemo(() => {
    let list = members
    if (tab === 'active') list = list.filter(m => m.status === 'active')
    else if (tab === 'inactive') list = list.filter(m => m.status !== 'active')
    else if (tab !== 'all') list = list.filter(m => categorizePosition(m.position_title, m.role) === tab)

    if (positionFilter !== 'all') list = list.filter(m => m.position_title === positionFilter)
    if (statusFilter !== 'all') list = list.filter(m => m.status === statusFilter)
    if (agentFilter !== 'all') list = list.filter(m => m.agents.includes(agentFilter))

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.mobile || '').includes(q) ||
        (m.position_title || '').toLowerCase().includes(q) ||
        m.agents.some(a => a.toLowerCase().includes(q))
      )
    }

    if (sortByLastActive) {
      list = [...list].sort((a, b) => new Date(b.last_active_at || 0).getTime() - new Date(a.last_active_at || 0).getTime())
    }
    return list
  }, [members, tab, positionFilter, statusFilter, agentFilter, search, sortByLastActive])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  const allVisibleSelected = paginated.length > 0 && paginated.every(m => selectedIds.has(m.id))
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) paginated.forEach(m => next.delete(m.id))
      else paginated.forEach(m => next.add(m.id))
      return next
    })
  }
  const toggleSelectOne = (id: string) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  // ── Add member ────────────────────────────────────────────────
  const submitAdd = async (values: MemberFormValues) => {
    if (!userId) return
    setAddError(''); setInviteLink(''); setAddBusy(true)
    try {
      const agents = values.selectedAgentKeys.map(key => {
        const [kind, ref] = key.split(':') as ['library' | 'custom', string]
        return { kind, ref }
      })
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, name: values.name, mobile: values.mobile, email: values.email,
          positionTitle: values.positionTitle,
          role: dbRoleForPosition(values.positionTitle),
          agents,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'সমস্যা হয়েছে।'); setAddBusy(false); return }
      setInviteLink(data.inviteLink)
      setFormNonce(n => n + 1)
      setMobileAddOpen(false)
      await loadMembers(userId)
      toast.success('কর্মী যোগ হয়েছে')
    } catch {
      setAddError('সমস্যা হয়েছে, আবার চেষ্টা করুন।')
    }
    setAddBusy(false)
  }

  const scrollOrOpenAddForm = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setMobileAddOpen(true)
    else panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  // ── Edit / status / delete ───────────────────────────────────
  const submitEdit = async (values: MemberFormValues) => {
    if (!userId || !editingMember) return
    setEditError(''); setEditBusy(true)
    try {
      const agents = values.selectedAgentKeys.map(key => {
        const [kind, ref] = key.split(':') as ['library' | 'custom', string]
        return { kind, ref }
      })
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, memberId: editingMember.id,
          name: values.name, mobile: values.mobile, email: values.email,
          positionTitle: values.positionTitle,
          role: dbRoleForPosition(values.positionTitle),
          agents,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setEditError(data.error || 'সমস্যা হয়েছে।'); setEditBusy(false); return }
      setEditingMember(null)
      await loadMembers(userId)
      toast.success('তথ্য আপডেট হয়েছে')
    } catch {
      setEditError('সমস্যা হয়েছে, আবার চেষ্টা করুন।')
    }
    setEditBusy(false)
  }

  const toggleStatus = async (m: Member) => {
    if (!userId) return
    const nextStatus = m.status === 'revoked' ? 'active' : 'revoked'
    await fetch('/api/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, memberId: m.id, status: nextStatus }),
    })
    setOpenMenuId(null)
    await loadMembers(userId)
  }

  const deleteMember = async (m: Member) => {
    if (!userId) return
    if (!confirm(`${m.name || m.email}-কে ডিলিট করতে চান? এটা আর ফিরিয়ে আনা যাবে না।`)) return
    await fetch('/api/team', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, memberId: m.id }),
    })
    setOpenMenuId(null)
    await loadMembers(userId)
  }

  const bulkRevoke = async () => {
    if (!userId || selectedIds.size === 0) return
    await Promise.all([...selectedIds].map(id =>
      fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, memberId: id, status: 'revoked' }) })
    ))
    setSelectedIds(new Set())
    await loadMembers(userId)
  }

  const rosterForAssistant = members.map(m => ({
    name: m.name, email: m.email, mobile: m.mobile, positionTitle: m.position_title,
    status: m.status, agents: m.agents, lastActiveAt: m.last_active_at,
  }))

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 bengali">লোড হচ্ছে…</div>
  }
  if (!userId) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500 bengali">লগইন করুন।</div>
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'সকল' },
    { key: 'active', label: 'সক্রিয়' },
    { key: 'inactive', label: 'নিষ্ক্রিয়' },
    { key: 'admin', label: POSITION_CATEGORY_LABELS_BN.admin },
    { key: 'sales', label: POSITION_CATEGORY_LABELS_BN.sales },
    { key: 'stock', label: POSITION_CATEGORY_LABELS_BN.stock },
    { key: 'cash', label: POSITION_CATEGORY_LABELS_BN.cash },
    { key: 'other', label: POSITION_CATEGORY_LABELS_BN.other },
  ]

  return (
    <BusinessSidebar active="team" searchValue={search} onSearchChange={setSearch}
      searchPlaceholder="কর্মীর নাম, ইমেইল, মোবাইল, পদবী বা এজেন্ট খুঁজুন..."
      notificationCount={stats.inactive}
      onRefresh={() => loadMembers(userId)}>
      <div className="max-w-[1400px] mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 bengali">টিম ও কর্মচারী</h1>
            <p className="text-gray-500 text-sm bengali mt-0.5">আপনার ব্যবসায় কাজ করা সকল কর্মচারী, সেলসম্যান এবং এজেন্টদের পরিচালনা করুন</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 border border-gray-200 hover:bg-gray-50 text-gray-600 font-semibold rounded-xl px-4 py-2.5 text-sm bengali">
              <Upload size={15} /> Import Excel
            </button>
            <button onClick={scrollOrOpenAddForm}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-4 py-2.5 text-sm bengali">
              <Plus size={15} /> নতুন কর্মী যোগ করুন
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<Users size={18} className="text-indigo-600" />} iconBg="#EEF2FF" value={stats.total}
            label="মোট টিম সদস্য" sub={stats.newThisMonth > 0 ? `↑${stats.newThisMonth} গত মাসের তুলনায়` : 'গত মাসের তুলনায়'} />
          <StatCard icon={<UserCheck size={18} className="text-emerald-600" />} iconBg="#ECFDF5" value={stats.active}
            label="সক্রিয়" sub="এই মুহূর্তে কাজ করছে" />
          <StatCard icon={<UserX size={18} className="text-amber-600" />} iconBg="#FFFBEB" value={stats.inactive}
            label="নিষ্ক্রিয়" sub="লগইন করেনি" />
          <StatCard icon={<Bot size={18} className="text-violet-600" />} iconBg="#F5F3FF" value={stats.asAgent}
            label="এজেন্ট হিসেবে কাজ করছে" sub="একাধিক এজেন্ট আসাইন" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Left: filters + table */}
          <div className="min-w-0">
            {/* Filter tabs */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`flex-shrink-0 text-xs font-bold px-3.5 py-2 rounded-xl bengali transition-colors ${
                    tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {t.label} ({tabCounts[t.key]})
                </button>
              ))}
            </div>

            {/* Search + dropdown filters */}
            <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="নাম, মোবাইল, ইমেইল বা পদবী দিয়ে খুঁজুন..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 text-xs bengali outline-none focus:border-indigo-400" />
              </div>
              <select value={positionFilter} onChange={e => setPositionFilter(e.target.value)}
                className="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 bengali outline-none focus:border-indigo-400 bg-white">
                <option value="all">সকল পদবী</option>
                {POSITION_OPTIONS_BN.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 bengali outline-none focus:border-indigo-400 bg-white">
                <option value="all">সকল স্ট্যাটাস</option>
                <option value="active">সক্রিয়</option>
                <option value="invited">Invite পাঠানো হয়েছে</option>
                <option value="revoked">বাতিল</option>
              </select>
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
                className="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 bengali outline-none focus:border-indigo-400 bg-white max-w-[160px]">
                <option value="all">সকল এজেন্ট</option>
                {agentOptions.map(a => <option key={`${a.kind}:${a.ref}`} value={a.label}>{a.label}</option>)}
              </select>
              <button onClick={() => { setSearch(''); setPositionFilter('all'); setStatusFilter('all'); setAgentFilter('all'); setTab('all') }}
                className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-2 bengali flex-shrink-0">
                <Filter size={13} /> ফিল্টার রিসেট
              </button>
            </div>

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 mb-3">
                <span className="text-xs font-bold text-indigo-700 bengali">{selectedIds.size}টি নির্বাচিত</span>
                <div className="flex items-center gap-3">
                  <button onClick={bulkRevoke} className="text-xs font-bold text-red-500 hover:text-red-700 bengali">বাতিল করুন</button>
                  <button onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-gray-400 hover:text-gray-600 bengali">নির্বাচন মুছুন</button>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/60">
                      <th className="w-9 px-3 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} /></th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase">#</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">নাম</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">মোবাইল</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">ইমেইল</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">পদবী</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">অ্যাসাইন এজেন্ট</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">স্ট্যাটাস</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">শেষ লগইন</th>
                      <th className="text-left px-2 py-3 text-[11px] font-bold text-gray-400 uppercase bengali">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((m, i) => (
                      <tr key={m.id} className="hover:bg-gray-50/50">
                        <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggleSelectOne(m.id)} /></td>
                        <td className="px-2 py-3 text-gray-400 text-xs">{(page - 1) * pageSize + i + 1}</td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                              style={{ background: avatarColor(m.name || m.email) }}>
                              {(m.name || m.email).charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-gray-800 truncate bengali">{m.name || '—'}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-gray-600 whitespace-nowrap">{m.mobile || '—'}</td>
                        <td className="px-2 py-3 text-gray-500 truncate max-w-[160px]">{m.email}</td>
                        <td className="px-2 py-3 text-gray-600 bengali whitespace-nowrap">{m.position_title || '—'}</td>
                        <td className="px-2 py-3 text-gray-600 bengali max-w-[140px] truncate" title={m.agents.join(', ')}>
                          {m.agents.length ? (m.agents.length === 1 ? m.agents[0] : `${m.agents[0]} +${m.agents.length - 1}`) : 'কোনো এজেন্ট নেই'}
                        </td>
                        <td className="px-2 py-3"><StatusPill status={m.status} /></td>
                        <td className="px-2 py-3 text-gray-500 whitespace-nowrap text-xs">{formatDate(m.last_active_at)}</td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1 relative">
                            <button onClick={() => setEditingMember(m)} title="এডিট করুন" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600"><Pencil size={14} /></button>
                            <button onClick={() => setEditingMember(m)} title="দেখুন" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-indigo-600"><Eye size={14} /></button>
                            <button onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)} title="আরও" className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><MoreVertical size={14} /></button>
                            {openMenuId === m.id && (
                              <div className="absolute right-0 top-8 z-10 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-40">
                                <button onClick={() => toggleStatus(m)} className="w-full text-left px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 bengali">
                                  {m.status === 'revoked' ? 'সক্রিয় করুন' : 'বাতিল করুন'}
                                </button>
                                <button onClick={() => deleteMember(m)} className="w-full text-left px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 bengali">ডিলিট করুন</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {paginated.length === 0 && (
                      <tr><td colSpan={10} className="text-center py-10 text-sm text-gray-400 bengali">কোনো কর্মী পাওয়া যায়নি।</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400 bengali">মোট {filtered.length} জন কর্মী</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span className="text-xs font-semibold text-gray-600">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 disabled:opacity-40"><ChevronRight size={14} /></button>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                    className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 outline-none">
                    {[10, 25, 50].map(n => <option key={n} value={n}>{n} / পৃষ্ঠা</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right: add-member panel + AI assistant (desktop only; mobile uses the header button → modal) */}
          <div ref={panelRef} className="hidden lg:flex flex-col gap-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-bold text-gray-900 bengali mb-4">নতুন কর্মী যোগ করুন</h2>
              <MemberForm key={formNonce} agentOptions={agentOptions} busy={addBusy} error={addError} submitLabel="কর্মী যোগ করুন" onSubmit={submitAdd} />
              {inviteLink && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-500 bengali mb-1.5">Invite via Link</p>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <span className="text-[11px] text-gray-500 truncate flex-1">{inviteLink}</span>
                    <button onClick={copyInviteLink} className="text-indigo-600 flex-shrink-0">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                  </div>
                  <p className="text-[11px] text-gray-400 bengali mt-1.5">এই লিংকটি শেয়ার করে কর্মীকে আমন্ত্রণ জানান</p>
                </div>
              )}
            </div>

            <TeamAIAssistant
              roster={rosterForAssistant}
              onOpenAddForm={scrollOrOpenAddForm}
              onGroupByAgent={() => setTab('all')}
              onSortByLastActive={() => setSortByLastActive(true)}
            />
          </div>
        </div>
      </div>

      {/* Mobile add-member modal */}
      {mobileAddOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 bengali">নতুন কর্মী যোগ করুন</h2>
              <button onClick={() => setMobileAddOpen(false)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <MemberForm key={`m-${formNonce}`} agentOptions={agentOptions} busy={addBusy} error={addError} submitLabel="কর্মী যোগ করুন" onSubmit={submitAdd} />
            {inviteLink && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-bold text-gray-500 bengali mb-1.5">Invite via Link</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <span className="text-[11px] text-gray-500 truncate flex-1">{inviteLink}</span>
                  <button onClick={copyInviteLink} className="text-indigo-600 flex-shrink-0">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit member modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 bengali">কর্মীর তথ্য এডিট করুন</h2>
              <button onClick={() => setEditingMember(null)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <MemberForm
              key={editingMember.id}
              agentOptions={agentOptions}
              busy={editBusy}
              error={editError}
              submitLabel="সেভ করুন"
              onSubmit={submitEdit}
              initial={{
                name: editingMember.name || '',
                mobile: editingMember.mobile || '',
                email: editingMember.email,
                positionTitle: editingMember.position_title || POSITION_OPTIONS_BN[0],
                selectedAgentKeys: editingMember.agentRefs.map(r => `${r.kind}:${r.ref}`),
              }}
            />
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400 bengali">যোগ হয়েছে {formatDate(editingMember.created_at)}</span>
              <StatusPill status={editingMember.status} />
            </div>
          </div>
        </div>
      )}

      {importOpen && userId && (
        <ImportExcelModal userId={userId} onClose={() => setImportOpen(false)} onDone={() => loadMembers(userId)} />
      )}
    </BusinessSidebar>
  )
}
