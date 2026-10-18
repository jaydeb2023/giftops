'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Phone, UserCheck, GitMerge } from 'lucide-react'
import toast from 'react-hot-toast'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge, Button, Field, Input, Modal, Select } from '@/components/rv/ui'
import { CallLogModal, CommTarget, WhatsAppModal } from '@/components/rv/CommsModals'
import { api, fmtDateTime, useFetch } from '@/lib/rv/client'
import { LEAD_SOURCES, LEAD_STAGES, labelize } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'

const opts = (a: readonly string[]) => a.map(v => ({ value: v, label: labelize(v) }))

const fields: FieldDef[] = [
  { key: 'name', label: 'Contact name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'mobile', label: 'Mobile', type: 'tel', help: 'Used to detect duplicates' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'source', label: 'Source', type: 'select', options: opts(LEAD_SOURCES), default: 'phone' },
  { key: 'stage', label: 'Stage', type: 'select', options: opts(LEAD_STAGES), default: 'new' },
  { key: 'owner_id', label: 'Owner', type: 'select', options: { remote: 'staff', label: r => r.full_name, filter: r => ['sales', 'admin'].includes(r.role) } },
  { key: 'occasion', label: 'Occasion' },
  { key: 'expected_value', label: 'Expected value (Rs)', type: 'number' },
  { key: 'next_followup_at', label: 'Next follow-up', type: 'datetime' },
  { key: 'lost_reason', label: 'Lost reason', help: 'Required when the stage is Lost' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'consent_whatsapp', label: 'OK to message on WhatsApp', type: 'checkbox', default: true },
  { key: 'opt_out', label: 'Opted out of all messages', type: 'checkbox' },
]

export default function LeadsPage() {
  const router = useRouter()
  const [wa, setWa] = useState<CommTarget | null>(null)
  const [call, setCall] = useState<CommTarget | null>(null)
  const [merge, setMerge] = useState<any | null>(null)
  const [mergeWith, setMergeWith] = useState('')
  const [convert, setConvert] = useState<any | null>(null)
  const [conv, setConv] = useState({ occasion: '', delivery_date: '' })
  const [bump, setBump] = useState(0)
  const others = useFetch<{ data: any[] }>(merge ? '/api/rv/r/leads?limit=500' : null)

  const doConvert = async () => {
    try {
      const r = await api<{ order_id: string | null; customer_id: string }>(`/api/rv/leads/${convert.id}/convert`, { body: { ...conv, create_order: true } })
      toast.success('Converted to customer and order created')
      setConvert(null)
      if (r.order_id) router.push(`/raahvia/orders/${r.order_id}`)
    } catch (e: any) { toast.error(e.message) }
  }
  const doMerge = async () => {
    try { await api('/api/rv/leads/merge', { body: { keep_id: merge.id, merge_id: mergeWith } }); toast.success('Leads merged'); setMerge(null); setMergeWith(''); setBump(b => b + 1) }
    catch (e: any) { toast.error(e.message) }
  }

  return (
    <>
      <ResourcePage
        key={bump}
        title="Leads"
        subtitle="Enquiries from phone, website, WhatsApp, chatbot and referrals"
        resource="leads"
        createLabel="New lead"
        modalTitle="lead"
        exportKind="leads"
        searchPlaceholder="Search name, company, mobile..."
        filters={[
          { key: 'stage', label: 'Stage', options: opts(LEAD_STAGES) },
          { key: 'source', label: 'Source', options: opts(LEAD_SOURCES) },
        ]}
        fields={fields}
        canDelete
        columns={[
          { key: 'lead_no', label: 'Lead', render: r => <span className="font-mono text-xs text-gray-500">{r.lead_no}</span> },
          { key: 'name', label: 'Contact', render: r => <div><div className="font-medium">{r.name}</div><div className="text-xs text-gray-500">{r.company || ''}</div></div> },
          { key: 'mobile', label: 'Mobile', render: r => r.mobile ? <a className="text-rv-700 hover:underline" href={`tel:${r.mobile}`}>{r.mobile}</a> : '-' },
          { key: 'source', label: 'Source', render: r => labelize(r.source) },
          { key: 'stage', label: 'Stage', render: r => <Badge value={r.stage} /> },
          { key: 'owner', label: 'Owner', render: r => r.owner?.full_name || '-' },
          { key: 'value', label: 'Value', render: r => r.expected_value ? inr(r.expected_value) : '-' },
          { key: 'next_followup_at', label: 'Follow-up', render: r => {
            const late = r.next_followup_at && new Date(r.next_followup_at) < new Date() && !['converted', 'lost'].includes(r.stage)
            return <span className={late ? 'font-medium text-red-600' : ''}>{fmtDateTime(r.next_followup_at)}</span>
          } },
        ]}
        rowActions={row => (
          <>
            <Button size="sm" variant="ghost" title="Log call" onClick={() => setCall({ name: row.name, mobile: row.mobile, lead_id: row.id, customer_id: row.customer_id })}><Phone className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" title="WhatsApp" onClick={() => setWa({ name: row.name, mobile: row.mobile, lead_id: row.id, customer_id: row.customer_id })}><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
            {row.stage !== 'converted' && <Button size="sm" variant="ghost" title="Convert to customer + order" onClick={() => { setConv({ occasion: row.occasion || '', delivery_date: '' }); setConvert(row) }}><UserCheck className="h-3.5 w-3.5 text-rv-700" /></Button>}
            <Button size="sm" variant="ghost" title="Merge a duplicate into this lead" onClick={() => setMerge(row)}><GitMerge className="h-3.5 w-3.5" /></Button>
          </>
        )}
      />
      <WhatsAppModal open={!!wa} onClose={() => setWa(null)} target={wa} />
      <CallLogModal open={!!call} onClose={() => setCall(null)} target={call} onDone={() => setBump(b => b + 1)} />

      <Modal open={!!convert} onClose={() => setConvert(null)} title={`Convert ${convert?.name || ''}`}
        footer={<><Button onClick={() => setConvert(null)}>Cancel</Button><Button variant="primary" onClick={doConvert}>Create customer + order</Button></>}>
        <p className="mb-3 text-sm text-gray-600">Creates (or re-uses, if the mobile matches) a customer and opens a new order you can add recipients to.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Occasion"><Input value={conv.occasion} onChange={e => setConv(c => ({ ...c, occasion: e.target.value }))} /></Field>
          <Field label="Delivery date"><Input type="date" value={conv.delivery_date} onChange={e => setConv(c => ({ ...c, delivery_date: e.target.value }))} /></Field>
        </div>
      </Modal>

      <Modal open={!!merge} onClose={() => setMerge(null)} title={`Merge a duplicate into ${merge?.name || ''}`}
        footer={<><Button onClick={() => setMerge(null)}>Cancel</Button><Button variant="primary" disabled={!mergeWith} onClick={doMerge}>Merge</Button></>}>
        <p className="mb-3 text-sm text-gray-600">The selected lead is removed. Missing details are copied into this lead and its history moves across. This is recorded in the audit log.</p>
        <Field label="Duplicate lead to merge in">
          <Select value={mergeWith} onChange={e => setMergeWith(e.target.value)}>
            <option value="">Select...</option>
            {(others.data?.data || []).filter(l => l.id !== merge?.id).map(l => <option key={l.id} value={l.id}>{l.lead_no} - {l.name} {l.mobile ? `(${l.mobile})` : ''}</option>)}
          </Select>
        </Field>
      </Modal>
    </>
  )
}
