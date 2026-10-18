'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { readCache, writeCache, useIsoLayoutEffect } from '@/lib/swrCache'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import {
  Sparkles, ShoppingCart, PackagePlus, UserPlus, FileText, Wallet,
  CalendarClock, BarChart2, MoreHorizontal, ArrowRight,
} from 'lucide-react'

import { tr } from '@/lib/i18n/tr'
interface LibAgentMeta { slug: string; name: string; icon: string }
interface CustomAgentMeta { id: string; name: string; icon: string }
interface ActivityItem { icon: string; agentName: string; customer: string; label: string; amount: number; ts: number; hasDue: boolean }
interface LowStockRow { icon: string; agentName: string; itemName: string; qty: number; minQty: number; unit: string }
interface TrendPoint { day: string; label: string; total: number }
interface CategorySlice { name: string; value: number }
interface AgentOption { key: string; label: string; icon: string }
export interface TaskItem { id: string; tone: 'warning' | 'success' | 'info'; text: string; actionId?: string }
export interface RecentActivityItem { id: string; icon: string; text: string; ts: number }

export interface OverviewStats {
  totalStockItems: number
  totalCustomers: number
  expiringSoon: number
  lowStockTotal: number
  yesterdayTotal: number
  newStockThisWeek: number
  newCustomersThisWeek: number
}

const DAY_LABEL_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']
const DONUT_COLORS = ['#6366F1', '#D946EF', '#F59E0B', '#10B981', '#0EA5E9', '#94A3B8']

// Rough keyword bucketing for the grocery/dokan vertical — there's no real
// `category` column on stock_items yet, so this is a heuristic on the item
// name just for the donut chart's visual breakdown. Swap for a real
// `category` column later if you want this to be exact.
function bucketCategory(name: string): string {
  const n = (name || '').toLowerCase()
  if (/চাল|rice/.test(n)) return 'চাল'
  if (/আটা|ময়দা|flour/.test(n)) return 'আটা'
  if (/ডাল|dal|lentil/.test(n)) return 'ডাল'
  if (/তেল|oil/.test(n)) return 'তেল'
  if (/মসলা|লবণ|হলুদ|মরিচ|জিরা|spice|salt/.test(n)) return 'মসলা'
  return 'অন্যান্য'
}

// Simple trend-based estimate for tomorrow (linear least-squares fit over
// the known points) plus a first-half vs second-half % change — a rough
// projection, not a trained model.
function computeTrendMeta(points: TrendPoint[]) {
  const n = points.length
  if (n === 0) return { prediction: 0, trendPct: 0 }
  const xs = points.map((_, i) => i)
  const ys = points.map(p => p.total)
  const xMean = xs.reduce((s, x) => s + x, 0) / n
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - xMean) * (ys[i] - yMean); den += (xs[i] - xMean) ** 2 }
  const slope = den === 0 ? 0 : num / den
  const intercept = yMean - slope * xMean
  const prediction = Math.max(0, Math.round(slope * n + intercept))
  const firstHalf = points.slice(0, 3).reduce((s, p) => s + p.total, 0)
  const secondHalf = points.slice(4).reduce((s, p) => s + p.total, 0)
  const trendPct = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0
  return { prediction, trendPct }
}

export const QUICK_ACTIONS = [
  { id: 'sales',   label: 'নতুন বিক্রি',    icon: <ShoppingCart size={18}/>, tint: 'bg-emerald-50 text-emerald-600' },
  { id: 'stock',   label: 'স্টক যোগ',       icon: <PackagePlus size={18}/>,  tint: 'bg-indigo-50 text-indigo-600' },
  { id: 'customer',label: 'গ্রাহক যোগ',     icon: <UserPlus size={18}/>,     tint: 'bg-fuchsia-50 text-fuchsia-600' },
  { id: 'invoice', label: 'ইনভয়েস তৈরি',   icon: <FileText size={18}/>,     tint: 'bg-rose-50 text-rose-600' },
  { id: 'expense', label: 'খরচ যোগ',        icon: <Wallet size={18}/>,       tint: 'bg-amber-50 text-amber-600' },
  { id: 'expiry',  label: 'মেয়াদ চেক',      icon: <CalendarClock size={18}/>,tint: 'bg-sky-50 text-sky-600' },
  { id: 'reports', label: 'রিপোর্ট দেখ',     icon: <BarChart2 size={18}/>,    tint: 'bg-violet-50 text-violet-600' },
  { id: 'more',    label: 'আরও',            icon: <MoreHorizontal size={18}/>,tint: 'bg-gray-100 text-gray-500' },
]

