import { NextRequest, NextResponse } from 'next/server'
import { guard, fail } from '@/lib/rv/server'
import { toCsv } from '@/lib/rv/util'
import type { RvRole } from '@/lib/rv/constants'

export const dynamic = 'force-dynamic'

interface Exp { roles: RvRole[]; table: string; select: string; flat: (r: any) => Record<string, any>; filters?: string[]; order?: string }
const EXPORTS: Record<string, Exp> = {
  leads: {
    roles: ['sales'], table: 'rv_leads', select: '*, owner:rv_staff!rv_leads_owner_id_fkey(full_name)', order: 'created_at',
    flat: r => ({ lead_no: r.lead_no, name: r.name, company: r.company, mobile: r.mobile, email: r.email, source: r.source, stage: r.stage, owner: r.owner?.full_name, expected_value: r.expected_value, occasion: r.occasion, lost_reason: r.lost_reason, next_followup_at: r.next_followup_at, created_at: r.created_at }),
  },
  customers: {
    roles: ['sales', 'finance'], table: 'rv_customers', select: '*', order: 'created_at',
    flat: r => ({ customer_no: r.customer_no, type: r.type, name: r.name, company: r.company, gstin: r.gstin, mobile: r.mobile, email: r.email, billing_address: r.billing_address, state_code: r.state_code, credit_days: r.credit_days, created_at: r.created_at }),
  },
  orders: {
    roles: ['sales', 'ops', 'finance'], table: 'rv_orders', select: '*, customer:rv_customers(name,company), recipients:rv_recipients(count)', order: 'created_at', filters: ['status', 'customer_id'],
    flat: r => ({ order_no: r.order_no, customer: r.customer?.company || r.customer?.name, occasion: r.occasion, delivery_date: r.delivery_date, status: r.status, recipients: r.recipients?.[0]?.count ?? 0, discount: r.discount, payment_terms: r.payment_terms, created_at: r.created_at }),
  },
  recipients: {
    roles: ['sales', 'ops', 'finance'], table: 'rv_recipients', select: '*, order:rv_orders(order_no,delivery_date), run:rv_delivery_runs(run_no,rider_name)', order: 'delivery_no', filters: ['order_id', 'delivery_status', 'address_status', 'run_id'],
    flat: r => ({ delivery_no: r.delivery_no, order_no: r.order?.order_no, name: r.name, mobile: r.mobile, address_line: r.address_line, landmark: r.landmark, pincode: r.pincode, zone: r.zone, address_status: r.address_status, packed: r.packed, delivery_status: r.delivery_status, run_no: r.run?.run_no, rider: r.run?.rider_name, delivered_at: r.delivered_at, received_by: r.received_by, failed_reason: r.failed_reason, attempts: r.attempt_count }),
  },
  invoices: {
    roles: ['finance'], table: 'rv_invoices', select: '*, customer:rv_customers(name,company,gstin,state_code), order:rv_orders(order_no)', order: 'invoice_date', filters: ['status', 'doc_type', 'customer_id'],
    flat: r => ({ invoice_no: r.invoice_no, doc_type: r.doc_type, invoice_date: r.invoice_date, due_date: r.due_date, customer: r.customer?.company || r.customer?.name, gstin: r.customer?.gstin, place_of_supply: r.place_of_supply, order_no: r.order?.order_no, taxable_value: r.taxable_value, cgst: r.cgst, sgst: r.sgst, igst: r.igst, total: r.total, paid_amount: r.paid_amount, status: r.status }),
  },
  payments: {
    roles: ['finance'], table: 'rv_payments', select: '*, customer:rv_customers(name,company), invoice:rv_invoices(invoice_no)', order: 'received_on',
    flat: r => ({ received_on: r.received_on, customer: r.customer?.company || r.customer?.name, invoice_no: r.invoice?.invoice_no, amount: r.amount, mode: r.mode, reference: r.reference, notes: r.notes }),
  },
  bills: {
    roles: ['finance'], table: 'rv_bills', select: '*, vendor:rv_vendors(name), order:rv_orders(order_no), run:rv_delivery_runs(run_no)', order: 'bill_date',
    flat: r => ({ bill_date: r.bill_date, bill_no: r.bill_no, type: r.bill_type, party: r.vendor?.name || r.party_name, order_no: r.order?.order_no, run_no: r.run?.run_no, due_date: r.due_date, amount: r.amount, paid_amount: r.paid_amount, status: r.status }),
  },
  expenses: {
    roles: ['finance'], table: 'rv_expenses', select: '*, order:rv_orders(order_no)', order: 'expense_date',
    flat: r => ({ expense_date: r.expense_date, head: r.head, classification: r.classification, amount: r.amount, order_no: r.order?.order_no, approved: r.approved, document_ref: r.document_ref, notes: r.notes }),
  },
  communications: {
    roles: ['sales', 'ops'], table: 'rv_communications', select: '*', order: 'created_at', filters: ['channel', 'order_id', 'customer_id', 'lead_id'],
    flat: r => ({ created_at: r.created_at, channel: r.channel, direction: r.direction, mobile: r.mobile_norm, body: r.body, status: r.status, outcome: r.outcome }),
  },
}

export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
  const cfg = EXPORTS[params.kind]
  if (!cfg) return fail('Unknown export', 404)
  const g = await guard(cfg.roles)
  if (!g.ok) return g.res
  const sp = req.nextUrl.searchParams
  let q = g.db.from(cfg.table).select(cfg.select)
  for (const f of cfg.filters || []) { const v = sp.get(f); if (v) q = q.eq(f, v) }
  const { data, error } = await q.order(cfg.order || 'created_at', { ascending: false }).limit(20000)
  if (error) return fail(error.message, 500)
  const rows = (data || []).map(cfg.flat)
  const csv = '﻿' + toCsv(rows, rows[0] ? Object.keys(rows[0]) : Object.keys(cfg.flat({})))
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="raahvia-${params.kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
