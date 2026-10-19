'use client'
import { useEffect, useMemo, useState } from 'react'
import { Phone, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDateTime, useFetch } from '@/lib/rv/client'
import { Button, Empty, ErrorNote, Input, PageHeader, Spinner, Textarea } from '@/components/rv/ui'
import { CallLogModal, CommTarget } from '@/components/rv/CommsModals'

interface Thread { key: string; name: string; mobile: string; msgs: any[]; last: string; unread: boolean; link: any }

/** Every WhatsApp message and call, grouped by phone number and linked to its lead / customer / recipient. */
export default function InboxPage() {
  const { data, loading, error, reload } = useFetch<{ data: any[] }>('/api/rv/r/communications?limit=800')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [call, setCall] = useState<CommTarget | null>(null)

  useEffect(() => { const t = setInterval(reload, 30000); return () => clearInterval(t) }, [reload])

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, Thread>()
    for (const m of data?.data || []) {
      const key = m.mobile_norm || m.lead_id || m.customer_id || m.recipient_id || m.id
      let t = map.get(key)
      const name = m.recipient?.name || m.customer?.company || m.customer?.name || m.lead?.name || m.mobile_norm || 'Unknown'
      if (!t) { t = { key, name, mobile: m.mobile_norm || '', msgs: [], last: m.created_at, unread: false, link: {} }; map.set(key, t) }
      t.msgs.push(m)
      if (!t.link.recipient_id && m.recipient_id) t.link.recipient_id = m.recipient_id
      if (!t.link.lead_id && m.lead_id) t.link.lead_id = m.lead_id
      if (!t.link.customer_id && m.customer_id) t.link.customer_id = m.customer_id
      if (!t.link.order_id && m.order_id) t.link.order_id = m.order_id
    }
    const arr = Array.from(map.values())
    arr.forEach(t => { t.msgs.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)); t.last = t.msgs[t.msgs.length - 1].created_at; t.unread = t.msgs[t.msgs.length - 1].direction === 'in' })
    return arr.sort((a, b) => +new Date(b.last) - +new Date(a.last))
  }, [data])

  const filtered = threads.filter(t => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.mobile.includes(q))
  const cur = threads.find(t => t.key === sel) || null

  const send = async () => {
    if (!cur || !text.trim()) return
    setBusy(true)
    try { await api('/api/rv/comms/send', { body: { ...cur.link, to: cur.mobile, text } }); setText(''); reload() }
    catch (e: any) { toast.error(e.message + (e.code === 'WINDOW_CLOSED' ? ' Use a template from the lead / customer screen.' : '')) } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Inbox & calls" subtitle="One timeline of WhatsApp messages and calls for every contact" />
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : threads.length === 0 ? <Empty>No messages or calls yet. Incoming WhatsApp messages appear here once the webhook is connected (Settings, Integrations).</Empty> : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 p-2"><Input placeholder="Search name or number" value={q} onChange={e => setQ(e.target.value)} /></div>
            <ul className="max-h-[65vh] divide-y divide-gray-100 overflow-y-auto">
              {filtered.map(t => (
                <li key={t.key}>
                  <button onClick={() => setSel(t.key)} className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 ${sel === t.key ? 'bg-rv-50' : ''}`}>
                    <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium">{t.name}</span><span className="shrink-0 text-[11px] text-gray-400">{fmtDateTime(t.last)}</span></div>
                    <div className="truncate text-xs text-gray-500">{t.unread && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />}{t.msgs[t.msgs.length - 1].body || t.msgs[t.msgs.length - 1].outcome}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex min-h-[50vh] flex-col rounded-xl border border-gray-200 bg-white">
            {!cur ? <div className="m-auto text-sm text-gray-400">Select a conversation</div> : (
              <>
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                  <div><div className="font-semibold">{cur.name}</div><div className="text-xs text-gray-500">{cur.mobile}</div></div>
                  <Button size="sm" onClick={() => setCall({ name: cur.name, mobile: cur.mobile, ...cur.link })}><Phone className="h-3.5 w-3.5" />Log call</Button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
                  {cur.msgs.map(m => (
                    <div key={m.id} className={`flex ${m.direction === 'in' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.direction === 'in' ? 'bg-white shadow-sm' : m.channel === 'whatsapp' ? 'bg-emerald-100' : 'bg-rv-100'}`}>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{m.channel.replace('_', ' ')}{m.outcome ? ` - ${m.outcome.replace(/_/g, ' ')}` : ''}</div>
                        <div className="whitespace-pre-wrap break-words">{m.body || '-'}</div>
                        <div className="mt-0.5 text-right text-[10px] text-gray-400">{fmtDateTime(m.created_at)}{m.status ? ` | ${m.status}` : ''}{m.owner?.full_name ? ` | ${m.owner.full_name}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-gray-100 p-3">
                  <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Reply on WhatsApp (works within 24 hours of their last message)" />
                  <Button variant="primary" loading={busy} onClick={send} aria-label="Send"><Send className="h-4 w-4" /></Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <CallLogModal open={!!call} onClose={() => setCall(null)} target={call} onDone={reload} />
    </div>
  )
}
