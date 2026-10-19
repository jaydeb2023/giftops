'use client'
import { useRouter } from 'next/navigation'
import ResourcePage from '@/components/rv/ResourcePage'
import { orderFields } from '@/components/rv/order/orderFields'
import { Badge } from '@/components/rv/ui'
import { fmtDate } from '@/lib/rv/client'
import { ORDER_STATUSES, labelize } from '@/lib/rv/constants'

export default function OrdersPage() {
  const router = useRouter()
  return (
    <ResourcePage
      title="Orders"
      subtitle="One order, many recipients. Open an order to add items, upload recipients, track deliveries and invoice."
      resource="orders"
      createLabel="New order"
      modalTitle="order"
      exportKind="orders"
      searchPlaceholder="Search order no., occasion..."
      filters={[{ key: 'status', label: 'Status', options: ORDER_STATUSES.map(v => ({ value: v, label: labelize(v) })) }]}
      fields={orderFields}
      canDelete
      onRowClick={r => router.push(`/app/orders/${r.id}`)}
      onCreated={r => router.push(`/app/orders/${r.id}`)}
      columns={[
        { key: 'order_no', label: 'Order', render: r => <span className="font-mono text-xs font-semibold text-rv-800">{r.order_no}</span> },
        { key: 'customer', label: 'Customer', render: r => r.customer?.company || r.customer?.name || '-' },
        { key: 'occasion', label: 'Occasion', render: r => r.occasion || '-' },
        { key: 'delivery_date', label: 'Deliver on', render: r => fmtDate(r.delivery_date) },
        { key: 'recipients', label: 'Recipients', render: r => r.recipients?.[0]?.count ?? 0 },
        { key: 'status', label: 'Status', render: r => <Badge value={r.status} /> },
        { key: 'owner', label: 'Owner', render: r => r.owner?.full_name || '-' },
      ]}
    />
  )
}
