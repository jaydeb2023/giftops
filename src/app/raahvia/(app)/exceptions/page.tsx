'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { CheckCircle2, ShieldCheck, MessageCircle, Phone } from 'lucide-react'
import { api, fmtDateTime, qs, useFetch } from '@/lib/rv/client'
import { labelize } from '@/lib/rv/constants'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageHeader, Spinner, Table, Tabs, Td } from '@/components/rv/ui'
import StopActions from '@/components/rv/StopActions'
import AddressModal from '@/components/rv/AddressModal'
import { CallLogModal, CommTarget, WhatsAppModal } from '@/components/rv/CommsModals'

type Tab = 'failed' | 'tasks'

export default function ExceptionsPage() {
  const [tab, setTab] = useState<Tab>('failed')
  const failed = useFetch<{ data: any[] }>(`/api/rv/recipients${qs({ delivery_status: 'failed,returned', limit: 300 })}`)
  const tasks = useFetch<{ data: any[] }>(`/api/rv/r/tasks${qs({ status: 'open', limit: 300 })}`)
  const [addr, setAddr] = useState<string | null>(null)
  const [wa, setWa] = useState<CommTarget | null>(null)
  const [call, setCall] = useState<CommTarget | null>(null)
  const [closing, setClosing] = useState<any | null>(null)
  const [note, setNote] = useState('')
  const both = () => { failed.reload(); tasks.reload() }

  const closeTask = async () => {
    try { await api(`/api/rv/r/tasks/${closing.id}`, { method: 'PATCH', body: { status: 'done', closure_note: note } }); toast.success('Closed'); setClosing(null); setNote(''); both() }
    catch (e: any) { toast.error(e.message) }
  }
  const fr = failed.data?.data || []
  const tk = tasks.data?.data || []
  const overdue = (t: any) => t.due_at && new Date(t.due_at) < new Date()

  return (
    <div>
      <PageHeader title="Exceptions" subtitle="Failed deliveries and open tasks, each with an owner, due time and closure note" />
      <Tabs tabs={[{ id: 'failed', label: 'Failed / returned deliveries', count: fr.length }, { id: 'tasks', label: 'Open tasks', count: tk.length }]} value={tab} onChange={setTab} />
      {tab === 'failed' && (failed.error ? <ErrorNote>{failed.error}</ErrorNote> : failed.loading && !failed.data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : fr.length === 0 ? <Empty>No failed deliveries. </Empty> : (
        <Table head={['Recipient', 'Order', 'Reason', 'Attempts', 'Re-attempt', 'Address', '']}>
          {fr.map(r => (
            <tr key={r.id}>
              <Td><div className="font-medium">{r.name}</div><div className="text-xs text-gray-500">{r.mobile || '-'}</div></Td>
              <Td><Link className="text-rv-700 hover:underline" href={`/raahvia/orders/${r.order_id}`}>{r.order?.order_no}</Link></Td>
              <Td className="max-w-[220px] text-red-700">{(r.failed_reason || '').replace(/_/g, ' ')}<div className="text-xs"><Badge value={r.delivery_status} /></div></Td>
              <Td>{r.attempt_count}</Td><Td>{r.reattempt_date || '-'}</Td>
              <Td><Badge value={r.address_status} /></Td>
              <Td><div className="flex flex-wrap items-center justify-end gap-1">
                <Button size="sm" variant="ghost" title="Call" onClick={() => setCall({ name: r.name, mobile: r.mobile, recipient_id: r.id, order_id: r.order_id })}><Phone className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" title="WhatsApp" onClick={() => setWa({ name: r.name, mobile: r.mobile, recipient_id: r.id, order_id: r.order_id })}><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
                <Button size="sm" variant="ghost" title="Correct address" onClick={() => setAddr(r.id)}><ShieldCheck className="h-3.5 w-3.5 text-rv-700" /></Button>
                <StopActions stop={r} onChange={both} />
              </div></Td>
            </tr>
          ))}
        </Table>
      ))}
      {tab === 'tasks' && (tasks.error ? <ErrorNote>{tasks.error}</ErrorNote> : tasks.loading && !tasks.data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : tk.length === 0 ? <Empty>No open tasks.</Empty> : (
        <Table head={['Task', 'Type', 'Order / lead', 'Due', '']}>
          {tk.map(t => (
            <tr key={t.id}>
              <Td className="max-w-[420px]">{t.title}</Td><Td>{labelize(t.kind)}</Td>
              <Td>{t.order ? <Link className="text-rv-700 hover:underline" href={`/raahvia/orders/${t.order_id}`}>{t.order.order_no}</Link> : t.lead?.name || '-'}</Td>
              <Td className={overdue(t) ? 'font-medium text-red-600' : ''}>{fmtDateTime(t.due_at)}{overdue(t) && ' (overdue)'}</Td>
              <Td className="text-right">
                {t.recipient_id && t.kind === 'address' && <Button size="sm" variant="ghost" onClick={() => setAddr(t.recipient_id)}><ShieldCheck className="h-3.5 w-3.5 text-rv-700" />Address</Button>}
                <Button size="sm" onClick={() => { setNote(''); setClosing(t) }}><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Close</Button>
              </Td>
            </tr>
          ))}
        </Table>
      ))}
      <Modal open={!!closing} onClose={() => setClosing(null)} title="Close task" footer={<><Button onClick={() => setClosing(null)}>Cancel</Button><Button variant="primary" onClick={closeTask}>Close task</Button></>}>
        <p className="mb-3 text-sm text-gray-600">{closing?.title}</p>
        <Field label="Closure note"><Input value={note} onChange={e => setNote(e.target.value)} placeholder="What was done?" /></Field>
      </Modal>
      {addr && <AddressModal recipientId={addr} onClose={() => setAddr(null)} onSaved={both} />}
      <WhatsAppModal open={!!wa} onClose={() => setWa(null)} target={wa} onDone={both} />
      <CallLogModal open={!!call} onClose={() => setCall(null)} target={call} address onDone={both} />
    </div>
  )
}
