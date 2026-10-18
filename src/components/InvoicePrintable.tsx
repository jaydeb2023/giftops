'use client'

// The actual invoice "paper" — rendered inline for the live preview in
// InvoiceBuilder, and captured with html2canvas for PDF/PNG export.
// Keep this presentational-only (no data fetching) so it's safe to reuse.

import { forwardRef } from 'react'
import { BillingProfile } from '@/lib/billing'
import { DiscountType, InvoiceLineItem } from '@/lib/invoices'

export interface PrintableInvoiceData {
  invoice_number: string
  doc_type: 'invoice' | 'quotation'
  date_label: string
  customer_name: string
  customer_phone?: string | null
  customer_address?: string | null
  items: InvoiceLineItem[]
  gst_enabled: boolean
  gst_rate: number
  discount_type: DiscountType
  discount_value: number
  paid_amount: number
}

const fmt = (n: number) => `₹${Number(n || 0).toFixed(0)}`

export function computePreviewTotals(d: PrintableInvoiceData) {
  const subtotal = d.items.reduce((s, i) => s + i.quantity * i.unit_price - (i.line_discount || 0), 0)
  const discountAmount =
    d.discount_type === 'flat' ? Math.min(d.discount_value || 0, subtotal) :
    d.discount_type === 'percent' ? subtotal * ((d.discount_value || 0) / 100) : 0
  const taxable = subtotal - discountAmount
  const gstAmount = d.gst_enabled ? taxable * ((d.gst_rate || 0) / 100) : 0
  const total = taxable + gstAmount
  const due = total - (d.paid_amount || 0)
  return { subtotal, discountAmount, gstAmount, total, due }
}

/** Builds a scannable UPI payment QR (works with any UPI app) via a free CORS-enabled QR image API. */
function upiQrUrl(upiId: string, payeeName: string, amount: number) {
  const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR`
  return `https://api.qrserver.com/v1/create-qr-code/?size=110x110&margin=0&data=${encodeURIComponent(upiString)}`
}

