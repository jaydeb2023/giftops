'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Download, Plus, Trash2, TrendingUp, TrendingDown,
  AlertCircle, Share2, Printer, RefreshCw, X, Check
} from 'lucide-react'
import toast from 'react-hot-toast'

import { tr } from '@/lib/i18n/tr'
// ── Types ──────────────────────────────────────────────────────
interface Sale     { id: string; sale_date: string; item_name: string; quantity: number; unit_price: number; total_amount: number; notes?: string }
interface Expense  { id: string; expense_date: string; category: string; description: string; amount: number }
interface Credit   { id: string; customer_name: string; amount: number; paid_amount: number; status: string; due_date?: string; notes?: string }
interface Stock    { id: string; item_name: string; current_qty: number; unit: string; min_qty: number; unit_cost: number }

interface Props { userId: string; agentId: string; agentName: string }

const EXPENSE_CATS = ['stock', 'rent', 'salary', 'utility', 'misc']
const EXPENSE_CAT_BN: Record<string, string> = { stock: 'মালামাল', rent: 'ভাড়া', salary: 'বেতন', utility: 'ইউটিলিটি', misc: 'অন্যান্য' }

// ── Tiny bar chart (pure CSS) ──────────────────────────────────
function MiniBar({ data, color = '#4F46E5' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-sm transition-all" style={{ height: `${(d.value / max) * 80}px`, background: color, minHeight: d.value > 0 ? '4px' : '0' }} />
          <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Donut chart (SVG) ──────────────────────────────────────────
function DonutChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let offset = 0
  const r = 40, cx = 50, cy = 50, circumference = 2 * Math.PI * r
  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {data.map((d, i) => {
          const pct = d.value / total
          const dash = pct * circumference
          const gap = circumference - dash
          const rotate = offset * 360 - 90
          offset += pct
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth="18"
              strokeDasharray={`${dash} ${gap}`}
              style={{ transform: `rotate(${rotate}deg)`, transformOrigin: '50px 50px' }} />
          )
        })}
        <circle cx={cx} cy={cy} r="28" fill="white" />
      </svg>
      <div className="flex flex-col gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: d.color }} />
            <span className="text-[11px] text-gray-600 bengali">{d.label}</span>
            <span className="text-[11px] font-semibold text-gray-800 ml-auto pl-2">₹{d.value.toLocaleString('bn-IN')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ReportDashboard({ userId, agentId, agentName }: Props) {
  const [activeReport, setActiveReport] = useState<'summary' | 'sales' | 'expenses' | 'credit' | 'stock' | 'history'>('summary')
  const [sales, setSales]     = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [stocks, setStocks]   = useState<Stock[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // ── Fetch all data ────────────────────────────────────────
  const fetchAll = async () => {
    setLoadingData(true)
    const [s, e, c, st] = await Promise.all([
      supabase.from('daily_sales').select('*').eq('user_id', userId).order('sale_date', { ascending: false }).limit(100),
      supabase.from('expenses').select('*').eq('user_id', userId).order('expense_date', { ascending: false }).limit(100),
      supabase.from('credit_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase.from('stock_items').select('*').eq('user_id', userId).order('item_name'),
    ])
    if (s.data) setSales(s.data)
    if (e.data) setExpenses(e.data)
    if (c.data) setCredits(c.data)
    if (st.data) setStocks(st.data)
    setLoadingData(false)
  }

  useEffect(() => { fetchAll() }, [userId])

  // ── Summary numbers ───────────────────────────────────────
  const totalSales    = sales.reduce((s, r) => s + Number(r.total_amount), 0)
  const totalExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0)
  const totalProfit   = totalSales - totalExpenses
  const totalBaki     = credits.filter(c => c.status !== 'paid').reduce((s, r) => s + (Number(r.amount) - Number(r.paid_amount)), 0)
  const lowStock      = stocks.filter(s => s.current_qty <= s.min_qty)

  // Last 7 days sales for chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const label = `${d.getDate()}/${d.getMonth() + 1}`
    const dateStr = d.toISOString().split('T')[0]
    const value = sales.filter(s => s.sale_date === dateStr).reduce((a, s) => a + Number(s.total_amount), 0)
    return { label, value }
  })

  // Expense breakdown for donut
  const expByCategory = EXPENSE_CATS.map((cat, i) => ({
    label: EXPENSE_CAT_BN[cat],
    value: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    color: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i],
  })).filter(d => d.value > 0)

  // ── Export: Excel (CSV) ───────────────────────────────────
  const downloadCSV = (rows: string[][], filename: string) => {
    const bom = '\uFEFF'
    const csv = bom + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
    toast.success('Excel ফাইল download হচ্ছে!')
  }

  const exportSalesExcel = () => downloadCSV(
    [['তারিখ', 'পণ্যের নাম', 'পরিমাণ', 'একক মূল্য', 'মোট'], ...sales.map(s => [s.sale_date, s.item_name, String(s.quantity), String(s.unit_price), String(s.total_amount)])],
    `sahayak-sales-${new Date().toISOString().split('T')[0]}.csv`
  )

  const exportExpensesExcel = () => downloadCSV(
    [['তারিখ', 'বিভাগ', 'বিবরণ', 'পরিমাণ'], ...expenses.map(e => [e.expense_date, EXPENSE_CAT_BN[e.category] || e.category, e.description, String(e.amount)])],
    `sahayak-expenses-${new Date().toISOString().split('T')[0]}.csv`
  )

  const exportCreditExcel = () => downloadCSV(
    [['গ্রাহকের নাম', 'মোট বাকি', 'পরিশোধ', 'বাকি', 'অবস্থা'], ...credits.map(c => [c.customer_name, String(c.amount), String(c.paid_amount), String(Number(c.amount) - Number(c.paid_amount)), c.status === 'paid' ? 'পরিশোধিত' : 'বাকি'])],
    `sahayak-credit-${new Date().toISOString().split('T')[0]}.csv`
  )

  // ── Export: Print / PDF ───────────────────────────────────
  const printReport = () => { window.print(); toast.success('Print dialog খুলছে — PDF হিসেবে সেভ করুন') }

  // ── Share: WhatsApp ───────────────────────────────────────
  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `📊 *${agentName} — রিপোর্ট*\n\n` +
      `💰 মোট বিক্রি: ₹${totalSales.toLocaleString()}\n` +
      `💸 মোট খরচ: ₹${totalExpenses.toLocaleString()}\n` +
      `📈 লাভ: ₹${totalProfit.toLocaleString()}\n` +
      `🔴 বাকি: ₹${totalBaki.toLocaleString()}\n\n` +
      `_Sahayak AI দ্বারা তৈরি_`
    )
    window.open(`https://wa.me/?text=${msg}`, '_blank')
  }

  // ── Delete helpers ────────────────────────────────────────
  const deleteSale = async (id: string) => {
    await supabase.from('daily_sales').delete().eq('id', id)
    setSales(sales.filter(s => s.id !== id))
    toast.success('মুছে ফেলা হয়েছে')
  }
  const deleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(expenses.filter(e => e.id !== id))
    toast.success('মুছে ফেলা হয়েছে')
  }
  const markCreditPaid = async (id: string, amount: number) => {
    await supabase.from('credit_entries').update({ paid_amount: amount, status: 'paid' }).eq('id', id)
    setCredits(credits.map(c => c.id === id ? { ...c, paid_amount: amount, status: 'paid' } : c))
    toast.success('পরিশোধিত হিসেবে চিহ্নিত করা হয়েছে!')
  }

  const tabs = [
    { id: 'summary',  label: '📊 সারসংক্ষেপ' },
    { id: 'sales',    label: '💰 বিক্রি'       },
    { id: 'expenses', label: '💸 খরচ'          },
    { id: 'credit',   label: '🔴 বাকি'         },
    { id: 'stock',    label: '📦 স্টক'          },
    { id: 'history',  label: '🕐 ইতিহাস'       },
  ]

  if (loadingData) return (
    <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
      <div className="text-gray-400 bengali animate-pulse">{tr('রিপোর্ট লোড হচ্ছে...')}</div>
    </div>
  )

  return (
    <div ref={printRef} className="space-y-4">

      {/* ── Top action bar ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-gray-800 bengali mr-2">{agentName} {tr('— রিপোর্ট')}</span>
        <div className="flex-1" />
        <button onClick={shareWhatsApp}   className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"><Share2 size={13} /> WhatsApp</button>
        <button onClick={printReport}     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"><Printer size={13} /> PDF</button>
        <button onClick={exportSalesExcel} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"><Download size={13} /> Excel</button>
        <button onClick={fetchAll}        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"><RefreshCw size={13} /> Refresh</button>
        <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"><Plus size={13} /> {tr('তথ্য যোগ করুন')}</button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveReport(t.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors bengali ${
              activeReport === t.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* SUMMARY TAB                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeReport === 'summary' && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'মোট বিক্রি',  value: totalSales,    icon: '💰', color: 'text-emerald-600', bg: 'bg-emerald-50', trend: <TrendingUp size={14} className="text-emerald-500" /> },
              { label: 'মোট খরচ',    value: totalExpenses, icon: '💸', color: 'text-red-600',     bg: 'bg-red-50',     trend: <TrendingDown size={14} className="text-red-500" />   },
              { label: 'লাভ/ক্ষতি',  value: totalProfit,   icon: '📈', color: totalProfit >= 0 ? 'text-indigo-600' : 'text-red-600', bg: 'bg-indigo-50', trend: null },
              { label: 'মোট বাকি',   value: totalBaki,     icon: '🔴', color: 'text-orange-600', bg: 'bg-orange-50',  trend: null },
            ].map(m => (
              <div key={m.label} className={`${m.bg} rounded-2xl p-4`}>
                <div className="text-lg mb-1">{m.icon}</div>
                <div className={`text-xl font-extrabold ${m.color} bengali`}>₹{m.value.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-0.5 bengali flex items-center gap-1">{m.label} {m.trend}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 bengali">{tr('গত ৭ দিনের বিক্রি')}</h3>
              <MiniBar data={last7} color="#4F46E5" />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-4 bengali">{tr('খরচের বিভাগ')}</h3>
              {expByCategory.length > 0
                ? <DonutChart data={expByCategory} />
                : <div className="text-center py-6 text-gray-400 text-xs bengali">{tr('এখনো কোনো খরচ নেই')}</div>
              }
            </div>
          </div>

          {/* Low stock alert */}
          {lowStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 bengali">⚠️ {lowStock.length}{tr('টি পণ্যের স্টক কম!')}</p>
                <p className="text-xs text-red-600 bengali mt-1">{lowStock.map(s => s.item_name).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* SALES TAB                                            */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeReport === 'sales' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 bengali">{tr('বিক্রির তালিকা (')}{sales.length}{tr('টি)')}</h3>
            <button onClick={exportSalesExcel} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline bengali">
              <Download size={12} /> Excel download
            </button>
          </div>
          {sales.length === 0 ? (
            <div className="py-12 text-center text-gray-400 bengali text-sm">{tr('কোনো বিক্রির তথ্য নেই। উপরে "তথ্য যোগ করুন" বাটনে click করুন।')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['তারিখ', 'পণ্য', 'পরিমাণ', 'একক মূল্য', 'মোট', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 bengali">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sales.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500">{s.sale_date}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 bengali">{s.item_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{s.quantity}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">₹{Number(s.unit_price).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600">₹{Number(s.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteSale(s.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 border-t-2 border-indigo-100">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700 bengali">{tr('মোট')}</td>
                    <td className="px-4 py-3 text-sm font-extrabold text-indigo-600">₹{totalSales.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* EXPENSES TAB                                         */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeReport === 'expenses' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 bengali">{tr('খরচের তালিকা (')}{expenses.length}{tr('টি)')}</h3>
            <button onClick={exportExpensesExcel} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline bengali">
              <Download size={12} /> Excel download
            </button>
          </div>
          {expenses.length === 0 ? (
            <div className="py-12 text-center text-gray-400 bengali text-sm">{tr('কোনো খরচের তথ্য নেই।')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['তারিখ', 'বিভাগ', 'বিবরণ', 'পরিমাণ', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 bengali">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-gray-500">{e.expense_date}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full bengali">{EXPENSE_CAT_BN[e.category] || e.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 bengali">{e.description}</td>
                      <td className="px-4 py-3 text-sm font-bold text-red-600">₹{Number(e.amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => deleteExpense(e.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-red-50 border-t-2 border-red-100">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-700 bengali">{tr('মোট খরচ')}</td>
                    <td className="px-4 py-3 text-sm font-extrabold text-red-600">₹{totalExpenses.toLocaleString()}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* CREDIT TAB                                           */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeReport === 'credit' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 bengali">{tr('বাকির তালিকা — মোট ₹')}{totalBaki.toLocaleString()}</h3>
            <button onClick={exportCreditExcel} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:underline bengali">
              <Download size={12} /> Excel download
            </button>
          </div>
          {credits.length === 0 ? (
            <div className="py-12 text-center text-gray-400 bengali text-sm">{tr('কোনো বাকির তথ্য নেই।')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['গ্রাহক', 'বাকি', 'পরিশোধ', 'বাকি আছে', 'অবস্থা', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 bengali">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {credits.map(c => {
                    const remaining = Number(c.amount) - Number(c.paid_amount)
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 bengali">{c.customer_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">₹{Number(c.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600">₹{Number(c.paid_amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-bold text-orange-600">₹{remaining.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bengali ${
                            c.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                          }`}>
                            {c.status === 'paid' ? tr('✓ পরিশোধিত') : tr('বাকি')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {c.status !== 'paid' && (
                            <button onClick={() => markCreditPaid(c.id, Number(c.amount))}
                              className="text-emerald-500 hover:text-emerald-700 transition-colors" title={tr('পরিশোধিত চিহ্নিত করুন')}>
                              <Check size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* STOCK TAB                                            */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeReport === 'stock' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 bengali">{tr('স্টক রিপোর্ট (')}{stocks.length}{tr('টি পণ্য)')}</h3>
          </div>
          {stocks.length === 0 ? (
            <div className="py-12 text-center text-gray-400 bengali text-sm">{tr('কোনো স্টক তথ্য নেই।')}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['পণ্যের নাম', 'বর্তমান স্টক', 'একক', 'ন্যূনতম', 'অবস্থা', 'মোট মূল্য'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 bengali">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stocks.map(s => {
                    const isLow = s.current_qty <= s.min_qty
                    return (
                      <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${isLow ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 bengali">{s.item_name}</td>
                        <td className="px-4 py-3 text-sm font-bold" style={{ color: isLow ? '#DC2626' : '#059669' }}>{s.current_qty}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{s.unit}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{s.min_qty}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full bengali ${isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {isLow ? tr('⚠️ কম') : tr('✓ ঠিক আছে')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">₹{(s.current_qty * s.unit_cost).toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* HISTORY TAB                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      {activeReport === 'history' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-800 mb-4 bengali">{tr('মাসিক সারসংক্ষেপ')}</h3>
          <div className="space-y-3">
            {Array.from(new Set(sales.map(s => s.sale_date.substring(0, 7)))).slice(0, 6).map(month => {
              const mSales = sales.filter(s => s.sale_date.startsWith(month)).reduce((a, s) => a + Number(s.total_amount), 0)
              const mExp   = expenses.filter(e => e.expense_date.startsWith(month)).reduce((a, e) => a + Number(e.amount), 0)
              const mProfit = mSales - mExp
              return (
                <div key={month} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:bg-gray-50">
                  <div className="text-sm font-bold text-gray-700 w-20">{month}</div>
                  <div className="flex-1 grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-xs text-gray-400 bengali">{tr('বিক্রি')}</div><div className="text-sm font-bold text-emerald-600">₹{mSales.toLocaleString()}</div></div>
                    <div><div className="text-xs text-gray-400 bengali">{tr('খরচ')}</div><div className="text-sm font-bold text-red-500">₹{mExp.toLocaleString()}</div></div>
                    <div><div className="text-xs text-gray-400 bengali">{tr('লাভ')}</div><div className={`text-sm font-bold ${mProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>₹{mProfit.toLocaleString()}</div></div>
                  </div>
                </div>
              )
            })}
            {sales.length === 0 && <div className="text-center py-8 text-gray-400 bengali text-sm">{tr('কোনো ইতিহাস নেই।')}</div>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* ADD DATA MODAL                                       */}
      {/* ══════════════════════════════════════════════════════ */}
      {showAddModal && (
        <AddDataModal
          userId={userId}
          agentId={agentId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchAll() }}
        />
      )}
    </div>
  )
}

// ── Add Data Modal ─────────────────────────────────────────────
function AddDataModal({ userId, agentId, onClose, onSaved }: { userId: string; agentId: string; onClose: () => void; onSaved: () => void }) {
  const [tab, setTab] = useState<'sale' | 'expense' | 'credit' | 'stock'>('sale')
  const [saving, setSaving] = useState(false)

  // Sale form
  const [saleItem, setSaleItem]     = useState('')
  const [saleQty, setSaleQty]       = useState('1')
  const [salePrice, setSalePrice]   = useState('')
  const [saleDate, setSaleDate]     = useState(new Date().toISOString().split('T')[0])

  // Expense form
  const [expDesc, setExpDesc]       = useState('')
  const [expAmount, setExpAmount]   = useState('')
  const [expCat, setExpCat]         = useState('stock')
  const [expDate, setExpDate]       = useState(new Date().toISOString().split('T')[0])

  // Credit form
  const [creditName, setCreditName] = useState('')
  const [creditAmt, setCreditAmt]   = useState('')
  const [creditNote, setCreditNote] = useState('')

  // Stock form
  const [stockName, setStockName]   = useState('')
  const [stockQty, setStockQty]     = useState('')
  const [stockUnit, setStockUnit]   = useState('pcs')
  const [stockMin, setStockMin]     = useState('5')
  const [stockCost, setStockCost]   = useState('0')

  const saveSale = async () => {
    if (!saleItem || !salePrice) return toast.error('পণ্যের নাম ও মূল্য দিন')
    setSaving(true)
    const { error } = await supabase.from('daily_sales').insert({ user_id: userId, agent_id: agentId, sale_date: saleDate, item_name: saleItem, quantity: Number(saleQty), unit_price: Number(salePrice), source: 'manual' })
    setSaving(false)
    if (error) return toast.error('সেভ করতে সমস্যা হয়েছে')
    toast.success('বিক্রি যোগ করা হয়েছে!')
    onSaved()
  }

  const saveExpense = async () => {
    if (!expDesc || !expAmount) return toast.error('বিবরণ ও পরিমাণ দিন')
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({ user_id: userId, agent_id: agentId, expense_date: expDate, description: expDesc, amount: Number(expAmount), category: expCat, source: 'manual' })
    setSaving(false)
    if (error) return toast.error('সেভ করতে সমস্যা হয়েছে')
    toast.success('খরচ যোগ করা হয়েছে!')
    onSaved()
  }

  const saveCredit = async () => {
    if (!creditName || !creditAmt) return toast.error('নাম ও পরিমাণ দিন')
    setSaving(true)
    const { error } = await supabase.from('credit_entries').insert({ user_id: userId, agent_id: agentId, customer_name: creditName, amount: Number(creditAmt), notes: creditNote, source: 'manual' })
    setSaving(false)
    if (error) return toast.error('সেভ করতে সমস্যা হয়েছে')
    toast.success('বাকি যোগ করা হয়েছে!')
    onSaved()
  }

  const saveStock = async () => {
    if (!stockName || !stockQty) return toast.error('নাম ও পরিমাণ দিন')
    setSaving(true)
    const { error } = await supabase.from('stock_items').insert({ user_id: userId, agent_id: agentId, item_name: stockName, current_qty: Number(stockQty), unit: stockUnit, min_qty: Number(stockMin), unit_cost: Number(stockCost) })
    setSaving(false)
    if (error) return toast.error('সেভ করতে সমস্যা হয়েছে')
    toast.success('স্টক যোগ করা হয়েছে!')
    onSaved()
  }

  const modalTabs = [
    { id: 'sale',    label: '💰 বিক্রি'  },
    { id: 'expense', label: '💸 খরচ'     },
    { id: 'credit',  label: '🔴 বাকি'    },
    { id: 'stock',   label: '📦 স্টক'     },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 bengali">{tr('তথ্য যোগ করুন')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Modal tabs */}
        <div className="flex border-b border-gray-100">
          {modalTabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`flex-1 py-2.5 text-xs font-semibold bengali transition-colors ${tab === t.id ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-3">
          {/* SALE */}
          {tab === 'sale' && <>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" placeholder={tr('পণ্যের নাম (যেমন: চাল, তেল)')} value={saleItem} onChange={e => setSaleItem(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('পরিমাণ')} value={saleQty} onChange={e => setSaleQty(e.target.value)} />
              <input type="number" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('একক মূল্য (₹)')} value={salePrice} onChange={e => setSalePrice(e.target.value)} />
            </div>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
            {salePrice && saleQty && <div className="text-sm text-emerald-600 font-bold bengali">{tr('মোট: ₹')}{(Number(salePrice) * Number(saleQty)).toLocaleString()}</div>}
            <button onClick={saveSale} disabled={saving} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm bengali">{saving ? tr('সেভ হচ্ছে...') : tr('বিক্রি যোগ করুন')}</button>
          </>}

          {/* EXPENSE */}
          {tab === 'expense' && <>
            <select className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" value={expCat} onChange={e => setExpCat(e.target.value)}>
              {EXPENSE_CATS.map(c => <option key={c} value={c}>{EXPENSE_CAT_BN[c]}</option>)}
            </select>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" placeholder={tr('খরচের বিবরণ')} value={expDesc} onChange={e => setExpDesc(e.target.value)} />
            <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('পরিমাণ (₹)')} value={expAmount} onChange={e => setExpAmount(e.target.value)} />
            <input type="date" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" value={expDate} onChange={e => setExpDate(e.target.value)} />
            <button onClick={saveExpense} disabled={saving} className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm bengali">{saving ? tr('সেভ হচ্ছে...') : tr('খরচ যোগ করুন')}</button>
          </>}

          {/* CREDIT */}
          {tab === 'credit' && <>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" placeholder={tr('গ্রাহকের নাম (যেমন: রামবাবু)')} value={creditName} onChange={e => setCreditName(e.target.value)} />
            <input type="number" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('বাকির পরিমাণ (₹)')} value={creditAmt} onChange={e => setCreditAmt(e.target.value)} />
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" placeholder={tr('নোট (ঐচ্ছিক)')} value={creditNote} onChange={e => setCreditNote(e.target.value)} />
            <button onClick={saveCredit} disabled={saving} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl text-sm bengali">{saving ? tr('সেভ হচ্ছে...') : tr('বাকি যোগ করুন')}</button>
          </>}

          {/* STOCK */}
          {tab === 'stock' && <>
            <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" placeholder={tr('পণ্যের নাম')} value={stockName} onChange={e => setStockName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('বর্তমান পরিমাণ')} value={stockQty} onChange={e => setStockQty(e.target.value)} />
              <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" value={stockUnit} onChange={e => setStockUnit(e.target.value)}>
                {['pcs', 'kg', 'litre', 'box', 'packet'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('ন্যূনতম স্টক')} value={stockMin} onChange={e => setStockMin(e.target.value)} />
              <input type="number" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" placeholder={tr('একক মূল্য (₹)')} value={stockCost} onChange={e => setStockCost(e.target.value)} />
            </div>
            <button onClick={saveStock} disabled={saving} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm bengali">{saving ? tr('সেভ হচ্ছে...') : tr('স্টক যোগ করুন')}</button>
          </>}
        </div>
      </div>
    </div>
  )
}
