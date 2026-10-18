'use client'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api, fmtDateTime, useFetch } from '@/lib/rv/client'
import { RV_ROLES, labelize } from '@/lib/rv/constants'
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Textarea } from '@/components/rv/ui'
import FormModal from '@/components/rv/FormModal'

type Tab = 'company' | 'chase' | 'staff' | 'integrations' | 'audit'

function SettingsForm({ k, fields, data, onSaved }: { k: string; fields: { key: string; label: string; type?: string; area?: boolean; help?: string }[]; data: any; onSaved: () => void }) {
  const [v, setV] = useState<Record<string, any>>(data || {})
  const [busy, setBusy] = useState(false)
  useEffect(() => setV(data || {}), [data])
  const save = async () => {
    setBusy(true)
    try {
      const out: Record<string, any> = { ...v }
      fields.forEach(f => { if (f.type === 'number') out[f.key] = Number(out[f.key] || 0) })
      await api('/api/rv/settings', { method: 'PUT', body: { key: k, value: out } }); toast.success('Saved'); onSaved()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return <Card><div className="grid gap-3 sm:grid-cols-2">
    {fields.map(f => <Field key={f.key} label={f.label} help={f.help} className={f.area ? 'sm:col-span-2' : ''}>
      {f.type === 'bool' ? <Select value={v[f.key] ? '1' : '0'} onChange={e => setV({ ...v, [f.key]: e.target.value === '1' })}><option value="1">Yes</option><option value="0">No</option></Select>
        : f.area ? <Textarea rows={3} value={v[f.key] ?? ''} onChange={e => setV({ ...v, [f.key]: e.target.value })} />
        : <Input type={f.type === 'number' ? 'number' : 'text'} value={v[f.key] ?? ''} onChange={e => setV({ ...v, [f.key]: e.target.value })} />}
    </Field>)}
  </div><div className="mt-4"><Button variant="primary" loading={busy} onClick={save}>Save</Button></div></Card>
}

function Staff() {
  const { data, loading, error, reload } = useFetch<{ data: any[] }>('/api/rv/staff')
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState<string | null>(null)
  const patch = async (id: string, body: any) => { try { const r: any = await api('/api/rv/staff', { method: 'PATCH', body: { id, ...body } }); if (r.temp_password) setPwd(r.temp_password); reload() } catch (e: any) { toast.error(e.message) } }
  return <div className="space-y-3">
    <div className="flex justify-end"><Button variant="primary" onClick={() => setOpen(true)}>Add staff</Button></div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {pwd && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Temporary password (shown once): <b className="font-mono">{pwd}</b> <button className="ml-2 underline" onClick={() => setPwd(null)}>hide</button></div>}
    {loading && !data ? <Spinner className="mx-auto my-8 h-6 w-6" /> : <Table head={['Name', 'Email', 'Role', 'Active', '']}>
      {(data?.data || []).map(s => <tr key={s.id}><Td>{s.full_name}</Td><Td>{s.email}</Td>
        <Td><Select className="w-auto" value={s.role} onChange={e => patch(s.id, { role: e.target.value })}>{RV_ROLES.map(r => <option key={r} value={r}>{labelize(r)}</option>)}</Select></Td>
        <Td>{s.active ? <Badge value="active" /> : <Badge value="inactive" />}</Td>
        <Td><div className="flex gap-2"><Button size="sm" onClick={() => patch(s.id, { active: !s.active })}>{s.active ? 'Deactivate' : 'Activate'}</Button><Button size="sm" onClick={() => confirm('Reset password?') && patch(s.id, { reset_password: true })}>Reset password</Button></div></Td></tr>)}
    </Table>}
    <FormModal open={open} onClose={() => setOpen(false)} title="Add staff member" submitLabel="Create login"
      intro="Creates a login. If you leave the password empty, a temporary one is generated and shown once."
      fields={[{ key: 'full_name', label: 'Full name', required: true }, { key: 'email', label: 'Email', required: true }, { key: 'mobile', label: 'Mobile' },
        { key: 'role', label: 'Role', type: 'select', options: RV_ROLES.map(r => ({ value: r, label: labelize(r) })), default: 'sales' }, { key: 'password', label: 'Password (optional)' }]}
      onSubmit={async v => { const r: any = await api('/api/rv/staff', { body: v }); if (r.temp_password) setPwd(r.temp_password); toast.success('Staff added'); reload() }} />
  </div>
}

function Integrations({ p }: { p: any }) {
  const origin = typeof window !== 'undefined' ? (p.app_url || window.location.origin) : p.app_url
  const row = (label: string, ok: boolean, hint: string) => <tr><Td>{label}</Td><Td>{ok ? <Badge value="connected" /> : <Badge value="not_set" />}</Td><Td className="text-xs text-gray-600">{hint}</Td></tr>
  return <div className="space-y-4">
    <Table head={['Integration', 'Status', 'What to set']}>
      {row('WhatsApp Cloud API', p.whatsapp, 'RV_WA_PHONE_NUMBER_ID, RV_WA_TOKEN')}
      {row('WhatsApp webhook signature', p.whatsapp_webhook_secret, 'RV_WA_APP_SECRET (Meta app secret) and RV_WA_VERIFY_TOKEN')}
      {row('AI calling provider', p.ai_call, 'RV_AI_CALL_API_URL, RV_AI_CALL_API_KEY (optional RV_AI_CALL_SCRIPT)')}
      {row('AI call callback secret', p.ai_call_callback_secret, 'RV_AI_CALL_SECRET, sent by the provider in header x-rv-secret')}
      {row('Scheduled chase (cron)', p.cron_secret, 'CRON_SECRET, call the URL below every 30-60 minutes')}
    </Table>
    <Card title="URLs to configure">
      <ul className="space-y-1 font-mono text-xs break-all">
        <li>WhatsApp webhook: {origin}/api/rv/webhooks/whatsapp</li>
        <li>AI call result webhook: {origin}/api/rv/webhooks/ai-call</li>
        <li>Address chase job: {origin}/api/rv/address-chase/run (header Authorization: Bearer CRON_SECRET)</li>
      </ul>
      <p className="mt-3 text-xs text-gray-500">WhatsApp needs an approved template named in Address chase settings (default <b>address_request</b>) with 3 variables: recipient name, customer name, delivery date. Environment variables are set on your host (e.g. Vercel) and need a redeploy.</p>
    </Card></div>
}

function Audit() {
  const { data, loading, error } = useFetch<{ data: any[] }>('/api/rv/r/audit?limit=200')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (loading && !data) return <Spinner className="mx-auto my-8 h-6 w-6" />
  return <Table head={['When', 'Who', 'Table', 'Action', 'Record']}>
    {(data?.data || []).map(a => <tr key={a.id}><Td>{fmtDateTime(a.created_at)}</Td><Td>{a.actor_email || '-'}</Td><Td>{a.table_name}</Td><Td>{a.action}</Td><Td className="font-mono text-xs">{String(a.record_id || '').slice(0, 8)}</Td></tr>)}
  </Table>
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('company')
  const { data, loading, error, reload } = useFetch<any>('/api/rv/settings')
  return <div>
    <PageHeader title="Settings & staff" subtitle="Company and invoice details, address chase rules, team logins and integrations" />
    <Tabs tabs={[{ id: 'company', label: 'Company & invoice' }, { id: 'chase', label: 'Address chase' }, { id: 'staff', label: 'Staff' }, { id: 'integrations', label: 'Integrations' }, { id: 'audit', label: 'Audit log' }]} value={tab} onChange={setTab} />
    <div className="mt-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-8 h-6 w-6" /> : data && (
        tab === 'company' ? <SettingsForm k="company" data={data.settings.company} onSaved={reload} fields={[
          { key: 'name', label: 'Company name' }, { key: 'tagline', label: 'Tagline' }, { key: 'gstin', label: 'GSTIN' }, { key: 'state_code', label: 'State code', help: 'West Bengal = 19. Decides CGST+SGST vs IGST' },
          { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'invoice_prefix', label: 'Invoice prefix' }, { key: 'default_gst_rate', label: 'Default GST %', type: 'number' }, { key: 'upi_id', label: 'UPI ID' },
          { key: 'address', label: 'Address', area: true }, { key: 'bank_details', label: 'Bank details', area: true }, { key: 'invoice_terms', label: 'Invoice terms', area: true }]} />
        : tab === 'chase' ? <SettingsForm k="address_chase" data={data.settings.address_chase} onSaved={reload} fields={[
          { key: 'enabled', label: 'Automatic chase on', type: 'bool' }, { key: 'whatsapp_template', label: 'WhatsApp template name' }, { key: 'whatsapp_language', label: 'Template language code' },
          { key: 'reminder_after_hours', label: 'Send WhatsApp after (hours)', type: 'number' }, { key: 'ai_call_after_hours', label: 'AI call after (hours)', type: 'number' },
          { key: 'human_after_hours', label: 'Human call task after (hours)', type: 'number' }, { key: 'max_attempts', label: 'Max attempts', type: 'number' }]} />
        : tab === 'staff' ? <Staff /> : tab === 'integrations' ? <Integrations p={data.providers} /> : <Audit />
      )}
      {tab === 'staff' && !data && <Staff />}
    </div></div>
}
