// Shared invoice data layer — talks to the new `invoices` / `invoice_items`
// tables (see supabase/migrations/009_invoices_schema.sql).
// Used by InvoiceBuilder.tsx (create) and InvoiceHistory.tsx (list/read/pay).

import { supabase } from '@/lib/supabaseClient'

export type DocType = 'invoice' | 'quotation'
export type InvoiceStatus = 'paid' | 'partial' | 'due'
export type DiscountType = 'none' | 'flat' | 'percent'

export interface InvoiceLineItem {
  item_name: string
  hsn_code?: string
  quantity: number
  unit: string
  unit_price: number
  line_discount?: number
}

export interface InvoiceRecord {
  id: string
  user_id: string
  invoice_number: string
  doc_type: DocType
  category: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  gst_enabled: boolean
  gst_rate: number
  discount_type: DiscountType
  discount_value: number
  subtotal: number
  discount_amount: number
  gst_amount: number
  total_amount: number
  paid_amount: number
  due_amount: number
  status: InvoiceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface InvoiceWithItems extends InvoiceRecord {
  invoice_items: (InvoiceLineItem & { id: string })[]
}

export interface NewInvoiceInput {
  doc_type: DocType
  category: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  customer_address: string | null
  gst_enabled: boolean
  gst_rate: number
  discount_type: DiscountType
  discount_value: number
  items: InvoiceLineItem[]
  paid_amount: number
  notes?: string
}

export function computeTotals(input: Pick<NewInvoiceInput, 'items' | 'gst_enabled' | 'gst_rate' | 'discount_type' | 'discount_value'>) {
  const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unit_price - (i.line_discount || 0), 0)
  const discountAmount =
    input.discount_type === 'flat' ? Math.min(input.discount_value || 0, subtotal) :
    input.discount_type === 'percent' ? subtotal * ((input.discount_value || 0) / 100) : 0
  const taxable = subtotal - discountAmount
  const gstAmount = input.gst_enabled ? taxable * ((input.gst_rate || 0) / 100) : 0
  const total = taxable + gstAmount
  return { subtotal, discountAmount, gstAmount, total }
}

function statusFor(total: number, paid: number): InvoiceStatus {
  if (paid <= 0) return 'due'
  if (paid >= total) return 'paid'
  return 'partial'
}

/** Reserves the next sequential invoice number for this user (server-side, race-safe). */
async function reserveInvoiceNumber(userId: string, docType: DocType): Promise<string> {
  const prefix = docType === 'quotation' ? 'QUO' : 'INV'
  const { data, error } = await supabase.rpc('next_invoice_number', { p_user_id: userId, p_prefix: prefix })
  if (error) throw error
  return data as string
}

/** Saves a new invoice + its line items. This is the action that makes it a real record. */
export async function createInvoice(userId: string, input: NewInvoiceInput): Promise<InvoiceRecord> {
  const { subtotal, discountAmount, gstAmount, total } = computeTotals(input)
  const invoiceNumber = await reserveInvoiceNumber(userId, input.doc_type)

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      invoice_number: invoiceNumber,
      doc_type: input.doc_type,
      category: input.category || 'general',
      customer_id: input.customer_id,
      customer_name: input.customer_name || 'নগদ কাস্টমার',
      customer_phone: input.customer_phone,
      customer_address: input.customer_address,
      gst_enabled: input.gst_enabled,
      gst_rate: input.gst_rate,
      discount_type: input.discount_type,
      discount_value: input.discount_value,
      subtotal,
      discount_amount: discountAmount,
      gst_amount: gstAmount,
      total_amount: total,
      paid_amount: input.paid_amount,
      status: statusFor(total, input.paid_amount),
      notes: input.notes || null,
    })
    .select()
    .single()

  if (invErr) throw invErr

  const itemRows = input.items.map((it, idx) => ({
    invoice_id: invoice.id,
    item_name: it.item_name,
    hsn_code: it.hsn_code || null,
    quantity: it.quantity,
    unit: it.unit,
    unit_price: it.unit_price,
    line_discount: it.line_discount || 0,
    sort_order: idx,
  }))
  const { error: itemsErr } = await supabase.from('invoice_items').insert(itemRows)
  if (itemsErr) throw itemsErr

  // Mirror each line into crm_purchases so it still shows up in the customer's
  // existing purchase history / dues views elsewhere in the app.
  if (input.customer_id) {
    await supabase.from('crm_purchases').insert(
      input.items.map(it => ({
        user_id: userId,
        customer_id: input.customer_id,
        purchase_date: new Date().toISOString().slice(0, 10),
        item_name: it.item_name,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        paid_amount: (input.paid_amount / input.items.length) || 0,
        payment_status: statusFor(total, input.paid_amount) === 'due' ? 'pending' : statusFor(total, input.paid_amount),
        source: 'invoice',
      }))
    )
  }

  return invoice as InvoiceRecord
}

export async function listInvoices(userId: string): Promise<InvoiceRecord[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getInvoiceWithItems(invoiceId: string): Promise<InvoiceWithItems | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('id', invoiceId)
    .single()
  if (error) { console.error('getInvoiceWithItems:', error); return null }
  return data as InvoiceWithItems
}

/** পেমেন্ট রেকর্ড করুন — updates paid_amount on an already-saved invoice and recomputes status. */
export async function recordPayment(invoiceId: string, additionalPaid: number, currentPaid: number, total: number) {
  const newPaid = Math.min(currentPaid + additionalPaid, total)
  const { error } = await supabase
    .from('invoices')
    .update({ paid_amount: newPaid, status: statusFor(total, newPaid) })
    .eq('id', invoiceId)
  if (error) throw error
  return newPaid
}
