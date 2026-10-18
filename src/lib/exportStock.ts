// Downloads the current Stock table as a single-sheet .xlsx —
// used by the "এক্সপোর্ট" button in StockManager (all filtered rows,
// or only the selected rows when a bulk selection is active).
// Requires the `xlsx` package (already a dep — see exportCustomers.ts).

import * as XLSX from 'xlsx'

export interface StockExportRow {
  'SKU': string
  'পণ্যের নাম': string
  'ক্যাটাগরি': string
  'সাবক্যাটাগরি': string
  'এজেন্ট': string
  'বর্তমান স্টক': number
  'একক': string
  'ন্যূনতম স্টক': number
  'ক্রয়মূল্য (₹)': number
  'বিক্রয়মূল্য (₹)': number
  'স্ট্যাটাস': string
  'সর্বশেষ আপডেট': string
}

export function exportStockToExcel(
  rows: StockExportRow[],
  filename: string = `stock-${new Date().toISOString().slice(0, 10)}.xlsx`
) {
  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 10 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, sheet, 'Stock')
  XLSX.writeFile(wb, filename)
}

/** Opens a print-only window with a formatted stock table and triggers the browser print dialog. */
export function printStockRows(rows: StockExportRow[], title: string) {
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) return
  const head = Object.keys(rows[0] || {})
  const style = `
    <style>
      body{font-family:'Noto Sans Bengali',Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:18px;margin:0 0 4px}
      p{font-size:12px;color:#666;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f3f4f6;font-weight:700}
      tr:nth-child(even) td{background:#fafafa}
    </style>`
  const rowsHtml = rows.map(r => `<tr>${head.map(h => `<td>${(r as any)[h]}</td>`).join('')}</tr>`).join('')
  win.document.write(`
    <html><head><title>${title}</title>${style}</head>
    <body>
      <h1>${title}</h1>
      <p>মোট ${rows.length}টি পণ্য · ${new Date().toLocaleDateString('bn-IN')}</p>
      <table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>
      <script>window.onload = () => { window.print(); }</script>
    </body></html>`)
  win.document.close()
}
