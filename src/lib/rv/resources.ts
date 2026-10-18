// Config-driven CRUD for the simple Raahvia tables. One generic route
// (/api/rv/r/[resource]) serves all of these, with per-resource roles,
// writable-field whitelists, auto numbering, mobile normalisation and audit.

import type { RvRole } from './constants'
import { normMobile } from './util'

export interface ResourceCfg {
  table: string
  read: RvRole[]
  write: RvRole[]
  remove: RvRole[]
  select: string
  /** columns searched with ?q= (ilike) */
  search?: string[]
  /** equality filters allowed in the query string */
  filters?: string[]
  order?: { col: string; asc?: boolean }
  fields: string[]
  required?: string[]
  numbering?: { counter: string; column: string; prefix: string; pad?: number }
  /** hook to massage a row before insert/update */
  prepare?: (row: Record<string, any>) => Record<string, any>
  /** log reads? no. log writes? yes (default). */
  noAudit?: boolean
}

const ALL: RvRole[] = ['admin', 'sales', 'ops', 'finance']

const withMobile = (row: Record<string, any>) => {
  if ('mobile' in row) row.mobile_norm = normMobile(row.mobile) || null
  return row
}

export const RESOURCES: Record<string, ResourceCfg> = {
  leads: {
    table: 'rv_leads',
    read: ['sales', 'ops'], write: ['sales'], remove: ['admin'],
    select: '*, owner:rv_staff!rv_leads_owner_id_fkey(id,full_name), customer:rv_customers(id,name,company)',
    search: ['name', 'company', 'mobile', 'email', 'lead_no'],
    filters: ['stage', 'source', 'owner_id'],
    order: { col: 'created_at' },
    fields: ['name', 'company', 'mobile', 'email', 'source', 'stage', 'owner_id', 'expected_value', 'occasion',
      'lost_reason', 'notes', 'next_followup_at', 'consent_whatsapp', 'opt_out'],
    required: ['name'],
    numbering: { counter: 'lead', column: 'lead_no', prefix: 'RV-L-', pad: 5 },
    prepare: withMobile,
  },
  customers: {
    table: 'rv_customers',
    read: ['sales', 'ops', 'finance'], write: ['sales', 'finance'], remove: ['admin'],
    select: '*',
    search: ['name', 'company', 'mobile', 'email', 'gstin', 'customer_no'],
    filters: ['type'],
    order: { col: 'created_at' },
    fields: ['type', 'name', 'company', 'gstin', 'mobile', 'email', 'billing_address', 'state_code', 'credit_days',
      'consent_whatsapp', 'opt_out', 'notes'],
    required: ['name'],
    numbering: { counter: 'customer', column: 'customer_no', prefix: 'RV-C-', pad: 5 },
    prepare: withMobile,
  },
  contacts: {
    table: 'rv_contacts',
    read: ['sales', 'ops', 'finance'], write: ['sales', 'finance'], remove: ['sales', 'finance'],
    select: '*',
    filters: ['customer_id'],
    order: { col: 'created_at', asc: true },
    fields: ['customer_id', 'name', 'designation', 'mobile', 'email'],
    required: ['customer_id', 'name'],
  },
  vendors: {
    table: 'rv_vendors',
    read: ['ops', 'finance', 'sales'], write: ['ops'], remove: ['admin'],
    select: '*',
    search: ['name', 'category', 'mobile', 'service_area'],
    filters: ['active', 'category'],
    order: { col: 'name', asc: true },
    fields: ['name', 'category', 'contact_name', 'mobile', 'email', 'gstin', 'service_area', 'lead_time_days',
      'quality_score', 'payment_terms', 'notes', 'active'],
    required: ['name'],
  },
  orders: {
    table: 'rv_orders',
    read: ALL, write: ['sales', 'ops'], remove: ['admin'],
    select: '*, customer:rv_customers(id,name,company,mobile,state_code), owner:rv_staff!rv_orders_owner_id_fkey(id,full_name), recipients:rv_recipients(count)',
    search: ['order_no', 'occasion', 'notes'],
    filters: ['status', 'customer_id', 'owner_id', 'delivery_date'],
    order: { col: 'created_at' },
    fields: ['customer_id', 'lead_id', 'occasion', 'delivery_date', 'window_start', 'window_end', 'status', 'owner_id',
      'packaging_notes', 'message_card', 'discount', 'payment_terms', 'quote_version', 'quote_approved',
      'place_of_supply', 'notes'],
    required: ['customer_id'],
    numbering: { counter: 'order', column: 'order_no', prefix: 'RV-ORD-', pad: 5 },
  },
  order_items: {
    table: 'rv_order_items',
    read: ALL, write: ['sales', 'ops'], remove: ['sales', 'ops'],
    select: '*, vendor:rv_vendors(id,name)',
    filters: ['order_id'],
    order: { col: 'created_at', asc: true },
    fields: ['order_id', 'name', 'qty', 'unit_price', 'cost_price', 'gst_rate', 'hsn', 'vendor_id', 'packaging', 'customization'],
    required: ['order_id', 'name'],
  },
  purchases: {
    table: 'rv_purchases',
    read: ['ops', 'finance'], write: ['ops'], remove: ['admin'],
    select: '*, vendor:rv_vendors(id,name), order:rv_orders(id,order_no)',
    search: ['purchase_no', 'description', 'supplier_invoice_ref'],
    filters: ['status', 'order_id', 'vendor_id'],
    order: { col: 'created_at' },
    fields: ['order_id', 'vendor_id', 'description', 'qty', 'unit_cost', 'total_cost', 'status',
      'supplier_invoice_ref', 'issue_note', 'expected_at', 'received_at'],
    required: ['order_id', 'description'],
    numbering: { counter: 'purchase', column: 'purchase_no', prefix: 'RV-PO-', pad: 5 },
    prepare: row => {
      if ('qty' in row || 'unit_cost' in row) {
        const q = Number(row.qty ?? 1), u = Number(row.unit_cost ?? 0)
        if (row.total_cost === undefined || row.total_cost === null) row.total_cost = Math.round(q * u * 100) / 100
      }
      if (row.status === 'received' && !row.received_at) row.received_at = new Date().toISOString()
      return row
    },
  },
  runs: {
    table: 'rv_delivery_runs',
    read: ['ops', 'finance'], write: ['ops'], remove: ['admin'],
    select: '*, rider:rv_staff!rv_delivery_runs_rider_staff_id_fkey(id,full_name), stops:rv_recipients(count)',
    search: ['run_no', 'zone', 'rider_name', 'partner'],
    filters: ['status', 'run_date', 'zone'],
    order: { col: 'run_date' },
    fields: ['run_date', 'zone', 'rider_staff_id', 'rider_name', 'partner', 'vehicle', 'feeder_vehicle', 'status',
      'run_cost', 'distance_km', 'notes'],
    numbering: { counter: 'run', column: 'run_no', prefix: 'RUN-', pad: 5 },
  },
  payments: {
    table: 'rv_payments',
    read: ['finance'], write: [], remove: [],   // writes go through /api/rv/payments (recalculates invoice)
    select: '*, customer:rv_customers(id,name,company), invoice:rv_invoices(id,invoice_no)',
    search: ['reference', 'notes'],
    filters: ['invoice_id', 'customer_id', 'mode'],
    order: { col: 'received_on' },
    fields: [],
  },
  bills: {
    table: 'rv_bills',
    read: ['finance', 'ops'], write: ['finance', 'ops'], remove: ['admin'],
    select: '*, vendor:rv_vendors(id,name), order:rv_orders(id,order_no), run:rv_delivery_runs(id,run_no)',
    search: ['bill_no', 'party_name', 'notes'],
    filters: ['bill_type', 'status', 'vendor_id', 'order_id', 'run_id'],
    order: { col: 'bill_date' },
    fields: ['bill_type', 'vendor_id', 'party_name', 'order_id', 'run_id', 'purchase_id', 'bill_no', 'bill_date',
      'due_date', 'amount', 'notes'],
    required: ['amount'],
  },
  expenses: {
    table: 'rv_expenses',
    read: ['finance'], write: ['finance'], remove: ['admin'],
    select: '*, order:rv_orders(id,order_no)',
    search: ['head', 'notes', 'document_ref'],
    filters: ['classification', 'order_id', 'approved'],
    order: { col: 'expense_date' },
    fields: ['expense_date', 'head', 'classification', 'amount', 'order_id', 'approved', 'document_ref', 'notes'],
    required: ['head', 'amount'],
  },
  communications: {
    table: 'rv_communications',
    read: ['sales', 'ops'], write: ['sales', 'ops'], remove: [],
    select: '*, owner:rv_staff!rv_communications_owner_id_fkey(id,full_name), lead:rv_leads(id,name), customer:rv_customers(id,name,company), recipient:rv_recipients(id,name,delivery_no)',
    search: ['body', 'mobile_norm'],
    filters: ['lead_id', 'customer_id', 'order_id', 'recipient_id', 'channel', 'direction'],
    order: { col: 'created_at' },
    fields: ['lead_id', 'customer_id', 'order_id', 'recipient_id', 'channel', 'direction', 'body', 'status',
      'outcome', 'next_action'],
    required: ['channel'],
    noAudit: true,
  },
  tasks: {
    table: 'rv_tasks',
    read: ['sales', 'ops', 'finance'], write: ['sales', 'ops', 'finance'], remove: ['admin'],
    select: '*, assignee:rv_staff!rv_tasks_assigned_to_fkey(id,full_name), order:rv_orders(id,order_no), lead:rv_leads(id,name)',
    search: ['title'],
    filters: ['kind', 'status', 'assigned_to', 'order_id', 'lead_id', 'recipient_id'],
    order: { col: 'due_at', asc: true },
    fields: ['kind', 'title', 'due_at', 'assigned_to', 'lead_id', 'order_id', 'recipient_id', 'status', 'closure_note'],
    required: ['title'],
    prepare: row => {
      if (row.status === 'done') row.closed_at = new Date().toISOString()
      return row
    },
  },
  audit: {
    table: 'rv_audit',
    read: [], write: [], remove: [],   // admin only (guard lets admin through)
    select: '*',
    search: ['table_name', 'record_id', 'actor_email', 'action'],
    filters: ['table_name', 'record_id'],
    order: { col: 'created_at' },
    fields: [],
    noAudit: true,
  },
}
