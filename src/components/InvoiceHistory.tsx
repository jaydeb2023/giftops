'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, Search, X, Wallet, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { InvoiceRecord, listInvoices, recordPayment } from '@/lib/invoices'
import InvoiceBuilder from '@/components/InvoiceBuilder'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { exportMonthlyGstr1 } from '@/lib/exportInvoices'

import { tr } from '@/lib/i18n/tr'
const DEFAULT_CATEGORIES = ['সাধারণ', 'বিক্রয়', 'সার্ভিস', 'সরবরাহ']

const statusLabel: Record<string, string> = { paid: 'পরিশোধিত', partial: 'আংশিক', due: 'বাকি' }
const statusClass: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-600',
  partial: 'bg-amber-50 text-amber-600',
  due: 'bg-red-50 text-red-600',
}

export default function InvoiceHistory({ userId }: { userId: string }) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'partial' | 'due'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<InvoiceRecord | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [paying, setPaying] = useState(false)
  const [gstExporting, setGstExporting] = useState(false)

  const handleGstExport = async () => {
    setGstExporting(true)
    const now = new Date()
    try {
      await exportMonthlyGstr1(userId, now.getFullYear(), now.getMonth() + 1)
      toast.success('GST এক্সপোর্ট ডাউনলোড হচ্ছে...')
    } catch (e: any) {
      if (e?.message === 'NO_DATA') toast.error('এই মাসে কোনো ইনভয়েস নেই')
      else { console.error('GST export failed:', e); toast.error('এক্সপোর্ট করতে সমস্যা হয়েছে') }
    }
    setGstExporting(false)
  }

  const { categories } = useCustomCategories(userId, 'invoice', DEFAULT_CATEGORIES)

  const load = () => {
    setLoading(true)
    listInvoices(userId).then(data => { setInvoices(data); setLoading(false) })
  }
  useEffect(() => { load() }, [userId])

  const filtered = useMemo(() => invoices.filter(inv => {
    const matchesQ = inv.customer_name.toLowerCase().includes(q.toLowerCase()) ||
      inv.invoice_number.toLowerCase().includes(q.toLowerCase()) ||
      (inv.customer_phone || '').includes(q)
    if (!matchesQ) return false
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (categoryFilter !== 'all' && inv.category !== categoryFilter) return false
    return true
  }), [invoices, q, statusFilter, categoryFilter])

  const openPay = (inv: InvoiceRecord) => { setPayFor(inv); setPayAmount(String(inv.due_amount)) }

  const submitPayment = async () => {
    if (!payFor) return
    const amt = Number(payAmount)
    if (!amt || amt <= 0) { toast.error('সঠিক পরিমাণ দিন'); return }
    setPaying(true)
    try {
      await recordPayment(payFor.id, amt, payFor.paid_amount, payFor.total_amount)
      toast.success('পেমেন্ট রেকর্ড হয়েছে')
      setPayFor(null)
      load()
    } catch (e) {
      console.error('recordPayment failed:', e)
      toast.error('পেমেন্ট রেকর্ড করতে সমস্যা হয়েছে')
    }
    setPaying(false)
  }

  if (openInvoiceId) {
    return (
      <div>
        <button onClick={() => { setOpenInvoiceId(null); load() }} className="mb-4 text-[13px] font-bold text-indigo-600 bengali">
          {tr('← ইনভয়েস হিস্ট্রিতে ফিরে যান')}
        </button>
        <InvoiceBuilder userId={userId} invoiceId={openInvoiceId} onClose={() => { setOpenInvoiceId(null); load() }} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-gray-900 bengali">{tr('ইনভয়েস হিস্ট্রি')}</h1>
        <p className="text-gray-400 text-sm bengali mt-0.5">{tr('সব সেভ করা ইনভয়েস ও কোটেশন')}</p>
      </div>

      {/* Category section */}
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1.5 rounded-full text-[12px] font-bold bengali ${categoryFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {tr('সব ক্যাটাগরি')}
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-bold bengali ${categoryFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex-1 min-w-[180px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('নাম, ফোন বা ইনভয়েস নং দিয়ে খুঁজুন...')}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
          <option value="all">{tr('সব স্ট্যাটাস')}</option>
          <option value="paid">{tr('পরিশোধিত')}</option>
          <option value="partial">{tr('আংশিক')}</option>
          <option value="due">{tr('বাকি')}</option>
        </select>
        <button onClick={handleGstExport} disabled={gstExporting}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[13px] font-bold bengali disabled:opacity-50">
          {gstExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {tr('এই মাসের GST এক্সপোর্ট')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl text-gray-400 text-[13px] bengali">
          {tr('কোনো ইনভয়েস পাওয়া যায়নি।')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] uppercase bengali">
                <th className="px-4 py-3 font-semibold">{tr('নং')}</th>
                <th className="px-4 py-3 font-semibold">{tr('ধরন')}</th>
                <th className="px-4 py-3 font-semibold">{tr('কাস্টমার')}</th>
                <th className="px-4 py-3 font-semibold">{tr('ক্যাটাগরি')}</th>
                <th className="px-4 py-3 font-semibold">{tr('তারিখ')}</th>
                <th className="px-4 py-3 font-semibold text-right">{tr('মোট')}</th>
                <th className="px-4 py-3 font-semibold text-right">{tr('বাকি')}</th>
                <th className="px-4 py-3 font-semibold text-center">{tr('স্ট্যাটাস')}</th>
                <th className="px-4 py-3 font-semibold text-center">{tr('অ্যাকশন')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => (
                <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">{inv.invoice_number}</td>
                  <td className="px-4 py-3 whitespace-nowrap bengali">{inv.doc_type === 'quotation' ? tr('কোটেশন') : tr('ইনভয়েস')}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 bengali whitespace-nowrap">{inv.customer_name}</td>
                  <td className="px-4 py-3 text-gray-500 bengali whitespace-nowrap">{inv.category}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(inv.created_at).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">₹{inv.total_amount.toFixed(0)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className={`font-bold ${inv.due_amount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{inv.due_amount.toFixed(0)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold bengali ${statusClass[inv.status]}`}>
                      {statusLabel[inv.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => setOpenInvoiceId(inv.id)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold bengali">
                        {tr('দেখুন')}
                      </button>
                      {inv.doc_type === 'invoice' && inv.due_amount > 0 && (
                        <button onClick={() => openPay(inv)} title={tr('পেমেন্ট রেকর্ড করুন')}
                          className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 inline-flex items-center justify-center">
                          <Wallet size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record payment modal */}
      {payFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setPayFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{tr('পেমেন্ট রেকর্ড করুন —')} {payFor.invoice_number}</h3>
              <button onClick={() => setPayFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-[12px] text-gray-500 bengali mb-3">{tr('বর্তমান বাকি:')} <b className="text-red-600">₹{payFor.due_amount.toFixed(0)}</b></p>
            <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={tr('পরিমাণ')}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] mb-3" />
            <button onClick={submitPayment} disabled={paying}
              className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50 flex items-center justify-center gap-2">
              {paying ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
              {paying ? tr('সেভ হচ্ছে...') : tr('পেমেন্ট সেভ করুন')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
