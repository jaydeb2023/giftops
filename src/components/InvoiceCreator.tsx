'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { FileText, Printer, MessageCircle } from 'lucide-react'
import { printBill, sendBillWhatsApp, BillingProfile } from '@/lib/billing'
import toast from 'react-hot-toast'

import { tr } from '@/lib/i18n/tr'
interface Customer { id: string; name: string; phone: string | null }

export default function InvoiceCreator({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<BillingProfile>({ shop_name: 'আমার দোকান' })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [form, setForm] = useState({ item_name: '', quantity: '1', unit: 'পিস', unit_price: '', customer_id: '', paid: '' })
  const [withGst, setWithGst] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('shop_name, owner_name, phone, address, upi_id, gstin, print_footer').eq('id', userId).single(),
      supabase.from('crm_customers').select('id, name, phone').eq('user_id', userId).order('name'),
    ]).then(([profileRes, custRes]) => {
      if (profileRes.data) setProfile(profileRes.data)
      setCustomers(custRes.data || [])
    })
  }, [userId])

  const qty = Number(form.quantity || 0)
  const price = Number(form.unit_price || 0)
  const total = qty * price
  const paid = form.paid ? Number(form.paid) : total
  const customer = customers.find(c => c.id === form.customer_id)

  const buildSale = () => ({
    item_name: form.item_name || 'পণ্য', quantity: qty, unit: form.unit, unit_price: price,
    total_amount: total, paid_amount: paid,
    customer_name: customer?.name, customer_phone: customer?.phone || undefined,
  })

  const valid = form.item_name.trim() && qty > 0 && price > 0

  const handlePrint = () => {
    if (!valid) { toast.error('পণ্য, পরিমাণ ও দাম দিন'); return }
    printBill(profile, buildSale(), withGst ? 18 : 0)
  }
  const handleWhatsApp = () => {
    if (!valid) { toast.error('পণ্য, পরিমাণ ও দাম দিন'); return }
    const ok = sendBillWhatsApp(profile, buildSale(), withGst)
    if (!ok) toast.error('কাস্টমারের ফোন নম্বর নেই — কাস্টমার বেছে নিন বা প্রিন্ট করুন')
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 bengali flex items-center gap-2 mb-4">
        <FileText size={18} className="text-indigo-600"/> {tr('ইনভয়েস তৈরি করুন')}
      </h2>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 max-w-md">
        <input placeholder={tr('পণ্য/সেবার নাম')} value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali"/>
        <div className="grid grid-cols-3 gap-3">
          <input placeholder={tr('পরিমাণ')} type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]"/>
          <input placeholder={tr('একক')} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali"/>
          <input placeholder={tr('দাম/একক')} type="number" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]"/>
        </div>
        <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali">
          <option value="">{tr('নগদ বিক্রি (কোনো কাস্টমার নয়)')}</option>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
        </select>
        <input placeholder={`পরিশোধ (ডিফল্ট: পুরো ₹${total.toFixed(0)})`} type="number" value={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.value }))}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]"/>
        <label className="flex items-center gap-2 text-[13px] text-gray-600 bengali">
          <input type="checkbox" checked={withGst} onChange={e => setWithGst(e.target.checked)} className="rounded"/>
          {tr('GST (18%) সহ')}
        </label>

        <div className="bg-indigo-50 rounded-lg p-3 flex items-center justify-between text-[13px]">
          <span className="text-indigo-700 font-semibold bengali">{tr('মোট')}</span>
          <span className="text-indigo-700 font-extrabold">₹{(withGst ? total * 1.18 : total).toFixed(0)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali">
            <Printer size={14}/> {tr('প্রিন্ট করুন')}
          </button>
          <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-[13px] bengali">
            <MessageCircle size={14}/> WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}
