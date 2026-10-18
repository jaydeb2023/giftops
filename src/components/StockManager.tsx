'use client'

// Redesigned Stock section — replaces the old card-grid StockOverview look
// with: 5 summary stat cards, status tabs (all/low/out/new), a category +
// subcategory sidebar with counts, a proper data table (checkboxes, SKU,
// status badges, inline qty steppers), bulk actions, print, Excel export,
// and pagination. One component, used two ways:
//   - Global "স্টক" page (all agents mixed)   → pass agentNameById/agentColorById
//   - An agent's own Stock tab (e.g. Dokan)   → pass agentId + categories + compact
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { readCache, writeCache, useIsoLayoutEffect } from '@/lib/swrCache'
import {
  Package, AlertTriangle, Search, RefreshCw, Plus, Minus, Pencil, Trash2, X,
  MoreVertical, Printer, FileDown, ChevronLeft, ChevronRight, Boxes, Wallet,
  IndianRupee, Layers, CheckSquare, Square, ChevronDown, Sparkles, LayoutGrid, List,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { loadAllStock, insertStock, updateStock, deleteStock, setStockCategory, sourceForAgentId, agentIdForSource, type StockSource } from '@/lib/stockSources'
import { exportStockToExcel, printStockRows, type StockExportRow } from '@/lib/exportStock'

import { tr } from '@/lib/i18n/tr'
export interface StockItem {
  id: string
  source?: StockSource   // which table the product lives in (Dokan/custom → stock_items, others → their own)
  agent_id: string | null
  item_name: string
  category: string
  subcategory: string
  sku: string
  current_qty: number
  unit: string
  min_qty: number
  unit_cost: number
  sell_price: number | null
  last_updated: string
}

type StatusTab = 'all' | 'low' | 'out' | 'new'
const NEW_WINDOW_DAYS = 7
const UNITS = ['কেজি', 'গ্রাম', 'লিটার', 'মিলি', 'পিস', 'প্যাকেট', 'বস্তা', 'ডজন', 'বোতল', 'কার্টন']
const UNCATEGORIZED = 'অন্যান্য'
const NO_SUBCATEGORY = 'সাধারণ'

const emptyForm = {
  item_name: '', current_qty: '', unit: 'পিস', min_qty: '', unit_cost: '', sell_price: '',
  category: '', subcategory: '', sku: '', agent_id: '',
}

function fmt(n: number) { return Math.round(n).toLocaleString('en-IN') }
function isRecent(ts: string) { return Date.now() - new Date(ts).getTime() < NEW_WINDOW_DAYS * 24 * 3600 * 1000 }
function statusOf(item: StockItem): 'out' | 'low' | 'ok' {
  const qty = Number(item.current_qty)
  if (qty <= 0) return 'out'
  if (qty <= Number(item.min_qty || 0)) return 'low'
  return 'ok'
}
function nextSku(items: StockItem[]) {
  let max = 0
  for (const it of items) {
    const m = /^PD(\d+)$/i.exec((it.sku || '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return 'PD' + String(max + 1).padStart(4, '0')
}

export default function StockManager({
  userId, agentId, categories, onAddCategory, agentNameById, agentColorById,
  accentColor = '#4F46E5', compact = false, slim = false, onDataChange, title, subtitle,
}: {
  userId: string
  agentId?: string
  categories?: string[]
  onAddCategory?: (name: string) => Promise<boolean>
  agentNameById?: Record<string, string>
  agentColorById?: Record<string, string>
  accentColor?: string
  compact?: boolean
  /** Global page with a docked AI panel: no category sidebar, price/agent columns only on very wide screens. */
  slim?: boolean
  onDataChange?: () => void
  title?: string
  subtitle?: string
}) {
  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusTab, setStatusTab] = useState<StatusTab>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [subcategoryFilter, setSubcategoryFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StockItem | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const [showNewCat, setShowNewCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const isGlobal = !agentId
  const priceCol = slim ? 'hidden 2xl:table-cell' : 'hidden lg:table-cell'
  const agentCol = slim ? 'hidden 2xl:table-cell' : 'hidden md:table-cell'

  const load = async () => {
    const ck = `stock:${userId}:${agentId || 'all'}`
    const cached = readCache<StockItem[]>(ck)
    if (cached) { setItems(cached); setLoading(false) } else setLoading(true)
    let mapped: StockItem[]
    let failed = false
    if (agentId) {
      // An agent's own stock tab (Dokan / custom agent): its rows in the shared table
      const { data, error } = await supabase.from('stock_items').select('*').eq('user_id', userId).eq('agent_id', agentId)
        .order('item_name', { ascending: true })
      if (error) { console.error('stock_items fetch:', error); failed = true }
      mapped = (data || []).map((r: any): StockItem => ({
        id: r.id, source: 'stock_items', agent_id: r.agent_id, item_name: r.item_name,
        category: r.category || UNCATEGORIZED, subcategory: r.subcategory || '',
        sku: r.sku || '', current_qty: Number(r.current_qty || 0), unit: r.unit || 'পিস',
        min_qty: Number(r.min_qty || 0), unit_cost: Number(r.unit_cost || 0),
        sell_price: r.sell_price != null ? Number(r.sell_price) : null,
        last_updated: r.last_updated || new Date().toISOString(),
      }))
    } else {
      // The global Stock page: products of EVERY agent — Dokan, built agents, Kapor, Mishti, Hotel, Pharmacy
      mapped = (await loadAllStock(supabase, userId)) as StockItem[]
    }
    setItems(mapped)
    if (!failed) writeCache(ck, mapped)
    setLoading(false)
  }

  useIsoLayoutEffect(() => { load() }, [userId, agentId])
  useEffect(() => { setPage(1) }, [q, statusTab, categoryFilter, subcategoryFilter, agentFilter])

  const colorFor = (aid: string | null) => (aid && agentColorById?.[aid]) || '#94A3B8'
  const nameFor = (aid: string | null) => (aid && agentNameById?.[aid]) || 'সাধারণ'

  // ── Scope: search + agent filter (used for the stable header stats/tabs) ──
  const scoped = useMemo(() => {
    let list = items
    if (!agentId && agentNameById) {
      list = list.filter(i => agentFilter === 'all' || (agentFilter === 'none' ? !i.agent_id : i.agent_id === agentFilter))
    }
    if (q.trim()) {
      const ql = q.toLowerCase()
      list = list.filter(i => i.item_name.toLowerCase().includes(ql) || i.sku.toLowerCase().includes(ql))
    }
    return list
  }, [items, q, agentFilter, agentId, agentNameById])

  const counts = useMemo(() => ({
    all: scoped.length,
    low: scoped.filter(i => statusOf(i) === 'low').length,
    out: scoped.filter(i => statusOf(i) === 'out').length,
    new: scoped.filter(i => isRecent(i.last_updated)).length,
  }), [scoped])

  const totals = useMemo(() => ({
    items: scoped.length,
    qty: scoped.reduce((s, i) => s + Number(i.current_qty || 0), 0),
    low: counts.low,
    cost: scoped.reduce((s, i) => s + Number(i.current_qty || 0) * Number(i.unit_cost || 0), 0),
    sell: scoped.reduce((s, i) => s + Number(i.current_qty || 0) * Number(i.sell_price || 0), 0),
  }), [scoped, counts.low])

  // ── Category / subcategory sidebar data (built from `scoped`, i.e. before category filters) ──
  const categoryList = useMemo(() => {
    const set = new Set<string>(categories?.filter(c => c !== 'সব') || [])
    scoped.forEach(i => set.add(i.category || UNCATEGORIZED))
    return Array.from(set)
  }, [scoped, categories])

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    scoped.forEach(i => { const c = i.category || UNCATEGORIZED; map[c] = (map[c] || 0) + 1 })
    return map
  }, [scoped])

  const subcategoryList = useMemo(() => {
    if (categoryFilter === 'all') return []
    const set = new Set<string>()
    scoped.filter(i => (i.category || UNCATEGORIZED) === categoryFilter).forEach(i => set.add(i.subcategory || NO_SUBCATEGORY))
    return Array.from(set)
  }, [scoped, categoryFilter])

  const subcategoryCounts = useMemo(() => {
    const map: Record<string, number> = {}
    scoped.filter(i => (i.category || UNCATEGORIZED) === categoryFilter)
      .forEach(i => { const s = i.subcategory || NO_SUBCATEGORY; map[s] = (map[s] || 0) + 1 })
    return map
  }, [scoped, categoryFilter])

  // ── Full filter pipeline for the table itself ──
  const filtered = useMemo(() => {
    let list = scoped
    if (statusTab === 'low') list = list.filter(i => statusOf(i) === 'low')
    else if (statusTab === 'out') list = list.filter(i => statusOf(i) === 'out')
    else if (statusTab === 'new') list = list.filter(i => isRecent(i.last_updated))
    if (categoryFilter !== 'all') list = list.filter(i => (i.category || UNCATEGORIZED) === categoryFilter)
    if (subcategoryFilter !== 'all') list = list.filter(i => (i.subcategory || NO_SUBCATEGORY) === subcategoryFilter)
    return list
  }, [scoped, statusTab, categoryFilter, subcategoryFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize)
  const agentOptions = Object.entries(agentNameById || {})

  // ── CRUD ──
  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, category: categoryFilter !== 'all' ? categoryFilter : (categoryList[0] || ''), sku: nextSku(items), agent_id: agentId || '' })
    setShowForm(true)
  }
  const openEdit = (item: StockItem) => {
    setEditing(item)
    setForm({
      item_name: item.item_name, current_qty: String(item.current_qty), unit: item.unit,
      min_qty: String(item.min_qty || ''), unit_cost: String(item.unit_cost || ''),
      sell_price: item.sell_price != null ? String(item.sell_price) : '',
      category: item.category, subcategory: item.subcategory, sku: item.sku,
      agent_id: item.agent_id || '',
    })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.item_name.trim()) { toast.error('পণ্যের নাম দিন'); return }
    setSaving(true)
    const newQty = Number(form.current_qty || 0)
    const unitCost = Number(form.unit_cost || 0)
    // An edit stays in the table the product already lives in; a new product goes to the table of the agent chosen for it
    const source: StockSource = editing ? (editing.source || 'stock_items') : sourceForAgentId(agentId || form.agent_id)
    const payload = {
      agent_id: agentIdForSource(source, (agentId || form.agent_id) || null),
      item_name: form.item_name.trim(), current_qty: newQty,
      unit: form.unit || 'পিস', min_qty: Number(form.min_qty || 0), unit_cost: unitCost,
      sell_price: form.sell_price !== '' ? Number(form.sell_price) : null,
      category: form.category.trim() || UNCATEGORIZED, subcategory: form.subcategory.trim(),
      sku: form.sku.trim() || nextSku(items),
    }
    const oldQty = editing ? Number(editing.current_qty) : 0
    const { data: saved, error } = editing
      ? await updateStock(supabase, source, editing.id, payload)
      : await insertStock(supabase, source, userId, payload)
    if (error) { console.error('stock_items save:', error); toast.error('সেভ করতে সমস্যা হয়েছে'); setSaving(false); return }
    // Log the restock as a purchase — new items count their full opening
    // quantity; edits only count the increase, so lowering stock (a
    // correction, not a purchase) never inflates "মোট ক্রয়".
    const qtyAdded = newQty - oldQty
    if (qtyAdded > 0 && unitCost > 0 && saved) {
      await supabase.from('stock_purchases').insert({
        user_id: userId, agent_id: payload.agent_id, source_table: source, source_id: saved.id,
        item_name: payload.item_name, quantity: qtyAdded, unit: payload.unit, unit_cost: unitCost,
      })
    }
    toast.success(editing ? 'আপডেট হয়েছে!' : 'যোগ হয়েছে!'); setShowForm(false); load(); onDataChange?.()
    setSaving(false)
  }

  const remove = async (item: StockItem) => {
    if (!confirm(`"${item.item_name}" মুছে ফেলবেন?`)) return
    const { error } = await deleteStock(supabase, item.source || 'stock_items', [item.id])
    if (error) { console.error('stock delete:', error); toast.error('মুছতে সমস্যা হয়েছে') }
    else { toast.success('মুছে ফেলা হয়েছে'); load(); onDataChange?.() }
  }

  const adjustQty = async (item: StockItem, delta: number) => {
    const newQty = Math.max(0, Number(item.current_qty) + delta)
    setItems(items.map(i => i.id === item.id ? { ...i, current_qty: newQty } : i))
    const { error } = await updateStock(supabase, item.source || 'stock_items', item.id, { current_qty: newQty })
    if (error) { console.error('stock qty update:', error); load(); return }
    // The +1/-1 stepper is a real restock/sale event, not a form edit — log
    // increases the same way save() does, using this item's own cost.
    if (delta > 0 && Number(item.unit_cost) > 0) {
      await supabase.from('stock_purchases').insert({
        user_id: userId, agent_id: item.agent_id, source_table: item.source || 'stock_items', source_id: item.id,
        item_name: item.item_name, quantity: delta, unit: item.unit, unit_cost: item.unit_cost,
      })
    }
    onDataChange?.()
  }

  const toggleSelect = (id: string) => setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSelectPage = () => {
    const allSelected = pageItems.every(i => selected.has(i.id))
    setSelected(s => {
      const n = new Set(s)
      pageItems.forEach(i => allSelected ? n.delete(i.id) : n.add(i.id))
      return n
    })
  }

  // selected ids → one batch per table (products of different agents live in different tables)
  const groupSelectedBySource = () => {
    const groups = new Map<StockSource, string[]>()
    for (const id of Array.from(selected) as string[]) {
      const src: StockSource = items.find(i => i.id === id)?.source || 'stock_items'
      groups.set(src, [...(groups.get(src) || []), id])
    }
    return Array.from(groups.entries())
  }

  const bulkDelete = async () => {
    if (!confirm(`${selected.size}টি পণ্য মুছে ফেলবেন?`)) return
    let failed = false
    for (const [src, ids] of groupSelectedBySource()) { const { error } = await deleteStock(supabase, src, ids); if (error) failed = true }
    if (failed) { toast.error('মুছতে সমস্যা হয়েছে'); load(); return }
    toast.success(`${selected.size}টি পণ্য মুছে ফেলা হয়েছে`)
    setSelected(new Set()); setShowBulkMenu(false); load(); onDataChange?.()
  }

  const bulkSetCategory = async (cat: string) => {
    let failed = false
    for (const [src, ids] of groupSelectedBySource()) { const { error } = await setStockCategory(supabase, src, ids, cat); if (error) failed = true }
    if (failed) { toast.error('আপডেট করতে সমস্যা হয়েছে'); load(); return }
    toast.success('ক্যাটাগরি আপডেট হয়েছে')
    setSelected(new Set()); setShowBulkMenu(false); load(); onDataChange?.()
  }

  const toExportRows = (list: StockItem[]): StockExportRow[] => list.map(i => ({
    'SKU': i.sku, 'পণ্যের নাম': i.item_name, 'ক্যাটাগরি': i.category, 'সাবক্যাটাগরি': i.subcategory || NO_SUBCATEGORY,
    'এজেন্ট': nameFor(i.agent_id), 'বর্তমান স্টক': i.current_qty, 'একক': i.unit, 'ন্যূনতম স্টক': i.min_qty,
    'ক্রয়মূল্য (₹)': i.unit_cost, 'বিক্রয়মূল্য (₹)': i.sell_price || 0,
    'স্ট্যাটাস': statusOf(i) === 'out' ? 'স্টক শেষ' : statusOf(i) === 'low' ? 'কম স্টক' : 'পর্যাপ্ত',
    'সর্বশেষ আপডেট': new Date(i.last_updated).toLocaleDateString('bn-IN'),
  }))

  const exportRows = () => {
    const list = selected.size > 0 ? items.filter(i => selected.has(i.id)) : filtered
    if (list.length === 0) { toast.error('কোনো পণ্য নেই'); return }
    exportStockToExcel(toExportRows(list))
  }
  const printRows = () => {
    const list = selected.size > 0 ? items.filter(i => selected.has(i.id)) : filtered
    if (list.length === 0) { toast.error('কোনো পণ্য নেই'); return }
    printStockRows(toExportRows(list), title || 'স্টক তালিকা')
  }

  const TABS: { id: StatusTab; label: string; count: number }[] = [
    { id: 'all', label: 'সকল পণ্য', count: counts.all },
    { id: 'low', label: 'কম স্টক', count: counts.low },
    { id: 'out', label: 'স্টক শেষ', count: counts.out },
    { id: 'new', label: 'নতুন পণ্য', count: counts.new },
  ]

  const StatCard = ({ icon, label, value, color, hint, cls = '' }: { icon: React.ReactNode; label: string; value: string | number; color: string; hint?: string; cls?: string }) => (
    <div className={`rounded-2xl border p-3 sm:p-3.5 ${slim ? 'max-sm:p-2' : ''} ${cls}`} style={{ borderColor: `${color}30`, background: `${color}0D` }}>
      <div className="flex items-center gap-2 mb-1.5 max-sm:mb-0.5">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${slim ? 'max-sm:hidden' : ''}`} style={{ background: `${color}18`, color }}>{icon}</div>
        <span className={`text-[11px] text-gray-500 bengali truncate ${slim ? 'max-sm:text-[10px]' : ''}`}>{label}</span>
      </div>
      <div className={`text-lg sm:text-xl font-extrabold text-gray-900 ${slim ? 'max-sm:text-base' : ''}`}>{value}</div>
      {hint && <div className={`text-[9px] text-gray-400 bengali mt-0.5 ${slim ? 'max-sm:hidden' : ''}`}>{hint}</div>}
    </div>
  )

  const Avatar = ({ item }: { item: StockItem }) => {
    const c = colorFor(item.agent_id)
    return (
      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-extrabold"
        style={{ background: `${c}22`, color: c }}>
        {(Array.from((item.item_name || '?').trim())[0] || '?').toUpperCase()}
      </div>
    )
  }

  const StatusBadge = ({ item }: { item: StockItem }) => {
    const st = statusOf(item)
    if (st === 'out') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 bengali">{tr('স্টক শেষ')}</span>
    if (st === 'low') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600 bengali"><AlertTriangle size={10} /> {tr('কম স্টক')}</span>
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 bengali">{tr('পর্যাপ্ত')}</span>
  }

  return (
    <div className={slim ? 'max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col lg:flex-1 lg:min-h-0 lg:flex lg:flex-col' : ''}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 bengali flex items-center gap-2">
            <Package size={18} style={{ color: accentColor }} /> {title || tr('সব পণ্য / স্টক')}
          </h2>
          {(subtitle || !compact) && <p className={`text-[11px] text-gray-400 bengali mt-0.5 ${slim ? 'max-sm:hidden' : ''}`}>{subtitle || tr('আপনার সব পণ্য, স্টক এবং ইনভেন্টরি এখানে দেখুন।')}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 bengali">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[12px] font-bold bengali" style={{ background: accentColor }}>
            <Plus size={12} /> {tr('পণ্য যোগ করুন')}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className={`grid gap-2 mb-4 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'} ${slim ? 'max-sm:grid-cols-4 max-sm:gap-1.5 max-sm:mb-2' : ''}`}>
        <StatCard icon={<Boxes size={14} />} label={tr('মোট পণ্য')} value={totals.items} color="#4F46E5" />
        <StatCard icon={<Layers size={14} />} label={tr('মোট স্টক')} value={fmt(totals.qty)} color="#059669" hint="বিভিন্ন এককে আনুমানিক যোগফল" />
        <StatCard icon={<AlertTriangle size={14} />} label={tr('কম স্টক')} value={totals.low} color="#D97706" />
        <StatCard icon={<Wallet size={14} />} label={tr('মোট ক্রয় মূল্য')} value={`₹${fmt(totals.cost)}`} color="#E11D48" />
        <StatCard icon={<IndianRupee size={14} />} label={tr('মোট বিক্রয় মূল্য')} value={`₹${fmt(totals.sell)}`} color="#7C3AED" cls="max-sm:hidden" />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-3 sm:flex-wrap max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:-mx-3 max-sm:px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map(tb => (
          <button key={tb.id} onClick={() => setStatusTab(tb.id)}
            className={`whitespace-nowrap shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold bengali transition-colors ${statusTab === tb.id ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
            style={statusTab === tb.id ? { background: accentColor } : undefined}>
            {tb.label} ({tb.count})
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex-1 min-w-[160px] max-sm:basis-full relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('পণ্য বা SKU খুঁজুন...')}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setSubcategoryFilter('all') }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 bengali max-w-[160px] max-sm:flex-1 max-sm:max-w-none max-sm:min-w-0">
          <option value="all">{tr('সব ক্যাটাগরি')}</option>
          {categoryList.map(c => <option key={c} value={c}>{c} ({categoryCounts[c] || 0})</option>)}
        </select>
        {categoryFilter !== 'all' && subcategoryList.length > 0 && (
          <select value={subcategoryFilter} onChange={e => setSubcategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 bengali max-w-[160px] max-sm:flex-1 max-sm:max-w-none max-sm:min-w-0">
            <option value="all">{tr('সব সাবক্যাটাগরি')}</option>
            {subcategoryList.map(s => <option key={s} value={s}>{s} ({subcategoryCounts[s] || 0})</option>)}
          </select>
        )}
        {isGlobal && agentOptions.length > 0 && (
          <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 bengali max-w-[160px] max-sm:flex-1 max-sm:max-w-none max-sm:min-w-0">
            <option value="all">{tr('সব এজেন্ট')}</option>
            {agentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            <option value="none">{tr('সাধারণ (agent বিহীন)')}</option>
          </select>
        )}
        <button onClick={printRows} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 bengali">
          <Printer size={13} /> <span className="max-sm:hidden">{tr('প্রিন্ট')}</span>
        </button>
        <button onClick={exportRows} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 bengali">
          <FileDown size={13} /> <span className="max-sm:hidden">{tr('এক্সপোর্ট')}</span>
        </button>
        <div className="ml-auto max-sm:ml-0 flex items-center rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setViewMode('list')} aria-label={tr('তালিকা')} className={`p-2 ${viewMode === 'list' ? 'text-white' : 'text-gray-400 bg-white'}`} style={viewMode === 'list' ? { background: accentColor } : undefined}><List size={14} /></button>
          <button onClick={() => setViewMode('grid')} aria-label={tr('গ্রিড')} className={`p-2 ${viewMode === 'grid' ? 'text-white' : 'text-gray-400 bg-white'}`} style={viewMode === 'grid' ? { background: accentColor } : undefined}><LayoutGrid size={14} /></button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 flex-wrap">
          <span className="text-[12px] font-bold text-indigo-700 bengali">{selected.size}{tr('টি নির্বাচিত')}</span>
          <div className="relative">
            <button onClick={() => setShowBulkMenu(v => !v)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700 bengali">
              {tr('বাল্ক অ্যাকশন')} <ChevronDown size={11} />
            </button>
            {showBulkMenu && (
              <div className="absolute z-10 mt-1 w-52 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
                <div className="px-3 py-1.5 text-[10px] text-gray-400 bengali">{tr('ক্যাটাগরি পরিবর্তন করুন')}</div>
                {categoryList.map(c => (
                  <button key={c} onClick={() => bulkSetCategory(c)} className="w-full text-left px-3 py-1.5 text-[12px] text-gray-700 hover:bg-gray-50 bengali">{c}</button>
                ))}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={bulkDelete} className="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 bengali font-bold">{tr('মুছে ফেলুন')}</button>
              </div>
            )}
          </div>
          <button onClick={exportRows} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700 bengali">
            <FileDown size={11} /> {tr('নির্বাচিত এক্সপোর্ট')}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-[11px] text-gray-400 hover:text-gray-600 bengali ml-auto">{tr('বাতিল')}</button>
        </div>
      )}

      <div className={compact || slim ? (slim ? 'max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col lg:flex-1 lg:min-h-0 lg:flex lg:flex-col' : '') : 'grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4'}>
        {/* Category sidebar — desktop / non-compact only */}
        {!compact && !slim && (
          <div className="border border-gray-100 rounded-xl p-3 h-fit">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-gray-700 bengali">{tr('ক্যাটাগরি')}</span>
              {onAddCategory && (
                <button onClick={() => setShowNewCat(v => !v)} className="text-gray-400 hover:text-indigo-600"><Plus size={13} /></button>
              )}
            </div>
            {showNewCat && onAddCategory && (
              <div className="flex items-center gap-1 mb-2">
                <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={async e => { if (e.key === 'Enter') { const ok = await onAddCategory(newCatName); if (ok) { setNewCatName(''); setShowNewCat(false) } } }}
                  placeholder={tr('নতুন ক্যাটাগরি...')} className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-[11px] bengali" />
              </div>
            )}
            <button onClick={() => { setCategoryFilter('all'); setSubcategoryFilter('all') }}
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bengali mb-0.5 ${categoryFilter === 'all' ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              style={categoryFilter === 'all' ? { background: accentColor } : undefined}>
              {tr('সকল ক্যাটাগরি')} <span className="text-[10px] opacity-80">{totals.items}</span>
            </button>
            <div className="max-h-64 overflow-y-auto space-y-0.5">
              {categoryList.map(c => (
                <button key={c} onClick={() => { setCategoryFilter(c); setSubcategoryFilter('all') }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[12px] font-semibold bengali ${categoryFilter === c ? 'text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                  style={categoryFilter === c ? { background: accentColor } : undefined}>
                  <span className="truncate">{c}</span> <span className="text-[10px] opacity-80 flex-shrink-0">{categoryCounts[c] || 0}</span>
                </button>
              ))}
            </div>
            {categoryFilter !== 'all' && subcategoryList.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-[11px] font-bold text-gray-500 bengali mb-1.5">{tr('সাবক্যাটাগরি (')}{categoryFilter})</div>
                <button onClick={() => setSubcategoryFilter('all')}
                  className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] bengali mb-0.5 ${subcategoryFilter === 'all' ? 'bg-gray-100 font-bold text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {tr('সবগুলো')} <span className="text-[10px]">{categoryCounts[categoryFilter] || 0}</span>
                </button>
                {subcategoryList.map(s => (
                  <button key={s} onClick={() => setSubcategoryFilter(s)}
                    className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-[11px] bengali mb-0.5 ${subcategoryFilter === s ? 'bg-gray-100 font-bold text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>
                    <span className="truncate">{s}</span> <span className="text-[10px] flex-shrink-0">{subcategoryCounts[s] || 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Compact mode: category chips instead of a sidebar column */}
        {compact && categoryList.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
            <button onClick={() => { setCategoryFilter('all'); setSubcategoryFilter('all') }}
              className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap bengali flex-shrink-0 ${categoryFilter === 'all' ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
              style={categoryFilter === 'all' ? { background: accentColor } : undefined}>{tr('সব (')}{totals.items})</button>
            {categoryList.map(c => (
              <button key={c} onClick={() => { setCategoryFilter(c); setSubcategoryFilter('all') }}
                className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap bengali flex-shrink-0 ${categoryFilter === c ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={categoryFilter === c ? { background: accentColor } : undefined}>{c} ({categoryCounts[c] || 0})</button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className={slim ? 'max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col lg:flex-1 lg:min-h-0 lg:flex lg:flex-col' : ''}>
          {loading ? (
            <div className="text-center py-12 text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl">
              <Package size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm bengali mb-3">{tr('কোনো পণ্য পাওয়া যায়নি।')}</p>
              <button onClick={openAdd} className="text-indigo-600 text-[13px] font-bold bengali">{tr('+ প্রথম পণ্য যোগ করুন')}</button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 ${slim ? 'max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto max-sm:content-start lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:content-start' : ''}`}>
              {pageItems.map(item => (
                <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar item={item} />
                    <div className="min-w-0">
                      <div className="font-bold text-[13px] text-gray-900 bengali truncate">{item.item_name}</div>
                      <div className="text-[10px] text-gray-400">#{item.sku || '—'}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-baseline gap-1">
                      <span className={`font-extrabold text-base ${statusOf(item) !== 'ok' ? 'text-amber-600' : 'text-gray-900'}`}>{item.current_qty}</span>
                      <span className="text-[10px] text-gray-400 bengali">{item.unit}</span>
                    </div>
                    <StatusBadge item={item} />
                  </div>
                  <div className="text-[11px] bengali -mt-1">
                    <span className="font-bold text-emerald-600">{item.sell_price ? `₹${item.sell_price}/${item.unit}` : '—'}</span>
                    <span className="text-gray-400"> {tr('· ক্রয় ₹')}{item.unit_cost}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => adjustQty(item, -1)} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center"><Minus size={11} /></button>
                      <button onClick={() => adjustQty(item, 1)} className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center"><Plus size={11} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(item)}><Pencil size={14} className="text-gray-300 hover:text-indigo-500" /></button>
                      <button onClick={() => remove(item)}><Trash2 size={14} className="text-gray-300 hover:text-red-500" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
            {/* Phones: one compact row per product (a 5-column table does not fit ~340px) */}
            <div className={`sm:hidden border border-gray-100 rounded-xl bg-white divide-y divide-gray-100 ${slim ? 'flex-1 min-h-0 overflow-y-auto' : ''}`}>
              {pageItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 px-2.5 py-2">
                  <button onClick={() => toggleSelect(item.id)} className="flex-shrink-0">
                    {selected.has(item.id) ? <CheckSquare size={16} className="text-indigo-600" /> : <Square size={16} className="text-gray-300" />}
                  </button>
                  <Avatar item={item} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[13px] text-gray-900 bengali truncate">{item.item_name}</div>
                    <div className="mt-0.5"><StatusBadge item={item} /></div>
                    <div className="text-[10px] mt-0.5 truncate">
                      <span className="font-bold text-emerald-600">{item.sell_price ? `₹${item.sell_price}` : '—'}</span>
                      <span className="text-gray-400"> {tr('· ক্রয় ₹')}{item.unit_cost}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => adjustQty(item, -1)} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center"><Minus size={11} /></button>
                    <div className="min-w-[34px] text-center leading-tight">
                      <div className={`font-extrabold text-[13px] ${statusOf(item) !== 'ok' ? 'text-amber-600' : 'text-gray-900'}`}>{item.current_qty}</div>
                      <div className="text-[9px] text-gray-400 bengali">{item.unit}</div>
                    </div>
                    <button onClick={() => adjustQty(item, 1)} className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center"><Plus size={11} /></button>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => openEdit(item)}><Pencil size={13} className="text-gray-400" /></button>
                    <button onClick={() => remove(item)}><Trash2 size={13} className="text-gray-400" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className={`max-sm:hidden overflow-x-auto border border-gray-100 rounded-xl ${slim ? 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto' : ''}`}>
              <table className="w-full text-[12.5px]">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr className="bg-gray-50 text-gray-500 text-[11px] bengali">
                    <th className="p-2.5 text-left w-8">
                      <button onClick={toggleSelectPage}>
                        {pageItems.length > 0 && pageItems.every(i => selected.has(i.id)) ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} className="text-gray-300" />}
                      </button>
                    </th>
                    <th className="p-2.5 text-left">{tr('পণ্য')}</th>
                    <th className={`p-2.5 text-left ${slim ? 'hidden 2xl:table-cell' : 'hidden sm:table-cell'}`}>{tr('ক্যাটাগরি / সাবক্যাটাগরি')}</th>
                    {isGlobal && agentOptions.length > 0 && <th className={`p-2.5 text-left ${agentCol}`}>{tr('এজেন্ট')}</th>}
                    <th className="p-2.5 text-left">{tr('বর্তমান স্টক')}</th>
                    {slim ? (
                      <th className="p-2.5 text-left">{tr('মূল্য (বিক্রয় / ক্রয়)')}</th>
                    ) : (
                      <>
                        <th className={`p-2.5 text-left ${priceCol}`}>{tr('ক্রয়মূল্য')}</th>
                        <th className={`p-2.5 text-left ${priceCol}`}>{tr('বিক্রয়মূল্য')}</th>
                      </>
                    )}
                    <th className="p-2.5 text-left">{tr('স্ট্যাটাস')}</th>
                    <th className="p-2.5 text-right">{tr('আকশন')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(item => {
                    const c = colorFor(item.agent_id)
                    return (
                      <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                        <td className="p-2.5"><button onClick={() => toggleSelect(item.id)}>{selected.has(item.id) ? <CheckSquare size={15} className="text-indigo-600" /> : <Square size={15} className="text-gray-300" />}</button></td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar item={item} />
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 bengali">{item.item_name}</div>
                              <div className="text-[10px] text-gray-400 bengali">#{item.sku || '—'}{slim && item.category ? ` · ${item.category}` : ''}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`p-2.5 ${slim ? 'hidden 2xl:table-cell' : 'hidden sm:table-cell'}`}>
                          <div className="text-gray-700 bengali">{item.category}</div>
                          <div className="text-[10px] text-gray-400 bengali">{item.subcategory || NO_SUBCATEGORY}</div>
                        </td>
                        {isGlobal && agentOptions.length > 0 && (
                          <td className={`p-2.5 ${agentCol}`}>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                              <span className="text-[11px] text-gray-500 bengali">{nameFor(item.agent_id)}</span>
                            </span>
                          </td>
                        )}
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${statusOf(item) !== 'ok' ? 'text-amber-600' : 'text-gray-900'}`}>{item.current_qty}</span>
                            <span className="text-[10px] text-gray-400 bengali">{item.unit}</span>
                            <button onClick={() => adjustQty(item, -1)} className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center"><Minus size={10} /></button>
                            <button onClick={() => adjustQty(item, 1)} className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center"><Plus size={10} /></button>
                          </div>
                        </td>
                        {slim ? (
                          <td className="p-2.5 whitespace-nowrap">
                            <div className="text-emerald-600 font-bold">{item.sell_price ? `₹${item.sell_price}/${item.unit}` : '—'}</div>
                            <div className="text-[10px] text-gray-400">{tr('ক্রয় ₹')}{item.unit_cost}/{item.unit}</div>
                          </td>
                        ) : (
                          <>
                            <td className={`p-2.5 ${priceCol} text-gray-500`}>₹{item.unit_cost}/{item.unit}</td>
                            <td className={`p-2.5 ${priceCol} text-emerald-600 font-semibold`}>{item.sell_price ? `₹${item.sell_price}/${item.unit}` : '—'}</td>
                          </>
                        )}
                        <td className="p-2.5"><StatusBadge item={item} /></td>
                        <td className="p-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(item)}><Pencil size={13} className="text-gray-300 hover:text-indigo-500" /></button>
                            <button onClick={() => remove(item)}><Trash2 size={13} className="text-gray-300 hover:text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex items-center justify-between mt-3 flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 bengali">
                <span>{tr('প্রতি পৃষ্ঠায়')}</span>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="border border-gray-200 rounded-md px-1.5 py-0.5">
                  {[20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>{tr('মোট')} {filtered.length}{tr('টি পণ্য')}</span>
              </div>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30"><ChevronLeft size={13} /></button>
                <span className="text-[12px] font-bold text-gray-600 px-2">{page} / {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-30"><ChevronRight size={13} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{editing ? tr('পণ্য সম্পাদনা') : tr('নতুন পণ্য')}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder={tr('পণ্যের নাম')} value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder={tr('পরিমাণ')} type="number" value={form.current_qty} onChange={e => setForm(f => ({ ...f, current_qty: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali">
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input placeholder={tr('ন্যূনতম (Low alert)')} type="number" value={form.min_qty} onChange={e => setForm(f => ({ ...f, min_qty: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                <input placeholder={tr('ক্রয়মূল্য/একক (₹)')} type="number" value={form.unit_cost} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              </div>
              <input placeholder={tr('বিক্রয়মূল্য/একক (₹)')} type="number" value={form.sell_price} onChange={e => setForm(f => ({ ...f, sell_price: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="grid grid-cols-2 gap-3">
                <input list="stock-cat-list" placeholder={tr('ক্যাটাগরি')} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                <input list="stock-subcat-list" placeholder={tr('সাবক্যাটাগরি')} value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                <datalist id="stock-cat-list">{categoryList.map(c => <option key={c} value={c} />)}</datalist>
                <datalist id="stock-subcat-list">{subcategoryList.map(s => <option key={s} value={s} />)}</datalist>
              </div>
              <div className="flex items-center gap-2">
                <input placeholder="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                <button type="button" onClick={() => setForm(f => ({ ...f, sku: nextSku(items) }))}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-[11px] font-bold text-gray-500 bengali flex-shrink-0">
                  <Sparkles size={12} /> {tr('অটো')}
                </button>
              </div>
              {isGlobal && agentOptions.length > 0 && (
                <select value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali">
                  <option value="">{tr('সাধারণ (কোনো নির্দিষ্ট agent নয়)')}</option>
                  {agentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                </select>
              )}
              <button onClick={save} disabled={saving} className="w-full py-2.5 rounded-lg text-white font-bold text-[13px] bengali disabled:opacity-50" style={{ background: accentColor }}>
                {saving ? tr('সেভ হচ্ছে...') : editing ? tr('আপডেট করুন') : tr('যোগ করুন')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
