'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, Search, Bot, Star, Eye, EyeOff, Trash2, Plus, Pencil, LayoutGrid, X,
} from 'lucide-react'
import { CATEGORY_LABELS, TOOL_LABELS, AgentCategory, AgentTool } from '@/types'
import toast from 'react-hot-toast'

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as AgentCategory[]
const ALL_TOOLS = Object.keys(TOOL_LABELS) as AgentTool[]

interface AdminUserLite { id: string; email: string; full_name: string | null }

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
  owner: AdminUserLite | null
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number | string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">{icon}{label}</div>
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

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AdminAgent[]>([])
  const [users, setUsers] = useState<AdminUserLite[]>([])
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

  const reloadAgents = async () => {
    setAgentsLoading(true)
    const res = await fetch('/api/admin/agents')
    const json = await res.json()
    setAgents(json.agents || [])
    setAgentsLoading(false)
  }

  useEffect(() => {
    reloadAgents()
    fetch('/api/admin/users').then((r) => r.json()).then((j) => setUsers(j.users || []))
  }, [])

  const openEditAgent = (a: AdminAgent) => {
    setEditingAgent(a)
    setAgentDraft({
      user_id: a.user_id, name: a.name, name_bn: a.name_bn || '', description: a.description,
      description_bn: a.description_bn || '', category: a.category, tools: a.tools || [],
      system_prompt: a.system_prompt, icon: a.icon, color: a.color, is_public: a.is_public, is_featured: a.is_featured,
    })
    setOwnerQuery(a.owner?.email || '')
  }

  const openCreateAgent = () => { setAgentDraft(emptyAgentDraft); setOwnerQuery(''); setCreatingAgent(true) }
  const closeAgentModal = () => { setEditingAgent(null); setCreatingAgent(false); setAgentDraft(emptyAgentDraft); setOwnerQuery('') }

  const toggleTool = (tool: AgentTool) => {
    setAgentDraft((d) => ({ ...d, tools: d.tools.includes(tool) ? d.tools.filter((t) => t !== tool) : [...d.tools, tool] }))
  }

  const saveAgent = async () => {
    if (!agentDraft.name.trim() || !agentDraft.description.trim() || !agentDraft.system_prompt.trim()) {
      toast.error('Name, description, and system prompt are required'); return
    }
    if (creatingAgent && !agentDraft.user_id) { toast.error('Pick an owner for this agent'); return }
    setSavingAgent(true)
    try {
      if (editingAgent) {
        const res = await fetch(`/api/admin/agents/${editingAgent.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agentDraft),
        })
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Update failed') }
        toast.success('Agent updated')
      } else {
        const res = await fetch('/api/admin/agents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(agentDraft),
        })
        if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Create failed') }
        toast.success('Agent created')
      }
      closeAgentModal(); reloadAgents()
    } catch (e: any) { toast.error(e.message || 'Something went wrong') }
    setSavingAgent(false)
  }

  const quickToggle = async (a: AdminAgent, field: 'is_public' | 'is_featured') => {
    const res = await fetch(`/api/admin/agents/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: !a[field] }),
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

  const matchingOwners = useMemo(() => {
    if (!ownerQuery.trim()) return users.slice(0, 6)
    const q = ownerQuery.toLowerCase()
    return users.filter((u) => u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q)).slice(0, 6)
  }, [ownerQuery, users])

  const agentStats = {
    total: agents.length,
    public: agents.filter((a) => a.is_public).length,
    featured: agents.filter((a) => a.is_featured).length,
    categories: new Set(agents.map((a) => a.category)).size,
  }

  const filteredAgents = agents.filter((a) => {
    const q = agentSearch.toLowerCase()
    const matchesSearch = !q || a.name.toLowerCase().includes(q) || (a.name_bn || '').toLowerCase().includes(q) ||
      (a.owner?.email || '').toLowerCase().includes(q) || (a.owner?.full_name || '').toLowerCase().includes(q)
    if (!matchesSearch) return false
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false
    if (visibilityFilter === 'public' && !a.is_public) return false
    if (visibilityFilter === 'private' && a.is_public) return false
    if (visibilityFilter === 'featured' && !a.is_featured) return false
    return true
  })

  const isEditorOpen = !!editingAgent || creatingAgent

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Agents</h1>
      <p className="text-gray-400 text-sm mb-6">Every agent on the platform, public or private</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Bot size={16} />} label="Total agents" value={agentStats.total} />
        <StatCard icon={<Eye size={16} />} label="Public" value={agentStats.public} accent="text-emerald-600" />
        <StatCard icon={<Star size={16} />} label="Featured" value={agentStats.featured} accent="text-amber-600" />
        <StatCard icon={<LayoutGrid size={16} />} label="Categories in use" value={agentStats.categories} />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)} placeholder="Search by agent name or owner..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white">
          <option value="all">All categories</option>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c].en}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(['all', 'public', 'private', 'featured'] as const).map((f) => (
            <button key={f} onClick={() => setVisibilityFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-colors ${
                visibilityFilter === f ? 'bg-violet-600 text-white' : 'bg-white border border-gray-200 text-gray-500'
              }`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={openCreateAgent}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold whitespace-nowrap">
          <Plus size={15} /> New agent
        </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        {agentsLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
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
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0" style={{ backgroundColor: a.color }}>{a.icon}</span>
                      <div>
                        <div className="font-semibold text-gray-800">{a.name}</div>
                        {a.name_bn && a.name_bn !== a.name && <div className="text-gray-400 text-xs">{a.name_bn}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-gray-700">{a.owner?.full_name || '—'}</div>
                    <div className="text-gray-400 text-xs">{a.owner?.email || 'Unknown user'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{CATEGORY_LABELS[a.category]?.en || a.category}</td>
                  <td className="px-4 py-3 text-gray-600">{a.use_count}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => quickToggle(a, 'is_public')}
                      title={a.is_public ? 'Public — click to make private' : 'Private — click to make public'}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                        a.is_public ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                      {a.is_public ? <Eye size={12} /> : <EyeOff size={12} />}
                      {a.is_public ? 'Public' : 'Private'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => quickToggle(a, 'is_featured')}
                      title={a.is_featured ? 'Featured — click to unfeature' : 'Click to feature in Library'}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                        a.is_featured ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'
                      }`}>
                      <Star size={12} fill={a.is_featured ? 'currentColor' : 'none'} />
                      {a.is_featured ? 'Featured' : 'Feature'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEditAgent(a)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                        <Pencil size={12} /> Edit
                      </button>
                      <button onClick={() => deleteAgent(a)} disabled={deletingId === a.id}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50">
                        {deletingId === a.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAgents.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No agents match.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {isEditorOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeAgentModal}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editingAgent ? 'Edit agent' : 'Create agent for a user'}</h3>
              <button onClick={closeAgentModal}><X size={18} className="text-gray-400" /></button>
            </div>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Owner {editingAgent ? '(change to transfer ownership)' : ''}
            </label>
            <div className="relative mb-3">
              <input value={ownerQuery} onChange={(e) => { setOwnerQuery(e.target.value); setAgentDraft((d) => ({ ...d, user_id: '' })) }}
                placeholder="Search by email or name..." className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              {ownerQuery && !agentDraft.user_id && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                  {matchingOwners.map((u) => (
                    <button key={u.id} onClick={() => { setAgentDraft((d) => ({ ...d, user_id: u.id })); setOwnerQuery(u.email) }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">
                      <div className="font-medium text-gray-800">{u.full_name || u.email}</div>
                      <div className="text-gray-400 text-xs">{u.email}</div>
                    </button>
                  ))}
                  {matchingOwners.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">No matching users</div>}
                </div>
              )}
              {agentDraft.user_id && <p className="text-xs text-emerald-600 mt-1">✓ Owner selected</p>}
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
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c].en}</option>)}
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
                <button key={t} onClick={() => toggleTool(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                    agentDraft.tools.includes(t) ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
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
              className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm disabled:opacity-50">
              {savingAgent ? 'Saving...' : editingAgent ? 'Save changes' : 'Create agent'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
