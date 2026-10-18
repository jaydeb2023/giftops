'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { readCache, writeCache, useIsoLayoutEffect } from '@/lib/swrCache'
import { TrendingUp, RefreshCw, Clock, Printer, MessageCircle, X, Sparkles, Trophy, CalendarDays } from 'lucide-react'
import { printBill, sendBillWhatsApp, BillingProfile } from '@/lib/billing'
import { ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import toast from 'react-hot-toast'

import { tr } from '@/lib/i18n/tr'
interface Sale {
  id: string
  agent_id: string | null
  sale_date: string
  item_name: string
  quantity: number
  unit_price: number
  total_amount: number
  notes?: string
}

type Range = 'today' | 'week' | 'month'

const WEEKDAY_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']

// notes are saved as "খদ্দের: NAME" by the chat backend when a customer is named
function customerNameFromNotes(notes?: string): string | null {
  if (!notes) return null
  const m = notes.match(/খদ্দের:\s*(.+)/)
  return m ? m[1].trim() : null
}

// Simple least-squares trend line — used to project the next few days' sales
// from the recent daily totals. This is a statistical trend projection, not
// a black-box model, but it's what powers the "forecast" shown to the user.
function linearForecast(points: number[], daysAhead: number): number[] {
  const n = points.length
  if (n < 3) return []
  const sumX = points.reduce((s, _, i) => s + i, 0)
  const sumY = points.reduce((s, y) => s + y, 0)
  const sumXY = points.reduce((s, y, i) => s + i * y, 0)
  const sumXX = points.reduce((s, _, i) => s + i * i, 0)
  const denom = n * sumXX - sumX * sumX
  const slope = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return Array.from({ length: daysAhead }, (_, i) => Math.max(0, slope * (n + i) + intercept))
}

export function StatCard({ icon, label, value, delta, bg, text, sub }: { icon: string; label: string; value: string; delta: number | null; bg: string; text: string; sub?: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 max-sm:p-2`}>
      <div className={`flex items-center gap-1.5 text-[12px] max-sm:text-[10px] max-sm:leading-tight font-semibold bengali ${text}`}>
        <span className="max-sm:hidden">{icon}</span> {label}
      </div>
      <div className="text-xl max-sm:text-base sm:text-2xl font-extrabold text-gray-900 mt-1.5 max-sm:mt-0.5">{value}</div>
      {sub ? (
        <div className="max-sm:hidden text-[11px] text-gray-400 bengali mt-1">{sub}</div>
      ) : delta !== null ? (
        <div className={`max-sm:hidden text-[11px] font-semibold mt-1 bengali ${delta >= 0 ? text : 'text-rose-600'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}% <span className="text-gray-400 font-normal max-sm:text-[10px]">{tr('আগের সময়ের তুলনায়')}</span>
        </div>
      ) : (
        <div className="max-sm:hidden text-[11px] text-gray-400 bengali mt-1">{tr('আগের সময়ের তুলনায় ডেটা নেই')}</div>
      )}
    </div>
  )
}

