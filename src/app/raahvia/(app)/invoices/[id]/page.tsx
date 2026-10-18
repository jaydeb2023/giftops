'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Banknote, Printer, RotateCcw, Ban } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, fmtDate, useFetch } from '@/lib/rv/client'
import { PAYMENT_MODES, labelize } from '@/lib/rv/constants'
import { amountInWords, inr } from '@/lib/rv/util'
import { Badge, Button, Card, ErrorNote, Spinner, Table, Td } from '@/components/rv/ui'
import FormModal from '@/components/rv/FormModal'
import type { FieldDef } from '@/components/rv/ResourcePage'
import { useStaff } from '@/components/rv/StaffContext'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const me = useStaff()
  const { data, loading, error, reload } = useFetch<any>(`/api/rv/invoices/${id}`)
  const [pay, setPay] = useState(false)
  const [cn, setCn] = useState(false)
  if (loading && !data) return <Spinner className="mx-auto my-20 h-8 w-8" />
  if (error || !data) return <ErrorNote>{error || 'Not found'}</ErrorNote>
  const { invoice: inv, lines, payments, credit_notes, company, outstanding } = data
  const c = inv.customer
  const isCN = inv.doc_type === 'credit_note'
  const canFin = ['admin', 'finance'].includes(me.role)
  const igst = Number(inv.igst) > 0
  const fmt = (n: any) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const payFields: FieldDef[] = [
    { key: 'amount', label: 'Amount received (Rs)', type: 'number', required: true, default: outstanding },
    { key: 'received_on', label: 'Received on', type: 'date', default: new Date().toISOString().slice(0, 10) },
    { key: 'mode', label: 'Mode', type: 'select', options: PAYMENT_MODES.map(m => ({ value: m, label: labelize(m) })), default: 'upi' },
    { key: 'reference', label: 'UTR / reference' }, { key: 'notes', label: 'Notes', full: true },
  ]
  const doPay = async (v: Record<string, any>) => {
    try { await api('/api/rv/payments', { body: { ...v, invoice_id: id } }) }
    catch (e: any) { if (e.code === 'DUPLICATE_PAYMENT' && confirm(e.message + '\n\nRecord it anyway?')) await api('/api/rv/payments', { body: { ...v, invoice_id: id, force: true } }); else throw e }
    toast.success('Payment recorded'); reload()
  }
  const cnFields: FieldDef[] = [{ key: 'reason', label: 'Reason', required: true, full: true, placeholder: 'Returned gifts, rate difference, cancelled deliveries...' }]
  const doCn = async (v: Record<string, any>) => { await api(`/api/rv/invoices/${id}/credit-note`, { body: { full: true, reason: v.reason } }); toast.success('Credit note issued'); reload() }
  const cancel = async () => { if (!confirm('Cancel this invoice?')) return; try { await api(`/api/rv/invoices/${id}`, { method: 'PATCH', body: { status: 'cancelled' } }); reload() } catch (e: any) { toast.error(e.message) } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/raahvia/invoices" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-rv-700"><ArrowLeft className="h-4 w-4" />All invoices</Link>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => window.print()}><Printer className="h-4 w-4" />Print / Save as PDF</Button>
          {canFin && !isCN && ['issued', 'part_paid'].includes(inv.status) && <Button variant="primary" onClick={() => setPay(true)}><Banknote className="h-4 w-4" />Record payment</Button>}
          {canFin && !isCN && ['issued', 'part_paid', 'paid'].includes(inv.status) && <Button onClick={() => setCn(true)}><RotateCcw className="h-4 w-4" />Credit note (full)</Button>}
          {canFin && !isCN && inv.status === 'issued' && <Button variant="danger" onClick={cancel}><Ban className="h-4 w-4" />Cancel</Button>}
        </div>
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-rv-800 pb-4">
          <div>
            <div className="text-2xl font-extrabold tracking-wide text-rv-800">{company.name || 'Raahvia'}</div>
            <div className="text-xs text-gray-500">{company.tagline}</div>
            <div className="mt-2 whitespace-pre-line text-xs text-gray-600">{company.address}{company.phone ? `\nPhone: ${company.phone}` : ''}{company.email ? `\n${company.email}` : ''}{company.gstin ? `\nGSTIN: ${company.gstin}` : ''}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold uppercase text-gray-800">{isCN ? 'Credit note' : 'Tax invoice'}</div>
            <div className="font-mono text-sm">{inv.invoice_no}</div>
            <div className="text-xs text-gray-500">Date: {fmtDate(inv.invoice_date)}</div>
            {!isCN && <div className="text-xs text-gray-500">Due: {fmtDate(inv.due_date)}</div>}
            <div className="mt-1 print:hidden"><Badge value={inv.status} /></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 py-4 text-sm">
          <div><div className="text-xs font-semibold uppercase text-gray-500">Bill to</div><div className="font-medium">{c?.company || c?.name}</div>{c?.company && <div>{c.name}</div>}<div className="whitespace-pre-line text-gray-600">{c?.billing_address}</div>{c?.gstin && <div className="text-gray-600">GSTIN: {c.gstin}</div>}</div>
          <div className="text-right text-gray-600"><div>Place of supply: {inv.place_of_supply || '-'}</div>{inv.order && <div>Order: {inv.order.order_no}</div>}{inv.order?.occasion && <div>{inv.order.occasion}</div>}</div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-y border-gray-300 bg-gray-50 text-xs uppercase text-gray-600"><th className="px-2 py-2 text-left">Description</th><th className="px-2 py-2 text-left">HSN</th><th className="px-2 py-2 text-right">Qty</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-right">GST %</th><th className="px-2 py-2 text-right">Taxable</th></tr></thead>
          <tbody>{lines.map((l: any) => <tr key={l.id} className="border-b border-gray-100"><td className="px-2 py-2">{l.description}</td><td className="px-2 py-2">{l.hsn || '-'}</td><td className="px-2 py-2 text-right">{l.qty}</td><td className="px-2 py-2 text-right">{fmt(l.rate)}</td><td className="px-2 py-2 text-right">{l.gst_rate}</td><td className="px-2 py-2 text-right">{fmt(l.amount)}</td></tr>)}</tbody>
        </table>
        <div className="ml-auto mt-4 w-full max-w-xs text-sm">
          <div className="flex justify-between py-0.5"><span>Taxable value</span><span>{fmt(inv.taxable_value)}</span></div>
          {igst ? <div className="flex justify-between py-0.5"><span>IGST</span><span>{fmt(inv.igst)}</span></div> : <>
            <div className="flex justify-between py-0.5"><span>CGST</span><span>{fmt(inv.cgst)}</span></div>
            <div className="flex justify-between py-0.5"><span>SGST</span><span>{fmt(inv.sgst)}</span></div></>}
          <div className="mt-1 flex justify-between border-t border-gray-300 pt-1 text-base font-bold"><span>Total</span><span>Rs {fmt(inv.total)}</span></div>
          {!isCN && Number(inv.paid_amount) > 0 && <div className="flex justify-between py-0.5 text-gray-600"><span>Received</span><span>- {fmt(inv.paid_amount)}</span></div>}
          {!isCN && <div className="flex justify-between py-0.5 font-semibold"><span>Balance due</span><span>Rs {fmt(outstanding)}</span></div>}
        </div>
        <div className="mt-4 text-xs text-gray-600"><span className="font-semibold">Amount in words: </span>{amountInWords(Number(inv.total))}</div>
        {inv.notes && <div className="mt-2 text-xs text-gray-600"><span className="font-semibold">{isCN ? 'Reason' : 'Notes'}: </span>{inv.notes}</div>}
        <div className="mt-6 grid grid-cols-2 gap-6 border-t border-gray-200 pt-4 text-xs text-gray-600">
          <div>{(company.bank_details || company.upi_id) && <><div className="font-semibold text-gray-800">Payment details</div><div className="whitespace-pre-line">{company.bank_details}</div>{company.upi_id && <div>UPI: {company.upi_id}</div>}</>}</div>
          <div><div className="font-semibold text-gray-800">Terms</div><div>{company.invoice_terms}</div></div>
        </div>
      </div>

      {(payments.length > 0 || credit_notes.length > 0) && (
        <div className="mx-auto mt-5 max-w-3xl space-y-4 print:hidden">
          {payments.length > 0 && <Card title="Payments received" pad={false}><div className="p-4"><Table head={['Date', 'Amount', 'Mode', 'Reference']}>{payments.map((p: any) => <tr key={p.id}><Td>{fmtDate(p.received_on)}</Td><Td>{inr(p.amount)}</Td><Td>{labelize(p.mode)}</Td><Td>{p.reference || '-'}</Td></tr>)}</Table></div></Card>}
          {credit_notes.length > 0 && <Card title="Credit notes" pad={false}><div className="p-4"><Table head={['Credit note', 'Date', 'Total']}>{credit_notes.map((n: any) => <tr key={n.id}><Td><Link className="text-rv-700 hover:underline" href={`/raahvia/invoices/${n.id}`}>{n.invoice_no}</Link></Td><Td>{fmtDate(n.invoice_date)}</Td><Td>{inr(n.total)}</Td></tr>)}</Table></div></Card>}
        </div>
      )}
      <FormModal open={pay} onClose={() => setPay(false)} title={`Record payment: ${inv.invoice_no}`} fields={payFields} onSubmit={doPay} />
      <FormModal open={cn} onClose={() => setCn(false)} title="Issue credit note for the full invoice" fields={cnFields} submitLabel="Issue credit note" onSubmit={doCn} intro="This reverses the whole invoice value. For a partial credit, ask admin to add a custom credit note line through the API." />
    </div>
  )
}