// Self-contained: given the currently-active library agents + custom agents,
// fetches each one's real underlying data and renders:
//  - a 7-day sales trend chart (filterable per agent) with a next-day estimate
//  - a product-category donut (heuristic bucketing, see bucketCategory)
//  - a quick-actions row (delegates navigation to onQuickAction)
//  - "recent sales" (with a paid/due status per row) + "low stock" tables
//  - "today's important tasks", generated from the same underlying data
// Also bubbles totalStockItems / totalCustomers / expiringSoon / lowStockTotal
// / yesterdayTotal / newStockThisWeek / newCustomersThisWeek up to the parent
// via onStats (for the KPI cards), and the tasks list via onTasks (so the
// parent can lay it out next to the agents grid).
export default function OverviewInsights({ userId, libraryAgents, customAgents, onStats, onQuickAction, onTasks, onRecentActivity, tasksCard }: {
  userId: string
  libraryAgents: LibAgentMeta[]
  customAgents: CustomAgentMeta[]
  onStats?: (stats: OverviewStats) => void
  onQuickAction?: (actionId: string) => void
  onTasks?: (tasks: TaskItem[]) => void
  onRecentActivity?: (items: RecentActivityItem[]) => void
  /** Optional third card for the bottom row (today's tasks), rendered by the parent. */
  tasksCard?: ReactNode
}) {
  const [loading, setLoading] = useState(true)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lowStock, setLowStock] = useState<LowStockRow[]>([])
  const [trendByAgent, setTrendByAgent] = useState<Record<string, TrendPoint[]>>({})
  const [selectedAgentKey, setSelectedAgentKey] = useState('all')
  const [categories, setCategories] = useState<CategorySlice[]>([])

  const agentOptions: AgentOption[] = useMemo(() => [
    { key: 'all', label: 'সব এজেন্ট', icon: '📊' },
    ...libraryAgents.map(l => ({ key: `lib:${l.slug}`, label: l.name, icon: l.icon })),
    ...customAgents.map(c => ({ key: `custom:${c.id}`, label: c.name, icon: c.icon })),
  ], [libraryAgents, customAgents])

  const trend = trendByAgent[selectedAgentKey] || trendByAgent['all'] || []
  const { prediction, trendPct } = useMemo(() => computeTrendMeta(trend), [trend])

  useIsoLayoutEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, libraryAgents.map(l => l.slug).join(','), customAgents.map(c => c.id).join(',')])

  // Reset the chart filter back to "all" if the agent it was filtered to
  // disappears (deactivated / deleted) — avoids showing a stale empty chart.
  useEffect(() => {
    if (selectedAgentKey !== 'all' && !agentOptions.some(a => a.key === selectedAgentKey)) setSelectedAgentKey('all')
  }, [agentOptions, selectedAgentKey])

  const cacheKey = `overview:${userId}:${libraryAgents.map(l => l.slug).join(',')}:${customAgents.map(c => c.id).join(',')}`

  const load = async () => {
    const cached = readCache<any>(cacheKey)
    if (cached) {
      setActivity(cached.activity || []); setLowStock(cached.lowStock || [])
      setTrendByAgent(cached.trendByAgent || {}); setCategories(cached.categories || [])
      if (cached.stats) onStats?.(cached.stats)
      if (cached.tasks) onTasks?.(cached.tasks)
      if (cached.recent) onRecentActivity?.(cached.recent)
      setLoading(false)
    } else setLoading(true)
    try {
      const dayKey = (d: string | Date) => new Date(d).toISOString().slice(0, 10)
      const dayOrder: string[] = []
      for (let i = 6; i >= 0; i--) dayOrder.push(dayKey(new Date(Date.now() - i * 86400000)))
      const emptyBucket = () => Object.fromEntries(dayOrder.map(k => [k, 0])) as Record<string, number>

      const bucketAll = emptyBucket()
      const bucketByKey: Record<string, Record<string, number>> = {}
      for (const opt of agentOptions) if (opt.key !== 'all') bucketByKey[opt.key] = emptyBucket()

      const sevenAgoISO = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
      const sevenAgoFullISO = new Date(Date.now() - 6 * 86400000).toISOString()
      const thisMonthYYYYMM = new Date().toISOString().slice(0, 7)
      const nextMonthYYYYMM = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 7)
      const yesterdayStart = new Date(Date.now() - 1 * 86400000); yesterdayStart.setHours(0, 0, 0, 0)
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

      const allActivity: ActivityItem[] = []
      const allLowStock: LowStockRow[] = []
      const allStockNames: string[] = []
      let expiringSoon = 0
      let newStockThisWeek = 0
      let yesterdayTotal = 0

      const addTrend = (key: string, dateStr: string, amt: number) => {
        const k = dayKey(dateStr)
        if (k in bucketAll) bucketAll[k] += amt
        if (bucketByKey[key] && k in bucketByKey[key]) bucketByKey[key][k] += amt
        const t = new Date(dateStr).getTime()
        if (t >= yesterdayStart.getTime() && t < todayStart.getTime()) yesterdayTotal += amt
      }
      const isRecent = (dateStr?: string | null) => !!dateStr && new Date(dateStr).getTime() >= new Date(sevenAgoFullISO).getTime()

      await Promise.all(libraryAgents.map(async lib => {
        const key = `lib:${lib.slug}`
        try {
          if (lib.slug === 'dokan-manager') {
            const agentId = LIBRARY_AGENT_IDS.dokan
            const [{ data: sales }, { data: trendRows }, { data: stockRows }] = await Promise.all([
              supabase.from('daily_sales').select('item_name,customer_name,total_amount,created_at').eq('user_id', userId).eq('agent_id', agentId).order('created_at', { ascending: false }).limit(6),
              supabase.from('daily_sales').select('total_amount,created_at').eq('user_id', userId).eq('agent_id', agentId).gte('sale_date', sevenAgoISO),
              supabase.from('stock_items').select('item_name,current_qty,unit,min_qty,last_updated').eq('user_id', userId).eq('agent_id', agentId),
            ])
            ;(sales || []).forEach((s: any) => allActivity.push({ icon: lib.icon, agentName: lib.name, customer: s.customer_name || 'নগদ', label: s.item_name, amount: Number(s.total_amount || 0), ts: new Date(s.created_at).getTime(), hasDue: false }))
            ;(trendRows || []).forEach((r: any) => addTrend(key, r.created_at, Number(r.total_amount || 0)))
            ;(stockRows || []).forEach((r: any) => {
              allStockNames.push(r.item_name)
              if (isRecent(r.last_updated)) newStockThisWeek++
              if (Number(r.current_qty) > 0 && Number(r.current_qty) <= Number(r.min_qty || 5)) allLowStock.push({ icon: lib.icon, agentName: lib.name, itemName: r.item_name, qty: Number(r.current_qty), minQty: Number(r.min_qty || 5), unit: r.unit || '' })
            })
            return
          }
          if (lib.slug === 'hotel-and-dhaba-manager') {
            const [{ data: sales }, { data: trendRows }, { data: stockRows }] = await Promise.all([
              supabase.from('hotel_orders').select('customer_name,total_amount,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
              supabase.from('hotel_orders').select('total_amount,created_at').eq('user_id', userId).gte('created_at', sevenAgoISO),
              supabase.from('hotel_stock').select('name,quantity,unit,min_quantity,created_at').eq('user_id', userId),
            ])
            ;(sales || []).forEach((s: any) => allActivity.push({ icon: lib.icon, agentName: lib.name, customer: s.customer_name || 'নগদ', label: 'অর্ডার', amount: Number(s.total_amount || 0), ts: new Date(s.created_at).getTime(), hasDue: false }))
            ;(trendRows || []).forEach((r: any) => addTrend(key, r.created_at, Number(r.total_amount || 0)))
            ;(stockRows || []).forEach((r: any) => {
              allStockNames.push(r.name)
              if (isRecent(r.created_at)) newStockThisWeek++
              if (Number(r.quantity) > 0 && Number(r.quantity) <= Number(r.min_quantity || 5)) allLowStock.push({ icon: lib.icon, agentName: lib.name, itemName: r.name, qty: Number(r.quantity), minQty: Number(r.min_quantity || 5), unit: r.unit || '' })
            })
            return
          }
          if (lib.slug === 'mishti-dokan-manager') {
            const [{ data: sales }, { data: trendRows }, { data: stockRows }] = await Promise.all([
              supabase.from('mishti_sales').select('item_name,customer_name,total_amount,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
              supabase.from('mishti_sales').select('total_amount,created_at').eq('user_id', userId).gte('sale_date', sevenAgoISO),
              supabase.from('mishti_items').select('name,stock_kg,min_stock_kg,created_at').eq('user_id', userId),
            ])
            ;(sales || []).forEach((s: any) => allActivity.push({ icon: lib.icon, agentName: lib.name, customer: s.customer_name || 'নগদ', label: s.item_name, amount: Number(s.total_amount || 0), ts: new Date(s.created_at).getTime(), hasDue: false }))
            ;(trendRows || []).forEach((r: any) => addTrend(key, r.created_at, Number(r.total_amount || 0)))
            ;(stockRows || []).forEach((r: any) => {
              allStockNames.push(r.name)
              if (isRecent(r.created_at)) newStockThisWeek++
              if (Number(r.stock_kg) > 0 && Number(r.stock_kg) <= Number(r.min_stock_kg || 1)) allLowStock.push({ icon: lib.icon, agentName: lib.name, itemName: r.name, qty: Number(r.stock_kg), minQty: Number(r.min_stock_kg || 1), unit: 'কেজি' })
            })
            return
          }
          if (lib.slug === 'kaporer-dokan-tracker') {
            const [{ data: sales }, { data: trendRows }, { data: stockRows }] = await Promise.all([
              supabase.from('kapor_sales').select('item_name,customer_name,total_amount,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(6),
              supabase.from('kapor_sales').select('total_amount,created_at').eq('user_id', userId).gte('sale_date', sevenAgoISO),
              supabase.from('kapor_products').select('name,stock_qty,min_stock,created_at').eq('user_id', userId),
            ])
            ;(sales || []).forEach((s: any) => allActivity.push({ icon: lib.icon, agentName: lib.name, customer: s.customer_name || 'নগদ', label: s.item_name, amount: Number(s.total_amount || 0), ts: new Date(s.created_at).getTime(), hasDue: false }))
            ;(trendRows || []).forEach((r: any) => addTrend(key, r.created_at, Number(r.total_amount || 0)))
            ;(stockRows || []).forEach((r: any) => {
              allStockNames.push(r.name)
              if (isRecent(r.created_at)) newStockThisWeek++
              if (Number(r.stock_qty) > 0 && Number(r.stock_qty) <= Number(r.min_stock || 5)) allLowStock.push({ icon: lib.icon, agentName: lib.name, itemName: r.name, qty: Number(r.stock_qty), minQty: Number(r.min_stock || 5), unit: 'পিস' })
            })
            return
          }
          if (lib.slug === 'pharmacy-assistant') {
            const [{ data: sales }, { data: trendRows }, { data: stockRows }] = await Promise.all([
              supabase.from('crm_purchases').select('item_name,total_amount,created_at,crm_customers!inner(name,business_type)').eq('user_id', userId).eq('crm_customers.business_type', 'pharmacy').order('created_at', { ascending: false }).limit(6),
              supabase.from('crm_purchases').select('total_amount,created_at,crm_customers!inner(business_type)').eq('user_id', userId).eq('crm_customers.business_type', 'pharmacy').gte('purchase_date', sevenAgoISO),
              supabase.from('pharmacy_medicines').select('name,stock,min_stock,unit,expiry,created_at').eq('user_id', userId),
            ])
            ;(sales || []).forEach((s: any) => allActivity.push({ icon: lib.icon, agentName: lib.name, customer: s.crm_customers?.name || 'নগদ', label: s.item_name, amount: Number(s.total_amount || 0), ts: new Date(s.created_at).getTime(), hasDue: false }))
            ;(trendRows || []).forEach((r: any) => addTrend(key, r.created_at, Number(r.total_amount || 0)))
            ;(stockRows || []).forEach((r: any) => {
              allStockNames.push(r.name)
              if (isRecent(r.created_at)) newStockThisWeek++
              if (Number(r.stock) > 0 && Number(r.stock) <= Number(r.min_stock || 20)) allLowStock.push({ icon: lib.icon, agentName: lib.name, itemName: r.name, qty: Number(r.stock), minQty: Number(r.min_stock || 20), unit: r.unit || '' })
              // expiry stored as 'YYYY-MM' text — count anything expiring this month or next
              if (r.expiry && (r.expiry === thisMonthYYYYMM || r.expiry === nextMonthYYYYMM)) expiringSoon++
            })
            return
          }
        } catch { /* skip a source that fails, don't break the whole widget */ }
      }))

      // Custom ("Build Agent") agents — generic agent_records table
      if (customAgents.length) {
        const ids = customAgents.map(a => a.id)
        const nameOf: Record<string, CustomAgentMeta> = Object.fromEntries(customAgents.map(a => [a.id, a]))
        const [{ data: recent }, { data: trendRows }] = await Promise.all([
          supabase.from('agent_records').select('agent_id,label,amount,recorded_at').eq('user_id', userId).eq('record_type', 'sale').in('agent_id', ids).order('recorded_at', { ascending: false }).limit(8),
          supabase.from('agent_records').select('agent_id,amount,recorded_at').eq('user_id', userId).eq('record_type', 'sale').in('agent_id', ids).gte('recorded_at', sevenAgoISO),
        ])
        ;(recent || []).forEach((r: any) => {
          const a = nameOf[r.agent_id]
          if (a) allActivity.push({ icon: a.icon || '🤖', agentName: a.name, customer: '—', label: r.label || 'বিক্রি', amount: Number(r.amount || 0), ts: new Date(r.recorded_at).getTime(), hasDue: false })
        })
        ;(trendRows || []).forEach((r: any) => { if (nameOf[r.agent_id]) addTrend(`custom:${r.agent_id}`, r.recorded_at, Number(r.amount || 0)) })
      }

      // Total + new customers, and per-customer outstanding dues — shared
      // tables across verticals, fetched once rather than per-agent.
      let totalCustomers = 0
      let newCustomersThisWeek = 0
      const dueByCustomer: Record<string, number> = {}
      try {
        const [{ count }, { count: newCount }, { data: creditRows }] = await Promise.all([
          supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('crm_customers').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', sevenAgoFullISO),
          supabase.from('credit_entries').select('customer_name,amount,paid_amount').eq('user_id', userId),
        ])
        totalCustomers = count || 0
        newCustomersThisWeek = newCount || 0
        ;(creditRows || []).forEach((c: any) => {
          const remaining = Number(c.amount || 0) - Number(c.paid_amount || 0)
          if (remaining > 0) {
            const k = (c.customer_name || '').trim().toLowerCase()
            if (k) dueByCustomer[k] = (dueByCustomer[k] || 0) + remaining
          }
        })
      } catch { /* table may not exist yet for this user's plan */ }

      allActivity.forEach(a => {
        const k = a.customer.trim().toLowerCase()
        a.hasDue = k !== 'নগদ' && k !== '—' && !!dueByCustomer[k]
      })

      allActivity.sort((a, b) => b.ts - a.ts)
      setActivity(allActivity.slice(0, 6))
      setLowStock(allLowStock.slice(0, 6))

      const pointsFromBucket = (bucket: Record<string, number>): TrendPoint[] =>
        dayOrder.map(k => ({ day: k, label: DAY_LABEL_BN[new Date(k).getDay()], total: Math.round(bucket[k]) }))
      const nextTrendByAgent: Record<string, TrendPoint[]> = { all: pointsFromBucket(bucketAll) }
      for (const k of Object.keys(bucketByKey)) nextTrendByAgent[k] = pointsFromBucket(bucketByKey[k])
      setTrendByAgent(nextTrendByAgent)

      // Category donut (heuristic — see bucketCategory)
      const catTotals: Record<string, number> = {}
      allStockNames.forEach(name => {
        const cat = bucketCategory(name)
        catTotals[cat] = (catTotals[cat] || 0) + 1
      })
      const catSlices = Object.entries(catTotals).map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
      setCategories(catSlices)

      const statsOut = {
        totalStockItems: allStockNames.length,
        totalCustomers,
        expiringSoon,
        lowStockTotal: allLowStock.length,
        yesterdayTotal: Math.round(yesterdayTotal),
        newStockThisWeek,
        newCustomersThisWeek,
      }
      onStats?.(statsOut)

      // ── Today's important tasks — generated from the same signals above,
      // newest/most-urgent first. Not a stored task list; recomputed each load.
      const tasks: TaskItem[] = []
      const worstLowStock = [...allLowStock].sort((a, b) => (a.qty / (a.minQty || 1)) - (b.qty / (b.minQty || 1)))[0]
      if (worstLowStock) {
        tasks.push({ id: 'low-stock', tone: 'warning', actionId: 'stock',
          text: `${worstLowStock.itemName} এর স্টক কম — মাত্র ${worstLowStock.qty} ${worstLowStock.unit} বাকি, অর্ডার করুন` })
      }
      const topDue = Object.entries(dueByCustomer).sort((a, b) => b[1] - a[1])[0]
      if (topDue) {
        const [nameKey, amount] = topDue
        const displayName = allActivity.find(a => a.customer.trim().toLowerCase() === nameKey)?.customer || nameKey
        tasks.push({ id: 'top-due', tone: 'warning', actionId: 'customer',
          text: `${displayName} এর বকেয়া ₹${Math.round(amount).toLocaleString()}` })
      }
      try {
        const { data: newestCustomers } = await supabase.from('crm_customers').select('name,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1)
        const newest = newestCustomers?.[0]
        if (newest && new Date(newest.created_at).getTime() >= new Date(sevenAgoFullISO).getTime()) {
          tasks.push({ id: 'new-customer', tone: 'success', actionId: 'customer', text: `নতুন গ্রাহক ${newest.name} যোগ হয়েছে` })
        }
      } catch { /* ignore */ }
      if (expiringSoon > 0) {
        tasks.push({ id: 'expiring', tone: 'warning', actionId: 'expiry', text: `মেয়াদ শেষ হতে চলছে ${expiringSoon}টি পণ্য` })
      }
      const { trendPct: overallTrendPct } = computeTrendMeta(pointsFromBucket(bucketAll))
      if (overallTrendPct !== 0) {
        tasks.push({
          id: 'trend', tone: overallTrendPct > 0 ? 'success' : 'warning', actionId: 'reports',
          text: `এই সপ্তাহের বিক্রি আগের দিনগুলোর থেকে ${Math.abs(overallTrendPct)}% ${overallTrendPct > 0 ? 'বেশি' : 'কম'}`,
        })
      }
      const tasksOut = tasks.slice(0, 5)
      onTasks?.(tasksOut)

      // "Recent AI activity" feed — the last few real sales, newest first.
      // Not a separate audit trail (audit_logs only covers team-management
      // events like invites, not chat-driven business writes); this reuses
      // the same activity rows as the "recent sales" table, phrased as a
      // completed action + relative time.
      const recentOut = allActivity.slice(0, 5).map((a, i) => ({
        id: `${a.ts}-${i}`, icon: a.icon, ts: a.ts,
        text: `${a.label} বিক্রি রেকর্ড করা হয়েছে ${a.customer && a.customer !== 'নগদ' ? `— ${a.customer}` : ''}`.trim(),
      }))
      onRecentActivity?.(recentOut)

      writeCache(cacheKey, {
        activity: allActivity.slice(0, 6), lowStock: allLowStock.slice(0, 6),
        trendByAgent: nextTrendByAgent, categories: catSlices,
        stats: statsOut, tasks: tasksOut, recent: recentOut,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 mb-8 lg:space-y-0 lg:mb-0 lg:flex lg:flex-col lg:gap-3 lg:flex-1 lg:min-h-0">
        <div className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse lg:shrink-0" />
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 lg:gap-3 lg:flex-[1.25] lg:min-h-0">
          {[0, 1].map(i => <div key={i} className="h-72 lg:h-auto bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-3 lg:flex-1 lg:min-h-0">
          {[0, 1, 2].map(i => <div key={i} className="h-40 lg:h-auto bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
        </div>
      </div>
    )
  }

  const cardCls = 'bg-white rounded-2xl border border-gray-100 p-4 max-sm:p-2.5 lg:p-3.5 flex flex-col min-h-0 max-sm:overflow-hidden lg:overflow-hidden'
  const seeAll = (id: string) => (
    <button onClick={() => onQuickAction?.(id)} className="max-sm:hidden flex items-center gap-1 text-xs text-indigo-600 font-semibold bengali hover:underline shrink-0">
      {tr('সব দেখুন')} <ArrowRight size={11}/>
    </button>
  )
  // Phones: an empty card is just a white hole — hide it there (desktop keeps it so the grid stays even).
  const hideIf = (empty: boolean) => (empty ? ' hidden max-sm:flex lg:flex' : '')
  const chartEmpty = trend.every(p => p.total === 0)
  const emptyCls = 'flex-1 flex items-center justify-center text-sm max-sm:text-[11px] text-gray-400 bengali text-center py-8 max-sm:py-0 lg:py-2'

  // On desktop (lg+) this whole block is a flex column that fills whatever
  // height the Overview page gives it: quick actions (fixed) → chart+donut
  // (1.25 share) → three lists (1 share). Each card scrolls INSIDE itself if
  // it has too many rows, so the page never grows past one screen and never
  // leaves empty white gaps. Below lg everything stacks like before.
  return (
    <div className="space-y-4 mb-8 max-sm:space-y-0 max-sm:mb-0 max-sm:grid max-sm:grid-cols-2 max-sm:grid-rows-[auto_minmax(0,1.25fr)_minmax(0,1fr)_auto] max-sm:gap-2 max-sm:flex-1 max-sm:min-h-0 lg:space-y-0 lg:mb-0 lg:flex lg:flex-col lg:gap-3 lg:flex-1 lg:min-h-0">
      {/* Quick actions (phone: first 4 only) */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 max-sm:p-1.5 max-sm:col-span-2 lg:p-2.5 shrink-0">
        <h2 className="font-bold text-gray-900 bengali mb-3 lg:hidden">{tr('দ্রুত কাজ শুরু করুন')}</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5 lg:gap-1">
          {QUICK_ACTIONS.map((a, qi) => (
            <button key={a.id} onClick={() => onQuickAction?.(a.id)}
              className={`${qi >= 4 ? 'max-sm:hidden ' : ''}flex flex-col items-center gap-1.5 lg:gap-1 p-2.5 max-sm:p-1 lg:p-1 rounded-xl hover:bg-gray-50 transition-colors group`}>
              <div className={`w-10 h-10 max-sm:w-9 max-sm:h-9 lg:w-8 lg:h-8 rounded-xl flex items-center justify-center ${a.tint} group-hover:scale-105 transition-transform`}>{a.icon}</div>
              <span className="text-[11px] lg:text-[10px] font-semibold text-gray-600 bengali text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sales trend + category donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] lg:grid-rows-[minmax(0,1fr)] gap-4 lg:gap-3 max-sm:contents lg:flex-[1.25] lg:min-h-0">
        <div className={`${cardCls} max-sm:col-span-2`}>
          <div className="flex items-start justify-between gap-2 flex-wrap lg:flex-nowrap shrink-0">
            <div>
              <h2 className="font-bold text-gray-900 bengali text-sm sm:text-base">{tr('গত ৭ দিনের বিক্রি')}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-extrabold text-gray-900 leading-none">₹{trend.reduce((s, p) => s + p.total, 0).toLocaleString()}</span>
                {trendPct !== 0 && (
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trendPct > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                    {trendPct > 0 ? '↑' : '↓'} {Math.abs(trendPct)}%
                  </span>
                )}
              </div>
            </div>
            <select value={selectedAgentKey} onChange={e => setSelectedAgentKey(e.target.value)}
              className="max-sm:hidden text-xs font-semibold text-gray-600 bengali border border-gray-200 rounded-lg px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:border-indigo-300 cursor-pointer max-w-[150px]">
              {agentOptions.map(a => <option key={a.key} value={a.key}>{a.icon} {a.label}</option>)}
            </select>
          </div>
          <div className="max-sm:hidden flex items-center justify-between my-1.5 flex-wrap gap-2 shrink-0 [@media(max-height:720px)]:hidden">
            <p className="text-[11px] text-gray-400 bengali lg:hidden">{tr('সাম্প্রতিক ট্রেন্ডের উপর ভিত্তি করে একটি আনুমানিক হিসাব — নিশ্চিত পূর্বাভাস নয়।')}</p>
            <div title={tr('সাম্প্রতিক ট্রেন্ডের উপর ভিত্তি করে একটি আনুমানিক হিসাব — নিশ্চিত পূর্বাভাস নয়।')}
              className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-semibold bengali whitespace-nowrap">
              {tr('আগামীকালের আনুমানিক বিক্রি: ₹')}{prediction.toLocaleString()}
            </div>
          </div>
          <div className="relative h-[210px] max-sm:h-auto max-sm:flex-1 max-sm:min-h-[70px] lg:h-auto lg:flex-1 lg:min-h-[70px] mt-1">
            <div className="absolute inset-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <Tooltip formatter={(v: any) => [`₹${v}`, 'বিক্রি']} />
                  <Line type="monotone" dataKey="total" stroke="#4F46E5" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className={`${cardCls}${hideIf(categories.length === 0)}`}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="font-bold text-gray-900 bengali flex items-center gap-2 text-sm max-sm:text-xs sm:text-base">
              <Sparkles size={16} className="text-fuchsia-500 max-sm:hidden" /> {tr('পণ্যের ক্যাটাগরি অনুপাত')}
            </h2>
            {seeAll('stock')}
          </div>
          {categories.length === 0 ? (
            <div className={emptyCls}>{tr('কোনো স্টক তথ্য নেই')}</div>
          ) : (
            <div className="flex items-center gap-4 max-sm:gap-2 lg:gap-3 max-sm:flex-1 max-sm:min-h-0 lg:flex-1 lg:min-h-0">
              <div className="relative w-[150px] h-[150px] max-sm:w-[62px] max-sm:h-[62px] lg:w-[46%] lg:h-full flex-shrink-0">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categories} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="95%" paddingAngle={2}>
                        {categories.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any, n: any) => [`${v} পণ্য`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-1.5 max-sm:space-y-0.5 flex-1 min-w-0 max-sm:overflow-hidden lg:max-h-full lg:overflow-y-auto">
                {categories.map((c, i) => {
                  const total = categories.reduce((s, x) => s + x.value, 0)
                  const pct = total ? Math.round((c.value / total) * 100) : 0
                  return (
                    <div key={c.name} className={`flex items-center justify-between text-xs max-sm:text-[10px] gap-2 ${i >= 3 ? 'max-sm:hidden' : ''}`}>
                      <span className="flex items-center gap-1.5 text-gray-600 bengali min-w-0">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-bold text-gray-800">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent sales · Low stock · Today's tasks */}
      <div className="max-sm:contents grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-[minmax(0,1fr)] gap-4 lg:gap-3 lg:flex-1 lg:min-h-0">
        <div className={`${cardCls}${hideIf(activity.length === 0)} max-sm:!hidden`}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="font-bold text-gray-900 bengali text-sm max-sm:text-xs">{tr('সাম্প্রতিক বিক্রি')}</h2>
            {seeAll('sales')}
          </div>
          {activity.length === 0 ? (
            <div className={emptyCls}>{tr('এখনো কোনো বিক্রি নেই')}</div>
          ) : (
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto divide-y divide-gray-50">
              {activity.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-700 bengali truncate">{a.customer}</div>
                    <div className="text-[10px] text-gray-400 bengali truncate">
                      {a.label} · {new Date(a.ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-emerald-600 whitespace-nowrap">₹{a.amount.toLocaleString()}</div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bengali whitespace-nowrap ${a.hasDue ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {a.hasDue ? tr('বাকি') : tr('পরিশোধিত')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${cardCls}${hideIf(lowStock.length === 0)}`}>
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h2 className="font-bold text-gray-900 bengali text-sm max-sm:text-xs">{tr('কম স্টক পণ্য')}</h2>
            {seeAll('stock')}
          </div>
          {lowStock.length === 0 ? (
            <div className={emptyCls}>{tr('সব স্টক ঠিক আছে ✅')}</div>
          ) : (
            <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto divide-y divide-gray-50">
              {lowStock.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-700 bengali truncate">{s.itemName}</div>
                    <div className="max-sm:hidden text-[10px] text-gray-400 bengali truncate">{tr('ন্যূনতম')} {s.minQty} {s.unit}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-amber-600 bengali whitespace-nowrap">{s.qty} {s.unit}</div>
                    <span className="max-sm:hidden text-[9px] font-bold px-1.5 py-0.5 rounded-full bengali whitespace-nowrap bg-amber-50 text-amber-600">{tr('কম স্টক')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {tasksCard}
      </div>
    </div>
  )
}
