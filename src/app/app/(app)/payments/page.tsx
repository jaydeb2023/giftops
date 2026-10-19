'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { fmtDate, qs, useDebounced, useFetch } from '@/lib/rv/client'
import { labelize, PAYMENT_MODES } from '@/lib/rv/constants'
import { inr } from '@/lib/rv/util'
import { Button, Empty, ErrorNote, Input, PageHeader, Select, Spinner, Table, Td } from '@/components/rv/ui'

export default function PaymentsPage() {
  const [q, setQ] = useState(''); const dq = useDebounced(q)
  const [mode, setMode] = useState('')
  const { data, loading, error } = useFetch<{ data: any[] }>(`/api/rv/r/payments${qs({ q: dq, mode, limit: 500 })}`)
  const rows = data?.data || []
  const total = rows.reduce((s, r) => s + Number(r.amount), 0)
  return (
    <div>
      <PageHeader title="Payments received" subtitle="Record payments from the invoice screen; they appear here automatically"
        actions={<a href="/api/rv/export/payments"><Button><Download className="h-4 w-4" />Export CSV</Button></a>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Search reference" value={q} onChange={e => setQ(e.target.value)} />
        <Select className="w-auto" value={mode} onChange={e => setMode(e.target.value)}><option value="">All modes</option>{PAYMENT_MODES.map(m => <option key={m} value={m}>{labelize(m)}</option>)}</Select>
        <span className="ml-auto text-sm text-gray-600">Total shown: <b>{inr(total)}</b></span>
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {loading && !data ? <Spinner className="mx-auto my-12 h-7 w-7" /> : rows.length === 0 ? <Empty>No payments recorded yet.</Empty> : (
        <Table head={['Date', 'Customer', 'Invoice', 'Amount', 'Mode', 'Reference']}>
          {rows.map(p => (
            <tr key={p.id}><Td>{fmtDate(p.received_on)}</Td><Td>{p.customer?.company || p.customer?.name}</Td>
              <Td>{p.invoice ? <Link className="text-rv-700 hover:underline" href={`/app/invoices/${p.invoice.id}`}>{p.invoice.invoice_no}</Link> : '-'}</Td>
              <Td className="font-medium">{inr(p.amount)}</Td><Td>{labelize(p.mode)}</Td><Td>{p.reference || '-'}</Td></tr>
          ))}
        </Table>
      )}
    </div>
  )
}
