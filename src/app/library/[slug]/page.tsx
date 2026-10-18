'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PREBUILT_AGENTS } from '@/types'
import {
  ArrowLeft, Send, Download, Plus, Trash2,
  Check, X, FileText, Phone, User, Calendar, Package,
  AlertTriangle, TrendingUp, DollarSign, Clock,
  ChevronDown, ChevronUp, Printer, Share2
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast from 'react-hot-toast'
import PharmacyAssistantUI from '@/components/PharmacyAssistantUI'
import DokanCRMUI from '@/components/DokanCRMUI'
import HotelDhabaManagerUI from '@/components/HotelDhabaManagerUI'
import MishtiDokanManagerUI from '@/components/MishtiDokanManagerUI'
import KaporDokanManagerUI from '@/components/KaporDokanManagerUI'
import DoctorChamberUI from '@/components/DoctorChamberUI'
import PathologyLabUI from '@/components/PathologyLabUI'
import DokanManagerUI from '@/components/DokanManagerUI'
import AgentWorkspace from '@/components/AgentWorkspace'
import { useRequireAuth } from '@/lib/useRequireAuth'
import { useAccess } from '@/lib/useAccess'
import { Lock } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import AgentRunner from '@/components/AgentRunner'

// ── slug helper ──────────────────────────────────────────────────
function agentSlug(name: string) {
  return name.toLowerCase().replace(/[&]/g, 'and').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}


// ══════════════════════════════════════════════════════════════════
// AGENT-SPECIFIC UI COMPONENTS
// ══════════════════════════════════════════════════════════════════

// ── 1. DOKAN MANAGER ─────────────────────────────────────────────


// ── 2. PHARMACY ASSISTANT ────────────────────────────────────────
// PharmacyUI, DoctorChamberUI, PathologyLabUI are now in separate component files
function _OldPharmacyUI_REMOVED() {
  const [medicines, setMedicines] = useState([
    { name: 'Paracetamol 500mg', stock: 84, unit: 'strip', expiry: '2026-08', minStock: 50, price: 12 },
    { name: 'Amoxicillin 250mg', stock: 23, unit: 'strip', expiry: '2025-12', minStock: 30, price: 45 },
    { name: 'Antacid Syrup', stock: 12, unit: 'bottle', expiry: '2025-11', minStock: 15, price: 55 },
    { name: 'Vitamin C 500mg', stock: 60, unit: 'strip', expiry: '2026-03', minStock: 40, price: 18 },
  ])
  const [newMed, setNewMed] = useState({ name: '', stock: '', unit: 'strip', expiry: '', price: '' })
  const [showBill, setShowBill] = useState(false)
  const [billMeds, setBillMeds] = useState<{name: string, qty: string, price: string}[]>([{ name: '', qty: '', price: '' }])

  const now = new Date()
  const expiringSoon = medicines.filter(m => {
    const exp = new Date(m.expiry + '-01')
    const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)
    return diff < 3
  })
  const lowStock = medicines.filter(m => m.stock < m.minStock)

  const addMed = () => {
    if (!newMed.name) return
    setMedicines([...medicines, { name: newMed.name, stock: +newMed.stock, unit: newMed.unit, expiry: newMed.expiry, minStock: 20, price: +newMed.price }])
    setNewMed({ name: '', stock: '', unit: 'strip', expiry: '', price: '' })
    toast.success('ওষুধ যোগ হয়েছে!')
  }

  const printBill = () => {
    const total = billMeds.reduce((s, m) => s + (+m.price || 0), 0)
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>Medicine Bill</title><style>body{font-family:sans-serif;padding:20px;max-width:400px}h2{text-align:center}table{width:100%}td,th{padding:6px;border-bottom:1px solid #eee}tfoot td{font-weight:bold}</style></head><body>
      <h2>💊 ওষুধের বিল</h2><p>তারিখ: ${new Date().toLocaleDateString('bn-IN')}</p><hr/>
      <table><thead><tr><th>ওষুধ</th><th>পরিমাণ</th><th>মূল্য</th></tr></thead><tbody>
      ${billMeds.map(m => `<tr><td>${m.name}</td><td>${m.qty}</td><td>₹${m.price}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2">মোট</td><td>₹${total}</td></tr></tfoot></table>
      <p style="text-align:center;margin-top:20px;font-size:12px">সুস্থ থাকুন!</p></body></html>`)
    w.print()
  }

  return (
    <div className="space-y-4">
      {/* Alerts */}
      {(expiringSoon.length > 0 || lowStock.length > 0) && (
        <div className="grid grid-cols-1 gap-3">
          {expiringSoon.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <h4 className="font-bold text-red-800 bengali flex items-center gap-2 mb-2"><AlertTriangle size={14} />মেয়াদ শেষ হচ্ছে</h4>
              {expiringSoon.map((m, i) => <div key={i} className="text-sm text-red-700 bengali">• {m.name} — মেয়াদ: {m.expiry}</div>)}
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <h4 className="font-bold text-yellow-800 bengali flex items-center gap-2 mb-2"><Package size={14} />কম স্টক</h4>
              {lowStock.map((m, i) => <div key={i} className="text-sm text-yellow-700 bengali">• {m.name} — মাত্র {m.stock} {m.unit}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Quick bill */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 bengali">💊 ওষুধের স্টক</h3>
          <button onClick={() => setShowBill(!showBill)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-lg font-bold bengali border border-green-200">🧾 বিল করুন</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500 border-b"><th className="text-left pb-2 bengali">ওষুধ</th><th className="text-right pb-2 bengali">স্টক</th><th className="text-right pb-2 bengali">মেয়াদ</th><th className="text-right pb-2 bengali">দাম</th></tr></thead>
          <tbody>{medicines.map((m, i) => (
            <tr key={i} className={`border-b border-gray-50 ${m.stock < m.minStock ? 'bg-yellow-50' : ''}`}>
              <td className="py-2 font-medium text-xs">{m.name}</td>
              <td className={`py-2 text-right font-bold text-xs ${m.stock < m.minStock ? 'text-red-600' : 'text-green-600'}`}>{m.stock} {m.unit}</td>
              <td className={`py-2 text-right text-xs ${expiringSoon.find(e => e.name === m.name) ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{m.expiry}</td>
              <td className="py-2 text-right text-xs">₹{m.price}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* Bill maker */}
      {showBill && (
        <div className="bg-white border border-green-200 rounded-xl p-4">
          <h3 className="font-bold text-gray-800 mb-3 bengali">🧾 ওষুধের বিল</h3>
          {billMeds.map((med, i) => (
            <div key={i} className="grid grid-cols-3 gap-2 mb-2">
              <input className="border rounded-lg px-3 py-2 text-sm col-span-1" placeholder="ওষুধের নাম" value={med.name} onChange={e => { const b = [...billMeds]; b[i].name = e.target.value; setBillMeds(b) }} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="পরিমাণ" value={med.qty} onChange={e => { const b = [...billMeds]; b[i].qty = e.target.value; setBillMeds(b) }} />
              <input className="border rounded-lg px-3 py-2 text-sm" placeholder="₹" value={med.price} onChange={e => { const b = [...billMeds]; b[i].price = e.target.value; setBillMeds(b) }} />
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => setBillMeds([...billMeds, { name: '', qty: '', price: '' }])} className="flex-1 border border-dashed rounded-lg py-2 text-sm text-gray-500 bengali">+ যোগ করুন</button>
            <button onClick={printBill} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-bold flex items-center justify-center gap-2 bengali"><Printer size={14} />প্রিন্ট</button>
          </div>
          <div className="mt-2 text-right font-bold bengali">মোট: ₹{billMeds.reduce((s, m) => s + (+m.price || 0), 0)}</div>
        </div>
      )}

      {/* Add medicine */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">➕ নতুন ওষুধ যোগ করুন</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="ওষুধের নাম" value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="স্টক পরিমাণ" type="number" value={newMed.stock} onChange={e => setNewMed({ ...newMed, stock: e.target.value })} />
          <select className="border rounded-lg px-3 py-2 text-sm" value={newMed.unit} onChange={e => setNewMed({ ...newMed, unit: e.target.value })}>
            {['strip', 'tablet', 'bottle', 'tube', 'injection', 'pcs'].map(u => <option key={u}>{u}</option>)}
          </select>
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="মেয়াদ (YYYY-MM)" value={newMed.expiry} onChange={e => setNewMed({ ...newMed, expiry: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm col-span-2" placeholder="দাম (₹)" type="number" value={newMed.price} onChange={e => setNewMed({ ...newMed, price: e.target.value })} />
        </div>
        <button onClick={addMed} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-bold bengali hover:bg-indigo-700">যোগ করুন</button>
      </div>
    </div>
  )
  return null // unused stub
}

// ── 3. GST & TAX HELPER ──────────────────────────────────────────
function GSTHelperUI() {
  const [items, setItems] = useState([{ desc: '', qty: '1', rate: '', gst: '18' }])
  const [bizName, setBizName] = useState('')
  const [gstin, setGstin] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now().toString().slice(-6)}`)

  const total = items.reduce((s, i) => s + (+i.qty * +i.rate || 0), 0)
  const gstAmt = items.reduce((s, i) => s + (+i.qty * +i.rate * +i.gst / 100 || 0), 0)
  const grand = total + gstAmt

  const printInvoice = () => {
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>GST Invoice</title><style>
      body{font-family:sans-serif;padding:30px;max-width:700px;margin:auto}
      h1{text-align:center;color:#4f46e5}table{width:100%;border-collapse:collapse}
      td,th{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}
      .total-row{font-weight:bold;background:#eff6ff}.header{display:flex;justify-content:space-between}
      .badge{background:#4f46e5;color:white;padding:4px 12px;border-radius:20px;font-size:12px}
    </style></head><body>
      <h1>🧾 GST Invoice</h1>
      <div class="header">
        <div><strong>${bizName || 'আপনার ব্যবসা'}</strong><br/>GSTIN: ${gstin || 'N/A'}</div>
        <div class="badge">Invoice #${invoiceNo}</div>
      </div>
      <p>তারিখ: ${new Date().toLocaleDateString('bn-IN')} | গ্রাহক: ${customerName || 'N/A'}</p>
      <table><thead><tr><th>পণ্য/সেবা</th><th>পরিমাণ</th><th>দাম</th><th>GST%</th><th>GST টাকা</th><th>মোট</th></tr></thead>
      <tbody>${items.map(i => `<tr><td>${i.desc}</td><td>${i.qty}</td><td>₹${i.rate}</td><td>${i.gst}%</td><td>₹${(+i.qty * +i.rate * (+i.gst / 100)).toFixed(2)}</td>
<td>₹${(+i.qty * +i.rate * (1 + +i.gst / 100)).toFixed(2)}</td></tr>`).join('')}</tbody>
      <tfoot><tr class="total-row"><td colspan="4">মোট</td><td>₹${gstAmt.toFixed(2)}</td><td>₹${grand.toFixed(2)}</td></tr></tfoot>
      </table><br/><p>ধন্যবাদ আপনার ব্যবসার জন্য!</p></body></html>`)
    w.print()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">🧾 GST Invoice তৈরি করুন</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input className="border rounded-lg px-3 py-2 text-sm bengali" placeholder="আপনার ব্যবসার নাম" value={bizName} onChange={e => setBizName(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="GSTIN নম্বর" value={gstin} onChange={e => setGstin(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 text-sm bengali" placeholder="গ্রাহকের নাম" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="Invoice নম্বর" value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)} />
        </div>
        <div className="border-t pt-3 mb-3">
          <div className="grid grid-cols-12 gap-1 text-xs font-bold text-gray-500 mb-2 bengali">
            <span className="col-span-4">পণ্য/সেবা</span><span className="col-span-2">পরিমাণ</span><span className="col-span-2">দাম (₹)</span><span className="col-span-2">GST %</span><span className="col-span-2">মোট</span>
          </div>
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-1 mb-2 items-center">
              <input className="border rounded px-2 py-1.5 text-sm col-span-4 bengali" placeholder="বিবরণ" value={item.desc} onChange={e => { const it = [...items]; it[i].desc = e.target.value; setItems(it) }} />
              <input className="border rounded px-2 py-1.5 text-sm col-span-2" type="number" value={item.qty} onChange={e => { const it = [...items]; it[i].qty = e.target.value; setItems(it) }} />
              <input className="border rounded px-2 py-1.5 text-sm col-span-2" type="number" placeholder="₹" value={item.rate} onChange={e => { const it = [...items]; it[i].rate = e.target.value; setItems(it) }} />
              <select className="border rounded px-1 py-1.5 text-sm col-span-2" value={item.gst} onChange={e => { const it = [...items]; it[i].gst = e.target.value; setItems(it) }}>
                {['0', '5', '12', '18', '28'].map(g => <option key={g}>{g}</option>)}
              </select>
              <div className="col-span-2 text-right text-sm font-bold text-indigo-700">₹{((+item.qty * +item.rate) * (1 + +item.gst / 100)).toFixed(0)}</div>
            </div>
          ))}
          <button onClick={() => setItems([...items, { desc: '', qty: '1', rate: '', gst: '18' }])} className="text-xs text-indigo-600 border border-dashed border-indigo-300 rounded-lg px-3 py-1.5 bengali w-full">+ পণ্য/সেবা যোগ করুন</button>
        </div>
        <div className="bg-indigo-50 rounded-lg p-3 space-y-1 text-sm mb-3">
          <div className="flex justify-between bengali"><span>মূল পরিমাণ</span><span>₹{total.toFixed(2)}</span></div>
          <div className="flex justify-between bengali text-orange-600"><span>GST</span><span>₹{gstAmt.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold text-indigo-700 bengali text-base border-t pt-2"><span>মোট দেয়</span><span>₹{grand.toFixed(2)}</span></div>
        </div>
        <button onClick={printInvoice} className="w-full bg-green-600 text-white rounded-lg py-2.5 font-bold bengali flex items-center justify-center gap-2 hover:bg-green-700"><Printer size={16} />Invoice প্রিন্ট / ডাউনলোড</button>
      </div>

      {/* GST rates reference */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">📊 GST হারের তালিকা</h3>
        <div className="space-y-2 text-sm">
          {[['0%', 'চাল, গম, সবজি, দুধ, ডিম', 'text-green-700', 'bg-green-50'],
            ['5%', 'চিনি, চা, কফি, কেরোসিন', 'text-blue-700', 'bg-blue-50'],
            ['12%', 'বাটার, ঘি, মোবাইল ফোন', 'text-yellow-700', 'bg-yellow-50'],
            ['18%', 'সাবান, টুথপেস্ট, রেস্তোরাঁ, AC', 'text-orange-700', 'bg-orange-50'],
            ['28%', 'গাড়ি, AC, সিমেন্ট, সিগারেট', 'text-red-700', 'bg-red-50'],
          ].map(([rate, items, textC, bgC]) => (
            <div key={rate} className={`${bgC} rounded-lg p-2.5 flex gap-3`}>
              <span className={`font-bold ${textC} w-8 flex-shrink-0`}>{rate}</span>
              <span className={`${textC} bengali`}>{items}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 4. COACHING CENTRE MANAGER ────────────────────────────────────
function CoachingManagerUI() {
  const [students, setStudents] = useState([
    { name: 'রিয়া দাস', class: 'X', subject: 'গণিত', fee: 800, paid: 800, attend: 22, total: 25 },
    { name: 'সোহম সাহা', class: 'XII', subject: 'পদার্থবিজ্ঞান', fee: 1000, paid: 0, attend: 18, total: 25 },
    { name: 'প্রিয়া মণ্ডল', class: 'IX', subject: 'ইংরেজি', fee: 700, paid: 700, attend: 24, total: 25 },
  ])
  const [newStudent, setNewStudent] = useState({ name: '', class: '', subject: '', fee: '', phone: '' })

  const addStudent = () => {
    if (!newStudent.name) return
    setStudents([...students, { name: newStudent.name, class: newStudent.class, subject: newStudent.subject, fee: +newStudent.fee, paid: 0, attend: 0, total: 25 }])
    setNewStudent({ name: '', class: '', subject: '', fee: '', phone: '' })
    toast.success('ছাত্র যোগ হয়েছে!')
  }

  const totalFee = students.reduce((s, st) => s + st.fee, 0)
  const totalPaid = students.reduce((s, st) => s + st.paid, 0)
  const totalDue = totalFee - totalPaid

  const printReport = () => {
    const w = window.open('', '_blank')!
    w.document.write(`<html><head><title>Coaching Report</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}th{background:#f3f4f6}</style></head><body>
      <h2>🏫 কোচিং সেন্টার রিপোর্ট — ${new Date().toLocaleDateString('bn-IN')}</h2>
      <table><thead><tr><th>নাম</th><th>শ্রেণী</th><th>বিষয়</th><th>ফি</th><th>পরিশোধ</th><th>বাকি</th><th>উপস্থিতি</th></tr></thead>
      <tbody>${students.map(s => `<tr><td>${s.name}</td><td>${s.class}</td><td>${s.subject}</td><td>₹${s.fee}</td><td>₹${s.paid}</td><td style="color:${s.fee-s.paid>0?'red':'green'}">₹${s.fee-s.paid}</td><td>${s.attend}/${s.total}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3"><strong>মোট</strong></td><td>₹${totalFee}</td><td>₹${totalPaid}</td><td style="color:red">₹${totalDue}</td><td></td></tr></tfoot></table></body></html>`)
    w.print()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'মোট ফি', value: `₹${totalFee}`, color: 'bg-indigo-50 border-indigo-200' },
          { label: 'পরিশোধ', value: `₹${totalPaid}`, color: 'bg-green-50 border-green-200' },
          { label: 'বাকি', value: `₹${totalDue}`, color: 'bg-red-50 border-red-200' }].map(s => (
          <div key={s.label} className={`${s.color} border rounded-xl p-3 text-center`}>
            <div className="font-bold text-gray-900 text-lg">{s.value}</div>
            <div className="text-xs text-gray-500 bengali">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold text-gray-800 bengali">📋 ছাত্রের তালিকা</h3>
          <button onClick={printReport} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold bengali border border-indigo-200 flex items-center gap-1"><Printer size={12} />রিপোর্ট</button>
        </div>
        <div className="space-y-2">
          {students.map((s, i) => (
            <div key={i} className={`border rounded-xl p-3 ${s.fee - s.paid > 0 ? 'border-red-100 bg-red-50' : 'border-green-100 bg-green-50'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-gray-900 bengali">{s.name}</div>
                  <div className="text-xs text-gray-500 bengali">শ্রেণী {s.class} · {s.subject}</div>
                  <div className="text-xs text-gray-500 bengali mt-1">উপস্থিতি: {s.attend}/{s.total} দিন ({Math.round(s.attend/s.total*100)}%)</div>
                </div>
                <div className="text-right">
                  <div className={`font-bold ${s.fee - s.paid > 0 ? 'text-red-600' : 'text-green-600'} bengali`}>
                    {s.fee - s.paid > 0 ? `₹${s.fee - s.paid} বাকি` : '✓ পরিশোধিত'}
                  </div>
                  {s.fee - s.paid > 0 && (
                    <button onClick={() => { const st = [...students]; st[i].paid = st[i].fee; setStudents(st); toast.success('পরিশোধ হয়েছে!') }} className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg font-bold bengali mt-1">✓ পরিশোধ</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">➕ নতুন ছাত্র ভর্তি</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="border rounded-lg px-3 py-2 text-sm bengali" placeholder="নাম" value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm bengali" placeholder="শ্রেণী" value={newStudent.class} onChange={e => setNewStudent({ ...newStudent, class: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm bengali" placeholder="বিষয়" value={newStudent.subject} onChange={e => setNewStudent({ ...newStudent, subject: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="মাসিক ফি (₹)" type="number" value={newStudent.fee} onChange={e => setNewStudent({ ...newStudent, fee: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm col-span-2" placeholder="অভিভাবকের ফোন" value={newStudent.phone} onChange={e => setNewStudent({ ...newStudent, phone: e.target.value })} />
        </div>
        <button onClick={addStudent} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-bold bengali hover:bg-indigo-700">ভর্তি করুন</button>
      </div>
    </div>
  )
}

// ── 5. BUDGET SAHAYAK ────────────────────────────────────────────
function BudgetUI() {
  const [income, setIncome] = useState([{ source: 'বেতন', amount: 25000 }, { source: 'ভাড়া', amount: 5000 }])
  const [expenses, setExpenses] = useState([
    { cat: 'বাজার', amount: 6000 }, { cat: 'বাড়ি ভাড়া', amount: 8000 },
    { cat: 'বিদ্যুৎ', amount: 800 }, { cat: 'ছেলের স্কুল', amount: 2000 },
  ])
  const [newExp, setNewExp] = useState({ cat: '', amount: '' })
  const [newInc, setNewInc] = useState({ source: '', amount: '' })

  const totalInc = income.reduce((s, i) => s + i.amount, 0)
  const totalExp = expenses.reduce((s, e) => s + e.amount, 0)
  const balance = totalInc - totalExp
  const savePct = Math.max(0, Math.round((balance / totalInc) * 100))

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-4 text-white">
        <div className="text-sm bengali opacity-80 mb-1">এই মাসের সঞ্চয়</div>
        <div className={`text-4xl font-extrabold ${balance < 0 ? 'text-red-300' : 'text-white'}`}>₹{Math.abs(balance).toLocaleString()}</div>
        <div className="text-sm bengali opacity-80">{balance < 0 ? '⚠️ ঘাটতি!' : `✓ সঞ্চয় হার: ${savePct}%`}</div>
        <div className="mt-3 bg-white bg-opacity-20 rounded-full h-2">
          <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${Math.min(100, savePct)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="text-xs text-green-600 bengali font-bold mb-1">মোট আয়</div>
          <div className="text-xl font-bold text-green-700">₹{totalInc.toLocaleString()}</div>
          {income.map((i, idx) => <div key={idx} className="text-xs text-green-600 bengali mt-1">{i.source}: ₹{i.amount.toLocaleString()}</div>)}
          <div className="mt-2 flex gap-1">
            <input className="border rounded px-2 py-1 text-xs flex-1 bengali" placeholder="উৎস" value={newInc.source} onChange={e => setNewInc({ ...newInc, source: e.target.value })} />
            <input className="border rounded px-2 py-1 text-xs w-20" placeholder="₹" type="number" value={newInc.amount} onChange={e => setNewInc({ ...newInc, amount: e.target.value })} />
          </div>
          <button onClick={() => { if (!newInc.source || !newInc.amount) return; setIncome([...income, { source: newInc.source, amount: +newInc.amount }]); setNewInc({ source: '', amount: '' }) }} className="mt-1 w-full text-xs bg-green-600 text-white rounded py-1 font-bold bengali">+ যোগ</button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="text-xs text-red-600 bengali font-bold mb-1">মোট খরচ</div>
          <div className="text-xl font-bold text-red-700">₹{totalExp.toLocaleString()}</div>
          {expenses.map((e, idx) => <div key={idx} className="text-xs text-red-600 bengali mt-1 flex justify-between"><span>{e.cat}</span><span>₹{e.amount.toLocaleString()}</span></div>)}
          <div className="mt-2 flex gap-1">
            <input className="border rounded px-2 py-1 text-xs flex-1 bengali" placeholder="খাত" value={newExp.cat} onChange={e => setNewExp({ ...newExp, cat: e.target.value })} />
            <input className="border rounded px-2 py-1 text-xs w-20" placeholder="₹" type="number" value={newExp.amount} onChange={e => setNewExp({ ...newExp, amount: e.target.value })} />
          </div>
          <button onClick={() => { if (!newExp.cat || !newExp.amount) return; setExpenses([...expenses, { cat: newExp.cat, amount: +newExp.amount }]); setNewExp({ cat: '', amount: '' }) }} className="mt-1 w-full text-xs bg-red-600 text-white rounded py-1 font-bold bengali">+ যোগ</button>
        </div>
      </div>

      {balance < 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="font-bold text-red-800 bengali mb-1">⚠️ সতর্কতা: খরচ আয়ের বেশি!</div>
          <div className="text-sm text-red-700 bengali">প্রতি মাসে ₹{Math.abs(balance).toLocaleString()} ঘাটতি। AI-কে জিজ্ঞেস করুন কীভাবে সাশ্রয় করবেন।</div>
        </div>
      )}
    </div>
  )
}

// ── 6. LOAN & EMI TRACKER ────────────────────────────────────────
function LoanTrackerUI() {
  const [loans, setLoans] = useState([
    { name: 'Home Loan — SBI', principal: 2000000, rate: 8.5, emi: 18000, paid: 36, total: 240, dueDate: '5' },
    { name: 'Car Loan — HDFC', principal: 500000, rate: 9.5, emi: 10500, paid: 12, total: 60, dueDate: '10' },
  ])
  const [newLoan, setNewLoan] = useState({ name: '', principal: '', rate: '', emi: '', total: '', dueDate: '' })

  const calcEMI = () => {
    const p = +newLoan.principal, r = +newLoan.rate / 100 / 12, n = +newLoan.total
    if (p && r && n) {
      const emi = Math.round(p * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1))
      setNewLoan({ ...newLoan, emi: emi.toString() })
    }
  }

  return (
    <div className="space-y-4">
      {loans.map((loan, i) => {
        const remaining = loan.total - loan.paid
        const pct = Math.round((loan.paid / loan.total) * 100)
        const totalPaid = loan.emi * loan.paid
        const estRemaining = loan.emi * remaining
        return (
          <div key={i} className="bg-white border rounded-xl p-4">
            <div className="flex justify-between items-start mb-2">
              <div><div className="font-bold text-gray-900 bengali">{loan.name}</div><div className="text-xs text-gray-500">সুদ: {loan.rate}% · EMI তারিখ: {loan.dueDate} তারিখ</div></div>
              <div className="text-right"><div className="font-bold text-indigo-700">₹{loan.emi.toLocaleString()}/মাস</div><div className="text-xs text-gray-500 bengali">প্রতি মাসের কিস্তি</div></div>
            </div>
            <div className="bg-gray-100 rounded-full h-2 mb-2"><div className="bg-indigo-600 rounded-full h-2" style={{ width: `${pct}%` }} /></div>
            <div className="flex justify-between text-xs text-gray-500 bengali mb-2"><span>{loan.paid}/{loan.total} কিস্তি দেওয়া হয়েছে ({pct}%)</span><span>{remaining} কিস্তি বাকি</span></div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-green-50 rounded-lg p-2 text-center bengali"><div className="font-bold text-green-700">₹{totalPaid.toLocaleString()}</div><div className="text-gray-500">পরিশোধ করা</div></div>
              <div className="bg-orange-50 rounded-lg p-2 text-center bengali"><div className="font-bold text-orange-700">₹{estRemaining.toLocaleString()}</div><div className="text-gray-500">বাকি আছে</div></div>
              <div className="bg-red-50 rounded-lg p-2 text-center bengali"><div className="font-bold text-red-700">₹{(totalPaid + estRemaining - loan.principal).toLocaleString()}</div><div className="text-gray-500">মোট সুদ</div></div>
            </div>
            <button onClick={() => { const l = [...loans]; l[i].paid = Math.min(l[i].total, l[i].paid + 1); setLoans(l); toast.success('কিস্তি পরিশোধ হয়েছে!') }} className="mt-3 w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-bold bengali">✓ এই মাসের কিস্তি পরিশোধ</button>
          </div>
        )
      })}

      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">➕ নতুন লোন যোগ করুন</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="border rounded-lg px-3 py-2 text-sm bengali col-span-2" placeholder="লোনের নাম (যেমন: Home Loan — SBI)" value={newLoan.name} onChange={e => setNewLoan({ ...newLoan, name: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="মূল পরিমাণ (₹)" type="number" value={newLoan.principal} onChange={e => setNewLoan({ ...newLoan, principal: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="সুদের হার (%)" type="number" step="0.1" value={newLoan.rate} onChange={e => setNewLoan({ ...newLoan, rate: e.target.value })} />
          <input className="border rounded-lg px-3 py-2 text-sm" placeholder="মোট কিস্তি সংখ্যা" type="number" value={newLoan.total} onChange={e => setNewLoan({ ...newLoan, total: e.target.value })} />
          <button onClick={calcEMI} className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm font-bold bengali">EMI হিসাব করুন</button>
          {newLoan.emi && <div className="col-span-2 bg-indigo-50 rounded-lg p-2 text-center font-bold text-indigo-700 bengali">মাসিক EMI: ₹{newLoan.emi}</div>}
        </div>
        <button onClick={() => { if (!newLoan.name || !newLoan.emi) return; setLoans([...loans, { name: newLoan.name, principal: +newLoan.principal, rate: +newLoan.rate, emi: +newLoan.emi, paid: 0, total: +newLoan.total, dueDate: '5' }]); setNewLoan({ name: '', principal: '', rate: '', emi: '', total: '', dueDate: '' }); toast.success('লোন যোগ হয়েছে!') }} className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-bold bengali">যোগ করুন</button>
      </div>
    </div>
  )
}

// ── GENERIC TASK UI (for all other agents) ───────────────────────
function GenericAgentUI({ agent }: { agent: any }) {
  const configs: Record<string, { tasks: string[], quickActions: string[], tip: string }> = {
    'hotel-dhaba-manager': { tasks: ['মেনু আপডেট করুন', 'আজকের স্টক চেক', 'স্টাফের খাবার লগ', 'লাভক্ষতি দেখুন'], quickActions: ['আজকের আয়?', 'কোন dish সবচেয়ে বেশি বিকিয়েছে?', 'waste কমানোর উপায়?', 'মেনুর দাম বাড়ানো উচিত?'], tip: 'প্রতিদিনের menu cost AI-কে বলুন, সে লাভক্ষতি বের করে দেবে।' },
    'mishti-dokan-manager': { tasks: ['রোজের উৎপাদন লগ', 'মেয়াদ চেক', 'উৎসব স্টক plan', 'সরবরাহকারী payment'], quickActions: ['আজকে কত মিষ্টি তৈরি হলো?', 'কোন মিষ্টি সবচেয়ে বেশি বিকলো?', 'পুজোর stock কত লাগবে?', 'কোন মিষ্টির মেয়াদ শেষ হচ্ছে?'], tip: 'উৎসবের আগে AI-কে বললে সে stock plan করে দেবে।' },
    'pharmacy-crm': { tasks: ['customer register', 'purchase history', 'prescription track', 'due payment'], quickActions: ['নতুন customer যোগ করো', 'কার বাকি আছে?', 'prescription reminder', 'Excel export করো'], tip: 'প্রতিটি customer-এর ওষুধ কেনার ইতিহাস AI-কে বলুন।' },
    'dokan-crm': { tasks: ['customer register', 'purchase history', 'বাকির তালিকা', 'voice input'], quickActions: ['নতুন customer', 'কার বাকি কত?', 'কে সবচেয়ে বেশি কেনে?', 'মাসিক report'], tip: 'নিয়মিত খদ্দেরের কেনার ইতিহাস রাখুন।' },
    'hotel-crm': { tasks: ['guest register', 'order history', 'credit tracking', 'voice input'], quickActions: ['নতুন guest যোগ', 'কার বাকি আছে?', 'popular item কী?', 'মাসিক report'], tip: 'নিয়মিত গ্রাহকদের খাবারের পছন্দ রাখুন।' },
  }

  const cfg = configs[agentSlug(agent.name)] || { tasks: ['হিসাব রাখুন', 'তথ্য যোগ করুন', 'রিপোর্ট দেখুন', 'reminder সেট করুন'], quickActions: ['শুরু করতে সাহায্য করো', 'কীভাবে ব্যবহার করব?', 'আজকের কাজ কী?', 'report দেখাও'], tip: 'বাংলায় আপনার ব্যবসার তথ্য বলুন, AI সাহায্য করবে।' }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">⚡ দ্রুত কাজ শুরু করুন</h3>
        <div className="grid grid-cols-2 gap-2">
          {cfg.tasks.map((task, i) => (
            <div key={i} className="border border-dashed border-indigo-200 rounded-xl p-3 text-center bg-indigo-50">
              <div className="text-sm font-bold text-indigo-700 bengali">{task}</div>
              <div className="text-xs text-indigo-500 bengali mt-1">AI-কে বলুন →</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="font-bold text-amber-800 bengali mb-1">💡 টিপস</div>
        <div className="text-sm text-amber-700 bengali">{cfg.tip}</div>
      </div>
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-bold text-gray-800 mb-3 bengali">🎯 জনপ্রিয় প্রশ্ন — ক্লিক করুন</h3>
        <div className="flex flex-wrap gap-2">
          {cfg.quickActions.map((q, i) => (
            <span key={i} className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full font-medium bengali cursor-pointer hover:bg-indigo-100 transition-colors" onClick={() => { const ta = document.querySelector('textarea'); if (ta) { (ta as HTMLTextAreaElement).value = q; ta.dispatchEvent(new Event('input', { bubbles: true })) } }}>
              {q}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function AgentDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#fafaf8' }} />}>
      <AgentDetailPageInner />
    </Suspense>
  )
}

function AgentDetailPageInner() {
  const params = useParams()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') || undefined
  const slug = params?.slug as string
  const { user, loading: authLoading, hasAccess, isTrialing, daysLeftInTrial } = useAccess()

  // ✅ Hook must be at top level — before any early returns
const panelRefreshRef = useRef<() => void>(() => {})

  useEffect(() => {
    panelRefreshRef.current = () => {
      if (typeof (window as any).__kaporReload === 'function') {
        (window as any).__kaporReload()
      }
      if (typeof (window as any).__mishtiReload === 'function') {
        (window as any).__mishtiReload()
      }
      if (typeof (window as any).__pharmReload === 'function') {
        (window as any).__pharmReload()
      }
      if (typeof (window as any).__dokanReload === 'function') {
        (window as any).__dokanReload()
      }
      if (typeof (window as any).__hotelReload === 'function') {
        (window as any).__hotelReload()
      }
    }
  })

  const agent = PREBUILT_AGENTS.find(a => agentSlug(a.name) === slug)

  // Auth loading state
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="bengali text-sm">লোড হচ্ছে...</span>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-800 bengali mb-2">এজেন্ট পাওয়া যায়নি</h2>
          <Link href="/library" className="text-indigo-600 bengali">Library-তে ফিরুন</Link>
        </div>
      </div>
    )
  }

  // Trial expired / not subscribed → block access to the actual dashboard
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-lg mx-auto pt-10">
          <Link href="/library" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm mb-6 transition-colors bengali">
            <ArrowLeft size={14} /> Library-তে ফিরুন
          </Link>
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <Lock size={26} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 bengali mb-2">
              {agent.name_bn || agent.name} — সাবস্ক্রিপশন প্রয়োজন
            </h2>
            <p className="text-gray-500 text-sm bengali mb-6">
              আপনার ৭ দিনের ফ্রি ট্রায়াল শেষ হয়ে গেছে। এই ও অন্যান্য সব লাইব্রেরি এজেন্ট ব্যবহার করতে মাসিক ₹১৯৯ সাবস্ক্রিপশন নিন।
            </p>
            <Link
              href="/subscribe"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors"
            >
              এখনই সাবস্ক্রাইব করুন
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Pick the right UI panel
  const renderPanel = () => {
    const s = agentSlug(agent.name)
    if (s === 'dokan-manager') return <DokanManagerUI userId={user?.id} initialTab={initialTab} />
    if (s === "pharmacy-assistant") return <PharmacyAssistantUI userId={user?.id} />
    if (s === 'dokan-crm') return <DokanCRMUI userId={user?.id} />
    if (s === 'hotel-and-dhaba-manager') return <HotelDhabaManagerUI userId={user?.id} />
    if (s === 'mishti-dokan-manager') return <MishtiDokanManagerUI userId={user?.id} />
    if (s === 'kaporer-dokan' || s === 'kaporer-dokan-tracker') return <KaporDokanManagerUI userId={user?.id} />
    if (s === 'doctor-chamber-helper') return <DoctorChamberUI />
    if (s === 'pathology-lab-tracker') return <PathologyLabUI />
    if (s === 'gst-tax-helper') return <GSTHelperUI />
    if (s === 'coaching-centre-manager') return <CoachingManagerUI />
    if (s === 'budget-sahayak') return <BudgetUI />
    if (s === 'loan-emi-tracker') return <LoanTrackerUI />
    return <GenericAgentUI agent={agent} />
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">

        {/* Back */}
        <Link href="/library" className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm mb-5 transition-colors bengali">
          <ArrowLeft size={14} /> Library-তে ফিরুন
        </Link>

        {/* Agent header */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 flex items-center gap-4" style={{ borderLeft: `5px solid ${agent.color}` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: agent.color }}>{agent.icon}</div>
          <div className="flex-1">
            <h1 className="font-extrabold text-gray-900 text-xl bengali">{agent.name_bn || agent.name}</h1>
            <p className="text-gray-500 text-sm bengali mt-0.5">{agent.description_bn}</p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-full font-bold bengali">✓ বিনামূল্যে</span>
            <span className="text-xs text-gray-400 bengali">Voice + Typing উভয়ই</span>
          </div>
        </div>

        {/* Main grid */}
        <AgentWorkspace
          dashboard={renderPanel()}
          chat={<AgentRunner agent={agent} userId={user?.id} agentSlugOverride={slug} businessName={(user as any)?.user_metadata?.business_name || (user as any)?.user_metadata?.full_name || undefined} onDataChange={() => panelRefreshRef.current()} />}
          chatTitle="AI সহায়ক — বাংলায় কথা বলুন"
        />
      </div>
    </div>
  )
}
