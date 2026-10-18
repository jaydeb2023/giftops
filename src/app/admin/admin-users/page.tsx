'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck, ShieldOff, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface U { id: string; email: string; full_name: string | null; is_admin: boolean; created_at: string }

export default function AdminUsersManagementPage() {
  const [users, setUsers] = useState<U[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = () => fetch('/api/admin/users').then((r) => r.json()).then((j) => { setUsers(j.users || []); setLoading(false) })
  useEffect(() => { reload() }, [])

  const toggle = async (u: U) => {
    setBusyId(u.id)
    const res = await fetch('/api/admin/set-admin', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: u.id, is_admin: !u.is_admin }),
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(j.error || 'Failed to update') }
    else { toast.success(u.is_admin ? 'Removed admin access' : 'Granted admin access'); reload() }
    setBusyId(null)
  }

  const admins = users.filter((u) => u.is_admin)
  const filtered = admins.filter((u) => {
    const q = search.toLowerCase()
    return !q || u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q)
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Admin Users</h1>
      <p className="text-gray-400 text-sm mb-6">{admins.length} people with super admin access</p>

      <div className="relative max-w-sm mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search admins..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-violet-400" />
      </div>

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto mb-8">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-800">{u.full_name || '—'}</div>
                    <div className="text-gray-400 text-xs">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggle(u)} disabled={busyId === u.id}
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50">
                      {busyId === u.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldOff size={12} />} Remove admin
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={3} className="px-4 py-10 text-center text-gray-400">No admins match.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="font-bold text-gray-900 text-sm mb-3">Grant admin access</h2>
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.filter((u) => !u.is_admin).slice(0, 20).map((u) => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-800">{u.full_name || '—'}</div>
                  <div className="text-gray-400 text-xs">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggle(u)} disabled={busyId === u.id}
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50">
                    {busyId === u.id ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Make admin
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-gray-400 px-4 py-2">Showing the first 20 non-admin users. Use the Users page to search the full list.</p>
      </div>
    </div>
  )
}
