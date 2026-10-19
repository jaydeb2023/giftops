'use client'
import { useState } from 'react'
import { Navigation, Phone, PlayCircle, CheckCheck, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDate, mapsLink, useFetch } from '@/lib/rv/client'
import { Badge, Button, Empty, ErrorNote, Input, Spinner } from '@/components/rv/ui'
import StopActions from '@/components/rv/StopActions'
import { useStaff } from '@/components/rv/StaffContext'

/** Phone-first screen for riders: today's stops in order, call / navigate / deliver with POD / fail. */
export default function RiderPage() {
  const me = useStaff()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const { data, loading, error, reload } = useFetch<{ data: any[] }>(`/api/rv/rider/runs?date=${date}`)
  const setStatus = async (id: string, status: string) => { try { await api(`/api/rv/runs/${id}/status`, { body: { status } }); reload() } catch (e: any) { toast.error(e.message) } }
  const runs = data?.data || []

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div><h1 className="text-xl font-bold text-gray-900">{me.role === 'rider' ? 'My deliveries' : 'Rider view'}</h1><p className="text-sm text-gray-500">Tap Call or Navigate, then mark each stop.</p></div>
        <div className="flex items-center gap-2">
          {me.role !== 'rider' && <Input type="date" className="w-40" value={date} onChange={e => setDate(e.target.value)} />}
          <Button onClick={reload} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : runs.length === 0 ? <Empty>No runs assigned to you right now.</Empty> : runs.map(run => {
        const done = run.stops.filter((s: any) => s.delivery_status === 'delivered').length
        return (
          <section key={run.id} className="mb-6">
            <div className="mb-2 flex items-center justify-between rounded-xl bg-rv-800 px-4 py-3 text-white">
              <div><div className="font-semibold">{run.run_no} | {run.zone || 'No zone'}</div><div className="text-xs text-rv-200">{fmtDate(run.run_date)} | {done}/{run.stops.length} delivered</div></div>
              {run.status === 'planned' && <Button size="sm" onClick={() => setStatus(run.id, 'out_for_delivery')}><PlayCircle className="h-4 w-4" />Start run</Button>}
              {run.status === 'out_for_delivery' && <Button size="sm" onClick={() => setStatus(run.id, 'completed')}><CheckCheck className="h-4 w-4" />Finish</Button>}
            </div>
            <div className="space-y-3">
              {run.stops.map((s: any) => (
                <article key={s.id} className={`rounded-xl border bg-white p-4 shadow-sm ${s.delivery_status === 'delivered' ? 'border-emerald-200 opacity-70' : s.delivery_status === 'failed' ? 'border-red-200' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="text-xs text-gray-400">Stop {s.stop_seq} | {s.order?.order_no}</div><div className="text-base font-semibold text-gray-900">{s.name}</div></div>
                    <Badge value={s.delivery_status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{s.address_line}{s.landmark ? `, near ${s.landmark}` : ''}{s.pincode ? ` - ${s.pincode}` : ''}</p>
                  {s.instructions && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">Note: {s.instructions}</p>}
                  {s.items_note && <p className="mt-1 text-xs text-gray-500">Gift: {s.items_note}</p>}
                  {s.failed_reason && <p className="mt-1 text-xs text-red-600">Last attempt: {s.failed_reason.replace(/_/g, ' ')}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.mobile && <a href={`tel:${s.mobile}`}><Button><Phone className="h-4 w-4 text-emerald-600" />Call</Button></a>}
                    {s.address_line && <a href={mapsLink(`${s.address_line} ${s.pincode || ''}`)} target="_blank" rel="noreferrer"><Button><Navigation className="h-4 w-4 text-sky-600" />Navigate</Button></a>}
                  </div>
                  <div className="mt-3"><StopActions stop={s} onChange={reload} big /></div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
