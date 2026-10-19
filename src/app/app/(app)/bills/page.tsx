'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Banknote } from 'lucide-react'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge, Button, ErrorNote, Field, Input, Modal, Select } from '@/components/rv/ui'
import { api, fmtDate } from '@/lib/rv/client'
import { BILL_TYPES, PAYMENT_MODES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { useStaff } from '@/components/rv/StaffContext'

const fields: FieldDef[] = [
  { key: 'bill_type', label: 'Type', type: 'select', options: BILL_TYPES.map(v => ({ value: v, label: labelize(v) })), default: 'vendor' },
  { key: 'vendor_id', label: 'Vendor', type: 'select', options: { remote: 'vendors', label: r => r.name } },
  { key: 'party_name', label: 'Party name (courier / other)' },
  { key: 'bill_no', label: 'Bill number' },
  { key: 'bill_date', label: 'Bill date', type: 'date', default: new Date().toISOString().slice(0, 10) },
  { key: 'due_date', label: 'Due date', type: 'date' },
  { key: 'amount', label: 'Amount (Rs)', type: 'number', required: true },
  { key: 'order_id', label: 'Allocate to order', type: 'select', options: { remote: 'orders', label: r => `${r.order_no} - ${r.customer?.company || r.customer?.name || ''}` }, help: 'Counted in that order\'s contribution' },
  { key: 'run_id', label: 'Allocate to delivery run', type: 'select', options: { remote: 'runs', label: r => `${r.run_no} - ${r.run_date}` }, help: 'Courier cost is shared across the run\'s stops' },
  { key: 'purchase_id', label: 'Linked purchase', type: 'select', options: { remote: 'purchases', label: r => `${r.purchase_no} - ${r.description}` }, help: 'Supplier bill for that purchase (not double counted)' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

export default function BillsPage() {
  const me = useStaff()
  const [pay, setPay] = useState<any | null>(null)
  const [f, setF] = useState({ amount: '', mode: 'bank', reference: '', paid_on: new Date().toISOString().slice(0, 10) })
  const [err, setErr] = useState('')
  const [bump, setBump] = useState(0)
  const canPay = me.role === 'admin' || me.role === 'finance'
  const doPay = async () => {
    setErr('')
    try { await api(`/api/rv/bills/${pay.id}/pay`, { body: { ...f, amount: Number(f.amount) } }); toast.success('Payment recorded'); setPay(null); setBump(b => b + 1) }
    catch (e: any) { setErr(e.message) }
  }
  return (
    <>
      <ResourcePage
        key={bump}
        title="Vendor & courier bills"
        subtitle="Payables: supplier and courier bills linked to vendors, orders and delivery runs"
        resource="bills"
        createLabel="New bill"
        modalTitle="bill"
        exportKind="bills"
        searchPlaceholder="Search bill no., party..."
        filters={[
          { key: 'bill_type', label: 'Type', options: BILL_TYPES.map(v => ({ value: v, label: labelize(v) })) },
          { key: 'status', label: 'Status', options: ['unpaid', 'part_paid', 'paid', 'cancelled'].map(v => ({ value: v, label: labelize(v) })) },
        ]}
        fields={fields}
        canDelete={canPay}
        columns={[
          { key: 'bill_date', label: 'Date', render: r => fmtDate(r.bill_date) },
          { key: 'bill_no', label: 'Bill', render: r => r.bill_no || '-' },
          { key: 'party', label: 'Party', render: r => <div>{r.vendor?.name || r.party_name || '-'}<div className="text-xs text-gray-500">{labelize(r.bill_type)}</div></div> },
          { key: 'alloc', label: 'Allocated to', render: r => [r.order?.order_no, r.run?.run_no].filter(Boolean).join(' / ') || '-' },
          { key: 'due_date', label: 'Due', render: r => fmtDate(r.due_date) },
          { key: 'amount', label: 'Amount', render: r => inr(r.amount) },
          { key: 'balance', label: 'Balance', render: r => inr(Number(r.amount) - Number(r.paid_amount)) },
          { key: 'status', label: 'Status', render: r => <Badge value={r.status} /> },
        ]}
        rowActions={row => canPay && ['unpaid', 'part_paid'].includes(row.status) ? (
          <Button size="sm" variant="ghost" title="Record payment" onClick={() => { setF({ amount: String(Number(row.amount) - Number(row.paid_amount)), mode: 'bank', reference: '', paid_on: new Date().toISOString().slice(0, 10) }); setErr(''); setPay(row) }}><Banknote className="h-3.5 w-3.5 text-emerald-600" /></Button>
        ) : null}
      />
      <Modal open={!!pay} onClose={() => setPay(null)} title={`Pay bill ${pay?.bill_no || ''}`}
        footer={<><Button onClick={() => setPay(null)}>Cancel</Button><Button variant="primary" onClick={doPay}>Record payment</Button></>}>
        {err && <div className="mb-3"><ErrorNote>{err}</ErrorNote></div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Amount (Rs)"><Input type="number" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Paid on"><Input type="date" value={f.paid_on} onChange={e => setF({ ...f, paid_on: e.target.value })} /></Field>
          <Field label="Mode"><Select value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}>{PAYMENT_MODES.map(m => <option key={m} value={m}>{labelize(m)}</option>)}</Select></Field>
          <Field label="Reference / UTR"><Input value={f.reference} onChange={e => setF({ ...f, reference: e.target.value })} /></Field>
        </div>
      </Modal>
    </>
  )
}
