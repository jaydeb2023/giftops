'use client'
import { useState } from 'react'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge, Select } from '@/components/rv/ui'
import { api, fmtDate } from '@/lib/rv/client'
import { PURCHASE_STATUSES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import toast from 'react-hot-toast'

const fields: FieldDef[] = [
  { key: 'order_id', label: 'Order', type: 'select', required: true, options: { remote: 'orders', label: r => `${r.order_no} - ${r.customer?.company || r.customer?.name || ''}` } },
  { key: 'vendor_id', label: 'Vendor', type: 'select', options: { remote: 'vendors', label: r => r.name, params: { active: 'true' } } },
  { key: 'description', label: 'Item / description', required: true, full: true },
  { key: 'qty', label: 'Quantity', type: 'number', default: 1 },
  { key: 'unit_cost', label: 'Unit cost (Rs)', type: 'number', default: 0 },
  { key: 'total_cost', label: 'Total cost (Rs)', type: 'number', help: 'Leave empty to use quantity x unit cost' },
  { key: 'status', label: 'Status', type: 'select', options: PURCHASE_STATUSES.map(v => ({ value: v, label: labelize(v) })), default: 'requested' },
  { key: 'expected_at', label: 'Expected by', type: 'date' },
  { key: 'supplier_invoice_ref', label: 'Supplier invoice ref' },
  { key: 'issue_note', label: 'Shortage / quality issue', type: 'textarea' },
]

export default function PurchasesPage() {
  const [bump, setBump] = useState(0)
  const setStatus = async (id: string, status: string) => {
    try { await api(`/api/rv/r/purchases/${id}`, { method: 'PATCH', body: { status } }); setBump(b => b + 1) } catch (e: any) { toast.error(e.message) }
  }
  return (
    <ResourcePage
      key={bump}
      title="Purchases"
      subtitle="Orders placed with vendors. One customer order can be split across several vendors."
      resource="purchases"
      createLabel="New purchase"
      modalTitle="purchase"
      searchPlaceholder="Search PO no., item, supplier invoice..."
      filters={[{ key: 'status', label: 'Status', options: PURCHASE_STATUSES.map(v => ({ value: v, label: labelize(v) })) }]}
      fields={fields}
      canDelete
      transform={p => { if (p.total_cost === null) delete p.total_cost; return p }}
      columns={[
        { key: 'purchase_no', label: 'PO', render: r => <span className="font-mono text-xs text-gray-500">{r.purchase_no}</span> },
        { key: 'order', label: 'Order', render: r => r.order?.order_no || '-' },
        { key: 'vendor', label: 'Vendor', render: r => r.vendor?.name || <span className="text-amber-600">Not allocated</span> },
        { key: 'description', label: 'Item', render: r => <div>{r.description}<div className="text-xs text-gray-500">Qty {r.qty}</div></div> },
        { key: 'total_cost', label: 'Cost', render: r => inr(r.total_cost) },
        { key: 'expected_at', label: 'Expected', render: r => fmtDate(r.expected_at) },
        { key: 'status', label: 'Status', render: r => (
          <Select className="!w-auto !py-1 text-xs" value={r.status} onChange={e => setStatus(r.id, e.target.value)} aria-label="Status">
            {PURCHASE_STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}
          </Select>
        ) },
        { key: 'issue', label: '', render: r => r.status === 'issue' ? <Badge value="issue" /> : null },
      ]}
    />
  )
}
