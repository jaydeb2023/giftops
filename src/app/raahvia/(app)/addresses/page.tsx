'use client'
import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Phone, PlayCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDateTime, qs, useFetch } from '@/lib/rv/client'
import { Badge, Button, Card, Empty, ErrorNote, PageHeader, Spinner, Table, Tabs, Td } from '@/components/rv/ui'
import AddressModal from '@/components/rv/AddressModal'
import { CallLogModal, CommTarget, WhatsAppModal } from '@/components/rv/CommsModals'

type Tab = 'action' | 'chasing' | 'human' | 'verified' | 'exception'
const TABS: { id: Tab; label: string; statuses: string }[] = [
  { id: 'action', label: 'Needs action', statuses: 'pending,replied,ai_captured' },
  { id: 'chasing', label: 'Being chased (WhatsApp / AI)', statuses: 'reminder_sent,ai_call' },
  { id: 'human', label: 'Human call queue', statuses: 'human_call' },
  { id: 'exception', label: 'Exceptions', statuses: 'exception' },
  { id: 'verified', label: 'Verified', statuses: 'verified' },
]

export default function AddressQueue() {
  const [tab, setTab] = useState<Tab>('human')
  const cur = TABS.find(t => t.id === tab)!
  const { data, loading, error, reload } = useFetch<{ data: any[]; count: number }>(`/api/rv/recipients${qs({ live: 1, address_status: cur.statuses, limit: 400 })}`)
  const [addr, setAddr] = useState<string | null>(null)
  const [wa, setWa] = useState<CommTarget | null>(null)
  const [call, setCall] = useState<CommTarget | null>(null)
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<any>(null)

  const runChase = async () => {
    setRunning(true); setReport(null)
    try { const r = await api<{ result: any }>('/api/rv/address-chase/run', { body: {} }); setReport(r.result); reload() }
    catch (e: any) { toast.error(e.message) } finally { setRunning(false) }
  }
  const rows = data?.data || []
  return (
    <div>
      <PageHeader title="Address queue" subtitle="WhatsApp request, then AI call, then human call, until every address is verified"
        actions={<Button variant="primary" loading={running} onClick={runChase}><PlayCircle className="h-4 w-4" />Run address chase now</Button>} />
      {report && (
        <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {report.skipped ? report.skipped : <>Checked {report.checked}: {report.whatsapp_sent} WhatsApp sent, {report.ai_calls} AI calls started, {report.to_human} moved to human calls
            {report.skipped_not_configured > 0 && <>, {report.skipped_not_configured} skipped (WhatsApp not configured - see Settings)</>}{report.errors > 0 && <>, {report.errors} errors</>}.</>}
        </div>
      )}
      <Tabs tabs={TABS.map(t => ({ id: t.id, label: t.label }))} value={tab} onChange={setTab} />
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : rows.length === 0 ? <Empty>Nothing in this queue.</Empty> : (
        <Table head={['Recipient', 'Order', 'Address on file', 'Status', 'Attempts', 'Last attempt', '']}>
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <Td><div className="font-medium">{r.name}</div><div className="text-xs text-gray-500">{r.mobile || <span className="text-amber-600">no mobile</span>}</div></Td>
              <Td><Link className="text-rv-700 hover:underline" href={`/raahvia/orders/${r.order_id}`}>{r.order?.order_no}</Link><div className="text-xs text-gray-500">{r.order?.delivery_date || ''}</div></Td>
              <Td className="max-w-[280px]"><div className="truncate">{r.address_line || <span className="text-amber-600">Missing</span>}</div><div className="text-xs text-gray-500">{r.pincode || ''}</div>
                {r.suggested_address && <div className="mt-1 truncate text-xs text-purple-700" title={r.suggested_address}>Suggestion: {r.suggested_address}</div>}</Td>
              <Td><Badge value={r.address_status} /></Td>
              <Td>{r.address_attempts}</Td>
              <Td className="text-xs text-gray-500">{fmtDateTime(r.last_attempt_at)}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" title="Call" onClick={() => setCall({ name: r.name, mobile: r.mobile, recipient_id: r.id, order_id: r.order_id })}><Phone className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" title="WhatsApp" onClick={() => setWa({ name: r.name, mobile: r.mobile, recipient_id: r.id, order_id: r.order_id })}><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
                <Button size="sm" variant="primary" onClick={() => setAddr(r.id)}><ShieldCheck className="h-3.5 w-3.5" />{r.address_status === 'verified' ? 'View' : 'Verify'}</Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      {addr && <AddressModal recipientId={addr} onClose={() => setAddr(null)} onSaved={reload} />}
      <WhatsAppModal open={!!wa} onClose={() => setWa(null)} target={wa} onDone={reload} />
      <CallLogModal open={!!call} onClose={() => setCall(null)} target={call} address onDone={reload} />
    </div>
  )
}
