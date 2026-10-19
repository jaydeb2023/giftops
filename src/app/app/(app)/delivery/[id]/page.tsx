'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowDown, ArrowLeft, ArrowUp, Image as ImageIcon, Navigation, Plus, Printer, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDate, fmtDateTime, mapsLink, qs, useFetch } from '@/lib/rv/client'
import { inr } from '@/lib/rv/util'
import { Badge, Button, Card, Empty, ErrorNote, Input, Modal, Select, Spinner, Stat, Table, Td } from '@/components/rv/ui'
import StopActions from '@/components/rv/StopActions'
import FormModal from '@/components/rv/FormModal'
import type { FieldDef } from '@/components/rv/ResourcePage'
import { useStaff } from '@/components/rv/StaffContext'

const costFields: FieldDef[] = [
  { key: 'run_cost', label: 'Run cost (Rs)', type: 'number' },
  { key: 'distance_km', label: 'Distance (km)', type: 'number' },
  { key: 'rider_name', label: 'Rider / partner name' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true },
]

function AddStops({ run, onClose, onDone }: { run: any; onClose: () => void; onDone: () => void }) {
  const [zone, setZone] = useState(run.zone || '')
  const [date, setDate] = useState(run.run_date || '')
  const [q, setQ] = useState('')
  const { data, loading } = useFetch<{ data: any[] }>(`/api/rv/recipients${qs({ live: 1, unassigned: 1, zone, delivery_date: date, q, limit: 400 })}`)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [err, setErr] = useState('')
  const rows = data?.data || []
  const add = async (force = false) => {
    setErr('')
    try {
      const r = await api<{ added: number; skipped: number }>(`/api/rv/runs/${run.id}/assign`, { body: { add: Array.from(sel), force } })
      toast.success(`${r.added} stop(s) added`); onDone(); onClose()
    } catch (e: any) {
      if (e.code === 'UNVERIFIED' && confirm(`${e.message}\n\nAdd them anyway?`)) return add(true)
      setErr(e.message)
    }
  }
  return (
    <Modal open onClose={onClose} title="Add stops to this run" wide
      footer={<><span className="mr-auto text-sm text-gray-500">{sel.size} selected</span><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!sel.size} onClick={() => add(false)}>Add to run</Button></>}>
      {err && <div className="mb-3"><ErrorNote>{err}</ErrorNote></div>}
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="w-40" placeholder="Zone" value={zone} onChange={e => setZone(e.target.value)} />
        <Input className="w-44" type="date" value={date} onChange={e => setDate(e.target.value)} title="Order delivery date" />
        <Input className="w-56" placeholder="Search name / PIN..." value={q} onChange={e => setQ(e.target.value)} />
        <Button size="sm" onClick={() => setSel(new Set(rows.filter(r => r.address_status === 'verified').map(r => r.id)))}>Select all verified ({rows.filter(r => r.address_status === 'verified').length})</Button>
      </div>
      {loading ? <Spinner /> : rows.length === 0 ? <Empty>No unassigned deliveries match. Clear the filters, or check that orders are confirmed.</Empty> : (
        <Table head={['', 'Recipient', 'Address', 'PIN', 'Zone', 'Address status', 'Order']}>
          {rows.map(r => (
            <tr key={r.id}>
              <Td><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel(s => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })} /></Td>
              <Td className="font-medium">{r.name}</Td><Td className="max-w-[220px] truncate">{r.address_line || '-'}</Td><Td>{r.pincode || '-'}</Td><Td>{r.zone || '-'}</Td>
              <Td><Badge value={r.address_status} /></Td><Td className="text-xs">{r.order?.order_no}</Td>
            </tr>
          ))}
        </Table>
      )}
    </Modal>
  )
}

