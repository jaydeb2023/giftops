// Shared billing/invoice helpers — same GST invoice + WhatsApp bill logic
// DokanManagerUI uses, generalized so any custom agent (dokan, pharmacy,
// hotel, mishti, kapor, general) can print/share a bill for a sale.

export interface BillingProfile {
  shop_name: string
  owner_name?: string
  phone?: string
  address?: string
  upi_id?: string
  gstin?: string
  print_footer?: string
  signature_url?: string | null
  logo_url?: string | null
}

export interface BillableSale {
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  paid_amount?: number
  customer_name?: string
  customer_phone?: string
}

const fmtAmt = (n: number) => `₹${Number(n || 0).toFixed(0)}`

/** Shared header markup (logo image if the shop has one uploaded, else the 🏪 emoji). */
function headerHtml(profile: BillingProfile) {
  return `<div class="header">
  <div class="brand-row">
    ${profile.logo_url
      ? `<img class="logo" src="${profile.logo_url}" alt="logo" />`
      : `<div class="logo logo-fallback">🏪</div>`}
    <div class="brand-text">
      <h2>${profile.shop_name}</h2>
      <div class="sub">${profile.address || ''}</div>
      <div class="sub">${profile.phone ? '📞 ' + profile.phone : ''}${profile.gstin ? `${profile.phone ? '  ·  ' : ''}GSTIN: <b>${profile.gstin}</b>` : ''}</div>
    </div>
  </div>
</div>`
}

/** Shared signature block, shown bottom-right of every printed invoice. */
function signatureHtml(profile: BillingProfile) {
  return `<div class="sign-block">
  ${profile.signature_url ? `<img class="sign-img" src="${profile.signature_url}" alt="signature" />` : `<div class="sign-img"></div>`}
  <div class="sign-label">অনুমোদিত স্বাক্ষর<br/>${profile.owner_name || profile.shop_name}</div>
</div>`
}

const sharedInvoiceStyles = `
*{box-sizing:border-box}
body{font-family:'Hind Siliguri',sans-serif;padding:16px;max-width:380px;margin:auto;color:#111;font-size:13px}
.header{border-bottom:2px solid #4F46E5;padding-bottom:10px;margin-bottom:10px}
.brand-row{display:flex;align-items:center;gap:10px}
.logo{width:52px;height:52px;object-fit:cover;border-radius:10px;flex-shrink:0;border:1px solid #e5e7eb}
.logo-fallback{background:#eef2ff;display:flex;align-items:center;justify-content:center;font-size:24px}
.brand-text{flex:1;min-width:0;text-align:left}
h2{color:#4F46E5;margin:0;font-size:18px;font-weight:800;line-height:1.2}
.sub{font-size:10.5px;color:#666;margin-top:2px}
.bill-no{display:flex;justify-content:space-between;font-size:11px;color:#777;margin-bottom:10px;padding:6px;background:#f9fafb;border-radius:6px}
.customer{background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:6px 10px;margin-bottom:10px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
th{background:#4F46E5;color:white;padding:6px 8px;text-align:left;font-size:11px}
td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
tr:last-child td{border-bottom:none}
.total-row{background:#eef2ff;font-weight:700}
.gst-row{color:#6b7280;font-size:11px}
.paid-row{color:#4F46E5;font-weight:600}
.due-row{color:#dc2626;font-weight:700;background:#fef2f2}
.footer{text-align:center;margin-top:12px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:10px}
.upi{text-align:center;background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:6px;margin:8px 0;font-size:12px}
.sign-block{margin-top:14px;padding-top:10px;border-top:1px dashed #ccc;text-align:right}
.sign-img{height:40px;margin-left:auto;display:block}
.sign-label{font-size:10px;color:#555;border-top:1px solid #ccc;padding-top:3px;margin-top:4px;display:inline-block;min-width:130px}
@media print{body{padding:0}button{display:none}}
`

