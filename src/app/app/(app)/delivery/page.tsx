'use client'
import { useRouter } from 'next/navigation'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge } from '@/components/rv/ui'
import { fmtDate } from '@/lib/rv/client'
import { RUN_STATUSES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'

const fields: FieldDef[] = [
  { key: 'run_date', label: 'Run date', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
  { key: 'zone', label: 'Zone / cluster', placeholder: 'e.g. South Kolkata' },
  { key: 'rider_staff_id', label: 'Rider (app login)', type: 'select', options: { remote: 'staff', label: r => r.full_name, filter: r => r.role === 'rider' }, help: 'Riders need a staff login with the Rider role to use the rider page' },
  { key: 'rider_name', label: 'Rider / partner name', help: 'Use when the rider has no login' },
  { key: 'partner', label: 'Delivery partner' },
  { key: 'vehicle', label: 'Vehicle' },
  { key: 'feeder_vehicle', label: 'Feeder vehicle / run' },
  { key: 'run_cost', label: 'Run cost (Rs)', type: 'number', default: 0 },
  { key: 'distance_km', label: 'Distance (km)', type: 'number' },
  { key: 'status', label: 'Status', type: 'select', options: RUN_STATUSES.map(v => ({ value: v, label: labelize(v) })), default: 'planned', hideOnEdit: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

export default function DeliveryPage() {
  const router = useRouter()
  return (
    <ResourcePage
      title="Delivery runs"
      subtitle="Plan zone-wise runs, assign riders, and follow each stop to proof of delivery"
      resource="runs"
      createLabel="New run"
      modalTitle="run"
      searchPlaceholder="Search run no., zone, rider..."
      filters={[{ key: 'status', label: 'Status', options: RUN_STATUSES.map(v => ({ value: v, label: labelize(v) })) }]}
      fields={fields}
      canDelete
      onRowClick={r => router.push(`/app/delivery/${r.id}`)}
      onCreated={r => router.push(`/app/delivery/${r.id}`)}
      columns={[
        { key: 'run_no', label: 'Run', render: r => <span className="font-mono text-xs font-semibold text-rv-800">{r.run_no}</span> },
        { key: 'run_date', label: 'Date', render: r => fmtDate(r.run_date) },
        { key: 'zone', label: 'Zone', render: r => r.zone || '-' },
        { key: 'rider', label: 'Rider / partner', render: r => r.rider?.full_name || r.rider_name || r.partner || <span className="text-amber-600">Unassigned</span> },
        { key: 'stops', label: 'Stops', render: r => r.stops?.[0]?.count ?? 0 },
        { key: 'run_cost', label: 'Cost', render: r => inr(r.run_cost) },
        { key: 'status', label: 'Status', render: r => <Badge value={r.status} /> },
      ]}
    />
  )
}
