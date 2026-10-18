'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  ComposedChart, Bar, Line, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import {
  FileText, ShoppingCart, Package, Users, TrendingUp, TrendingDown, Download,
  Printer, Filter, Loader2, RefreshCw, Calendar,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

import { tr } from '@/lib/i18n/tr'
/**
 * Cross-agent "রিপোর্ট ও হিসাব" dashboard.
 *
 * Reads every sales/purchase/dues source across all agents (see the table
 * list in load()) and rolls them into one view. Definitions, so the numbers
 * are never a mystery:
 *  - মোট বিক্রি  = sum of sales in the selected date range
 *  - মোট ক্রয়   = stock_purchases (auto-logged when stock goes up) +
 *                  kapor_suppliers orders + manual expenses in 'stock' category
 *  - আনুমানিক লাভ = বিক্রি − ক্রয় − অন্যান্য খরচ (an estimate, not accounting)
 *  - মোট বাকি   = all-time outstanding dues (not limited to the date range)
 */

export interface AgentInfo { name: string; icon: string; color: string }

interface SaleRow { agent: string; date: string; amount: number; due: number; customer: string; item: string; qty: number; unit: string; prodOnly?: boolean }
interface CostRow { agent: string; date: string; amount: number; kind: 'purchase' | 'expense' }
interface DueRow { agent: string; customer: string; due: number; date: string }
interface LowRow { agent: string; name: string; qty: number; min: number; unit: string }

const OTHER = 'other'
const DEFAULT_CUSTOMERS = new Set(['', 'অজানা', 'নগদ', 'নগদ কাস্টমার', 'unknown'])
type Gran = 'day' | 'week' | 'month'

// ── date helpers (local dates as YYYY-MM-DD strings) ──────────────
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => new Date(s + 'T00:00:00')
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d) }
const diffDays = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000)
const dShort = (s: string) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const money = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN')
const num = (v: any) => Number(v || 0)
const dateOf = (ts: string) => (ts || '').slice(0, 10)

async function fetchAll<T>(build: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < 10; i++) {
    const { data, error } = await build(i * 1000, i * 1000 + 999)
    if (error) { console.error('ReportsHub fetch:', error.message || error); break }
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out
}

function trendPct(cur: number, prev: number): number | null {
  if (!prev) return null
  return ((cur - prev) / prev) * 100
}

function TrendBadge({ v }: { v: number | null }) {
  if (v === null) return null
  const up = v >= 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {Math.abs(v).toFixed(0)}%
    </span>
  )
}

function GranSelect({ value, onChange }: { value: Gran; onChange: (g: Gran) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value as Gran)}
      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bengali bg-white">
      <option value="day">{tr('দিন ভিত্তিক')}</option>
      <option value="week">{tr('সপ্তাহ ভিত্তিক')}</option>
      <option value="month">{tr('মাস ভিত্তিক')}</option>
    </select>
  )
}