const InvoicePrintable = forwardRef<HTMLDivElement, { profile: BillingProfile; data: PrintableInvoiceData }>(
  function InvoicePrintable({ profile, data }, ref) {
    const { subtotal, discountAmount, gstAmount, total, due } = computePreviewTotals(data)
    const hasHsn = data.items.some(i => i.hsn_code)
    const isQuotation = data.doc_type === 'quotation'

    return (
      <div
        ref={ref}
        style={{ fontFamily: "'Hind Siliguri', sans-serif", background: '#fff', color: '#111', width: 380, padding: 16, fontSize: 13 }}
      >
        {/* ── Header: logo + business identity ─────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '2px solid #4F46E5', paddingBottom: 10, marginBottom: 10 }}>
          {profile.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo_url} alt="logo" crossOrigin="anonymous"
              style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: '1px solid #e5e7eb' }} />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
          )}
          <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <h2 style={{ color: '#4F46E5', margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{profile.shop_name}</h2>
            {profile.address && <div style={{ fontSize: 10.5, color: '#666', marginTop: 2 }}>{profile.address}</div>}
            <div style={{ fontSize: 10.5, color: '#666' }}>
              {profile.phone ? `📞 ${profile.phone}` : ''}
              {profile.gstin ? `${profile.phone ? '  ·  ' : ''}GSTIN: ${profile.gstin}` : ''}
            </div>
          </div>
        </div>

        {isQuotation && (
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <span style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 999 }}>
              QUOTATION — এস্টিমেট, ট্যাক্স ইনভয়েস নয়
            </span>
          </div>
        )}

        {/* ── Invoice # / date ──────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#777', marginBottom: 10, padding: 6, background: '#f9fafb', borderRadius: 6 }}>
          <span>{isQuotation ? 'কোটেশন' : 'ইনভয়েস'} নং: <b>{data.invoice_number}</b></span>
          <span>তারিখ: <b>{data.date_label}</b></span>
        </div>

        {/* ── Bill To ───────────────────────────────────────────── */}
        <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontSize: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#4F46E5', marginBottom: 2 }}>বিল প্রাপক (BILL TO)</div>
          👤 <b>{data.customer_name || 'নগদ কাস্টমার'}</b>
          {data.customer_phone ? ` · ${data.customer_phone}` : ''}
          {data.customer_address ? <div style={{ fontSize: 11, color: '#555' }}>{data.customer_address}</div> : null}
        </div>

        {/* ── Items table ───────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ background: '#4F46E5', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: 11 }}>পণ্য</th>
              {hasHsn && <th style={{ background: '#4F46E5', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: 11 }}>HSN</th>}
              <th style={{ background: '#4F46E5', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: 11 }}>পরিমাণ</th>
              <th style={{ background: '#4F46E5', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: 11 }}>দর</th>
              <th style={{ background: '#4F46E5', color: '#fff', padding: '6px 8px', textAlign: 'left', fontSize: 11 }}>মোট</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #f0f0f0' }}>{it.item_name || '—'}</td>
                {hasHsn && <td style={{ padding: '5px 8px', borderBottom: '1px solid #f0f0f0' }}>{it.hsn_code || '—'}</td>}
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #f0f0f0' }}>{it.quantity} {it.unit}</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #f0f0f0' }}>{fmt(it.unit_price)}</td>
                <td style={{ padding: '5px 8px', borderBottom: '1px solid #f0f0f0' }}>{fmt(it.quantity * it.unit_price - (it.line_discount || 0))}</td>
              </tr>
            ))}
            <tr style={{ background: '#eef2ff', fontWeight: 700 }}>
              <td colSpan={hasHsn ? 4 : 3} style={{ padding: '5px 8px' }}>উপমোট</td>
              <td style={{ padding: '5px 8px' }}>{fmt(subtotal)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr style={{ color: '#dc2626', fontSize: 11 }}>
                <td colSpan={hasHsn ? 4 : 3} style={{ padding: '5px 8px' }}>
                  ছাড় {data.discount_type === 'percent' ? `(${data.discount_value}%)` : ''}
                </td>
                <td style={{ padding: '5px 8px' }}>-{fmt(discountAmount)}</td>
              </tr>
            )}
            {data.gst_enabled && (
              <>
                <tr style={{ color: '#6b7280', fontSize: 11 }}>
                  <td colSpan={hasHsn ? 4 : 3} style={{ padding: '5px 8px' }}>GST ({data.gst_rate}%)</td>
                  <td style={{ padding: '5px 8px' }}>{fmt(gstAmount)}</td>
                </tr>
                <tr style={{ background: '#eef2ff', fontWeight: 700 }}>
                  <td colSpan={hasHsn ? 4 : 3} style={{ padding: '5px 8px' }}><b>মোট (GST সহ)</b></td>
                  <td style={{ padding: '5px 8px' }}><b>{fmt(total)}</b></td>
                </tr>
              </>
            )}
            {!isQuotation && (
              <>
                <tr style={{ color: '#4F46E5', fontWeight: 600 }}>
                  <td colSpan={hasHsn ? 4 : 3} style={{ padding: '5px 8px' }}>✅ পরিশোধ</td>
                  <td style={{ padding: '5px 8px' }}>{fmt(data.paid_amount)}</td>
                </tr>
                <tr style={due > 0 ? { color: '#dc2626', fontWeight: 700, background: '#fef2f2' } : { color: '#4F46E5' }}>
                  <td colSpan={hasHsn ? 4 : 3} style={{ padding: '5px 8px' }}>{due > 0 ? '⚠️ বাকি' : 'পরিপূর্ণ পরিশোধ'}</td>
                  <td style={{ padding: '5px 8px' }}>{due > 0 ? fmt(due) : '✅'}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        {/* ── QR code + signature footer ───────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, paddingTop: 10, borderTop: '1px dashed #ccc' }}>
          <div style={{ textAlign: 'left', minHeight: 40 }}>
            {profile.upi_id && !isQuotation ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={upiQrUrl(profile.upi_id, profile.shop_name, total)} alt="UPI QR" crossOrigin="anonymous"
                  style={{ width: 78, height: 78, display: 'block' }} />
                <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>স্ক্যান করে পে করুন</div>
              </>
            ) : null}
          </div>
          <div style={{ textAlign: 'center', minWidth: 110 }}>
            {profile.signature_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.signature_url} alt="signature" crossOrigin="anonymous" style={{ height: 40, margin: '0 auto 4px', display: 'block' }} />
            ) : (
              <div style={{ height: 40 }} />
            )}
            <div style={{ fontSize: 10, color: '#555', borderTop: '1px solid #ccc', paddingTop: 3 }}>
              অনুমোদিত স্বাক্ষর<br />{profile.owner_name || profile.shop_name}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#888' }}>
          <p style={{ margin: '0 0 4px' }}>{profile.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏'}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#aaa' }}>Powered by Sahayak AI · sahayakai.tech</p>
        </div>
      </div>
    )
  }
)

export default InvoicePrintable
