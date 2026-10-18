'use client'

import { useEffect, useState } from 'react'
import { Loader2, Star, Search } from 'lucide-react'
import { CATEGORY_LABELS, AgentCategory } from '@/types'
import toast from 'react-hot-toast'

interface LibraryAgent {
  id: string
  name: string
  name_bn?: string | null
  description: string
  category: AgentCategory
  icon: string
  color: string
  is_featured: boolean
  use_count: number
  owner: { email: string; full_name: string | null } | null
}

export default function AgentLibraryPage() {
  const [agents, setAgents] = useState<LibraryAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const reload = async () => {
    const res = await fetch('/api/admin/agents')
    const json = await res.json()
    setAgents((json.agents || []).filter((a: LibraryAgent & { is_public: boolean }) => a.is_public))
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  const toggleFeatured = async (a: LibraryAgent) => {
    const res = await fetch(`/api/admin/agents/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_featured: !a.is_featured }),
    })
    if (!res.ok) { toast.error('Failed to update'); return }
    setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_featured: !x.is_featured } : x)))
  }

  const filtered = agents.filter((a) => {
    const q = search.toLowerCase()
    return !q || a.name.toLowerCase().includes(q) || (a.name_bn || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Agent Library</h1>
      <p className="text-gray-400 text-sm mb-6">Public agents visible to everyone in the marketplace — {agents.length} live</p>

      <div className="relative max-w-sm mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search library..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400" />
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: a.color }}>{a.icon}</span>
                <button onClick={() => toggleFeatured(a)}
                  className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${a.is_featured ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-400'}`}>
                  <Star size={11} fill={a.is_featured ? 'currentColor' : 'none'} /> {a.is_featured ? 'Featured' : 'Feature'}
                </button>
              </div>
              <p className="font-semibold text-gray-900 text-sm">{a.name_bn || a.name}</p>
              <p className="text-xs text-gray-400 mb-2">{CATEGORY_LABELS[a.category]?.en || a.category}</p>
              <p className="text-xs text-gray-500 line-clamp-2 mb-3">{a.description}</p>
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span>{a.use_count} uses</span>
                <span className="truncate max-w-[50%]">{a.owner?.email}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-10">No public agents match.</p>}
        </div>
      )}
    </div>
  )
}
