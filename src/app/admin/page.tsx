'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, Search, ShieldAlert, Users, TrendingUp, Clock, XCircle,
  Settings2, X, Bot, Star, Eye, EyeOff, Trash2, Plus, Pencil, LayoutGrid,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { computeAccess, Subscription } from '@/lib/subscription'
import { CATEGORY_LABELS, TOOL_LABELS, AgentCategory, AgentTool } from '@/types'
import toast from 'react-hot-toast'

const PLAN_LABEL: Record<string, string> = { basic: 'Basic', starter: 'Starter', business: 'Business', growth: 'Legacy Growth', monthly: 'Legacy ₹199' }
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as AgentCategory[]
const ALL_TOOLS = Object.keys(TOOL_LABELS) as AgentTool[]

interface AdminUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  is_admin: boolean
  agent_count: number
  subscription: Subscription | null
}

interface AdminAgent {
  id: string
  user_id: string
  name: string
  name_bn?: string | null
  description: string
  description_bn?: string | null
  category: AgentCategory
  tools: AgentTool[]
  system_prompt: string
  icon: string
  color: string
  is_public: boolean
  is_featured: boolean
  use_count: number
  created_at: string
  updated_at: string
  owner: { id: string; email: string; full_name: string | null } | null
}

function StatusBadge({ sub }: { sub: Subscription | null }) {
  const { isActive, isTrialing, isExpired, daysLeftInTrial } = computeAccess(sub)
  if (isActive) {
    return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">Active</span>
  }
  if (isTrialing) {
    return (
      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600">
        Trial · {daysLeftInTrial}d left
      </span>
    )
  }
  return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Expired</span>
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${accent || 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

const emptyAgentDraft = {
  user_id: '',
  name: '',
  name_bn: '',
  description: '',
  description_bn: '',
  category: 'business' as AgentCategory,
  tools: ['memory', 'calculations'] as AgentTool[],
  system_prompt: '',
  icon: '⚡',
  color: '#EEF2FF',
  is_public: false,
  is_featured: false,
}

export default function AdminPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState<'users' | 'agents'>('users')

  // ---------- Users tab state ----------
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

  // ---------- Agents tab state ----------
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentSearch, setAgentSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'all' | AgentCategory>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private' | 'featured'>('all')
  const [editingAgent, setEditingAgent] = useState<AdminAgent | null>(null)
  const [agentDraft, setAgentDraft] = useState(emptyAgentDraft)
  const [savingAgent, setSavingAgent] = useState(false)
  const [creatingAgent, setCreatingAgent] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [ownerQuery, setOwnerQuery] = useState('')

  const reloadUsers = async () => {
    const res = await fetch('/api/admin/users')
    const json = await res.json()
    setUsers(json.users || [])
  }

  const reloadAgents = async () => {
    setAgentsLoading(true)
    const res = await fetch('/api/admin/agents')
    const json = await res.json()
    setAgents(json.agents || [])
    setAgentsLoading(false)
  }

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

  // ---------- Agent actions ----------
  const openEditAgent = (a: AdminAgent) => {
    setEditingAgent(a)
    setAgentDraft({
      user_id: a.user_id,
      name: a.name,
      name_bn: a.name_bn || '',
      description: a.description,
      description_bn: a.description_bn || '',
      category: a.category,
      tools: a.tools || [],
      system_prompt: a.system_prompt,
      icon: a.icon,
      color: a.color,
      is_public: a.is_public,
      is_featured: a.is_featured,
    })
    setOwnerQuery(a.owner?.email || '')
  }

  const openCreateAgent = () => {
    setAgentDraft(emptyAgentDraft)
    setOwnerQuery('')
    setCreatingAgent(true)
  }

  const closeAgentModal = () => {
    setEditingAgent(null)
    setCreatingAgent(false)
    setAgentDraft(emptyAgentDraft)
    setOwnerQuery('')
  }

  const toggleTool = (tool: AgentTool) => {
    setAgentDraft((d) => ({
      ...d,
      tools: d.tools.includes(tool) ? d.tools.filter((t) => t !== tool) : [...d.tools, tool],
    }))
  }

  const saveAgent = async () => {
    if (!agentDraft.name.trim() || !agentDraft.description.trim() || !agentDraft.system_prompt.trim()) {
      toast.error('Name, description, and system prompt are required')
      return
    }
    if (creatingAgent && !agentDraft.user_id) {
      toast.error('Pick an owner for this agent')
      return
    }
    setSavingAgent(true)
    try {
      if (editingAgent) {
        const res = await fetch(`/api/admin/agents/${editingAgent.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentDraft),
        })
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Update failed') }
        toast.success('Agent updated')
      } else {
        const res = await fetch('/api/admin/agents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(agentDraft),
        })
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Create failed') }
        toast.success('Agent created')
      }
      closeAgentModal()
      reloadAgents()
    } catch (e: any) {
      toast.error(e.message || 'Something went wrong')
    }
    setSavingAgent(false)
  }

  const quickToggle = async (a: AdminAgent, field: 'is_public' | 'is_featured') => {
    const res = await fetch(`/api/admin/agents/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !a[field] }),
    })
    if (!res.ok) { toast.error('Failed to update'); return }
    setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, [field]: !x[field] } : x)))
  }

  const deleteAgent = async (a: AdminAgent) => {
    if (!confirm(`Delete "${a.name}"? This also deletes its conversation history. This can't be undone.`)) return
    setDeletingId(a.id)
    const res = await fetch(`/api/admin/agents/${a.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete agent') }
    else { toast.success('Agent deleted'); setAgents((prev) => prev.filter((x) => x.id !== a.id)) }
    setDeletingId(null)
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/login?next=/admin')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
      if (!profile?.is_admin) {
        setChecking(false)
        setAuthorized(false)
        return
      }
      setAuthorized(true)
      setChecking(false)

      const [usersRes, agentsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/agents'),
      ])
      const usersJson = await usersRes.json()
      const agentsJson = await agentsRes.json()
      setUsers(usersJson.users || [])
      setAgents(agentsJson.agents || [])
      setLoading(false)
      setAgentsLoading(false)
    }
    init()
  }, [router])

  const matchingOwners = useMemo(() => {
    if (!ownerQuery.trim()) return users.slice(0, 6)
    const q = ownerQuery.toLowerCase()
    return users.filter((u) => u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q)).slice(0, 6)
  }, [ownerQuery, users])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <ShieldAlert className="text-red-400" size={32} />
        <p className="text-gray-700 font-semibold">You don't have access to this page.</p>
        <p className="text-gray-400 text-sm">Admin access is restricted.</p>
      </div>
    )
  }

  const stats = {
    total: users.length,
    active: users.filter((u) => computeAccess(u.subscription).isActive).length,
    trialing: users.filter((u) => computeAccess(u.subscription).isTrialing).length,
    expired: users.filter((u) => computeAccess(u.subscription).isExpired).length,
  }
  const mrr = users.filter((u) => computeAccess(u.subscription).isActive)
    .reduce((sum, u) => sum + (u.subscription?.amount || 19900), 0) / 100

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) || (u.full_name || '').toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch) return false
    if (filter === 'all') return true
    const access = computeAccess(u.subscription)
    if (filter === 'active') return access.isActive
    if (filter === 'trialing') return access.isTrialing
    if (filter === 'expired') return access.isExpired
    return true
  })

  const agentStats = {
    total: agents.length,
    public: agents.filter((a) => a.is_public).length,
    featured: agents.filter((a) => a.is_featured).length,
    categories: new Set(agents.map((a) => a.category)).size,
  }

  const filteredAgents = agents.filter((a) => {
    const q = agentSearch.toLowerCase()
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      (a.name_bn || '').toLowerCase().includes(q) ||
      (a.owner?.email || '').toLowerCase().includes(q) ||
      (a.owner?.full_name || '').toLowerCase().includes(q)
    if (!matchesSearch) return false
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
    if (visibilityFilter === 'public' && !a.is_public) return false
    if (visibilityFilter === 'private' && a.is_public) return false
    if (visibilityFilter === 'featured' && !a.is_featured) return false
    return true
  })

  const isEditorOpen = !!editingAgent || creatingAgent

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Super Admin</h1>
        <p className="text-gray-400 text-sm mb-6">Users, subscriptions, and every agent on the platform</p>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          <button
            onClick={() => setTab('users')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'users' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Users size={15} /> Users
          </button>
          <button
            onClick={() => setTab('agents')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'agents' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Bot size={15} /> Agents
          </button>
        </div>

        {tab === 'users' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<Users size={16} />} label="Total users" value={stats.total} />
              <StatCard icon={<TrendingUp size={16} />} label="Active subs" value={stats.active} accent="text-emerald-600" />
              <StatCard icon={<Clock size={16} />} label="On trial" value={stats.trialing} accent="text-amber-600" />
              <StatCard icon={<XCircle size={16} />} label="Expired" value={stats.expired} accent="text-gray-400" />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              <span className="text-sm text-gray-600">
                Estimated MRR: <span className="font-bold text-gray-900">₹{mrr.toLocaleString('en-IN')}</span>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email or name..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {(['all', 'active', 'trialing', 'expired'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      filter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
              {loading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="animate-spin text-indigo-600" size={22} />
                </div>
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
                            {u.email} {u.is_admin && <span className="text-indigo-500 font-semibold">· admin</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <StatusBadge sub={u.subscription} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {u.subscription?.plan ? (PLAN_LABEL[u.subscription.plan] || u.subscription.plan) : '—'}
                          {u.subscription?.amount === 0 && u.subscription?.plan && (
                            <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">FREE</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.agent_count}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {u.subscription?.last_payment_at
                            ? new Date(u.subscription.last_payment_at).toLocaleDateString('en-IN')
                            : '—'}
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
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                          No users match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'agents' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={<Bot size={16} />} label="Total agents" value={agentStats.total} />
              <StatCard icon={<Eye size={16} />} label="Public" value={agentStats.public} accent="text-emerald-600" />
              <StatCard icon={<Star size={16} />} label="Featured" value={agentStats.featured} accent="text-amber-600" />
              <StatCard icon={<LayoutGrid size={16} />} label="Categories in use" value={agentStats.categories} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={agentSearch}
                  onChange={(e) => setAgentSearch(e.target.value)}
                  placeholder="Search by agent name or owner..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as any)}
                className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white"
              >
                <option value="all">All categories</option>
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c].en}</option>
                ))}
              </select>
              <div className="flex gap-1.5">
                {(['all', 'public', 'private', 'featured'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setVisibilityFilter(f)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      visibilityFilter === f ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={openCreateAgent}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold whitespace-nowrap"
              >
                <Plus size={15} /> New agent
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
              {agentsLoading ? (
                <div className="p-10 flex justify-center">
                  <Loader2 className="animate-spin text-indigo-600" size={22} />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                      <th className="px-4 py-3 font-medium">Agent</th>
                      <th className="px-4 py-3 font-medium">Owner</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Uses</th>
                      <th className="px-4 py-3 font-medium">Public</th>
                      <th className="px-4 py-3 font-medium">Featured</th>
                      <th className="px-4 py-3 font-medium">Created</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((a) => (
                      <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                              style={{ backgroundColor: a.color }}
                            >
                              {a.icon}
                            </span>
                            <div>
                              <div className="font-semibold text-gray-800">{a.name}</div>
                              {a.name_bn && a.name_bn !== a.name && (
                                <div className="text-gray-400 text-xs">{a.name_bn}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-700">{a.owner?.full_name || '—'}</div>
                          <div className="text-gray-400 text-xs">{a.owner?.email || 'Unknown user'}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {CATEGORY_LABELS[a.category]?.en || a.category}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{a.use_count}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => quickToggle(a, 'is_public')}
                            title={a.is_public ? 'Public — click to make private' : 'Private — click to make public'}
                            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                              a.is_public ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {a.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                            {a.is_public ? 'Public' : 'Private'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => quickToggle(a, 'is_featured')}
                            title={a.is_featured ? 'Featured — click to unfeature' : 'Click to feature in Library'}
                            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                              a.is_featured ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            <Star size={12} fill={a.is_featured ? 'currentColor' : 'none'} />
                            {a.is_featured ? 'Featured' : 'Feature'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditAgent(a)}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => deleteAgent(a)}
                              disabled={deletingId === a.id}
                              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAgents.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                          No agents match.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Manage access modal (Users tab) */}
      {manageFor && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setManageFor(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900">Manage access</h3>
              <button onClick={() => setManageFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-gray-400 text-xs mb-4">{manageFor.email}</p>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
            <select value={grantStatus} onChange={e => setGrantStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3">
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="locked">Locked</option>
              <option value="canceled">Canceled</option>
            </select>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Plan</label>
            <select value={grantPlan} onChange={e => setGrantPlan(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3">
              <option value="basic">Basic (1 agent, ₹99)</option>
              <option value="starter">Starter (3 agents, ₹199)</option>
              <option value="business">Business (unlimited, custom)</option>
            </select>

            <label className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <input type="checkbox" checked={grantFree} onChange={e => setGrantFree(e.target.checked)} className="rounded" />
              Complimentary (no charge / free)
            </label>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              {grantStatus === 'trialing' ? 'Extend trial by (days)' : 'Access period (days)'}
            </label>
            <input type="number" value={grantDays} onChange={e => setGrantDays(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-5" />

            <button onClick={submitGrant} disabled={granting}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50">
              {granting ? 'Saving...' : 'Save access'}
            </button>
          </div>
        </div>
      )}

      {/* Create / Edit agent modal (Agents tab) */}
      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeAgentModal}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editingAgent ? 'Edit agent' : 'Create agent for a user'}</h3>
              <button onClick={closeAgentModal}><X size={18} className="text-gray-400" /></button>
            </div>

            {/* Owner picker (only when creating, or optionally when transferring) */}
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Owner {editingAgent ? '(change to transfer ownership)' : ''}
            </label>
            <div className="relative mb-3">
              <input
                value={ownerQuery}
                onChange={(e) => { setOwnerQuery(e.target.value); setAgentDraft((d) => ({ ...d, user_id: '' })) }}
                placeholder="Search by email or name..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              />
              {ownerQuery && !agentDraft.user_id && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {matchingOwners.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setAgentDraft((d) => ({ ...d, user_id: u.id })); setOwnerQuery(u.email) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-800">{u.full_name || u.email}</div>
                      <div className="text-gray-400 text-xs">{u.email}</div>
                    </button>
                  ))}
                  {matchingOwners.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">No matching users</div>
                  )}
                </div>
              )}
              {agentDraft.user_id && (
                <p className="text-xs text-emerald-600 mt-1">✓ Owner selected</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name (English)</label>
                <input value={agentDraft.name} onChange={(e) => setAgentDraft((d) => ({ ...d, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Name (Bengali)</label>
                <input value={agentDraft.name_bn} onChange={(e) => setAgentDraft((d) => ({ ...d, name_bn: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
            <textarea value={agentDraft.description} onChange={(e) => setAgentDraft((d) => ({ ...d, description: e.target.value }))}
              rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Category</label>
                <select value={agentDraft.category} onChange={(e) => setAgentDraft((d) => ({ ...d, category: e.target.value as AgentCategory }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {ALL_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c].en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Icon (emoji)</label>
                <input value={agentDraft.icon} onChange={(e) => setAgentDraft((d) => ({ ...d, icon: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </div>
            </div>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Tools</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {ALL_TOOLS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTool(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    agentDraft.tools.includes(t) ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {TOOL_LABELS[t].en}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">System prompt</label>
            <textarea value={agentDraft.system_prompt} onChange={(e) => setAgentDraft((d) => ({ ...d, system_prompt: e.target.value }))}
              rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3 font-mono text-xs" />

            <div className="flex items-center gap-4 mb-5">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={agentDraft.is_public} onChange={(e) => setAgentDraft((d) => ({ ...d, is_public: e.target.checked }))} className="rounded" />
                Public (visible in Library)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={agentDraft.is_featured} onChange={(e) => setAgentDraft((d) => ({ ...d, is_featured: e.target.checked }))} className="rounded" />
                Featured
              </label>
            </div>

            <button onClick={saveAgent} disabled={savingAgent}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-50">
              {savingAgent ? 'Saving...' : editingAgent ? 'Save changes' : 'Create agent'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
