'use client'

import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'

interface Log {
  id: string
  actor_label: string
  action: string
  target_table: string | null
  target_id: string | null
  details: Record<string, any>
  created_at: string
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([])
  const [loading, setLoading] = useState(true)
  const [missingTable, setMissingTable] = useState(false)

  useEffect(() => {
    fetch('/api/admin/audit-logs').then((r) => r.json()).then((j) => {
      setLogs(j.logs || []); setMissingTable(!!j.missingTable); setLoading(false)
    })
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Audit Logs</h1>
      <p className="text-gray-400 text-sm mb-6">Every logged admin/system action, most recent first</p>

      {missingTable && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl p-4 mb-4 text-sm">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            The <code className="font-mono text-xs">audit_logs</code> table doesn't exist in your database yet — the code
            already calls it, but no migration ever created it. Run <code className="font-mono text-xs">supabase/migrations/010_audit_logs.sql</code> in
            the Supabase SQL editor, then entries will start showing up here.
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-violet-600" size={22} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3 text-gray-700">{l.actor_label || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{l.action}</td>
                  <td className="px-4 py-3 text-gray-500">{l.target_table ? `${l.target_table}${l.target_id ? ` · ${l.target_id}` : ''}` : '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && !missingTable && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No logged actions yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