/** Opens a print-ready GST/non-GST invoice in a new tab (same layout as the library agents). */
export function printBill(profile: BillingProfile, sale: BillableSale, gstPercent: number = 0) {
  const total = Number(sale.total_amount)
  const paid = sale.paid_amount ?? total
  const due = total - paid
  const gstAmt = gstPercent > 0 ? (total * gstPercent / 100) : 0
  const totalWithGst = total + gstAmt
  const billNo = `INV-${Date.now().toString().slice(-6)}`
  const custName = sale.customer_name || 'নগদ'

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><title>রসিদ - ${profile.shop_name}</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
${sharedInvoiceStyles}
</style></head><body>
${headerHtml(profile)}
<div class="bill-no">
  <span>রসিদ নং: <b>${billNo}</b></span>
  <span>তারিখ: <b>${new Date().toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b></span>
</div>
${custName && custName !== 'নগদ' ? `<div class="customer">👤 <b>কাস্টমার:</b> ${custName}</div>` : '<div class="customer">👤 নগদ বিক্রি</div>'}
<table>
<tr><th>পণ্য</th><th>পরিমাণ</th><th>দর</th><th>মোট</th></tr>
<tr><td>${sale.item_name}</td><td>${sale.quantity} ${sale.unit}</td><td>₹${Number(sale.unit_price).toFixed(0)}/${sale.unit}</td><td>₹${total.toFixed(0)}</td></tr>
<tr class="total-row"><td colspan="3">উপমোট</td><td>₹${total.toFixed(0)}</td></tr>
${gstPercent > 0 ? `<tr class="gst-row"><td colspan="3">GST (${gstPercent}%)</td><td>₹${gstAmt.toFixed(2)}</td></tr>
<tr class="total-row"><td colspan="3"><b>মোট (GST সহ)</b></td><td><b>₹${totalWithGst.toFixed(0)}</b></td></tr>` : ''}
<tr class="paid-row"><td colspan="3">✅ পরিশোধ</td><td>₹${paid.toFixed(0)}</td></tr>
${due > 0 ? `<tr class="due-row"><td colspan="3">⚠️ বাকি</td><td>₹${due.toFixed(0)}</td></tr>` : '<tr style="color:#4F46E5"><td colspan="3">পরিপূর্ণ পরিশোধ</td><td>✅</td></tr>'}
</table>
${profile.upi_id ? `<div class="upi">💳 UPI Payment: <b>${profile.upi_id}</b></div>` : ''}
${signatureHtml(profile)}
<div class="footer">
  <p style="margin:0 0 4px">${profile.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏'}</p>
  <p style="margin:0;font-size:10px;color:#aaa">Powered by Sahayak AI · sahayakai.tech</p>
</div>
</body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 300)
}

// ── Multi-item (date-wise) invoices ──────────────────────────────
// Used by the Customer tab to invoice everything a customer bought on one
// particular date, instead of just a single item like the quick-bill form.

export interface BillableItem {
  item_name: string
  quantity: number
  unit: string
  unit_price: number
}

export interface MultiSale {
  items: BillableItem[]
  paid_amount?: number
  customer_name?: string
  customer_phone?: string
  /** Display label for the invoice date, e.g. "12 Sep 2026". Defaults to today. */
  date_label?: string
}

function multiSaleTotal(sale: MultiSale) {
  return sale.items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
}

/** Opens a print-ready invoice covering every item bought on one date. */
export function printMultiBill(profile: BillingProfile, sale: MultiSale, gstPercent: number = 0) {
  const total = multiSaleTotal(sale)
  const paid = sale.paid_amount ?? total
  const due = total - paid
  const gstAmt = gstPercent > 0 ? (total * gstPercent / 100) : 0
  const totalWithGst = total + gstAmt
  const billNo = `INV-${Date.now().toString().slice(-6)}`
  const custName = sale.customer_name || 'নগদ'
  const dateLabel = sale.date_label || new Date().toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const rows = sale.items.map(i => `<tr><td>${i.item_name}</td><td>${i.quantity} ${i.unit}</td><td>₹${Number(i.unit_price).toFixed(0)}/${i.unit}</td><td>₹${(i.quantity * i.unit_price).toFixed(0)}</td></tr>`).join('')

  const w = window.open('', '_blank')
  if (!w) return
  w.document.write(`<!DOCTYPE html><html><head><title>রসিদ - ${profile.shop_name}</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
${sharedInvoiceStyles}
</style></head><body>
${headerHtml(profile)}
<div class="bill-no">
  <span>রসিদ নং: <b>${billNo}</b></span>
  <span>তারিখ: <b>${dateLabel}</b></span>
</div>
${custName && custName !== 'নগদ' ? `<div class="customer">👤 <b>কাস্টমার:</b> ${custName}</div>` : '<div class="customer">👤 নগদ বিক্রি</div>'}
<table>
<tr><th>পণ্য</th><th>পরিমাণ</th><th>দর</th><th>মোট</th></tr>
${rows}
<tr class="total-row"><td colspan="3">উপমোট</td><td>₹${total.toFixed(0)}</td></tr>
${gstPercent > 0 ? `<tr class="gst-row"><td colspan="3">GST (${gstPercent}%)</td><td>₹${gstAmt.toFixed(2)}</td></tr>
<tr class="total-row"><td colspan="3"><b>মোট (GST সহ)</b></td><td><b>₹${totalWithGst.toFixed(0)}</b></td></tr>` : ''}
<tr class="paid-row"><td colspan="3">✅ পরিশোধ</td><td>₹${paid.toFixed(0)}</td></tr>
${due > 0 ? `<tr class="due-row"><td colspan="3">⚠️ বাকি</td><td>₹${due.toFixed(0)}</td></tr>` : '<tr style="color:#4F46E5"><td colspan="3">পরিপূর্ণ পরিশোধ</td><td>✅</td></tr>'}
</table>
${profile.upi_id ? `<div class="upi">💳 UPI Payment: <b>${profile.upi_id}</b></div>` : ''}
${signatureHtml(profile)}
<div class="footer">
  <p style="margin:0 0 4px">${profile.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏'}</p>
  <p style="margin:0;font-size:10px;color:#aaa">Powered by Sahayak AI · sahayakai.tech</p>
</div>
</body></html>`)
  w.document.close()
  setTimeout(() => w.print(), 300)
}

/** Opens WhatsApp with a formatted bill message covering every item bought on one date. */
export function sendMultiBillWhatsApp(profile: BillingProfile, sale: MultiSale, withGst: boolean = false): boolean {
  const phone = sale.customer_phone?.replace(/[^0-9]/g, '') || ''
  if (!phone) return false

  const total = multiSaleTotal(sale)
  const paid = sale.paid_amount ?? total
  const due = total - paid
  const gstAmt = withGst ? total * 0.18 : 0
  const grandTotal = total + gstAmt
  const dateLabel = sale.date_label || new Date().toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  const itemLines = sale.items.map(i => `${i.item_name}: ${i.quantity} ${i.unit} × ₹${i.unit_price} = ${fmtAmt(i.quantity * i.unit_price)}`)

  const lines = [
    `🧾 *${profile.shop_name}*`,
    profile.gstin && withGst ? `GSTIN: ${profile.gstin}` : '',
    `তারিখ: ${dateLabel}`,
    '───────────────',
    ...itemLines,
    '───────────────',
    `উপমোট: ${fmtAmt(total)}`,
    withGst ? `GST (18%): ₹${gstAmt.toFixed(0)}` : '',
    `*মোট: ${fmtAmt(grandTotal)}*`,
    `পরিশোধ: ${fmtAmt(paid)}`,
    due > 0 ? `বাকি: ${fmtAmt(due)}` : '✅ সম্পূর্ণ পরিশোধিত',
    '───────────────',
    profile.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏',
  ].filter(Boolean)

  window.open(`https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  return true
}

/** Opens WhatsApp with a formatted bill message. Returns false if the customer has no phone on file. */
export function sendBillWhatsApp(profile: BillingProfile, sale: BillableSale, withGst: boolean = false): boolean {
  const phone = sale.customer_phone?.replace(/[^0-9]/g, '') || ''
  if (!phone) return false

  const total = Number(sale.total_amount)
  const paid = sale.paid_amount ?? total
  const due = total - paid
  const gstAmt = withGst ? total * 0.18 : 0
  const grandTotal = total + gstAmt

  const lines = [
    `🧾 *${profile.shop_name}*`,
    profile.gstin && withGst ? `GSTIN: ${profile.gstin}` : '',
    '───────────────',
    `পণ্য: ${sale.item_name}`,
    `পরিমাণ: ${sale.quantity} ${sale.unit} × ₹${sale.unit_price}`,
    `উপমোট: ${fmtAmt(total)}`,
    withGst ? `GST (18%): ₹${gstAmt.toFixed(0)}` : '',
    `*মোট: ${fmtAmt(grandTotal)}*`,
    `পরিশোধ: ${fmtAmt(paid)}`,
    due > 0 ? `বাকি: ${fmtAmt(due)}` : '✅ সম্পূর্ণ পরিশোধিত',
    '───────────────',
    profile.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏',
  ].filter(Boolean)

  window.open(`https://wa.me/91${phone.slice(-10)}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  return true
}