export default function SalesOverview({ userId, agentNameById }: { userId: string; agentNameById: Record<string, string> }) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<Range>('today')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [profile, setProfile] = useState<BillingProfile>({ shop_name: 'আমার দোকান' })
  const [phoneByName, setPhoneByName] = useState<Record<string, string>>({})
  const [billFor, setBillFor] = useState<Sale | null>(null)
  const [withGst, setWithGst] = useState(false)

  const [customers, setCustomers] = useState<{ name: string; phone: string | null; created_at: string }[]>([])

  const applyBundle = (b: any) => {
    setSales(b.sales || [])
    if (b.profile) setProfile(b.profile)
    const map: Record<string, string> = {}
    for (const c of b.customers || []) if (c.phone) map[c.name.toLowerCase()] = c.phone
    setPhoneByName(map)
    setCustomers(b.customers || [])
  }

  const load = async () => {
    const ck = `sales:${userId}`
    const cached = readCache<any>(ck)
    if (cached) { applyBundle(cached); setLoading(false) } else setLoading(true)
    const [salesRes, profileRes, customersRes] = await Promise.all([
      supabase.from('daily_sales').select('*').eq('user_id', userId).order('sale_date', { ascending: false }).limit(500),
      supabase.from('profiles').select('shop_name, owner_name, phone, address, upi_id, gstin, print_footer').eq('id', userId).single(),
      supabase.from('crm_customers').select('name, phone, created_at').eq('user_id', userId),
    ])
    if (salesRes.error) console.error('daily_sales fetch:', salesRes.error)
    const bundle = { sales: salesRes.data || [], profile: profileRes.data || null, customers: customersRes.data || [] }
    applyBundle(bundle)
    if (!salesRes.error) writeCache(ck, bundle)
    setLoading(false)
  }

  useIsoLayoutEffect(() => { load() }, [userId])

  const today = new Date().toISOString().slice(0, 10)
  const cutoff = useMemo(() => {
    const d = new Date()
    if (range === 'week') d.setDate(d.getDate() - 7)
    if (range === 'month') d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  }, [range])

  const agentScoped = sales.filter(s => agentFilter === 'all' || s.agent_id === agentFilter)
  const filtered = agentScoped.filter(s => range === 'today' ? s.sale_date === today : s.sale_date >= cutoff)
  const total = filtered.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)

  // ── KPI cards: current period vs the immediately preceding equal-length
  // period (yesterday / previous 7 days / previous 30 days) ────────────
  const kpis = useMemo(() => {
    const spanDays = range === 'today' ? 1 : range === 'week' ? 7 : 30
    const startCurr = new Date(); startCurr.setDate(startCurr.getDate() - (spanDays - 1))
    const startPrev = new Date(startCurr); startPrev.setDate(startPrev.getDate() - spanDays)
    const endPrev = new Date(startCurr); endPrev.setDate(endPrev.getDate() - 1)
    const startCurrKey = startCurr.toISOString().slice(0, 10)
    const startPrevKey = startPrev.toISOString().slice(0, 10)
    const endPrevKey = endPrev.toISOString().slice(0, 10)

    const prevSales = agentScoped.filter(s => s.sale_date >= startPrevKey && s.sale_date <= endPrevKey)
    const prevTotal = prevSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0)
    const prevCount = prevSales.length

    const newCustCurr = customers.filter(c => c.created_at && c.created_at.slice(0, 10) >= startCurrKey).length
    const newCustPrev = customers.filter(c => c.created_at && c.created_at.slice(0, 10) >= startPrevKey && c.created_at.slice(0, 10) <= endPrevKey).length

    const avgCurr = filtered.length ? total / filtered.length : 0
    const avgPrev = prevCount ? prevTotal / prevCount : 0

    const pct = (curr: number, prev: number) => prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null

    return {
      total: { value: total, delta: pct(total, prevTotal) },
      count: { value: filtered.length, delta: pct(filtered.length, prevCount) },
      newCustomers: { value: newCustCurr, delta: pct(newCustCurr, newCustPrev) },
      avg: { value: avgCurr, delta: pct(avgCurr, avgPrev) },
    }
  }, [agentScoped, customers, filtered, total, range])

  // ── Daily trend (last 30 days) + AI-style forecast (next 7 days) ──
  const trendChart = useMemo(() => {
    const days = 30
    const byDate: Record<string, number> = {}
    for (const s of agentScoped) byDate[s.sale_date] = (byDate[s.sale_date] || 0) + Number(s.total_amount || 0)
    const actualPoints: { date: string; label: string; total: number }[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      actualPoints.push({ date: key, label: d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }), total: byDate[key] || 0 })
    }
    // Train the trend line on the last 14 actual days only (recent momentum matters more)
    const trainWindow = actualPoints.slice(-14).map(p => p.total)
    const forecastVals = linearForecast(trainWindow, 7)
    const chartData: any[] = actualPoints.map(p => ({ label: p.label, actual: p.total }))
    if (forecastVals.length) {
      // Bridge the actual line into the forecast line so they connect visually
      chartData[chartData.length - 1].forecast = chartData[chartData.length - 1].actual
      for (let i = 0; i < forecastVals.length; i++) {
        const d = new Date(); d.setDate(d.getDate() + i + 1)
        chartData.push({ label: d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }), forecast: forecastVals[i] })
      }
    }
    const forecastTotal = forecastVals.reduce((s, v) => s + v, 0)
    return { chartData, forecastTotal, hasForecast: forecastVals.length > 0 }
  }, [agentScoped])

  // ── Top-selling products, within the selected date range ──
  const topProducts = useMemo(() => {
    const byItem: Record<string, { qty: number; revenue: number }> = {}
    for (const s of filtered) {
      const key = s.item_name || 'অজানা'
      if (!byItem[key]) byItem[key] = { qty: 0, revenue: 0 }
      byItem[key].qty += Number(s.quantity || 0)
      byItem[key].revenue += Number(s.total_amount || 0)
    }
    return Object.entries(byItem)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [filtered])

  // ── Best-performing day of the week, over the last 90 days ──
  const bestWeekday = useMemo(() => {
    const cutoff90 = new Date(); cutoff90.setDate(cutoff90.getDate() - 90)
    const cutoffKey = cutoff90.toISOString().slice(0, 10)
    const byDay: { total: number; count: number }[] = WEEKDAY_BN.map(() => ({ total: 0, count: 0 }))
    for (const s of agentScoped) {
      if (s.sale_date < cutoffKey) continue
      const wd = new Date(s.sale_date + 'T00:00:00').getDay()
      byDay[wd].total += Number(s.total_amount || 0)
      byDay[wd].count += 1
    }
    const avgs = byDay.map((d, i) => ({ day: WEEKDAY_BN[i], avg: d.count ? d.total / d.count : 0, total: d.total }))
    const best = avgs.reduce((a, b) => (b.avg > a.avg ? b : a), avgs[0])
    return { avgs, best }
  }, [agentScoped])

  const toBillable = (s: Sale) => {
    const custName = customerNameFromNotes(s.notes) || undefined
    return {
      item_name: s.item_name, quantity: s.quantity, unit: 'পিস', unit_price: s.unit_price,
      total_amount: s.total_amount, paid_amount: s.total_amount, // daily_sales doesn't track partial payment
      customer_name: custName, customer_phone: custName ? phoneByName[custName.toLowerCase()] : undefined,
    }
  }

  const handlePrint = (s: Sale) => printBill(profile, toBillable(s), withGst ? 18 : 0)
  const handleWhatsApp = (s: Sale) => {
    const ok = sendBillWhatsApp(profile, toBillable(s), withGst)
    if (!ok) toast.error('কাস্টমারের ফোন নম্বর নেই')
  }

  return (
    <div className="max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col">
      <div className="flex items-start justify-between mb-4 max-sm:mb-2 gap-2">
        <div className="min-w-0">
          <h2 className="text-lg max-sm:text-xl font-bold text-gray-900 bengali flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-600"/> {tr('বিক্রি')}
          </h2>
          <p className="max-sm:hidden text-xs text-gray-400 bengali mt-0.5">{tr('আপনার ব্যবসার বিক্রি এবং পারফরম্যান্স দেখুন।')}</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 bengali">
          <RefreshCw size={12}/> Refresh
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 max-sm:mb-2 flex-wrap max-sm:flex-nowrap">
        {(['today', 'week', 'month'] as Range[]).map(r => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-4 max-sm:px-3 py-2 max-sm:py-2 shrink-0 rounded-lg text-[12px] font-bold bengali ${range===r ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            {r === 'today' ? tr('আজ') : r === 'week' ? tr('সাপ্তাহিক') : tr('মাসিক')}
          </button>
        ))}
        {Object.keys(agentNameById).length > 0 && (
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            className="ml-auto max-sm:ml-0 max-sm:flex-1 max-sm:min-w-0 text-[12px] font-semibold border border-gray-200 rounded-lg px-2.5 py-2 bengali bg-white text-gray-600">
            <option value="all">{tr('সব Agent')}</option>
            {Object.entries(agentNameById).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 max-sm:grid-cols-4 lg:grid-cols-4 gap-3 max-sm:gap-1.5 mb-4 max-sm:mb-2">
        <StatCard
          icon="💰" label={tr('মোট বিক্রি')} bg="bg-emerald-50" text="text-emerald-700"
          value={`₹${kpis.total.value.toFixed(0)}`} delta={kpis.total.delta}
        />
        <StatCard
          icon="🛒" label={tr('মোট লেনদেন')} bg="bg-blue-50" text="text-blue-700"
          value={`${kpis.count.value}`} delta={kpis.count.delta}
        />
        <StatCard
          icon="👥" label={tr('নতুন কাস্টমার')} bg="bg-pink-50" text="text-pink-700"
          value={`${kpis.newCustomers.value}`} delta={kpis.newCustomers.delta}
        />
        <StatCard
          icon="📄" label={tr('গড় বিক্রি (প্রতি লেনদেন)')} bg="bg-amber-50" text="text-amber-700"
          value={`₹${kpis.avg.value.toFixed(0)}`} delta={kpis.avg.delta}
        />
      </div>

      {/* ── Trend + AI-style forecast ────────────────────────── */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 max-sm:p-2.5 mb-4 max-sm:mb-2">
          <div className="flex items-center justify-between mb-3 max-sm:mb-1 flex-wrap gap-1">
            <h3 className="text-[13px] font-bold text-gray-800 bengali flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-600"/> {tr('গত ৩০ দিনের বিক্রি')}{trendChart.hasForecast ? tr(' + পূর্বাভাস') : ''}
            </h3>
            {trendChart.hasForecast && (
              <span className="max-sm:hidden text-[11px] font-semibold text-indigo-600 bengali flex items-center gap-1">
                <Sparkles size={12}/> {tr('আগামী ৭ দিনে সম্ভাব্য বিক্রি: ₹')}{trendChart.forecastTotal.toFixed(0)}
              </span>
            )}
          </div>
          {trendChart.chartData.filter((d: any) => d.actual).length < 3 ? (
            <div className="text-center py-8 text-gray-400 text-[12px] bengali">
              {tr('পূর্বাভাস দেখতে অন্তত কয়েকদিনের বিক্রি ডেটা দরকার — বিক্রি যোগ করতে থাকুন।')}
            </div>
          ) : (
            <div className="w-full h-[220px] max-sm:h-[100px]">
              <ResponsiveContainer>
                <ComposedChart data={trendChart.chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4}/>
                  <YAxis tick={{ fontSize: 10 }}/>
                  <Tooltip formatter={(v: any) => `₹${Number(v).toFixed(0)}`} contentStyle={{ fontSize: 12 }}/>
                  <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => v === 'actual' ? 'প্রকৃত বিক্রি' : 'পূর্বাভাস (AI ট্রেন্ড)'}/>
                  <Line type="monotone" dataKey="actual" stroke="#059669" strokeWidth={2} dot={false} connectNulls/>
                  <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls/>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Top-selling products + best day of the week ──────── */}
      {!loading && filtered.length > 0 && (
        <div className="max-sm:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-[13px] font-bold text-gray-800 bengali flex items-center gap-1.5 mb-3">
              <Trophy size={14} className="text-amber-500"/> {tr('সবচেয়ে বেশি বিক্রি হওয়া পণ্য')}
            </h3>
            <div className="space-y-2">
              {topProducts.map((p, i) => {
                const hideOnPhone = i >= 3
                const pct = topProducts[0].revenue ? (p.revenue / topProducts[0].revenue) * 100 : 0
                return (
                  <div key={p.name} className={hideOnPhone ? 'max-sm:hidden' : ''}>
                    <div className="flex justify-between text-[12px] mb-0.5">
                      <span className="font-semibold text-gray-700 bengali truncate">{i + 1}. {p.name}</span>
                      <span className="font-bold text-gray-900 flex-shrink-0 ml-2">₹{p.revenue.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }}/>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="max-sm:hidden bg-white rounded-2xl border border-gray-100 p-4">
            <h3 className="text-[13px] font-bold text-gray-800 bengali flex items-center gap-1.5 mb-3">
              <CalendarDays size={14} className="text-indigo-500"/> {tr('সপ্তাহের কোন দিন সেরা?')}
            </h3>
            <div className="text-[12px] text-gray-500 bengali mb-3">
              {tr('গত ৯০ দিনে')} <b className="text-indigo-600">{bestWeekday.best.day}{tr('বার')}</b>{tr('-এ গড়ে সবচেয়ে বেশি বিক্রি হয়েছে')}
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {bestWeekday.avgs.map(d => {
                const maxAvg = Math.max(...bestWeekday.avgs.map(x => x.avg), 1)
                const h = Math.max(4, (d.avg / maxAvg) * 100)
                const isBest = d.day === bestWeekday.best.day
                return (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <div className={`w-full rounded-t-md ${isBest ? 'bg-indigo-500' : 'bg-indigo-100'}`} style={{ height: `${h}%` }}/>
                    <span className={`text-[10px] bengali ${isBest ? 'font-bold text-indigo-600' : 'text-gray-400'}`}>{d.day}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <Clock size={32} className="mx-auto text-gray-300 mb-2"/>
          <p className="text-gray-400 text-sm bengali">{tr('এই সময়ে কোনো বিক্রি রেকর্ড নেই।')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col">
          <div className="flex items-center justify-between px-3.5 pt-3 max-sm:pt-2 pb-2 border-b border-gray-50 shrink-0">
            <h3 className="text-[13px] font-bold text-gray-800 bengali flex items-center gap-1.5"><Clock size={14} className="text-indigo-500"/> {tr('সাম্প্রতিক বিক্রি')}</h3>
            <span className="text-[11px] text-gray-400 bengali">{filtered.length}{tr('টি')}</span>
          </div>
          <div className="divide-y divide-gray-50 max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto">
          {filtered.slice(0, 100).map((s, idx) => (
            <div key={s.id} className={`flex items-center justify-between p-3.5 max-sm:p-3 gap-2.5 `}>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-base flex-shrink-0">🧾</div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-800 text-[13px] bengali truncate">{s.item_name}</div>
                <div className="text-[11px] text-gray-400 bengali mt-0.5">
                  {s.sale_date} · {s.quantity} × ₹{s.unit_price}
                  {s.agent_id && agentNameById[s.agent_id] ? ` · ${agentNameById[s.agent_id]}` : ''}
                  {s.notes ? ` · ${s.notes}` : ''}
                </div>
              </div>
              <div className="font-extrabold text-gray-900 text-[14px] flex-shrink-0">₹{Number(s.total_amount).toFixed(0)}</div>
              <button onClick={() => setBillFor(s)} title={tr('ইনভয়েস / বিল')}
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Printer size={14}/>
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* Invoice action sheet */}
      {billFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setBillFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{tr('ইনভয়েস —')} {billFor.item_name}</h3>
              <button onClick={() => setBillFor(null)}><X size={18} className="text-gray-400"/></button>
            </div>
            <label className="flex items-center gap-2 mb-4 text-[13px] text-gray-600 bengali">
              <input type="checkbox" checked={withGst} onChange={e => setWithGst(e.target.checked)} className="rounded"/>
              {tr('GST (18%) সহ')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { handlePrint(billFor); setBillFor(null) }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali">
                <Printer size={14}/> {tr('প্রিন্ট করুন')}
              </button>
              <button onClick={() => { handleWhatsApp(billFor); setBillFor(null) }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-[13px] bengali">
                <MessageCircle size={14}/> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
