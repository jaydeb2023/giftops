// Builds and downloads an .xlsx workbook for the Customer tab:
// Sheet 1 = one row per customer (summary + totals)
// Sheet 2 = one row per purchase (full date-wise history)
// Requires the `xlsx` package: npm install xlsx

import * as XLSX from 'xlsx'

export interface CustomerExportRow {
  Name: string
  Agent: string
  'Father Name': string
  Phone: string
  Address: string
  'Pin Code': string
  'Total Purchases': number
  'Total Spent (₹)': number
  'Total Paid (₹)': number
  'Total Due (₹)': number
  'Last Purchase Date': string
}

export interface PurchaseExportRow {
  Customer: string
  Agent: string
  Date: string
  Item: string
  Quantity: number
  Unit: string
  'Unit Price (₹)': number
  'Total (₹)': number
  'Paid (₹)': number
  'Due (₹)': number
  Status: string
}

export function exportCustomersToExcel(
  customerRows: CustomerExportRow[],
  purchaseRows: PurchaseExportRow[],
  filename: string = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const wb = XLSX.utils.book_new()

  const customersSheet = XLSX.utils.json_to_sheet(customerRows)
  customersSheet['!cols'] = [
    { wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 24 },
    { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(wb, customersSheet, 'Customers')

  const purchasesSheet = XLSX.utils.json_to_sheet(purchaseRows)
  purchasesSheet['!cols'] = [
    { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, purchasesSheet, 'Purchase History')

  XLSX.writeFile(wb, filename)
}
