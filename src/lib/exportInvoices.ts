// Bulk export a month of invoices as one .xlsx for the accountant —
// columns follow the GSTR-1 B2C/B2B outward-supplies layout closely enough
// to copy-paste into the actual filing sheet. Requires: xlsx (already a dep).

import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabaseClient'

export interface Gstr1Row {
  'Invoice No.': string
  'Invoice Date': string
  'Customer Name': string
  'Customer GSTIN': string
  'HSN/SAC': string
  'Item': string
  'Quantity': number
  'Taxable Value (₹)': number
  'GST Rate (%)': number
  'GST Amount (₹)': number
  'Invoice Value (₹)': number
  'Place of Supply': string
}

/** Fetches every saved (non-quotation) invoice + items for the given month and downloads a .xlsx. */
export async function exportMonthlyGstr1(userId: string, year: number, month: number /* 1-12 */) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = new Date(year, month, 0).getDate()
  const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`

  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('*, invoice_items(*)')
    .eq('user_id', userId)
    .eq('doc_type', 'invoice')
    .gte('created_at', start)
    .lte('created_at', `${end}T23:59:59`)
    .order('created_at')

  if (error) throw error
  if (!invoices || invoices.length === 0) {
    throw new Error('NO_DATA')
  }

  const rows: Gstr1Row[] = []
  for (const inv of invoices) {
    for (const it of inv.invoice_items || []) {
      const lineTaxable = it.quantity * it.unit_price - (it.line_discount || 0)
      const lineGst = inv.gst_enabled ? lineTaxable * (inv.gst_rate / 100) : 0
      rows.push({
        'Invoice No.': inv.invoice_number,
        'Invoice Date': new Date(inv.created_at).toLocaleDateString('en-IN'),
        'Customer Name': inv.customer_name,
        'Customer GSTIN': '', // fill in manually for B2B customers
        'HSN/SAC': it.hsn_code || '',
        'Item': it.item_name,
        'Quantity': it.quantity,
        'Taxable Value (₹)': Math.round(lineTaxable),
        'GST Rate (%)': inv.gst_rate || 0,
        'GST Amount (₹)': Math.round(lineGst),
        'Invoice Value (₹)': Math.round(lineTaxable + lineGst),
        'Place of Supply': '',
      })
    }
  }

  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 16 }, { wch: 10 },
    { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, sheet, 'GSTR-1')
  XLSX.writeFile(wb, `gstr1-${year}-${String(month).padStart(2, '0')}.xlsx`)
}