function Panel({ title, sub, children, right }: { title: string; sub?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="border-l-2 border-indigo-500 pl-2">
          <div className="font-extrabold text-gray-900 text-sm bengali">{title}</div>
          {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

export default function ReportsHub({ userId, agentInfo }: { userId: string; agentInfo: Record<string, AgentInfo> }) {
  const now = ymd(new Date())
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return ymd(d) })
  const [to, setTo] = useState(now)
  const [agentFilter, setAgentFilter] = useState('all')
  const [showPresets, setShowPresets] = useState(false)
  const [granA, setGranA] = useState<Gran>('day')
  const [granB, setGranB] = useState<Gran>('day')
  const [loading, setLoading] = useState(true)

  const [sales, setSales] = useState<SaleRow[]>([])
  const [costs, setCosts] = useState<CostRow[]>([])
  const [dues, setDues] = useState<DueRow[]>([])
  const [low, setLow] = useState<LowRow[]>([])
  const [costByName, setCostByName] = useState<Record<string, number>>({})

  // Previous period of equal length, for the ↑/↓ % badges
  const len = Math.max(1, diffDays(from, to) + 1)
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(len - 1))

  const load = async () => {
    if (!from || !to || from > to) return
    setLoading(true)
    const gte = prevFrom, lte = to
    const [ds, ms, ks, ho, cp, sp, ks2, ex, cust, cre, si, hs, pm] = await Promise.all([
      fetchAll<any>((a, b) => supabase.from('daily_sales').select('agent_id,sale_date,total_amount,item_name,quantity').eq('user_id', userId).gte('sale_date', gte).lte('sale_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('mishti_sales').select('agent_id,sale_date,total_amount,due_amount,customer_name,item_name,quantity_kg').eq('user_id', userId).gte('sale_date', gte).lte('sale_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('kapor_sales').select('agent_id,sale_date,total_amount,due_amount,customer_name,item_name,qty').eq('user_id', userId).gte('sale_date', gte).lte('sale_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('hotel_orders').select('agent_id,created_at,total_amount,due_amount,customer_name,items').eq('user_id', userId).gte('created_at', gte).lte('created_at', lte + 'T23:59:59').range(a, b)),
      fetchAll<any>((a, b) => supabase.from('crm_purchases').select('agent_id,customer_id,purchase_date,total_amount,due_amount,item_name,quantity,unit').eq('user_id', userId).gte('purchase_date', gte).lte('purchase_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('stock_purchases').select('agent_id,purchase_date,total_cost').eq('user_id', userId).gte('purchase_date', gte).lte('purchase_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('kapor_suppliers').select('agent_id,order_date,cost_total').eq('user_id', userId).gte('order_date', gte).lte('order_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('expenses').select('agent_id,expense_date,amount,category').eq('user_id', userId).gte('expense_date', gte).lte('expense_date', lte).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('crm_customers').select('id,name').eq('user_id', userId).range(a, b)),
      // Outstanding dues — all time, not date-limited
      fetchAll<any>((a, b) => supabase.from('credit_entries').select('agent_id,customer_name,amount,paid_amount,created_at').eq('user_id', userId).neq('status', 'paid').range(a, b)),
      fetchAll<any>((a, b) => supabase.from('stock_items').select('agent_id,item_name,current_qty,min_qty,unit,unit_cost').eq('user_id', userId).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('hotel_stock').select('name,quantity,min_quantity,unit,cost_per_unit').eq('user_id', userId).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('pharmacy_medicines').select('name,stock,min_stock,unit,cost_price').eq('user_id', userId).range(a, b)),
    ])
    const [mDue, kDue, hDue, cDue] = await Promise.all([
      fetchAll<any>((a, b) => supabase.from('mishti_sales').select('agent_id,customer_name,due_amount,sale_date').eq('user_id', userId).gt('due_amount', 0).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('kapor_sales').select('agent_id,customer_name,due_amount,sale_date').eq('user_id', userId).gt('due_amount', 0).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('hotel_orders').select('agent_id,customer_name,due_amount,created_at').eq('user_id', userId).gt('due_amount', 0).range(a, b)),
      fetchAll<any>((a, b) => supabase.from('crm_purchases').select('agent_id,customer_id,due_amount,purchase_date').eq('user_id', userId).gt('due_amount', 0).range(a, b)),
    ])

    const custName: Record<string, string> = {}
    cust.forEach((c: any) => { custName[c.id] = c.name })
    const ag = (v: any) => v || OTHER

    const s: SaleRow[] = []
    ds.forEach(r => s.push({ agent: ag(r.agent_id), date: r.sale_date, amount: num(r.total_amount), due: 0, customer: '', item: r.item_name || '', qty: num(r.quantity), unit: '' }))
    ms.forEach(r => s.push({ agent: ag(r.agent_id || LIBRARY_AGENT_IDS.mishti), date: r.sale_date, amount: num(r.total_amount), due: num(r.due_amount), customer: r.customer_name || '', item: r.item_name || '', qty: num(r.quantity_kg), unit: 'কেজি' }))
    ks.forEach(r => s.push({ agent: ag(r.agent_id || LIBRARY_AGENT_IDS.kapor), date: r.sale_date, amount: num(r.total_amount), due: num(r.due_amount), customer: r.customer_name || '', item: r.item_name || '', qty: num(r.qty), unit: 'পিস' }))
    cp.forEach(r => s.push({ agent: ag(r.agent_id), date: r.purchase_date, amount: num(r.total_amount), due: num(r.due_amount), customer: custName[r.customer_id] || '', item: r.item_name || '', qty: num(r.quantity), unit: r.unit || '' }))
    ho.forEach(r => {
      const agent = ag(r.agent_id || LIBRARY_AGENT_IDS.hotel), date = dateOf(r.created_at)
      // one row per order for the totals…
      s.push({ agent, date, amount: num(r.total_amount), due: num(r.due_amount), customer: r.customer_name || '', item: '', qty: 0, unit: '' })
      // …and per-line rows (excluded from totals) so the hotel's dishes rank in "top products"
      let items: any[] = []
      try { items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []) } catch { items = [] }
      items.forEach((it: any) => s.push({ agent, date, amount: num(it.qty) * num(it.price), due: 0, customer: '', item: it.name || '', qty: num(it.qty), unit: '', prodOnly: true }))
    })
    setSales(s)

    const c: CostRow[] = []
    sp.forEach(r => c.push({ agent: ag(r.agent_id), date: r.purchase_date, amount: num(r.total_cost), kind: 'purchase' }))
    ks2.forEach(r => c.push({ agent: ag(r.agent_id || LIBRARY_AGENT_IDS.kapor), date: r.order_date, amount: num(r.cost_total), kind: 'purchase' }))
    ex.forEach(r => c.push({ agent: ag(r.agent_id), date: r.expense_date, amount: num(r.amount), kind: r.category === 'stock' ? 'purchase' : 'expense' }))
    setCosts(c)

    const d: DueRow[] = []
    cre.forEach(r => { const v = num(r.amount) - num(r.paid_amount); if (v > 0) d.push({ agent: ag(r.agent_id), customer: r.customer_name || 'অজানা', due: v, date: dateOf(r.created_at) }) })
    mDue.forEach(r => d.push({ agent: ag(r.agent_id || LIBRARY_AGENT_IDS.mishti), customer: r.customer_name || 'অজানা', due: num(r.due_amount), date: r.sale_date }))
    kDue.forEach(r => d.push({ agent: ag(r.agent_id || LIBRARY_AGENT_IDS.kapor), customer: r.customer_name || 'অজানা', due: num(r.due_amount), date: r.sale_date }))
    hDue.forEach(r => d.push({ agent: ag(r.agent_id || LIBRARY_AGENT_IDS.hotel), customer: r.customer_name || 'অজানা', due: num(r.due_amount), date: dateOf(r.created_at) }))
    cDue.forEach(r => d.push({ agent: ag(r.agent_id), customer: custName[r.customer_id] || 'অজানা', due: num(r.due_amount), date: r.purchase_date }))
    setDues(d)

    const l: LowRow[] = []
    si.forEach(r => { if (num(r.current_qty) <= num(r.min_qty)) l.push({ agent: ag(r.agent_id), name: r.item_name, qty: num(r.current_qty), min: num(r.min_qty), unit: r.unit || '' }) })
    hs.forEach(r => { if (num(r.quantity) <= num(r.min_quantity)) l.push({ agent: LIBRARY_AGENT_IDS.hotel, name: r.name, qty: num(r.quantity), min: num(r.min_quantity), unit: r.unit || '' }) })
    pm.forEach(r => { if (num(r.stock) <= num(r.min_stock)) l.push({ agent: LIBRARY_AGENT_IDS.pharmacy, name: r.name, qty: num(r.stock), min: num(r.min_stock), unit: r.unit || '' }) })
    setLow(l)

    // name → unit cost, so top-product profit can be estimated
    const cm: Record<string, number> = {}
    hs.forEach(r => { if (num(r.cost_per_unit) > 0) cm[String(r.name).toLowerCase()] = num(r.cost_per_unit) })
    pm.forEach(r => { if (num(r.cost_price) > 0) cm[String(r.name).toLowerCase()] = num(r.cost_price) })
    si.forEach(r => { if (num(r.unit_cost) > 0) cm[String(r.item_name).toLowerCase()] = num(r.unit_cost) })
    setCostByName(cm)
    setLoading(false)
  }

  useEffect(() => { load() /* eslint-disable-next-line */ }, [userId, from, to])

  // ── derived numbers ─────────────────────────────────────────────
  const D = useMemo(() => {
    const okAgent = (a: string) => agentFilter === 'all' || a === agentFilter
    const inCur = (d: string) => d >= from && d <= to
    const inPrev = (d: string) => d >= prevFrom && d <= prevTo
    const S = sales.filter(r => okAgent(r.agent))
    const C = costs.filter(r => okAgent(r.agent))
    const totals = (pred: (d: string) => boolean) => {
      const sale = S.filter(r => !r.prodOnly && pred(r.date)).reduce((a, r) => a + r.amount, 0)
      const purchase = C.filter(r => r.kind === 'purchase' && pred(r.date)).reduce((a, r) => a + r.amount, 0)
      const expense = C.filter(r => r.kind === 'expense' && pred(r.date)).reduce((a, r) => a + r.amount, 0)
      return { sale, purchase, expense, profit: sale - purchase - expense }
    }
    const cur = totals(inCur), prev = totals(inPrev)
    const dueList = dues.filter(r => okAgent(r.agent))
    const dueTotal = dueList.reduce((a, r) => a + r.due, 0)

    // bucketed series for the charts
    const series = (gran: Gran) => {
      const keyOf = (d: string) => gran === 'day' ? d : gran === 'month' ? d.slice(0, 7) : `w${Math.floor(diffDays(from, d) / 7)}`
      const labelOf = (d: string) => gran === 'day' ? dShort(d) : gran === 'month' ? parse(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : dShort(d)
      const order: string[] = []
      const map: Record<string, { label: string; sale: number; purchase: number; profit: number }> = {}
      for (let d = from; d <= to; d = addDays(d, 1)) {
        const k = keyOf(d)
        if (!map[k]) { map[k] = { label: labelOf(d), sale: 0, purchase: 0, profit: 0 }; order.push(k) }
      }
      S.filter(r => !r.prodOnly && inCur(r.date)).forEach(r => { map[keyOf(r.date)].sale += r.amount })
      C.filter(r => inCur(r.date)).forEach(r => { const b = map[keyOf(r.date)]; if (r.kind === 'purchase') b.purchase += r.amount; else b.profit -= r.amount })
      return order.map(k => { const b = map[k]; return { ...b, profit: b.sale - b.purchase + b.profit } })
    }

    // top products
    const pm: Record<string, { name: string; qty: number; amount: number; unit: string }> = {}
    S.filter(r => r.item && inCur(r.date)).forEach(r => {
      const k = r.item.toLowerCase()
      const p = pm[k] || (pm[k] = { name: r.item, qty: 0, amount: 0, unit: r.unit })
      p.qty += r.qty; p.amount += r.amount
    })
    const topProducts = Object.values(pm).sort((a, b) => b.amount - a.amount).slice(0, 5)
      .map(p => { const c = costByName[p.name.toLowerCase()]; return { ...p, profit: c ? p.amount - p.qty * c : null as number | null } })

    // top customer dues (grouped by name)
    const dm: Record<string, { name: string; due: number; oldest: string }> = {}
    dueList.forEach(r => {
      const k = r.customer.toLowerCase()
      const x = dm[k] || (dm[k] = { name: r.customer, due: 0, oldest: r.date || now })
      x.due += r.due; if (r.date && r.date < x.oldest) x.oldest = r.date
    })
    const topDues = Object.values(dm).sort((a, b) => b.due - a.due).slice(0, 5).map(x => ({ ...x, days: Math.max(0, diffDays(x.oldest, now)) }))

    const lowList = low.filter(r => okAgent(r.agent)).sort((a, b) => (a.qty / (a.min || 1)) - (b.qty / (b.min || 1)))

    // per-agent performance
    const ids = new Set<string>()
    S.forEach(r => ids.add(r.agent)); C.forEach(r => ids.add(r.agent)); dueList.forEach(r => ids.add(r.agent))
    const sparkDays = Array.from({ length: 8 }, (_, i) => addDays(to, i - 7))
    const agentRows = Array.from(ids).map(id => {
      const rows = S.filter(r => r.agent === id && !r.prodOnly && inCur(r.date))
      const sale = rows.reduce((a, r) => a + r.amount, 0)
      const purchase = C.filter(r => r.agent === id && r.kind === 'purchase' && inCur(r.date)).reduce((a, r) => a + r.amount, 0)
      const expense = C.filter(r => r.agent === id && r.kind === 'expense' && inCur(r.date)).reduce((a, r) => a + r.amount, 0)
      const custs = new Set(rows.map(r => r.customer.trim().toLowerCase()).filter(c => !DEFAULT_CUSTOMERS.has(c)))
      const due = dueList.filter(r => r.agent === id).reduce((a, r) => a + r.due, 0)
      const spark = sparkDays.map(d => S.filter(r => r.agent === id && !r.prodOnly && r.date === d).reduce((x, r) => x + r.amount, 0))
      return { id, sale, purchase, profit: sale - purchase - expense, customers: custs.size, txns: rows.length, due, spark }
    }).filter(r => r.sale || r.purchase || r.due).sort((a, b) => b.sale - a.sale)

    return { cur, prev, dueTotal, series, topProducts, topDues, lowList, agentRows }
  }, [sales, costs, dues, low, costByName, agentFilter, from, to]) // eslint-disable-line

  const seriesA = useMemo(() => D.series(granA), [D, granA])
  const seriesB = useMemo(() => D.series(granB), [D, granB])
  const info = (id: string): AgentInfo => agentInfo[id] || { name: id === OTHER ? 'অন্যান্য' : 'Agent', icon: '📦', color: '#6366F1' }
  const agentOptions = Object.keys(agentInfo)
  const noData = !loading && D.cur.sale === 0 && D.cur.purchase === 0 && D.dueTotal === 0

  const preset = (k: 'today' | '7' | 'month' | 'lastmonth' | 'year') => {
    const d = new Date()
    if (k === 'today') { setFrom(now); setTo(now) }
    else if (k === '7') { setFrom(addDays(now, -6)); setTo(now) }
    else if (k === 'month') { d.setDate(1); setFrom(ymd(d)); setTo(now) }
    else if (k === 'lastmonth') { const s = new Date(d.getFullYear(), d.getMonth() - 1, 1), e = new Date(d.getFullYear(), d.getMonth(), 0); setFrom(ymd(s)); setTo(ymd(e)) }
    else { setFrom(`${d.getFullYear()}-01-01`); setTo(now) }
    setShowPresets(false)
  }

  // ── exports ─────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const label = agentFilter === 'all' ? 'সব Agent' : info(agentFilter).name
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { বিষয়: 'সময়', মান: `${from} → ${to}` }, { বিষয়: 'Agent', মান: label },
      { বিষয়: 'মোট বিক্রি', মান: D.cur.sale }, { বিষয়: 'মোট ক্রয়', মান: D.cur.purchase },
      { বিষয়: 'অন্যান্য খরচ', মান: D.cur.expense }, { বিষয়: 'আনুমানিক লাভ', মান: D.cur.profit },
      { বিষয়: 'মোট বাকি (সব সময়)', মান: D.dueTotal },
    ]), 'সারসংক্ষেপ')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(D.series('day').map(r => ({ তারিখ: r.label, বিক্রি: r.sale, ক্রয়: r.purchase, লাভ: r.profit }))), 'দৈনিক')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(D.topProducts.map(p => ({ পণ্য: p.name, পরিমাণ: p.qty, বিক্রি: p.amount, লাভ: p.profit ?? '' }))), 'সর্বাধিক বিক্রিত')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(D.topDues.map(p => ({ কাস্টমার: p.name, বাকি: p.due, দিন: p.days }))), 'বাকি')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(D.agentRows.map(r => ({ Agent: info(r.id).name, বিক্রি: r.sale, ক্রয়: r.purchase, লাভ: r.profit, কাস্টমার: r.customers, লেনদেন: r.txns, বাকি: r.due }))), 'Agent')
    XLSX.writeFile(wb, `report-${from}_${to}.xlsx`)
  }

  // Bengali needs a real font, which jsPDF doesn't ship — so "PDF" opens the
  // browser's print dialog (Save as PDF) on a clean HTML version instead.
  const exportPdf = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    const row = (cells: (string | number)[]) => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`
    const label = agentFilter === 'all' ? 'সব Agent' : info(agentFilter).name
    w.document.write(`<html><head><title>রিপোর্ট ও হিসাব</title><style>
      body{font-family:'Noto Sans Bengali',Arial,sans-serif;padding:24px;color:#111}
      h1{font-size:20px;margin:0}h2{font-size:14px;margin:18px 0 6px}p{font-size:12px;color:#666;margin:2px 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}th{background:#f3f4f6}
      .k{display:flex;gap:10px}.k div{flex:1;border:1px solid #ddd;border-radius:8px;padding:8px}.k b{display:block;font-size:16px}
    </style></head><body>
      <h1>রিপোর্ট ও হিসাব</h1><p>${label} · ${from} থেকে ${to}</p>
      <div class="k"><div>মোট বিক্রি<b>${money(D.cur.sale)}</b></div><div>মোট ক্রয়<b>${money(D.cur.purchase)}</b></div>
      <div>মোট বাকি<b>${money(D.dueTotal)}</b></div><div>আনুমানিক লাভ<b>${money(D.cur.profit)}</b></div></div>
      <h2>Agent পারফরম্যান্স</h2><table><tr><th>Agent</th><th>বিক্রি</th><th>ক্রয়</th><th>লাভ</th><th>বাকি</th></tr>
      ${D.agentRows.map(r => row([info(r.id).name, money(r.sale), money(r.purchase), money(r.profit), money(r.due)])).join('')}</table>
      <h2>সর্বাধিক বিক্রিত পণ্য</h2><table><tr><th>পণ্য</th><th>পরিমাণ</th><th>বিক্রি</th></tr>
      ${D.topProducts.map(p => row([p.name, p.qty, money(p.amount)])).join('')}</table>
      <h2>কাস্টমার বাকি</h2><table><tr><th>কাস্টমার</th><th>বাকি</th><th>দিন</th></tr>
      ${D.topDues.map(p => row([p.name, money(p.due), p.days])).join('')}</table>
      <script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }

  // ── stat cards ──────────────────────────────────────────────────
  interface Card { label: string; value: string; trend: number | null; sub: string; icon: ReactNode; bg: string; fg: string; valueColor: string }
  const cards: Card[] = [
    { label: 'মোট বিক্রি', value: money(D.cur.sale), trend: trendPct(D.cur.sale, D.prev.sale), sub: 'গত সময়ের তুলনায়', icon: <ShoppingCart size={20} />, bg: '#EEF2FF', fg: '#4F46E5', valueColor: 'text-gray-900' },
    { label: 'মোট ক্রয়', value: money(D.cur.purchase), trend: trendPct(D.cur.purchase, D.prev.purchase), sub: 'গত সময়ের তুলনায়', icon: <Package size={20} />, bg: '#F5F3FF', fg: '#7C3AED', valueColor: 'text-gray-900' },
    { label: 'মোট বাকি', value: money(D.dueTotal), trend: null, sub: 'সব সময়ের বকেয়া', icon: <Users size={20} />, bg: '#FEF2F2', fg: '#DC2626', valueColor: 'text-red-600' },
    { label: 'আনুমানিক লাভ', value: money(D.cur.profit), trend: trendPct(D.cur.profit, D.prev.profit), sub: 'বিক্রি − ক্রয় − খরচ', icon: <TrendingUp size={20} />, bg: '#F0FDF4', fg: '#16A34A', valueColor: D.cur.profit < 0 ? 'text-red-600' : 'text-emerald-600' },
  ]

  return (
    <div className="space-y-4 min-w-0">
      {/* Header + controls */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><FileText size={22} /></div>
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 bengali">{tr('রিপোর্ট ও হিসাব')}</h1>
            <p className="text-xs text-gray-400 bengali">{tr('আপনার ব্যবসার পূর্ণ হিসাব ও পারফরম্যান্স')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs bengali bg-white max-w-[150px]">
            <option value="all">{tr('সব Agent')}</option>
            {agentOptions.map(id => <option key={id} value={id}>{agentInfo[id].name}</option>)}
          </select>
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-2.5 py-1.5 bg-white text-xs">
            <Calendar size={13} className="text-gray-400" />
            <input type="date" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} className="outline-none bg-transparent" />
            <span className="text-gray-300">–</span>
            <input type="date" value={to} min={from} max={now} onChange={e => e.target.value && setTo(e.target.value)} className="outline-none bg-transparent" />
          </div>
          <button onClick={() => setShowPresets(v => !v)} className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 bg-white bengali">
            <Filter size={13} /> {tr('ফিল্টার')}
          </button>
          <button onClick={load} title="Refresh" className="border border-gray-200 rounded-xl p-2 text-gray-500 bg-white">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <button onClick={exportPdf} className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-3 py-2 text-xs font-bold bengali"><Printer size={13} /> {tr('PDF এক্সপোর্ট')}</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold bengali"><Download size={13} /> {tr('Excel এক্সপোর্ট')}</button>
        </div>
      </div>

      {showPresets && (
        <div className="flex flex-wrap gap-2">
          {([['today', 'আজ'], ['7', 'শেষ ৭ দিন'], ['month', 'এই মাস'], ['lastmonth', 'গত মাস'], ['year', 'এই বছর']] as const).map(([k, l]) => (
            <button key={k} onClick={() => preset(k)} className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-bold text-gray-600 bengali">{l}</button>
          ))}
        </div>
      )}

      {noData && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-3 py-2 bengali">
          {tr('এই সময়ে কোনো বিক্রি, ক্রয় বা বাকির তথ্য নেই। তারিখ বদলে দেখুন।')}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: c.bg, color: c.fg }}>{c.icon}</div>
            <div className="min-w-0">
              <div className="text-xs text-gray-500 bengali">{c.label}</div>
              <div className={`text-xl font-extrabold truncate ${c.valueColor}`}>{c.value}</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-gray-400 bengali">{c.sub}</span>
                <TrendBadge v={c.trend} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 min-w-0">
          <Panel title={tr('বিক্রি বনাম ক্রয়')} sub="Sales vs Purchase" right={<GranSelect value={granA} onChange={setGranA} />}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={seriesA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={45} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sale" name="বিক্রি" fill="#6366F1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="purchase" name="ক্রয়" fill="#F472B6" radius={[3, 3, 0, 0]} />
                  <Line dataKey="profit" name="লাভ" stroke="#16A34A" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
        <div className="lg:col-span-2 min-w-0">
          <Panel title={tr('লাভের ট্রেন্ড')} sub="Profit Trend" right={<GranSelect value={granB} onChange={setGranB} />}>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesB}>
                  <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#16A34A" stopOpacity={0.3} /><stop offset="95%" stopColor="#16A34A" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={45} />
                  <Tooltip formatter={(v: any) => money(Number(v))} />
                  <Area dataKey="profit" name="লাভ" stroke="#16A34A" strokeWidth={2} fill="url(#pg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>

      {/* Three lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title={tr('সর্বাধিক বিক্রিত পণ্য')} sub="Top Selling Products">
          {D.topProducts.length === 0 ? <Empty /> : (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 text-left"><th className="py-1 w-5">#</th><th>{tr('পণ্য')}</th><th>{tr('পরিমাণ')}</th><th>{tr('বিক্রি')}</th><th>{tr('লাভ')}</th></tr></thead>
              <tbody>{D.topProducts.map((p, i) => (
                <tr key={p.name} className="border-t border-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="font-semibold text-gray-800 bengali truncate max-w-[90px]">{p.name}</td>
                  <td>{Math.round(p.qty * 10) / 10}</td>
                  <td>{money(p.amount)}</td>
                  <td className="text-emerald-600 font-bold">{p.profit === null ? '—' : money(p.profit)}</td>
                </tr>))}</tbody>
            </table>
          )}
        </Panel>
        <Panel title={tr('কাস্টমার বাকি (শীর্ষ ৫)')} sub="Top Customer Dues">
          {D.topDues.length === 0 ? <Empty text="কোনো বাকি নেই 🎉" /> : (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 text-left"><th className="py-1 w-5">#</th><th>{tr('কাস্টমার')}</th><th>{tr('বাকি')}</th><th>{tr('দিন')}</th></tr></thead>
              <tbody>{D.topDues.map((p, i) => (
                <tr key={p.name} className="border-t border-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="font-semibold text-gray-800 bengali truncate max-w-[110px]">{p.name}</td>
                  <td className="text-red-600 font-bold">{money(p.due)}</td>
                  <td>{p.days}</td>
                </tr>))}</tbody>
            </table>
          )}
        </Panel>
        <Panel title={tr('কম স্টক পণ্য')} sub="Low Stock Products">
          {D.lowList.length === 0 ? <Empty text="সব স্টক ঠিক আছে ✅" /> : (
            <table className="w-full text-xs">
              <thead><tr className="text-gray-400 text-left"><th className="py-1 w-5">#</th><th>{tr('পণ্য')}</th><th>{tr('বর্তমান')}</th><th>{tr('ন্যূনতম')}</th></tr></thead>
              <tbody>{D.lowList.slice(0, 5).map((p, i) => (
                <tr key={p.agent + p.name} className="border-t border-gray-50">
                  <td className="py-2 text-gray-400">{i + 1}</td>
                  <td className="font-semibold text-gray-800 bengali truncate max-w-[100px]">{p.name}</td>
                  <td className="text-red-600 font-bold">{p.qty} {p.unit}</td>
                  <td className="text-gray-500">{p.min} {p.unit}</td>
                </tr>))}</tbody>
            </table>
          )}
          {D.lowList.length > 5 && <div className="text-[11px] text-gray-400 mt-2 bengali">{tr('আরও')} {D.lowList.length - 5}{tr('টি পণ্য কম স্টকে')}</div>}
        </Panel>
      </div>

      {/* Agent performance */}
      <Panel title={tr('Agent পারফরম্যান্স')} sub="Agent Performance">
        {D.agentRows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[640px]">
              <thead><tr className="text-gray-400 text-left">
                <th className="py-1 w-6">#</th><th>Agent</th><th>{tr('বিক্রি')}</th><th>{tr('ক্রয়')}</th><th>{tr('লাভ')}</th><th>{tr('কাস্টমার')}</th><th>{tr('লেনদেন')}</th><th>{tr('বাকি')}</th><th></th>
              </tr></thead>
              <tbody>{D.agentRows.map((r, i) => {
                const a = info(r.id); const max = Math.max(1, ...r.spark)
                return (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="py-2.5 text-gray-400">{i + 1}</td>
                    <td><div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm" style={{ background: a.color + '22' }}>{a.icon}</span>
                      <span className="font-semibold text-gray-800 bengali">{a.name}</span></div></td>
                    <td>{money(r.sale)}</td>
                    <td>{r.purchase ? money(r.purchase) : <span className="text-gray-300">—</span>}</td>
                    <td className={`font-bold ${r.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(r.profit)}</td>
                    <td>{r.customers || <span className="text-gray-300">—</span>}</td>
                    <td>{r.txns}</td>
                    <td className="text-red-600 font-bold">{money(r.due)}</td>
                    <td><div className="flex items-end gap-0.5 h-6">
                      {r.spark.map((v, j) => <span key={j} className="w-1.5 rounded-sm bg-indigo-500" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v ? 1 : 0.2 }} />)}
                    </div></td>
                  </tr>)
              })}</tbody>
            </table>
          </div>
        )}
      </Panel>

      <p className="text-[11px] text-gray-400 bengali leading-relaxed">
        {tr('* "মোট ক্রয়" গণনা হয় স্টক বাড়ানো (স্বয়ংক্রিয় লগ), কাপড়ের দোকানের সরবরাহকারী অর্ডার ও "stock" ক্যাটাগরির খরচ থেকে — মিষ্টির দোকানের জন্য ক্রয়ের উৎস এখনও নেই। লাভ একটি আনুমানিক হিসাব (বিক্রি − ক্রয় − অন্যান্য খরচ), অ্যাকাউন্টিং রিপোর্ট নয়। ক্রয়ের তথ্য শুধু মাইগ্রেশনের পর থেকে জমা হচ্ছে।')}
      </p>
    </div>
  )
}

function Empty({ text = 'এই সময়ে কোনো তথ্য নেই' }: { text?: string }) {
  return <div className="text-center text-gray-400 text-xs py-8 bengali">{text}</div>
}
