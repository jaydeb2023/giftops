'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { useFetch, qs, fmtDate, downloadText } from '@/lib/rv/client'
import { inr, toCsv } from '@/lib/rv/util'
import { Button, Card, ErrorNote, Input, PageHeader, Spinner, Stat, Table, Tabs, Td } from '@/components/rv/ui'

const BUCKETS: [string, string][] = [['not_due', 'Not due'], ['d1_30', '1-30'], ['d31_60', '31-60'], ['d61_90', '61-90'], ['d90_plus', '90+']]

function Profit() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const { data, loading, error } = useFetch<any>(`/api/rv/reports/profit${qs({ from, to })}`)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">From <Input type="date" className="w-auto" value={from} onChange={e => setFrom(e.target.value)} /> to <Input type="date" className="w-auto" value={to} onChange={e => setTo(e.target.value)} />
        <Button className="ml-auto" disabled={!data} onClick={() => data && downloadText('order-contribution.csv', toCsv(data.rows, ['order_no', 'customer', 'delivery_date', 'recipients', 'revenue', 'product_cost', 'delivery_cost', 'other_bills', 'expenses', 'cost', 'contribution', 'margin_pct']))}><Download className="h-4 w-4" />CSV</Button></div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-10 h-7 w-7" /> : data && <>
        <div className="grid gap-3 sm:grid-cols-3"><Stat label="Revenue (ex-GST)" value={inr(data.totals.revenue)} /><Stat label="Direct cost" value={inr(data.totals.cost)} /><Stat label="Contribution" value={inr(data.totals.contribution)} tone={data.totals.contribution < 0 ? 'bad' : 'good'} /></div>
        <p className="text-xs text-gray-500">{data.note || 'Contribution is revenue less direct order costs (gross margin), not accounting profit.'} Orders not yet invoiced use the quoted value.</p>
        <Table head={['Order', 'Customer', 'Date', 'Recipients', 'Revenue', 'Products', 'Delivery', 'Other', 'Contribution', 'Margin']}>
          {data.rows.map((r: any) => (
            <tr key={r.order_id}><Td><Link className="text-rv-700 hover:underline" href={`/raahvia/orders/${r.order_id}`}>{r.order_no}</Link></Td><Td>{r.customer}</Td><Td>{fmtDate(r.delivery_date)}</Td><Td>{r.recipients}</Td>
              <Td>{inr(r.revenue)}{!r.invoiced && <span className="ml-1 text-[10px] text-gray-400">quote</span>}</Td><Td>{inr(r.product_cost)}</Td><Td>{inr(r.delivery_cost)}</Td><Td>{inr(Number(r.other_bills) + Number(r.expenses))}</Td>
              <Td className={`font-medium ${r.contribution < 0 ? 'text-red-600' : ''}`}>{inr(r.contribution)}</Td><Td>{r.margin_pct}%</Td></tr>
          ))}
        </Table></>}
    </div>
  )
}

function AgeBlock({ title, totals, groups, label }: { title: string; totals: any; groups: any[]; label: string }) {
  return (
    <Card title={title} pad={false}><div className="p-4">
      <Table head={[label, ...BUCKETS.map(b => b[1]), 'Total']}>
        {groups.map(g => <tr key={g.name}><Td>{g.name}</Td>{BUCKETS.map(([k]) => <Td key={k}>{g[k] ? inr(g[k]) : '-'}</Td>)}<Td className="font-medium">{inr(g.total)}</Td></tr>)}
        <tr className="bg-gray-50 font-semibold"><Td>Total</Td>{BUCKETS.map(([k]) => <Td key={k}>{inr(totals[k])}</Td>)}<Td>{inr(totals.total)}</Td></tr>
      </Table></div></Card>
  )
}
function Ageing() {
  const { data, loading, error } = useFetch<any>('/api/rv/reports/ageing')
  if (error) return <ErrorNote>{error}</ErrorNote>
  if (loading && !data) return <Spinner className="mx-auto my-10 h-7 w-7" />
  return <div className="space-y-4">
    <AgeBlock title="Receivables - customers owe us" totals={data.receivables.totals} groups={data.receivables.by_customer} label="Customer" />
    <AgeBlock title="Payables - we owe vendors / couriers" totals={data.payables.totals} groups={data.payables.by_party} label="Party" />
    <p className="text-xs text-gray-500">Buckets are days past the due date.</p></div>
}
function Exports() {
  const kinds = [['leads', 'Leads'], ['customers', 'Customers'], ['orders', 'Orders'], ['recipients', 'Recipients & delivery status'], ['invoices', 'Invoices'], ['payments', 'Payments'], ['bills', 'Bills'], ['expenses', 'Expenses']]
  return <Card title="Download as CSV (opens in Excel)"><div className="grid gap-2 sm:grid-cols-3">{kinds.map(([k, l]) => <a key={k} href={`/api/rv/export/${k}`}><Button className="w-full justify-start"><Download className="h-4 w-4" />{l}</Button></a>)}</div></Card>
}

export default function ReportsPage() {
  const [tab, setTab] = useState<'profit' | 'ageing' | 'export'>('profit')
  return <div><PageHeader title="Reports" subtitle="Order contribution, receivables / payables ageing, data exports" />
    <Tabs tabs={[{ id: 'profit', label: 'Order contribution' }, { id: 'ageing', label: 'Ageing' }, { id: 'export', label: 'Exports' }]} value={tab} onChange={setTab} />
    <div className="mt-4">{tab === 'profit' ? <Profit /> : tab === 'ageing' ? <Ageing /> : <Exports />}</div></div>
}
