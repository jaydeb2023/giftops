'use client'

import { useState } from 'react'
import { Plus, Trash2, Phone, Search, Printer, Download, AlertTriangle, Check } from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────
interface TestOrder {
  id: string
  patientName: string
  phone: string
  age: string
  refDoctor: string
  date: string
  tests: string[]
  status: 'pending' | 'processing' | 'ready' | 'delivered'
  totalFee: number
  paid: number
  homeCollection: boolean
  collectionAddress?: string
  sampleCollectedAt?: string
}

interface Reagent {
  id: string
  name: string
  stock: number
  unit: string
  minStock: number
  expiry: string
  supplier: string
  costPerTest: number
}

// ─── Initial data ──────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }

const COMMON_TESTS = [
  { name: 'CBC (Complete Blood Count)', fee: 200 },
  { name: 'Blood Glucose (Fasting)', fee: 80 },
  { name: 'Blood Glucose (PP)', fee: 80 },
  { name: 'HbA1c', fee: 350 },
  { name: 'Lipid Profile', fee: 400 },
  { name: 'LFT (Liver Function Test)', fee: 500 },
  { name: 'KFT (Kidney Function Test)', fee: 450 },
  { name: 'Thyroid Profile (T3/T4/TSH)', fee: 600 },
  { name: 'Urine R/E', fee: 100 },
  { name: 'Urine Culture & Sensitivity', fee: 400 },
  { name: 'Serum Creatinine', fee: 120 },
  { name: 'Widal Test', fee: 150 },
  { name: 'Dengue NS1 Antigen', fee: 500 },
  { name: 'Malaria Antigen', fee: 300 },
  { name: 'HIV Test', fee: 200 },
  { name: 'HBsAg', fee: 250 },
  { name: 'CRP (C-Reactive Protein)', fee: 300 },
  { name: 'Chest X-Ray', fee: 300 },
  { name: 'ECG', fee: 200 },
  { name: 'USG Abdomen', fee: 700 },
]

const INIT_ORDERS: TestOrder[] = [
  { id: uid(), patientName: 'রামবাবু দাস', phone: '9876543210', age: '45', refDoctor: 'ডা. সুমিত রায়', date: today(), tests: ['CBC (Complete Blood Count)', 'Blood Glucose (Fasting)'], status: 'ready', totalFee: 280, paid: 280, homeCollection: false, sampleCollectedAt: '09:30' },
  { id: uid(), patientName: 'সুমিত্রা দেবী', phone: '9123456780', age: '52', refDoctor: 'ডা. মীনা চক্রবর্তী', date: today(), tests: ['Thyroid Profile (T3/T4/TSH)', 'Lipid Profile', 'HbA1c'], status: 'processing', totalFee: 1350, paid: 1000, homeCollection: false, sampleCollectedAt: '10:15' },
  { id: uid(), patientName: 'মোহন লাল শর্মা', phone: '8765432190', age: '60', refDoctor: 'ডা. প্রকাশ সেন', date: today(), tests: ['KFT (Kidney Function Test)', 'Serum Creatinine', 'Urine R/E'], status: 'pending', totalFee: 570, paid: 300, homeCollection: true, collectionAddress: 'ব্যারাকপুর, ১২ নম্বর রাস্তা', sampleCollectedAt: undefined },
  { id: uid(), patientName: 'প্রিয়া চক্রবর্তী', phone: '7654321890', age: '28', refDoctor: 'ডা. অনিল বোস', date: today(), tests: ['Dengue NS1 Antigen', 'CBC (Complete Blood Count)'], status: 'delivered', totalFee: 700, paid: 700, homeCollection: false, sampleCollectedAt: '08:45' },
]

const INIT_REAGENTS: Reagent[] = [
  { id: uid(), name: 'CBC Reagent Kit', stock: 200, unit: 'test', minStock: 100, expiry: '2026-06', supplier: 'Sysmex Corp', costPerTest: 40 },
  { id: uid(), name: 'Glucose Reagent', stock: 45, unit: 'test', minStock: 100, expiry: '2025-11', supplier: 'Span Diagnostics', costPerTest: 15 },
  { id: uid(), name: 'HbA1c Kit', stock: 80, unit: 'test', minStock: 50, expiry: '2025-12', supplier: 'Bio-Rad', costPerTest: 120 },
  { id: uid(), name: 'Dengue NS1 Rapid Kit', stock: 12, unit: 'test', minStock: 30, expiry: '2026-02', supplier: 'J Mitra', costPerTest: 180 },
  { id: uid(), name: 'Widal Antigen', stock: 150, unit: 'test', minStock: 50, expiry: '2026-08', supplier: 'Tulip Diagnostics', costPerTest: 25 },
]

