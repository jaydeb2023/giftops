'use client'
import { useState } from 'react'
import { Users, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import ResourcePage, { FieldDef } from '@/components/rv/ResourcePage'
import { Badge, Button, Empty, Field, Input, Modal, Table, Td } from '@/components/rv/ui'
import { WhatsAppModal, CommTarget } from '@/components/rv/CommsModals'
import { api, useFetch } from '@/lib/rv/client'

const fields: FieldDef[] = [
  { key: 'type', label: 'Type', type: 'select', options: [{ value: 'corporate', label: 'Corporate' }, { value: 'personal', label: 'Personal' }], default: 'corporate' },
  { key: 'name', label: 'Contact name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'gstin', label: 'GSTIN', placeholder: '19ABCDE1234F1Z5' },
  { key: 'mobile', label: 'Mobile', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'state_code', label: 'State code (GST)', default: '19', help: '19 = West Bengal. Decides CGST+SGST vs IGST.' },
  { key: 'credit_days', label: 'Credit days', type: 'number', default: 0 },
  { key: 'billing_address', label: 'Billing address', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
  { key: 'consent_whatsapp', label: 'OK to message on WhatsApp', type: 'checkbox', default: true },
  { key: 'opt_out', label: 'Opted out of all messages', type: 'checkbox' },
]

function ContactsModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const { data, reload } = useFetch<{ data: any[] }>(`/api/rv/r/contacts?customer_id=${customer.id}`)
  const [f, setF] = useState({ name: '', designation: '', mobile: '', email: '' })
  const add = async () => {
    if (!f.name.trim()) return toast.error('Enter a name')
    try { await api('/api/rv/r/contacts', { body: { ...f, customer_id: customer.id } }); setF({ name: '', designation: '', mobile: '', email: '' }); reload() }
    catch (e: any) { toast.error(e.message) }
  }
  const del = async (id: string) => { try { await api(`/api/rv/r/contacts/${id}`, { method: 'DELETE' }); reload() } catch (e: any) { toast.error(e.message) } }
  const rows = data?.data || []
  return (
    <Modal open onClose={onClose} title={`Contacts: ${customer.company || customer.name}`} wide>
      {rows.length === 0 ? <Empty>No extra contacts yet.</Empty> : (
        <Table head={['Name', 'Role', 'Mobile', 'Email', '']}>
          {rows.map(c => (
            <tr key={c.id}><Td>{c.name}</Td><Td>{c.designation || '-'}</Td><Td>{c.mobile || '-'}</Td><Td>{c.email || '-'}</Td>
              <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => del(c.id)}>Remove</Button></Td></tr>
          ))}
        </Table>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Name"><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Role"><Input value={f.designation} onChange={e => setF({ ...f, designation: e.target.value })} /></Field>
        <Field label="Mobile"><Input value={f.mobile} onChange={e => setF({ ...f, mobile: e.target.value })} /></Field>
        <Field label="Email"><Input value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></Field>
        <div className="flex items-end"><Button variant="primary" onClick={add} className="w-full">Add</Button></div>
      </div>
    </Modal>
  )
}

export default function CustomersPage() {
  const [contacts, setContacts] = useState<any | null>(null)
  const [wa, setWa] = useState<CommTarget | null>(null)
  return (
    <>
      <ResourcePage
        title="Customers"
        subtitle="Corporate and personal customers with billing details, GSTIN and credit terms"
        resource="customers"
        createLabel="New customer"
        modalTitle="customer"
        exportKind="customers"
        searchPlaceholder="Search name, company, mobile, GSTIN..."
        filters={[{ key: 'type', label: 'Type', options: [{ value: 'corporate', label: 'Corporate' }, { value: 'personal', label: 'Personal' }] }]}
        fields={fields}
        canDelete
        columns={[
          { key: 'customer_no', label: 'No.', render: r => <span className="font-mono text-xs text-gray-500">{r.customer_no}</span> },
          { key: 'name', label: 'Customer', render: r => <div><div className="font-medium">{r.company || r.name}</div><div className="text-xs text-gray-500">{r.company ? r.name : ''}</div></div> },
          { key: 'type', label: 'Type', render: r => <Badge value={r.type === 'corporate' ? 'confirmed' : 'new'} className="!bg-gray-100 !text-gray-700" /> },
          { key: 'mobile', label: 'Mobile' },
          { key: 'gstin', label: 'GSTIN', render: r => r.gstin || '-' },
          { key: 'credit_days', label: 'Credit', render: r => `${r.credit_days || 0} days` },
          { key: 'opt_out', label: 'Messages', render: r => (r.opt_out || r.consent_whatsapp === false) ? <span className="text-xs font-medium text-red-600">Opted out</span> : <span className="text-xs text-emerald-600">OK</span> },
        ]}
        rowActions={row => (
          <>
            <Button size="sm" variant="ghost" title="Contacts" onClick={() => setContacts(row)}><Users className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" title="WhatsApp" onClick={() => setWa({ name: row.company || row.name, mobile: row.mobile, customer_id: row.id })}><MessageCircle className="h-3.5 w-3.5 text-emerald-600" /></Button>
          </>
        )}
      />
      {contacts && <ContactsModal customer={contacts} onClose={() => setContacts(null)} />}
      <WhatsAppModal open={!!wa} onClose={() => setWa(null)} target={wa} />
    </>
  )
}