export default function RunPage() {
  const { id } = useParams<{ id: string }>()
  const me = useStaff()
  const { data, loading, error, reload } = useFetch<any>(`/api/rv/runs/${id}`)
  const [add, setAdd] = useState(false)
  const [edit, setEdit] = useState(false)
  const canPlan = ['admin', 'ops'].includes(me.role)

  if (loading && !data) return <Spinner className="mx-auto my-20 h-8 w-8" />
  if (error || !data) return <ErrorNote>{error || 'Run not found'}</ErrorNote>
  const { run, stops, summary } = data
  const closed = ['completed', 'cancelled'].includes(run.status)

  const setStatus = async (status: string) => { try { await api(`/api/rv/runs/${id}/status`, { body: { status } }); toast.success('Run updated'); reload() } catch (e: any) { toast.error(e.message) } }
  const move = async (i: number, dir: -1 | 1) => {
    const ids = stops.map((s: any) => s.id); const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    try { await api(`/api/rv/runs/${id}/assign`, { body: { order: ids } }); reload() } catch (e: any) { toast.error(e.message) }
  }
  const remove = async (sid: string) => { try { await api(`/api/rv/runs/${id}/assign`, { body: { remove: [sid] } }); reload() } catch (e: any) { toast.error(e.message) } }
  const saveRun = async (v: Record<string, any>) => { await api(`/api/rv/r/runs/${id}`, { method: 'PATCH', body: v }); toast.success('Saved'); reload() }

  return (
    <div className="print:text-xs">
      <Link href="/app/delivery" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-rv-700 print:hidden"><ArrowLeft className="h-4 w-4" />All runs</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h1 className="font-mono text-xl font-bold text-rv-800">{run.run_no}</h1><Badge value={run.status} /></div>
          <div className="mt-1 text-sm text-gray-600">{fmtDate(run.run_date)} | {run.zone || 'No zone'} | Rider: {run.rider?.full_name || run.rider_name || 'unassigned'}{run.vehicle ? ` | ${run.vehicle}` : ''}</div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print run sheet</Button>
          {canPlan && !closed && <Button onClick={() => setEdit(true)}>Edit run</Button>}
          {canPlan && !closed && <Button variant="primary" onClick={() => setAdd(true)}><Plus className="h-4 w-4" />Add stops</Button>}
          {canPlan && run.status === 'planned' && <Button variant="primary" onClick={() => setStatus('out_for_delivery')}>Send out for delivery</Button>}
          {canPlan && run.status === 'out_for_delivery' && <Button variant="primary" onClick={() => setStatus('completed')}>Complete run</Button>}
          {canPlan && run.status === 'planned' && <Button variant="danger" onClick={() => confirm('Cancel this run? Stops go back to unassigned.') && setStatus('cancelled')}>Cancel run</Button>}
        </div>
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Planned stops" value={summary.planned} /><Stat label="Delivered" value={summary.delivered} tone="good" />
        <Stat label="Open" value={summary.open} tone={summary.open ? 'warn' : undefined} /><Stat label="Failed" value={summary.failed} tone={summary.failed ? 'bad' : undefined} />
        <Stat label="Run cost" value={inr(run.run_cost)} hint={run.distance_km ? `${run.distance_km} km` : undefined} />
        <Stat label="Cost / completed stop" value={summary.delivered ? inr(summary.cost_per_completed) : '-'} />
      </div>
      {stops.length === 0 ? <Empty>No stops yet. Use &quot;Add stops&quot; to pick verified deliveries for this zone.</Empty> : (
        <Table head={['#', 'Recipient', 'Address', 'Order', 'Status', 'POD', '']}>
          {stops.map((s: any, i: number) => (
            <tr key={s.id}>
              <Td className="font-semibold">{s.stop_seq}</Td>
              <Td><div className="font-medium">{s.name}</div><div className="text-xs text-gray-500">{s.mobile ? <a href={`tel:${s.mobile}`} className="text-rv-700">{s.mobile}</a> : '-'}</div></Td>
              <Td className="max-w-[260px]"><div>{s.address_line}</div><div className="text-xs text-gray-500">{[s.landmark, s.pincode].filter(Boolean).join(' | ')}</div>
                {s.address_line && <a className="inline-flex items-center gap-1 text-xs text-rv-700 print:hidden" target="_blank" rel="noreferrer" href={mapsLink(`${s.address_line} ${s.pincode || ''}`)}><Navigation className="h-3 w-3" />Map</a>}</Td>
              <Td className="text-xs">{s.order?.order_no}</Td>
              <Td><Badge value={s.delivery_status} />{s.failed_reason && <div className="mt-0.5 max-w-[160px] text-[11px] text-red-600">{s.failed_reason.replace(/_/g, ' ')}</div>}</Td>
              <Td className="text-xs">{s.delivery_status === 'delivered' ? <>{fmtDateTime(s.delivered_at)}<div>{s.received_by}</div>{s.pod_path && <a className="inline-flex items-center gap-1 text-rv-700" target="_blank" rel="noreferrer" href={`/api/rv/pod/${s.id}`}><ImageIcon className="h-3 w-3" />Photo</a>}</> : '-'}</Td>
              <Td className="print:hidden"><div className="flex items-center gap-1">
                {canPlan && !closed && s.delivery_status === 'assigned' && <>
                  <Button size="sm" variant="ghost" onClick={() => move(i, -1)} aria-label="Up"><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => move(i, 1)} aria-label="Down"><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s.id)} aria-label="Remove from run"><X className="h-3.5 w-3.5 text-red-500" /></Button></>}
                <StopActions stop={s} onChange={reload} />
              </div></Td>
            </tr>
          ))}
        </Table>
      )}
      {add && <AddStops run={run} onClose={() => setAdd(false)} onDone={reload} />}
      <FormModal open={edit} onClose={() => setEdit(false)} title="Edit run" fields={costFields} initial={run} onSubmit={saveRun} />
    </div>
  )
}