const TABS = [
  { id: 'orders',  label: 'টেস্ট অর্ডার', icon: '🔬' },
  { id: 'new',     label: 'নতুন রোগী',    icon: '➕' },
  { id: 'reagent', label: 'রিএজেন্ট',      icon: '🧪' },
  { id: 'report',  label: 'রিপোর্ট',       icon: '📊' },
]

const STATUS_CONFIG = {
  pending:    { label: 'নমুনা বাকি', bg: 'bg-gray-100 text-gray-600' },
  processing: { label: 'প্রক্রিয়াধীন', bg: 'bg-blue-100 text-blue-700' },
  ready:      { label: 'রিপোর্ট তৈরি', bg: 'bg-green-100 text-green-700' },
  delivered:  { label: 'দেওয়া হয়েছে', bg: 'bg-indigo-100 text-indigo-700' },
}

// ══════════════════════════════════════════════════════════════════
export default function PathologyLabUI() {
  const [tab, setTab] = useState('orders')
  const [orders, setOrders] = useState<TestOrder[]>(INIT_ORDERS)
  const [reagents, setReagents] = useState<Reagent[]>(INIT_REAGENTS)
  const [searchQ, setSearchQ] = useState('')

  // New order form
  const [form, setForm] = useState({ patientName: '', phone: '', age: '', refDoctor: '', homeCollection: false, collectionAddress: '' })
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [testSearch, setTestSearch] = useState('')

  // Derived
  const todayOrders = orders.filter(o => o.date === today())
  const todayRevenue = todayOrders.reduce((s, o) => s + o.paid, 0)
  const todayDue = todayOrders.reduce((s, o) => s + (o.totalFee - o.paid), 0)
  const readyNotDelivered = orders.filter(o => o.status === 'ready')
  const lowReagents = reagents.filter(r => r.stock < r.minStock)

  const totalSelectedFee = selectedTests.reduce((s, t) => {
    const test = COMMON_TESTS.find(ct => ct.name === t)
    return s + (test?.fee || 0)
  }, 0)

  const toggleTest = (testName: string) => {
    setSelectedTests(prev => prev.includes(testName) ? prev.filter(t => t !== testName) : [...prev, testName])
  }

  const updateStatus = (id: string, status: TestOrder['status']) => {
    setOrders(orders.map(o => o.id === id ? { ...o, status } : o))
    const labels = { pending: 'নমুনা নেওয়া বাকি', processing: 'প্রক্রিয়া শুরু', ready: '✓ রিপোর্ট তৈরি!', delivered: 'রিপোর্ট দেওয়া হয়েছে' }
    toast.success(labels[status])
  }

  const collectPayment = (id: string) => {
    const order = orders.find(o => o.id === id)
    if (!order) return
    const due = order.totalFee - order.paid
    if (due <= 0) { toast('সম্পূর্ণ পেমেন্ট হয়ে গেছে!'); return }
    const paid = prompt(`বকেয়া: ₹${due}\nকত টাকা নিলেন?`)
    if (!paid) return
    setOrders(orders.map(o => o.id === id ? { ...o, paid: Math.min(o.totalFee, o.paid + +paid) } : o))
    toast.success('পেমেন্ট রেকর্ড হয়েছে!')
  }

  const saveOrder = () => {
    if (!form.patientName || selectedTests.length === 0) { toast.error('রোগীর নাম ও টেস্ট দিন'); return }
    const order: TestOrder = {
      id: uid(), ...form, date: today(), tests: selectedTests, status: 'pending',
      totalFee: totalSelectedFee, paid: 0,
    }
    setOrders([order, ...orders])
    setForm({ patientName: '', phone: '', age: '', refDoctor: '', homeCollection: false, collectionAddress: '' })
    setSelectedTests([])
    toast.success('টেস্ট অর্ডার নেওয়া হয়েছে!')
    setTab('orders')
  }

  const printReport = (order: TestOrder) => {
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>Lab Report</title><meta charset="utf-8">
<style>
  body{font-family:'Segoe UI',sans-serif;padding:24px;max-width:500px;margin:auto}
  h2{text-align:center;color:#4f46e5}table{width:100%;border-collapse:collapse;font-size:13px}
  th{background:#4f46e5;color:white;padding:7px 10px;text-align:left}td{padding:6px 10px;border-bottom:1px solid #eee}
  .total{font-weight:700}.footer{text-align:center;font-size:11px;color:#999;margin-top:20px}
  .badge{display:inline-block;background:#d1fae5;color:#065f46;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
</style></head><body>
<h2>🔬 Lab Test Requisition</h2>
<table>
  <tr><td><b>রোগী</b></td><td>${order.patientName}</td></tr>
  ${order.phone ? `<tr><td>ফোন</td><td>${order.phone}</td></tr>` : ''}
  ${order.age ? `<tr><td>বয়স</td><td>${order.age}</td></tr>` : ''}
  ${order.refDoctor ? `<tr><td>Ref. Doctor</td><td>${order.refDoctor}</td></tr>` : ''}
  <tr><td>তারিখ</td><td>${order.date}</td></tr>
  ${order.homeCollection ? `<tr><td>Home Collection</td><td>✓ ${order.collectionAddress || ''}</td></tr>` : ''}
</table>
<br/>
<table>
  <tr><th>পরীক্ষার নাম</th><th>ফি</th></tr>
  ${order.tests.map(t => { const fee = COMMON_TESTS.find(ct => ct.name === t)?.fee || 0; return `<tr><td>${t}</td><td>₹${fee}</td></tr>` }).join('')}
  <tr class="total"><td>মোট</td><td>₹${order.totalFee}</td></tr>
  <tr><td>পরিশোধিত</td><td style="color:#16a34a">₹${order.paid}</td></tr>
  ${order.totalFee - order.paid > 0 ? `<tr><td>বকেয়া</td><td style="color:#dc2626">₹${order.totalFee - order.paid}</td></tr>` : ''}
</table>
<p class="badge">স্ট্যাটাস: ${STATUS_CONFIG[order.status].label}</p>
<div class="footer">ধন্যবাদ আমাদের সেবা নেওয়ার জন্য 🙏</div>
</body></html>`)
    w.print()
  }

  const filteredOrders = orders.filter(o =>
    !searchQ || o.patientName.toLowerCase().includes(searchQ.toLowerCase()) || o.phone.includes(searchQ)
  )

  const expiryStatus = (expiry: string) => {
    const diff = (new Date(expiry + '-01').getTime() - Date.now()) / 86400000
    if (diff < 0) return 'expired'
    if (diff < 30) return 'critical'
    if (diff < 90) return 'warning'
    return 'ok'
  }

  return (
    <div className="space-y-4">

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের টেস্ট', value: `${todayOrders.length}টি`, icon: '🔬', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'আজকের আয়', value: `₹${todayRevenue}`, icon: '💰', color: 'bg-green-50 border-green-200 text-green-700' },
          { label: 'রিপোর্ট তৈরি', value: `${readyNotDelivered.length}টি`, icon: '✅', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
          { label: 'কম রিএজেন্ট', value: `${lowReagents.length}টি`, icon: '⚠️', color: 'bg-orange-50 border-orange-200 text-orange-700' },
        ].map(c => (
          <div key={c.label} className={`${c.color} border rounded-xl p-3`}>
            <div className="text-lg mb-0.5">{c.icon}</div>
            <div className="font-extrabold text-lg">{c.value}</div>
            <div className="text-xs opacity-70 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Ready to deliver alert */}
      {readyNotDelivered.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <div className="font-bold text-green-800 bengali text-sm mb-1.5">✅ রিপোর্ট তৈরি — রোগীকে জানান</div>
          <div className="flex flex-wrap gap-2">
            {readyNotDelivered.map(o => (
              <span key={o.id} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg bengali">{o.patientName} · {o.phone}</span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border rounded-2xl overflow-hidden">
        <div className="flex overflow-x-auto border-b bg-gray-50">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold transition-all bengali whitespace-nowrap ${tab === t.id ? 'bg-white text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="p-4">

          {/* ══ ORDERS ══ */}
          {tab === 'orders' && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <div className="flex-1 relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="রোগীর নাম বা ফোন..." className="w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-indigo-400 bengali" />
                </div>
                <button onClick={() => setTab('new')} className="text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold bengali hover:bg-indigo-700 flex items-center gap-1 whitespace-nowrap">
                  <Plus size={11} />নতুন
                </button>
              </div>

              {filteredOrders.length === 0 && <div className="text-center py-8 text-gray-400 bengali text-sm">কোনো অর্ডার নেই</div>}

              {filteredOrders.map(order => (
                <div key={order.id} className="bg-white border rounded-xl p-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-800 bengali">{order.patientName}</div>
                      <div className="text-xs text-gray-400 bengali flex gap-2 mt-0.5">
                        {order.phone && <span>📞 {order.phone}</span>}
                        {order.refDoctor && <span>👨‍⚕️ {order.refDoctor}</span>}
                        {order.homeCollection && <span className="text-blue-600">🏠 Home</span>}
                      </div>
                      <div className="text-xs text-gray-600 bengali mt-1">{order.tests.join(' · ')}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_CONFIG[order.status].bg}`}>{STATUS_CONFIG[order.status].label}</span>
                      <span className="font-bold text-indigo-700 text-sm">₹{order.totalFee}</span>
                      {order.totalFee - order.paid > 0 && <span className="text-[10px] text-red-500 font-bold bengali">বকেয়া ₹{order.totalFee - order.paid}</span>}
                    </div>
                  </div>

                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {order.status === 'pending' && (
                      <button onClick={() => updateStatus(order.id, 'processing')} className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold bengali hover:bg-blue-700">নমুনা নেওয়া হয়েছে</button>
                    )}
                    {order.status === 'processing' && (
                      <button onClick={() => updateStatus(order.id, 'ready')} className="text-[10px] bg-green-600 text-white px-2 py-1 rounded font-bold bengali hover:bg-green-700">রিপোর্ট তৈরি</button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => updateStatus(order.id, 'delivered')} className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded font-bold bengali hover:bg-indigo-700">রিপোর্ট দেওয়া হয়েছে</button>
                    )}
                    {order.totalFee - order.paid > 0 && (
                      <button onClick={() => collectPayment(order.id)} className="text-[10px] bg-yellow-500 text-white px-2 py-1 rounded font-bold bengali hover:bg-yellow-600">💳 পেমেন্ট</button>
                    )}
                    <button onClick={() => printReport(order)} className="text-[10px] text-indigo-600 border border-indigo-200 px-2 py-1 rounded font-bold bengali hover:bg-indigo-50">🖨️ প্রিন্ট</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ NEW ORDER ══ */}
          {tab === 'new' && (
            <div className="space-y-3">
              <div className="font-bold text-gray-800 bengali text-sm">🔬 নতুন টেস্ট অর্ডার</div>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="রোগীর নাম *" className="border rounded-lg px-3 py-2 text-sm col-span-2 focus:outline-none focus:border-indigo-400 bengali" value={form.patientName} onChange={e => setForm({ ...form, patientName: e.target.value })} />
                <input placeholder="ফোন নম্বর" className="border rounded-lg px-3 py-2 text-sm focus:outline-none" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                <input placeholder="বয়স" className="border rounded-lg px-3 py-2 text-sm focus:outline-none bengali" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} />
                <input placeholder="Referring Doctor" className="border rounded-lg px-3 py-2 text-sm col-span-2 focus:outline-none bengali" value={form.refDoctor} onChange={e => setForm({ ...form, refDoctor: e.target.value })} />
                <label className="flex items-center gap-2 text-sm col-span-2 cursor-pointer">
                  <input type="checkbox" checked={form.homeCollection} onChange={e => setForm({ ...form, homeCollection: e.target.checked })} />
                  <span className="bengali">🏠 Home Collection?</span>
                </label>
                {form.homeCollection && (
                  <input placeholder="বাড়ির ঠিকানা" className="border rounded-lg px-3 py-2 text-sm col-span-2 focus:outline-none bengali" value={form.collectionAddress} onChange={e => setForm({ ...form, collectionAddress: e.target.value })} />
                )}
              </div>

              {/* Test selector */}
              <div>
                <div className="font-semibold text-gray-700 bengali text-xs mb-2">টেস্ট বেছে নিন *</div>
                <input placeholder="টেস্ট খুঁজুন..." className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none mb-2" value={testSearch} onChange={e => setTestSearch(e.target.value)} />
                <div className="max-h-[200px] overflow-y-auto space-y-1 border rounded-lg p-2">
                  {COMMON_TESTS.filter(t => !testSearch || t.name.toLowerCase().includes(testSearch.toLowerCase())).map(test => (
                    <label key={test.name} className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedTests.includes(test.name)} onChange={() => toggleTest(test.name)} />
                        <span className="text-xs text-gray-700">{test.name}</span>
                      </div>
                      <span className="text-xs font-bold text-indigo-600">₹{test.fee}</span>
                    </label>
                  ))}
                </div>
              </div>

              {selectedTests.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="text-xs font-bold text-indigo-800 bengali mb-2">নির্বাচিত টেস্ট ({selectedTests.length}টি)</div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTests.map(t => (
                      <span key={t} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        {t} <button onClick={() => toggleTest(t)} className="text-indigo-400 hover:text-red-500">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="font-extrabold text-indigo-800 text-sm bengali">মোট: ₹{totalSelectedFee}</div>
                </div>
              )}

              <button onClick={saveOrder} disabled={!form.patientName || selectedTests.length === 0} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 font-bold bengali hover:bg-indigo-700 disabled:opacity-40">
                অর্ডার নিন
              </button>
            </div>
          )}

          {/* ══ REAGENTS ══ */}
          {tab === 'reagent' && (
            <div className="space-y-3">
              {lowReagents.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                  <div className="font-bold text-orange-800 bengali text-sm mb-2">📦 কম রিএজেন্ট — অর্ডার করুন</div>
                  <div className="flex flex-wrap gap-2">{lowReagents.map(r => <span key={r.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg bengali">🧪 {r.name}: {r.stock} {r.unit}</span>)}</div>
                </div>
              )}
              {reagents.map(r => {
                const es = expiryStatus(r.expiry)
                const ls = r.stock < r.minStock
                return (
                  <div key={r.id} className={`bg-white border rounded-xl p-3 ${ls ? 'border-orange-200' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-800 text-sm">{r.name}</div>
                        <div className="text-xs text-gray-400 bengali">{r.supplier}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`font-bold ${ls ? 'text-red-600' : 'text-green-700'}`}>{r.stock} {r.unit}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${es === 'expired' ? 'bg-red-100 text-red-700' : es === 'critical' ? 'bg-orange-100 text-orange-700' : es === 'warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.expiry}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => { const qty = prompt(`কত ${r.unit} যোগ করবেন?`); if (qty) { setReagents(reagents.map(re => re.id === r.id ? { ...re, stock: re.stock + +qty } : re)); toast.success('স্টক আপডেট হয়েছে!') } }} className="flex-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg py-1.5 font-bold bengali hover:bg-blue-100">
                        ➕ স্টক যোগ করুন
                      </button>
                      <button onClick={() => toast.success(`${r.name} অর্ডার দেওয়া হয়েছে!`)} className="flex-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg py-1.5 font-bold bengali hover:bg-indigo-100">
                        📦 অর্ডার করুন
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ REPORT ══ */}
          {tab === 'report' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'আজকের টেস্ট', value: todayOrders.length, icon: '🔬' },
                  { label: 'আজকের আয়', value: `₹${todayRevenue}`, icon: '💰' },
                  { label: 'বকেয়া', value: `₹${todayDue}`, icon: '⏳' },
                  { label: 'মোট রোগী', value: orders.length, icon: '👥' },
                ].map(r => (
                  <div key={r.label} className="bg-gray-50 border rounded-xl p-3 text-center">
                    <div className="text-xl">{r.icon}</div>
                    <div className="font-extrabold text-gray-900">{r.value}</div>
                    <div className="text-xs text-gray-500 bengali">{r.label}</div>
                  </div>
                ))}
              </div>

              {/* Test-wise count */}
              <div className="bg-white border rounded-xl p-4">
                <div className="font-bold text-gray-800 bengali text-sm mb-3">📋 আজকের টেস্ট ব্রেকডাউন</div>
                {(() => {
                  const counts: Record<string, number> = {}
                  todayOrders.forEach(o => o.tests.forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
                  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([test, count]) => (
                    <div key={test} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-sm">
                      <span className="text-gray-700 text-xs">{test}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-gray-600 bengali">{count}টি</span>
                        <span className="text-xs font-bold text-indigo-700">₹{(COMMON_TESTS.find(t => t.name === test)?.fee || 0) * count}</span>
                      </div>
                    </div>
                  ))
                })()}
              </div>

              {/* Status breakdown */}
              <div className="bg-white border rounded-xl p-4">
                <div className="font-bold text-gray-800 bengali text-sm mb-3">🔄 স্ট্যাটাস ব্রেকডাউন</div>
                {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                  const count = todayOrders.filter(o => o.status === status).length
                  return (
                    <div key={status} className="flex items-center justify-between py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${config.bg} bengali`}>{config.label}</span>
                      <span className="text-sm font-bold text-gray-700">{count}টি</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
