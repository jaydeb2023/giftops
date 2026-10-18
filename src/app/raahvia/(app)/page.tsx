'use client'
import Link from 'next/link'
import { fmtDate, useFetch } from '@/lib/rv/client'
import { labelize, LEAD_STAGES } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { Badge, Card, ErrorNote, PageHeader, Spinner, Stat } from '@/components/rv/ui'
import { useStaff } from '@/components/rv/StaffContext'

export default function Dashboard() {
  const me = useStaff()
  const { data, loading, error } = useFetch<any>('/api/rv/dashboard')
  const { data: tasks } = useFetch<{ data: any[] }>('/api/rv/r/tasks?status=open&limit=8')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (loading && !data) return <Spinner className="mx-auto my-20 h-8 w-8" />
  const k = data.kpi
  const showFin = ['admin', 'finance'].includes(me.role)
  const maxF = Math.max(1, ...LEAD_STAGES.map(s => data.funnel[s] || 0))
  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${me.full_name?.split(' ')[0] || 'team'}`} subtitle="Today's picture across sales, operations and money" />
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Needs attention</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Addresses missing" value={k.missing_addresses} tone={k.missing_addresses ? 'warn' : 'good'} href="/raahvia/addresses" />
          <Stat label="Follow-ups due" value={k.followups_due} tone={k.followups_due ? 'warn' : 'good'} href="/raahvia/leads" />
          <Stat label="Failed deliveries" value={k.failed_deliveries} tone={k.failed_deliveries ? 'bad' : 'good'} href="/raahvia/exceptions" />
          <Stat label="Open exceptions" value={k.open_exceptions} tone={k.open_exceptions ? 'bad' : 'good'} href="/raahvia/exceptions" />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Operations</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Deliveries today" value={k.orders_today} href="/raahvia/orders" />
          <Stat label="Orders next 7 days" value={k.orders_next_7d} href="/raahvia/orders" />
          <Stat label="Packing backlog" value={k.packing_backlog} hint="gifts not yet packed" href="/raahvia/packing" />
          <Stat label="Out for delivery" value={k.out_for_delivery} href="/raahvia/delivery" />
          <Stat label="Purchases open" value={k.purchases_open} href="/raahvia/purchases" />
          <Stat label="POD pending" value={k.pod_pending} tone={k.pod_pending ? 'warn' : undefined} />
          <Stat label="New leads (7 days)" value={k.leads_new_7d} href="/raahvia/leads" />
          <Stat label="Lead conversion" value={`${k.conversion_pct}%`} hint={`${k.leads_total} leads total`} />
        </div>
      </section>
      {showFin && <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Money</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Invoiced this month" value={inr(k.invoiced_this_month)} href="/raahvia/invoices" />
          <Stat label="Receivable" value={inr(k.receivable)} hint="customers owe us" href="/raahvia/reports" />
          <Stat label="Payable" value={inr(k.payable)} hint="we owe vendors" href="/raahvia/bills" />
        </div>
      </section>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Upcoming orders" pad={false}><ul className="divide-y divide-gray-100">
          {data.upcoming.length === 0 && <li className="p-4 text-sm text-gray-400">Nothing scheduled.</li>}
          {data.upcoming.map((o: any) => <li key={o.id}><Link href={`/raahvia/orders/${o.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-gray-50">
            <div><div className="text-sm font-medium">{o.order_no} <span className="font-normal text-gray-500">{o.customer?.company || o.customer?.name}</span></div>
              <div className="text-xs text-gray-500">{fmtDate(o.delivery_date)} {o.occasion ? `| ${o.occasion}` : ''} | {o.recipients?.[0]?.count ?? 0} recipients</div></div><Badge value={o.status} /></Link></li>)}
        </ul></Card>
        <Card title="Open tasks" pad={false}><ul className="divide-y divide-gray-100">
          {(tasks?.data || []).length === 0 && <li className="p-4 text-sm text-gray-400">No open tasks.</li>}
          {(tasks?.data || []).map(t => <li key={t.id} className="px-4 py-2.5"><div className="text-sm font-medium">{t.title}</div><div className="text-xs text-gray-500">{labelize(t.kind)}{t.due_at ? ` | due ${fmtDate(t.due_at)}` : ''}</div></li>)}
        </ul></Card>
      </div>
      <Card title="Lead funnel"><div className="space-y-1.5">
        {LEAD_STAGES.map(s => <div key={s} className="flex items-center gap-2 text-sm"><span className="w-32 text-gray-600">{labelize(s)}</span>
          <div className="h-4 flex-1 rounded bg-gray-100"><div className="h-4 rounded bg-rv-600" style={{ width: `${((data.funnel[s] || 0) / maxF) * 100}%` }} /></div><span className="w-8 text-right">{data.funnel[s] || 0}</span></div>)}
      </div></Card>
    </div>
  )
}
