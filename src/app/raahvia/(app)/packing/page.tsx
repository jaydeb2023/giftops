'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { PackageCheck, PackageX } from 'lucide-react'
import { api, qs, useFetch } from '@/lib/rv/client'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Table, Td } from '@/components/rv/ui'

export default function PackingPage() {
  const [filter, setFilter] = useState<'todo' | 'packed' | 'all'>('todo')
  const [order, setOrder] = useState('')
  const [q, setQ] = useState('')
  const url = `/api/rv/recipients${qs({ live: 1, packed: filter === 'all' ? '' : filter === 'packed' ? 'true' : 'false', order_id: order, q, limit: 500 })}`
  const { data, loading, error, reload } = useFetch<{ data: any[] }>(url)
  const orders = useFetch<{ data: any[] }>('/api/rv/r/orders?limit=300')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [rework, setRework] = useState<any | null>(null)
  const [why, setWhy] = useState('')
  const rows = data?.data || []
  const allOn = rows.length > 0 && rows.every(r => sel.has(r.id))

  const bulk = async (patch: Record<string, any>) => {
    try { await api('/api/rv/recipients/bulk', { body: { ids: Array.from(sel), patch } }); toast.success('Updated'); setSel(new Set()); reload() } catch (e: any) { toast.error(e.message) }
  }
  const qcFail = async () => {
    try { await api(`/api/rv/recipients/${rework.id}`, { method: 'PATCH', body: { packed: false, qc_ok: false, rework_reason: why } }); toast.success('Sent back for rework'); setRework(null); setWhy(''); reload() }
    catch (e: any) { toast.error(e.message) }
  }
  const qcPass = async (r: any) => { try { await api(`/api/rv/recipients/${r.id}`, { method: 'PATCH', body: { packed: true, qc_ok: true, rework_reason: null } }); reload() } catch (e: any) { toast.error(e.message) } }

  return (
    <div>
      <PageHeader title="Packing & QC" subtitle="Work queue of every parcel to pack for orders in progress" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="w-auto" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="todo">To pack</option><option value="packed">Packed</option><option value="all">All</option>
        </Select>
        <Select className="w-auto max-w-xs" value={order} onChange={e => setOrder(e.target.value)}>
          <option value="">All orders</option>
          {(orders.data?.data || []).map(o => <option key={o.id} value={o.id}>{o.order_no} - {o.customer?.company || o.customer?.name}</option>)}
        </Select>
        <Input className="max-w-xs" placeholder="Search name, delivery no..." value={q} onChange={e => setQ(e.target.value)} />
        {sel.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">{sel.size} selected</span>
            <Button size="sm" variant="primary" onClick={() => bulk({ packed: true, qc_ok: true })}><PackageCheck className="h-3.5 w-3.5" />Mark packed + QC ok</Button>
            <Button size="sm" onClick={() => bulk({ packed: false })}>Unpack</Button>
          </div>
        )}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : rows.length === 0 ? <Empty>Nothing to pack here.</Empty> : (
        <Table head={[<input key="a" type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map(r => r.id)))} aria-label="Select all" />, 'Delivery', 'Recipient', 'Gift / card', 'Zone', 'Address', 'Packing', '']}>
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <Td><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })} aria-label="Select" /></Td>
              <Td><Link className="font-mono text-xs text-rv-700 hover:underline" href={`/raahvia/orders/${r.order_id}`}>{r.delivery_no}</Link></Td>
              <Td className="font-medium">{r.name}</Td>
              <Td className="max-w-[260px]"><div className="truncate">{r.items_note || '-'}</div><div className="truncate text-xs text-gray-500">{r.card_message ? `Card: ${r.card_message}` : ''}</div></Td>
              <Td>{r.zone || '-'}</Td>
              <Td><Badge value={r.address_status} /></Td>
              <Td>{r.packed ? <Badge value="completed" className="!bg-emerald-100 !text-emerald-800" /> : r.qc_ok === false ? <span className="text-xs font-medium text-red-600">Rework: {r.rework_reason || '-'}</span> : <Badge value="pending" />}</Td>
              <Td className="whitespace-nowrap text-right">
                {!r.packed && <Button size="sm" onClick={() => qcPass(r)}><PackageCheck className="h-3.5 w-3.5 text-emerald-600" />Packed</Button>}
                <Button size="sm" variant="ghost" title="QC failed / rework" onClick={() => { setWhy(''); setRework(r) }}><PackageX className="h-3.5 w-3.5 text-red-500" /></Button>
              </Td>
            </tr>
          ))}
        </Table>
      )}
      <Modal open={!!rework} onClose={() => setRework(null)} title={`QC failed: ${rework?.name || ''}`}
        footer={<><Button onClick={() => setRework(null)}>Cancel</Button><Button variant="danger" disabled={!why.trim()} onClick={qcFail}>Send for rework</Button></>}>
        <Field label="What needs fixing?" required><Input value={why} onChange={e => setWhy(e.target.value)} placeholder="Damaged box, wrong card, missing item..." /></Field>
      </Modal>
    </div>
  )
}
