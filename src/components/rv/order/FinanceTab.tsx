'use client'
import { useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { FilePlus2, Banknote } from 'lucide-react'
import { api, fmtDate, useFetch } from '@/lib/rv/client'
import { PAYMENT_MODES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { Badge, Button, Card, Empty, Table, Td } from '../ui'
import FormModal from '../FormModal'
import type { FieldDef } from '../ResourcePage'
import type { OrderDetail } from './types'

const extraFields: FieldDef[] = [
  { key: 'description', label: 'Extra charge (optional)', placeholder: 'e.g. Delivery charges', full: true },
  { key: 'rate', label: 'Amount (Rs, ex-GST)', type: 'number' },
  { key: 'gst_rate', label: 'GST %', type: 'number', default: 18 },
  { key: 'invoice_date', label: 'Invoice date', type: 'date', default: new Date().toISOString().slice(0, 10) },
  { key: 'notes', label: 'Notes on invoice', type: 'textarea' },
]

export default function FinanceTab({ d, reload, role }: { d: OrderDetail; reload: () => void; role: string }) {
  const canFin = role === 'admin' || role === 'finance'
  const [inv, setInv] = useState(false)
  const [payFor, setPayFor] = useState<any | null>(null)
  const profit = useFetch<any>(role === 'sales' ? null : `/api/rv/reports/profit?order_id=${d.order.id}`)
  const pr = profit.data?.rows?.[0]

  const createInvoice = async (v: Record<string, any>) => {
    const extra = v.description && v.rate ? [{ description: v.description, qty: 1, rate: Number(v.rate), gst_rate: Number(v.gst_rate ?? 18) }] : []
    const r = await api<{ data: any }>('/api/rv/invoices', { body: { order_id: d.order.id, extra_lines: extra, invoice_date: v.invoice_date, notes: v.notes } })
    toast.success(`Invoice ${r.data.invoice_no} created`); reload()
  }
  const payFields = (inv: any): FieldDef[] => [
    { key: 'amount', label: 'Amount received (Rs)', type: 'number', required: true, default: Math.max(Number(inv.total) - Number(inv.paid_amount), 0) },
    { key: 'received_on', label: 'Received on', type: 'date', default: new Date().toISOString().slice(0, 10) },
    { key: 'mode', label: 'Mode', type: 'select', options: PAYMENT_MODES.map(m => ({ value: m, label: labelize(m) })), default: 'upi' },
    { key: 'reference', label: 'UTR / reference' },
    { key: 'notes', label: 'Notes', full: true },
  ]
  const pay = async (v: Record<string, any>) => {
    try { await api('/api/rv/payments', { body: { ...v, invoice_id: payFor.id } }) }
    catch (e: any) {
      if (e.code === 'DUPLICATE_PAYMENT' && confirm(e.message + '\n\nRecord it anyway?')) await api('/api/rv/payments', { body: { ...v, invoice_id: payFor.id, force: true } })
      else throw e
    }
    toast.success('Payment recorded'); reload()
  }
  const hasLive = d.invoices.some(i => i.doc_type === 'invoice' && i.status !== 'cancelled')

  return (
    <div className="space-y-4">
      <Card title="Invoices" pad={false} actions={canFin && !hasLive && <Button size="sm" variant="primary" onClick={() => setInv(true)}><FilePlus2 className="h-3.5 w-3.5" />Create invoice from order</Button>}>
        <div className="p-4">
          {d.invoices.length === 0 ? <Empty>No invoice yet. {canFin ? 'Create one from the order items once the order is confirmed.' : 'Finance will raise it.'}</Empty> : (
            <Table head={['Invoice', 'Date', 'Due', 'Taxable', 'GST', 'Total', 'Paid', 'Status', '']}>
              {d.invoices.map(i => (
                <tr key={i.id}>
                  <Td><Link className="font-medium text-rv-700 hover:underline" href={`/app/invoices/${i.id}`}>{i.invoice_no}</Link>{i.doc_type === 'credit_note' && <span className="ml-1 text-xs text-gray-500">(credit note)</span>}</Td>
                  <Td>{fmtDate(i.invoice_date)}</Td><Td>{fmtDate(i.due_date)}</Td>
                  <Td>{inr(i.taxable_value)}</Td><Td>{inr(Number(i.cgst) + Number(i.sgst) + Number(i.igst))}</Td>
                  <Td className="font-medium">{inr(i.total)}</Td><Td>{inr(i.paid_amount)}</Td>
                  <Td><Badge value={i.status} /></Td>
                  <Td className="text-right">{canFin && i.doc_type === 'invoice' && ['issued', 'part_paid'].includes(i.status) && <Button size="sm" onClick={() => setPayFor(i)}><Banknote className="h-3.5 w-3.5" />Record payment</Button>}</Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </Card>

      {d.payments.length > 0 && (
        <Card title="Payments received" pad={false}>
          <div className="p-4"><Table head={['Date', 'Amount', 'Mode', 'Reference']}>
            {d.payments.map(p => <tr key={p.id}><Td>{fmtDate(p.received_on)}</Td><Td>{inr(p.amount)}</Td><Td>{labelize(p.mode)}</Td><Td>{p.reference || '-'}</Td></tr>)}
          </Table></div>
        </Card>
      )}

      {pr && (
        <Card title="Order contribution (gross margin, not accounting profit)">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {([
              [pr.invoiced ? 'Revenue (ex-GST)' : 'Quoted revenue (ex-GST)', inr(pr.revenue)],
              ['Product cost', inr(pr.product_cost)],
              ['Other bills', inr(pr.other_bills)],
              ['Delivery cost', inr(pr.delivery_cost)],
              ['Expenses', inr(pr.expenses)],
              ['Contribution', inr(pr.contribution)],
              ['Margin', `${pr.margin_pct}%`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-gray-50 p-3"><div className="text-xs text-gray-500">{k}</div><div className="mt-0.5 font-semibold">{v}</div></div>
            ))}
          </div>
        </Card>
      )}

      <FormModal open={inv} onClose={() => setInv(false)} title="Create invoice" fields={extraFields} submitLabel="Create invoice" onSubmit={createInvoice}
        intro={<>Builds the invoice from this order&apos;s items ({inr(d.totals.taxable)} taxable + GST {inr(d.totals.gst)}). GST is split CGST+SGST for West Bengal customers and IGST otherwise. You can add one extra charge below.</>} />
      <FormModal open={!!payFor} onClose={() => setPayFor(null)} title={`Record payment: ${payFor?.invoice_no || ''}`} fields={payFor ? payFields(payFor) : []} onSubmit={pay} />
    </div>
  )
}
