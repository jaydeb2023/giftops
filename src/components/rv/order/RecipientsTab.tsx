'use client'
import { useMemo, useState } from 'react'
import { Download, MessageCircle, Phone, Plus, ShieldCheck, Upload, Image as ImageIcon, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '@/lib/rv/client'
import { ADDRESS_STATUSES, labelize } from '@/lib/rv/constants'
import { Badge, Button, Card, Empty, Input, Select, Table, Td } from '../ui'
import FormModal from '../FormModal'
import AddressModal from '../AddressModal'
import ImportModal from './ImportModal'
import { CallLogModal, CommTarget, WhatsAppModal } from '../CommsModals'
import type { FieldDef } from '../ResourcePage'
import type { OrderDetail } from './types'

const addFields: FieldDef[] = [
  { key: 'name', label: 'Recipient name', required: true },
  { key: 'mobile', label: 'Mobile', type: 'tel' },
  { key: 'address_line', label: 'Full address', type: 'textarea' },
  { key: 'landmark', label: 'Landmark' },
  { key: 'pincode', label: 'PIN code' },
  { key: 'zone', label: 'Zone' },
  { key: 'items_note', label: 'Gift / items for this recipient' },
  { key: 'card_message', label: 'Card message' },
  { key: 'instructions', label: 'Delivery instructions', full: true },
]

export default function RecipientsTab({ d, reload, canEdit }: { d: OrderDetail; reload: () => void; canEdit: boolean }) {
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [imp, setImp] = useState(false)
  const [add, setAdd] = useState(false)
  const [addr, setAddr] = useState<string | null>(null)
  const [wa, setWa] = useState<CommTarget | null>(null)
  const [call, setCall] = useState<CommTarget | null>(null)
  const [zone, setZone] = useState('')

  const rows = useMemo(() => d.recipients.filter(r =>
    (!st || r.address_status === st) &&
    (!q || [r.name, r.mobile, r.address_line, r.pincode, r.delivery_no].some(x => (x || '').toLowerCase().includes(q.toLowerCase())))
  ), [d.recipients, q, st])

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allOn = rows.length > 0 && rows.every(r => sel.has(r.id))

  const addOne = async (v: Record<string, any>) => {
    await api('/api/rv/orders/' + d.order.id + '/import', { body: { rows: [v] } })
    toast.success('Recipient added'); reload()
  }
  const bulkZone = async () => {
    if (!sel.size) return
    try { await api('/api/rv/recipients/bulk', { body: { ids: Array.from(sel), patch: { zone } } }); toast.success('Zone updated'); setSel(new Set()); reload() }
    catch (e: any) { toast.error(e.message) }
  }
  const remove = async (id: string) => {
    if (!confirm('Remove this recipient from the order?')) return
    try { await api(`/api/rv/recipients/${id}`, { method: 'DELETE' }); reload() } catch (e: any) { toast.error(e.message) }
  }

  const c = d.counts
  return (
    <Card title={`Recipients (${c.recipients})`} pad={false}
      actions={canEdit && <>
        <a href={`/api/rv/export/recipients?order_id=${d.order.id}`}><Button size="sm"><Download className="h-3.5 w-3.5" />Export</Button></a>
        <Button size="sm" onClick={() => setAdd(true)}><Plus className="h-3.5 w-3.5" />Add one</Button>
        <Button size="sm" variant="primary" onClick={() => setImp(true)}><Upload className="h-3.5 w-3.5" />Upload Excel</Button>
      </>}>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{c.address_verified} verified</span>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{c.address_open} address pending</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">{c.delivered} delivered</span>
          {c.failed > 0 && <span className="rounded-full bg-red-50 px-2.5 py-1 text-red-700">{c.failed} failed</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input className="max-w-xs" placeholder="Search name, mobile, address, PIN..." value={q} onChange={e => setQ(e.target.value)} />
          <Select className="w-auto" value={st} onChange={e => setSt(e.target.value)}>
            <option value="">Address status: all</option>
            {ADDRESS_STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}
          </Select>
          {canEdit && sel.size > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">{sel.size} selected</span>
              <Input className="w-32" placeholder="Zone" value={zone} onChange={e => setZone(e.target.value)} />
              <Button size="sm" onClick={bulkZone}>Set zone</Button>
            </div>
          )}
        </div>
        {d.recipients.length === 0 ? <Empty>No recipients yet. Upload your Excel sheet (50, 100 or more) or add them one by one.</Empty> : (
          <Table head={[<input key="all" type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map(r => r.id)))} aria-label="Select all" />, 'Delivery', 'Recipient', 'Address', 'Address status', 'Delivery', '']}>
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label="Select" /></Td>
                <Td className="font-mono text-xs text-gray-500">{r.delivery_no}</Td>
                <Td><div className="font-medium">{r.name}</div><div className="text-xs text-gray-500">{r.mobile || <span className="text-amber-600">no mobile</span>}</div></Td>
                <Td className="max-w-[280px]"><div className="truncate" title={r.address_line || ''}>{r.address_line || <span className="text-amber-600">Missing</span>}</div><div className="text-xs text-gray-500">{[r.landmark, r.pincode, r.zone].filter(Boolean).join(' | ')}</div></Td>
                <Td><Badge value={r.address_status} />{r.suggested_address && <div className="mt-0.5 text-[11px] text-purple-700">has suggestion</div>}</Td>
                <Td><Badge value={r.delivery_status} />{r.run && <div className="mt-0.5 text-[11px] text-gray-500">{r.run.run_no}</div>}</Td>
                <Td className="whitespace-nowrap text-right">
                  {canEdit && <Button size="sm" variant="ghost" title="Edit / verify address" onClick={() => setAddr(r.id)}><ShieldCheck className="h-3.5 w-3.5 text-rv-700" /></Button>}
                  <Button size="sm" variant="ghost" title="Log call" onClick={() => setCall({ name: r.name, mobile: r.mobile, recipient_id: r.id, order_id: d.order.id })}><Phone className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" title="WhatsApp" onClick={() => setWa({ name: r.name, mobile: r.mobile, recipient_id: r.id, order_id: d.order.id })}><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
                  {r.pod_path && <a href={`/api/rv/pod/${r.id}`} target="_blank" rel="noreferrer" title="View proof of delivery"><Button size="sm" variant="ghost"><ImageIcon className="h-3.5 w-3.5" /></Button></a>}
                  {canEdit && <Button size="sm" variant="ghost" title="Remove" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5 text-red-500" /></Button>}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <ImportModal orderId={d.order.id} open={imp} onClose={() => setImp(false)} onDone={reload} />
      <FormModal open={add} onClose={() => setAdd(false)} title="Add recipient" fields={addFields} onSubmit={addOne} />
      {addr && <AddressModal recipientId={addr} onClose={() => setAddr(null)} onSaved={reload} />}
      <WhatsAppModal open={!!wa} onClose={() => setWa(null)} target={wa} onDone={reload} />
      <CallLogModal open={!!call} onClose={() => setCall(null)} target={call} address onDone={reload} />
    </Card>
  )
}
