'use client'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge } from '@/components/rv/ui'

const fields: FieldDef[] = [
  { key: 'name', label: 'Vendor name', required: true },
  { key: 'category', label: 'Category', placeholder: 'Sweets, hampers, packaging...' },
  { key: 'contact_name', label: 'Contact person' },
  { key: 'mobile', label: 'Mobile', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'gstin', label: 'GSTIN' },
  { key: 'service_area', label: 'Service area' },
  { key: 'lead_time_days', label: 'Lead time (days)', type: 'number' },
  { key: 'quality_score', label: 'Quality score (1-5)', type: 'number', step: '0.1' },
  { key: 'payment_terms', label: 'Payment terms', placeholder: 'e.g. 15 days' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'active', label: 'Active', type: 'checkbox', default: true },
]

export default function VendorsPage() {
  return (
    <ResourcePage
      title="Vendors"
      subtitle="Gift, sweets, hamper and packaging suppliers"
      resource="vendors"
      createLabel="New vendor"
      modalTitle="vendor"
      searchPlaceholder="Search vendor, category, area..."
      fields={fields}
      canDelete
      columns={[
        { key: 'name', label: 'Vendor', render: r => <div><div className="font-medium">{r.name}</div><div className="text-xs text-gray-500">{r.contact_name || ''}</div></div> },
        { key: 'category', label: 'Category', render: r => r.category || '-' },
        { key: 'mobile', label: 'Mobile', render: r => r.mobile ? <a className="text-rv-700 hover:underline" href={`tel:${r.mobile}`}>{r.mobile}</a> : '-' },
        { key: 'service_area', label: 'Area', render: r => r.service_area || '-' },
        { key: 'lead_time_days', label: 'Lead time', render: r => r.lead_time_days != null ? `${r.lead_time_days} d` : '-' },
        { key: 'quality_score', label: 'Quality', render: r => r.quality_score ?? '-' },
        { key: 'payment_terms', label: 'Terms', render: r => r.payment_terms || '-' },
        { key: 'active', label: 'Status', render: r => <Badge value={r.active ? 'completed' : 'cancelled'} className={r.active ? '' : ''} /> },
      ]}
    />
  )
}
