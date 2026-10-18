'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, MessageCircle, Pencil, Plus, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDate, fmtDateTime, useFetch } from '@/lib/rv/client'
import { ORDER_STATUSES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { Badge, Button, Card, Empty, ErrorNote, Select, Spinner, Table, Tabs, Td } from '@/components/rv/ui'
import { useStaff } from '@/components/rv/StaffContext'
import FormModal from '@/components/rv/FormModal'
import { WhatsAppModal } from '@/components/rv/CommsModals'
import ItemsTab from '@/components/rv/order/ItemsTab'
import RecipientsTab from '@/components/rv/order/RecipientsTab'
import FinanceTab from '@/components/rv/order/FinanceTab'
import type { OrderDetail } from '@/components/rv/order/types'
import { orderFields } from '@/components/rv/order/orderFields'
import type { FieldDef } from '@/components/rv/ResourcePage'
import { PURCHASE_STATUSES } from '@/lib/rv/constants'

type Tab = 'overview' | 'items' | 'recipients' | 'purchases' | 'finance' | 'activity'

const purchaseFields: FieldDef[] = [
  { key: 'vendor_id', label: 'Vendor', type: 'select', options: { remote: 'vendors', label: r => r.name, params: { active: 'true' } } },
  { key: 'description', label: 'Item / description', required: true, full: true },
  { key: 'qty', label: 'Quantity', type: 'number', default: 1 },
  { key: 'unit_cost', label: 'Unit cost (Rs)', type: 'number', default: 0 },
  { key: 'status', label: 'Status', type: 'select', options: PURCHASE_STATUSES.map(v => ({ value: v, label: labelize(v) })), default: 'requested' },
  { key: 'expected_at', label: 'Expected by', type: 'date' },
  { key: 'supplier_invoice_ref', label: 'Supplier invoice ref' },
]

function Progress({ label, n, total, tone }: { label: string; n: number; total: number; tone: string }) {
  const pct = total ? Math.round((n / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-600"><span>{label}</span><span>{n}/{total}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const me = useStaff()
  const { data: d, loading, error, reload } = useFetch<OrderDetail>(`/api/rv/orders/${id}/detail`)
  const [tab, setTab] = useState<Tab>('overview')
  const [editOrder, setEditOrder] = useState(false)
  const [addPurchase, setAddPurchase] = useState(false)
  const [wa, setWa] = useState(false)
  const comms = useFetch<{ data: any[] }>(tab === 'activity' ? `/api/rv/r/communications?order_id=${id}&limit=200` : null)

  const canEdit = ['admin', 'sales', 'ops'].includes(me.role)
  const statusText = useMemo(() => {
    if (!d) return ''
    const c = d.counts
    return `Hello ${d.order.customer?.name || ''}, update on your order ${d.order.order_no}${d.order.occasion ? ` (${d.order.occasion})` : ''}: ${c.delivered} of ${c.recipients} gifts delivered${c.failed ? `, ${c.failed} need a re-attempt` : ''}${c.in_transit ? `, ${c.in_transit} out for delivery` : ''}. - Raahvia`
  }, [d])

  if (loading && !d) return <div className="py-20 text-center"><Spinner className="mx-auto h-8 w-8" /></div>
  if (error || !d) return <ErrorNote>{error || 'Order not found'}</ErrorNote>
  const o = d.order
  const c = d.counts

  const setStatus = async (status: string) => {
    try { await api(`/api/rv/r/orders/${id}`, { method: 'PATCH', body: { status } }); toast.success('Status updated'); reload() } catch (e: any) { toast.error(e.message) }
  }
  const patchOrder = async (body: Record<string, any>) => { await api(`/api/rv/r/orders/${id}`, { method: 'PATCH', body }); toast.success('Saved'); reload() }
  const addP = async (v: Record<string, any>) => { await api('/api/rv/r/purchases', { body: { ...v, order_id: id } }); toast.success('Purchase added'); reload() }
  const setPStatus = async (pid: string, status: string) => { try { await api(`/api/rv/r/purchases/${pid}`, { method: 'PATCH', body: { status } }); reload() } catch (e: any) { toast.error(e.message) } }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'items', label: 'Items', count: d.items.length },
    { id: 'recipients', label: 'Recipients', count: c.recipients },
    ...(['admin', 'ops', 'finance'].includes(me.role) ? [{ id: 'purchases' as Tab, label: 'Purchases', count: d.purchases.length }] : []),
    ...(['admin', 'finance', 'sales', 'ops'].includes(me.role) ? [{ id: 'finance' as Tab, label: 'Invoices & payments' }] : []),
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div>
      <Link href="/raahvia/orders" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-rv-700"><ArrowLeft className="h-4 w-4" />All orders</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-bold text-rv-800">{o.order_no}</h1>
            <Badge value={o.status} />
            {o.quote_approved && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Quote v{o.quote_version} approved</span>}
          </div>
          <div className="mt-1 text-sm text-gray-600">
            {o.customer?.company || o.customer?.name}{o.occasion ? ` | ${o.occasion}` : ''} | Deliver {fmtDate(o.delivery_date)}{o.window_start ? ` (${o.window_start}-${o.window_end || ''})` : ''}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Select className="w-auto" value={o.status} onChange={e => setStatus(e.target.value)} aria-label="Order status">
              {ORDER_STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}
            </Select>
          )}
          {canEdit && <Button onClick={() => setEditOrder(true)}><Pencil className="h-4 w-4" />Edit details</Button>}
          {['admin', 'sales'].includes(me.role) && <Button onClick={() => setWa(true)}><MessageCircle className="h-4 w-4 text-emerald-600" />Update customer</Button>}
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Progress" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <Progress label="Addresses verified" n={c.address_verified} total={c.recipients} tone="bg-emerald-500" />
              <Progress label="Packed" n={c.packed} total={c.recipients} tone="bg-violet-500" />
              <Progress label="Out for delivery / delivered" n={c.delivered + c.in_transit} total={c.recipients} tone="bg-amber-500" />
              <Progress label="Delivered" n={c.delivered} total={c.recipients} tone="bg-sky-500" />
            </div>
            {c.address_open > 0 && <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{c.address_open} address(es) still need verifying. <Link href="/raahvia/addresses" className="font-medium underline">Open address queue</Link></div>}
            {c.failed > 0 && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{c.failed} failed deliver{c.failed === 1 ? 'y' : 'ies'}. <Link href="/raahvia/exceptions" className="font-medium underline">Open exceptions</Link></div>}
            {canEdit && ['enquiry', 'quotation'].includes(o.status) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {o.status === 'enquiry' && <Button onClick={() => patchOrder({ status: 'quotation' })}><Send className="h-4 w-4" />Mark quotation sent</Button>}
                <Button variant="primary" onClick={() => patchOrder({ quote_approved: true, status: 'confirmed' })}><CheckCircle2 className="h-4 w-4" />Customer approved - confirm order</Button>
                <Button onClick={() => patchOrder({ quote_version: o.quote_version + 1, quote_approved: false })}><Plus className="h-4 w-4" />New quote version (v{o.quote_version + 1})</Button>
              </div>
            )}
          </Card>
          <Card title="Quote value">
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-gray-500">Items</dt><dd className="text-right">{inr(d.totals.gross)}</dd>
              <dt className="text-gray-500">Discount</dt><dd className="text-right">- {inr(d.totals.discount)}</dd>
              <dt className="text-gray-500">Taxable</dt><dd className="text-right">{inr(d.totals.taxable)}</dd>
              <dt className="text-gray-500">GST</dt><dd className="text-right">{inr(d.totals.gst)}</dd>
              <dt className="font-semibold">Total</dt><dd className="text-right font-semibold">{inr(d.totals.total)}</dd>
              <dt className="text-gray-500">Estimated cost</dt><dd className="text-right">{inr(d.totals.est_cost)}</dd>
            </dl>
          </Card>
          <Card title="Order details" className="lg:col-span-3">
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['Customer', o.customer?.company || o.customer?.name], ['Contact', [o.customer?.name, o.customer?.mobile].filter(Boolean).join(' | ')],
                ['Owner', o.owner?.full_name], ['Payment terms', o.payment_terms], ['Place of supply', o.place_of_supply],
                ['Packaging', o.packaging_notes], ['Message card', o.message_card], ['Notes', o.notes],
              ].map(([k, v]) => <div key={k as string}><dt className="text-xs text-gray-500">{k}</dt><dd className="whitespace-pre-wrap">{v || '-'}</dd></div>)}
            </dl>
          </Card>
          {d.tasks.length > 0 && (
            <Card title={`Open tasks (${d.tasks.length})`} className="lg:col-span-3">
              <ul className="divide-y divide-gray-100 text-sm">{d.tasks.map(t => <li key={t.id} className="flex justify-between gap-3 py-1.5"><span>{t.title}</span><span className="text-xs text-gray-500">{fmtDateTime(t.due_at)}</span></li>)}</ul>
            </Card>
          )}
        </div>
      )}
      {tab === 'items' && <ItemsTab d={d} reload={reload} canEdit={canEdit} />}
      {tab === 'recipients' && <RecipientsTab d={d} reload={reload} canEdit={canEdit} />}
      {tab === 'purchases' && (
        <Card title="Purchases from vendors" pad={false} actions={['admin', 'ops'].includes(me.role) && <Button size="sm" variant="primary" onClick={() => setAddPurchase(true)}><Plus className="h-3.5 w-3.5" />Add purchase</Button>}>
          <div className="p-4">
            {d.purchases.length === 0 ? <Empty>No purchases yet. Use &quot;Create purchase lines&quot; on the Items tab to start from the order items.</Empty> : (
              <Table head={['PO', 'Vendor', 'Item', 'Qty', 'Cost', 'Status']}>
                {d.purchases.map(p => (
                  <tr key={p.id}>
                    <Td className="font-mono text-xs text-gray-500">{p.purchase_no}</Td><Td>{p.vendor?.name || <span className="text-amber-600">Not allocated</span>}</Td>
                    <Td>{p.description}</Td><Td>{p.qty}</Td><Td>{inr(p.total_cost)}</Td>
                    <Td>{['admin', 'ops'].includes(me.role)
                      ? <Select className="!w-auto !py-1 text-xs" value={p.status} onChange={e => setPStatus(p.id, e.target.value)}>{PURCHASE_STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}</Select>
                      : <Badge value={p.status} />}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </div>
        </Card>
      )}
      {tab === 'finance' && <FinanceTab d={d} reload={reload} role={me.role} />}
      {tab === 'activity' && (
        <Card title="Messages and calls linked to this order" pad={false}>
          <div className="p-4">
            {comms.loading ? <Spinner /> : (comms.data?.data || []).length === 0 ? <Empty>No messages or calls logged for this order yet.</Empty> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {comms.data!.data.map(m => (
                  <li key={m.id} className="flex gap-3 py-2">
                    <span className="w-28 shrink-0 text-xs text-gray-400">{fmtDateTime(m.created_at)}</span>
                    <span className="w-20 shrink-0 text-xs font-medium uppercase text-gray-500">{m.channel.replace('_', ' ')} {m.direction === 'in' ? 'in' : 'out'}</span>
                    <span className="min-w-0 break-words">{m.body || m.outcome || '-'} {m.status && <span className="text-xs text-gray-400">({m.status})</span>}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      <FormModal open={editOrder} onClose={() => setEditOrder(false)} title="Edit order" fields={orderFields.filter(f => f.key !== 'customer_id')} initial={o} onSubmit={patchOrder} />
      <FormModal open={addPurchase} onClose={() => setAddPurchase(false)} title="Add purchase" fields={purchaseFields} onSubmit={addP} />
      <WhatsAppModal open={wa} onClose={() => setWa(false)} target={{ name: o.customer?.name || 'Customer', mobile: o.customer?.mobile, customer_id: o.customer_id, order_id: o.id }} initialText={statusText} onDone={reload} />
    </div>
  )
}
