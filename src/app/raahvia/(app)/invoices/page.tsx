'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDate, qs, useDebounced, useFetch } from '@/lib/rv/client'
import { labelize, INVOICE_STATUSES } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { Badge, Button, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Table, Td } from '@/components/rv/ui'
import FormModal from '@/components/rv/FormModal'
import type { FieldDef } from '@/components/rv/ResourcePage'
import { useStaff } from '@/components/rv/StaffContext'

const fields: FieldDef[] = [
  { key: 'order_id', label: 'From an order (uses its items)', type: 'select', options: { remote: 'orders', label: r => `${r.order_no} - ${r.customer?.company || r.customer?.name || ''}` }, full: true, help: 'Or leave empty and fill a manual invoice below' },
  { key: 'customer_id', label: 'Customer (manual invoice)', type: 'select', options: { remote: 'customers', label: r => r.company || r.name } },
  { key: 'description', label: 'Description (manual / extra line)' },
  { key: 'qty', label: 'Quantity', type: 'number', default: 1 },
  { key: 'rate', label: 'Rate (Rs, ex-GST)', type: 'number' },
  { key: 'gst_rate', label: 'GST %', type: 'number', default: 18 },
  { key: 'invoice_date', label: 'Invoice date', type: 'date', default: new Date().toISOString().slice(0, 10) },
  { key: 'notes', label: 'Notes', type: 'textarea', full: true },
]

export default function InvoicesPage() {
  const me = useStaff(); const router = useRouter()
  const [q, setQ] = useState(''); const dq = useDebounced(q)
  const [status, setStatus] = useState(''); const [type, setType] = useState('')
  const { data, loading, error, reload } = useFetch<{ data: any[] }>(`/api/rv/invoices${qs({ q: dq, status, doc_type: type })}`)
  const [open, setOpen] = useState(false)
  const canFin = ['admin', 'finance'].includes(me.role)
  const rows = data?.data || []

  const create = async (v: Record<string, any>) => {
    const line = v.description && v.rate ? [{ description: v.description, qty: Number(v.qty || 1), rate: Number(v.rate), gst_rate: Number(v.gst_rate ?? 18) }] : []
    const body: any = { invoice_date: v.invoice_date, notes: v.notes }
    if (v.order_id) { body.order_id = v.order_id; body.extra_lines = line } else { body.customer_id = v.customer_id; body.lines = line }
    if (!body.order_id && !body.customer_id) throw new Error('Choose an order or a customer')
    const r = await api<{ data: any }>('/api/rv/invoices', { body })
    toast.success(`Invoice ${r.data.invoice_no} created`); router.push(`/raahvia/invoices/${r.data.id}`)
  }

  return (
    <div>
      <PageHeader title="Invoices" subtitle="GST invoices and credit notes with CGST/SGST or IGST, linked to orders and customers"
        actions={<>
          <a href="/api/rv/export/invoices"><Button><Download className="h-4 w-4" />Export CSV</Button></a>
          {canFin && <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New invoice</Button>}
        </>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search invoice no." value={q} onChange={e => setQ(e.target.value)} />
        <Select className="w-auto" value={status} onChange={e => setStatus(e.target.value)}><option value="">Status: all</option>{INVOICE_STATUSES.map(s => <option key={s} value={s}>{labelize(s)}</option>)}</Select>
        <Select className="w-auto" value={type} onChange={e => setType(e.target.value)}><option value="">Invoices and credit notes</option><option value="invoice">Invoices</option><option value="credit_note">Credit notes</option></Select>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : rows.length === 0 ? <Empty>No invoices yet.</Empty> : (
        <Table head={['Invoice', 'Date', 'Customer', 'Order', 'Taxable', 'GST', 'Total', 'Paid', 'Due', 'Status']}>
          {rows.map(i => (
            <tr key={i.id} className="hover:bg-gray-50">
              <Td><Link className="font-medium text-rv-700 hover:underline" href={`/raahvia/invoices/${i.id}`}>{i.invoice_no}</Link>{i.doc_type === 'credit_note' && <span className="ml-1 text-xs text-gray-500">credit note</span>}</Td>
              <Td>{fmtDate(i.invoice_date)}</Td><Td>{i.customer?.company || i.customer?.name}</Td><Td className="text-xs">{i.order?.order_no || '-'}</Td>
              <Td>{inr(i.taxable_value)}</Td><Td>{inr(Number(i.cgst) + Number(i.sgst) + Number(i.igst))}</Td>
              <Td className="font-medium">{inr(i.total)}</Td><Td>{inr(i.paid_amount)}</Td><Td>{fmtDate(i.due_date)}</Td><Td><Badge value={i.status} /></Td>
            </tr>
          ))}
        </Table>
      )}
      <FormModal open={open} onClose={() => setOpen(false)} title="New invoice" fields={fields} submitLabel="Create invoice" onSubmit={async v => { await create(v); reload() }} />
    </div>
  )
}
