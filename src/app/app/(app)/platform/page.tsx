'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { api, fmtDate, fmtDateTime, useFetch } from '@/lib/rv/client'
import { Badge, Button, Card, ErrorNote, Field, Input, PageHeader, Select, Spinner, Table, Tabs, Td, Textarea } from '@/components/rv/ui'
import FormModal from '@/components/rv/FormModal'

type Tab = 'overview' | 'companies' | 'users'

const Stat = ({ label, value }: { label: string; value: number | string }) =>
  <div className="rounded-xl border border-gray-200 bg-white p-4"><div className="text-2xl font-bold text-rv-800">{value}</div><div className="mt-1 text-xs text-gray-500">{label}</div></div>

function Overview() {
  const { data, error } = useFetch<any>('/api/rv/platform/overview')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (!data) return <Spinner className="mx-auto my-8 h-6 w-6" />
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <Stat label="Companies" value={data.orgs} /><Stat label="On free trial" value={data.trial} /><Stat label="Paying / active" value={data.active} /><Stat label="Suspended" value={data.suspended} />
    <Stat label="Logins (all companies)" value={data.users} /><Stat label="New companies, last 7 days" value={data.new_companies_7d} /><Stat label="Leads (all companies)" value={data.leads} /><Stat label="Orders (all companies)" value={data.orders} />
  </div>
}

function EditOrg({ o, onDone }: { o: any; onDone: () => void }) {
  const [v, setV] = useState({ status: o.status, plan: o.plan || '', trial_ends_at: o.trial_ends_at ? o.trial_ends_at.slice(0, 10) : '', notes: o.notes || '', contact_mobile: o.contact_mobile || '' })
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await api(`/api/rv/platform/orgs/${o.id}`, { method: 'PATCH', body: { ...v, trial_ends_at: v.trial_ends_at ? new Date(v.trial_ends_at).toISOString() : null } }); toast.success('Saved'); onDone() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  return <tr><td colSpan={9} className="bg-gray-50 p-4"><div className="grid gap-3 sm:grid-cols-4">
    <Field label="Status"><Select value={v.status} onChange={e => setV({ ...v, status: e.target.value })}><option value="trial">Trial</option><option value="active">Active (paying)</option><option value="suspended">Suspended (blocked)</option></Select></Field>
    <Field label="Plan"><Input value={v.plan} onChange={e => setV({ ...v, plan: e.target.value })} placeholder="e.g. Starter" /></Field>
    <Field label="Trial ends"><Input type="date" value={v.trial_ends_at} onChange={e => setV({ ...v, trial_ends_at: e.target.value })} /></Field>
    <Field label="Contact mobile"><Input value={v.contact_mobile} onChange={e => setV({ ...v, contact_mobile: e.target.value })} /></Field>
    <Field label="Notes" className="sm:col-span-4"><Textarea rows={2} value={v.notes} onChange={e => setV({ ...v, notes: e.target.value })} /></Field>
  </div><div className="mt-3"><Button variant="primary" size="sm" loading={busy} onClick={save}>Save</Button></div></td></tr>
}

function Companies() {
  const { data, loading, error, reload } = useFetch<{ data: any[] }>('/api/rv/platform/orgs')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<string | null>(null)
  const [pwd, setPwd] = useState<string | null>(null)
  return <div className="space-y-3">
    <div className="flex justify-end"><Button variant="primary" onClick={() => setOpen(true)}>Add company</Button></div>
    {error && <ErrorNote>{error}</ErrorNote>}
    {pwd && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">First admin's temporary password (shown once): <b className="font-mono">{pwd}</b> <button className="ml-2 underline" onClick={() => setPwd(null)}>hide</button></div>}
    {loading && !data ? <Spinner className="mx-auto my-8 h-6 w-6" /> : <Table head={['Company', 'Owner', 'Status', 'Signed up', 'Logins', 'Leads', 'Orders', 'Last activity', '']}>
      {(data?.data || []).flatMap(o => [
        <tr key={o.id}>
          <Td><div className="font-medium">{o.name}</div><div className="text-xs text-gray-400">{o.plan || 'no plan'}{o.status === 'trial' && o.trial_ends_at ? ` · trial ends ${fmtDate(o.trial_ends_at)}` : ''}</div></Td>
          <Td>{o.owner_email || '-'}</Td><Td><Badge value={o.status} /></Td><Td>{fmtDate(o.created_at)}</Td>
          <Td>{o.staff}</Td><Td>{o.leads}</Td><Td>{o.orders}</Td><Td>{o.last_activity ? fmtDateTime(o.last_activity) : '-'}</Td>
          <Td><Button size="sm" onClick={() => setEdit(edit === o.id ? null : o.id)}>{edit === o.id ? 'Close' : 'Manage'}</Button></Td>
        </tr>,
        ...(edit === o.id ? [<EditOrg key={o.id + 'e'} o={o} onDone={() => { setEdit(null); reload() }} />] : []),
      ])}
    </Table>}
    <FormModal open={open} onClose={() => setOpen(false)} title="Add a company" submitLabel="Create company"
      intro="Creates the company workspace and its first admin login. A temporary password is shown once."
      fields={[{ key: 'name', label: 'Company name', required: true }, { key: 'owner_name', label: 'Admin name' }, { key: 'owner_email', label: 'Admin email', required: true },
        { key: 'status', label: 'Start as', type: 'select', options: [{ value: 'trial', label: 'Free trial' }, { value: 'active', label: 'Active (paying)' }], default: 'trial' }, { key: 'plan', label: 'Plan' }]}
      onSubmit={async v => { const r: any = await api('/api/rv/platform/orgs', { body: v }); if (r.temp_password) setPwd(r.temp_password); toast.success('Company created'); reload() }} />
  </div>
}

function Users() {
  const { data, loading, error } = useFetch<{ data: any[] }>('/api/rv/platform/users')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (loading && !data) return <Spinner className="mx-auto my-8 h-6 w-6" />
  return <Table head={['Name', 'Email', 'Company', 'Role', 'Joined', 'Last sign-in']}>
    {(data?.data || []).map(u => <tr key={u.id}><Td>{u.full_name}</Td><Td>{u.email}</Td><Td>{u.org?.name || '-'}</Td><Td>{u.role}{u.active ? '' : ' (inactive)'}</Td><Td>{fmtDate(u.created_at)}</Td><Td>{u.last_sign_in ? fmtDateTime(u.last_sign_in) : 'never'}</Td></tr>)}
  </Table>
}

export default function PlatformPage() {
  const [tab, setTab] = useState<Tab>('overview')
  return <div>
    <PageHeader title="Platform" subtitle="All companies and logins on GiftOps. Visible only to Evynta platform owners." />
    <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'companies', label: 'Companies' }, { id: 'users', label: 'Logins' }]} value={tab} onChange={setTab} />
    {tab === 'overview' ? <Overview /> : tab === 'companies' ? <Companies /> : <Users />}
  </div>
}
