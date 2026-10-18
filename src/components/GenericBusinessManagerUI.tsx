'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Plus, Search, Trash2, Check, X, Download, Package, TrendingUp,
  Users, IndianRupee, BarChart2, AlertTriangle, Phone, Loader2,
  Truck, Clock, Settings, Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { BUSINESS_TEMPLATES } from '@/lib/agentUtils'
import SupplyDashboard from '@/components/SupplyDashboard'
import FollowUpDashboard from '@/components/FollowUpDashboard'

type Tab = 'stock' | 'sales' | 'customers' | 'dues' | 'followup' | 'supplier' | 'reports'

interface Props {
  userId: string
  agentId: string
  agentName?: string
  icon?: string
  accentColor?: string
  businessType?: string   // stored per-agent; also doubles as the category scope key
  templateId?: string     // used to seed sensible default categories from BUSINESS_TEMPLATES
}

// IST-aware "today" — Vercel/browsers use UTC via toISOString(), which is
// a day behind India local time between 12:00–5:30 AM IST, causing sales
// made in that window to be stamped/filtered as "yesterday".
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

// Some agents (created before the color-generation logic was fixed, or with
// a stray/pastel value in agents.color) have a very pale accent colour
// stored in the DB. Painting white text/icons on top of a near-white
// background makes the whole header, buttons and active tab basically
// invisible — exactly the "colors not visible" bug. Reject anything too
// light and fall back to the template's proper saturated accent, or a
// sensible default.
function relativeLuminance(hex?: string): number | null {
  if (!hex) return null
  const c = hex.replace('#', '')
  if (c.length !== 6) return null
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  if ([r, g, b].some(Number.isNaN)) return null
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function getReadableAccent(rawColor: string | undefined, templateAccent: string | undefined): string {
  const lum = relativeLuminance(rawColor)
  // Luminance > ~0.55 means white text on it would fail contrast — treat it
  // as a broken/pastel value and use the template's real accent instead.
  if (lum === null || lum <= 0.55) return rawColor || templateAccent || '#4F46E5'
  return templateAccent || '#4F46E5'
}

/**
 * One flexible dashboard that adapts to any business — used for every
 * custom agent whose business_type isn't one of the 5 bespoke verticals
 * (Dokan/Pharmacy/Hotel/Mishti/Kapor). Backed by the same generic tables
 * ReportDashboard/CRMDashboard already used (stock_items, daily_sales,
 * expenses, credit_entries, crm_customers, crm_purchases) — just presented
 * as one cohesive tabbed dashboard with the same visual richness (category
 * chips, themed accent, add-forms) as the bespoke manager UIs.
 */
export default function GenericBusinessManagerUI({
  userId, agentId, agentName = 'আমার ব্যবসা', icon = '⚡', accentColor: accentColorProp = '#4F46E5',
  businessType = 'general', templateId,
}: Props) {
  const [tab, setTab] = useState<Tab>('stock')
  const template = useMemo(() => BUSINESS_TEMPLATES.find(t => t.id === templateId), [templateId])
  // Shadow the raw prop with a contrast-checked value — every usage below
  // keeps referring to `accentColor` unchanged, but now it's guaranteed
  // readable regardless of what's actually stored in agents.color.
  const accentColor = useMemo(
    () => getReadableAccent(accentColorProp, template?.accent),
    [accentColorProp, template]
  )
  const defaultCats = useMemo(() => {
    const fromTemplate = template?.stockCategories?.filter(Boolean) || []
    return ['সব', ...fromTemplate.length ? fromTemplate : ['সাধারণ']]
  }, [template])

  const { categories: CATS, addCategory } = useCustomCategories(userId, businessType, defaultCats)

  // ── Business name (editable, saved per-agent via /api/agent-settings —
  // same endpoint AgentDataPanel already uses for 'general' type agents) ──
  const [bizName, setBizName] = useState(agentName)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(agentName)
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    fetch(`/api/agent-settings?agentId=${agentId}`)
      .then(r => r.json())
      .then(d => {
        if (d.settings?.business_name) {
          setBizName(d.settings.business_name)
          setNameDraft(d.settings.business_name)
        }
      })
      .catch(() => {})
  }, [agentId])

  const saveBizName = async () => {
    const trimmed = nameDraft.trim()
    if (!trimmed) { toast.error('নাম খালি রাখা যাবে না'); return }
    setSavingName(true)
    try {
      await fetch('/api/agent-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, settings: { business_name: trimmed } }),
      })
      setBizName(trimmed)
      setEditingName(false)
      toast.success('নাম সংরক্ষিত ✅')
    } catch {
      toast.error('সেভ হয়নি')
    } finally {
      setSavingName(false)
    }
  }

  // ── Stock ────────────────────────────────────────────────────
  const [stock, setStock] = useState<any[]>([])
  const [stockLoading, setStockLoading] = useState(true)
  const [stockCat, setStockCat] = useState('সব')
  const [stockSearch, setStockSearch] = useState('')
  const [showAddStock, setShowAddStock] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newStock, setNewStock] = useState({ item_name: '', category: defaultCats[1] || 'সাধারণ', current_qty: '', unit: 'pcs', min_qty: '5', unit_cost: '' })
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [editStock, setEditStock] = useState({ item_name: '', category: '', current_qty: '', unit: '', min_qty: '', unit_cost: '' })

  const loadStock = useCallback(async () => {
    const { data, error } = await supabase.from('stock_items').select('*')
      .eq('user_id', userId).eq('agent_id', agentId).order('item_name')
    if (error) console.error('stock_items fetch:', error)
    setStock(data || [])
    setStockLoading(false)
  }, [userId, agentId])

  useEffect(() => { loadStock() }, [loadStock])

  const addStockItem = async () => {
    if (!newStock.item_name.trim() || !newStock.current_qty) { toast.error('নাম ও পরিমাণ দিন'); return }
    const { error } = await supabase.from('stock_items').insert({
      user_id: userId, agent_id: agentId, item_name: newStock.item_name.trim(),
      category: newStock.category, current_qty: Number(newStock.current_qty),
      unit: newStock.unit, min_qty: Number(newStock.min_qty) || 0, unit_cost: Number(newStock.unit_cost) || 0,
    })
    if (error) { console.error('stock insert:', error); toast.error('যোগ করতে সমস্যা হয়েছে'); return }
    toast.success('যোগ হয়েছে')
    setNewStock({ item_name: '', category: newStock.category, current_qty: '', unit: 'pcs', min_qty: '5', unit_cost: '' })
    setShowAddStock(false)
    loadStock()
  }

  const deleteStockItem = async (id: string) => {
    const { error } = await supabase.from('stock_items').delete().eq('id', id)
    if (error) { toast.error('মুছতে সমস্যা হয়েছে'); return }
    setStock(s => s.filter(i => i.id !== id))
  }

  const startEditStock = (item: any) => {
    setEditingStockId(item.id)
    setEditStock({
      item_name: item.item_name || '', category: item.category || '',
      current_qty: String(item.current_qty ?? ''), unit: item.unit || 'pcs',
      min_qty: String(item.min_qty ?? ''), unit_cost: String(item.unit_cost ?? ''),
    })
  }

  const saveEditStock = async () => {
    if (!editingStockId) return
    if (!editStock.item_name.trim()) { toast.error('পণ্যের নাম দিন'); return }
    const payload = {
      item_name: editStock.item_name.trim(), category: editStock.category,
      current_qty: Number(editStock.current_qty) || 0, unit: editStock.unit,
      min_qty: Number(editStock.min_qty) || 0, unit_cost: Number(editStock.unit_cost) || 0,
    }
    const { error } = await supabase.from('stock_items').update(payload).eq('id', editingStockId)
    if (error) { toast.error('আপডেট করতে সমস্যা হয়েছে'); return }
    setStock(s => s.map(i => (i.id === editingStockId ? { ...i, ...payload } : i)))
    toast.success('আপডেট হয়েছে')
    setEditingStockId(null)
  }

  const filteredStock = stock.filter(i =>
    (stockCat === 'সব' || i.category === stockCat) &&
    (!stockSearch || i.item_name.toLowerCase().includes(stockSearch.toLowerCase()))
  )
  const lowStockCount = stock.filter(i => Number(i.current_qty) <= Number(i.min_qty)).length

  // ── Sales ────────────────────────────────────────────────────
  const [sales, setSales] = useState<any[]>([])
  const [salesLoading, setSalesLoading] = useState(true)
  const [showAddSale, setShowAddSale] = useState(false)
  const [newSale, setNewSale] = useState({ item_name: '', quantity: '1', unit_price: '' })

  const loadSales = useCallback(async () => {
    const { data, error } = await supabase.from('daily_sales').select('*')
      .eq('user_id', userId).eq('agent_id', agentId).order('sale_date', { ascending: false }).limit(100)
    if (error) console.error('daily_sales fetch:', error)
    setSales(data || [])
    setSalesLoading(false)
  }, [userId, agentId])

  useEffect(() => { loadSales() }, [loadSales])

  const addSale = async () => {
    if (!newSale.item_name.trim() || !newSale.unit_price) { toast.error('পণ্য ও দাম দিন'); return }
    const { error } = await supabase.from('daily_sales').insert({
      user_id: userId, agent_id: agentId, sale_date: today(),
      item_name: newSale.item_name.trim(), quantity: Number(newSale.quantity) || 1,
      unit_price: Number(newSale.unit_price), source: 'manual',
    })
    if (error) { console.error('sale insert:', error); toast.error('যোগ করতে সমস্যা হয়েছে'); return }
    toast.success('বিক্রি যোগ হয়েছে')
    setNewSale({ item_name: '', quantity: '1', unit_price: '' })
    setShowAddSale(false)
    loadSales()
  }

  const todaySalesTotal = sales.filter(s => s.sale_date === today()).reduce((sum, s) => sum + Number(s.total_amount || 0), 0)

  // ── Customers ────────────────────────────────────────────────
  const [customers, setCustomers] = useState<any[]>([])
  const [custLoading, setCustLoading] = useState(true)
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', notes: '' })
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null)
  const [editCustomer, setEditCustomer] = useState({ name: '', phone: '', address: '', notes: '' })

  const loadCustomers = useCallback(async () => {
    const { data, error } = await supabase.from('crm_customers').select('*')
      .eq('user_id', userId).eq('agent_id', agentId).order('created_at', { ascending: false })
    if (error) console.error('crm_customers fetch:', error)
    setCustomers(data || [])
    setCustLoading(false)
  }, [userId, agentId])

  useEffect(() => { loadCustomers() }, [loadCustomers])

  const addCustomer = async () => {
    if (!newCustomer.name.trim()) { toast.error('নাম দিন'); return }
    const { error } = await supabase.from('crm_customers').insert({
      user_id: userId, agent_id: agentId, business_type: businessType,
      name: newCustomer.name.trim(), phone: newCustomer.phone.trim() || null,
      address: newCustomer.address.trim() || null, notes: newCustomer.notes.trim() || null,
    })
    if (error) { console.error('customer insert:', error); toast.error('যোগ করতে সমস্যা হয়েছে'); return }
    toast.success('কাস্টমার যোগ হয়েছে')
    setNewCustomer({ name: '', phone: '', address: '', notes: '' })
    setShowAddCustomer(false)
    loadCustomers()
  }

  const startEditCustomer = (c: any) => {
    setEditingCustomerId(c.id)
    setEditCustomer({ name: c.name || '', phone: c.phone || '', address: c.address || '', notes: c.notes || '' })
  }

  const saveEditCustomer = async () => {
    if (!editingCustomerId) return
    if (!editCustomer.name.trim()) { toast.error('নাম দিন'); return }
    const { error } = await supabase.from('crm_customers').update({
      name: editCustomer.name.trim(), phone: editCustomer.phone.trim() || null,
      address: editCustomer.address.trim() || null, notes: editCustomer.notes.trim() || null,
    }).eq('id', editingCustomerId).eq('user_id', userId).eq('agent_id', agentId)
    if (error) { console.error('customer update:', error); toast.error('সংরক্ষণ হয়নি'); return }
    toast.success('কাস্টমার আপডেট হয়েছে')
    setEditingCustomerId(null)
    loadCustomers()
  }

  const deleteCustomer = async (id: string) => {
    const { error } = await supabase.from('crm_customers').delete().eq('id', id).eq('user_id', userId).eq('agent_id', agentId)
    if (error) { console.error('customer delete:', error); toast.error('মুছতে সমস্যা হয়েছে'); return }
    toast.success('মুছে ফেলা হয়েছে')
    loadCustomers()
  }


  // ── Dues (বাকি) ──────────────────────────────────────────────
  const [dues, setDues] = useState<any[]>([])
  const [duesLoading, setDuesLoading] = useState(true)
  const [showAddDue, setShowAddDue] = useState(false)
  const [newDue, setNewDue] = useState({ customer_name: '', amount: '', notes: '' })

  const loadDues = useCallback(async () => {
    const { data, error } = await supabase.from('credit_entries').select('*')
      .eq('user_id', userId).eq('agent_id', agentId).order('created_at', { ascending: false })
    if (error) console.error('credit_entries fetch:', error)
    setDues(data || [])
    setDuesLoading(false)
  }, [userId, agentId])

  useEffect(() => { loadDues() }, [loadDues])

  const addDue = async () => {
    if (!newDue.customer_name.trim() || !newDue.amount) { toast.error('নাম ও টাকা দিন'); return }
    const { error } = await supabase.from('credit_entries').insert({
      user_id: userId, agent_id: agentId, customer_name: newDue.customer_name.trim(),
      amount: Number(newDue.amount), notes: newDue.notes.trim() || null, source: 'manual',
    })
    if (error) { console.error('due insert:', error); toast.error('যোগ করতে সমস্যা হয়েছে'); return }
    toast.success('বাকি যোগ হয়েছে')
    setNewDue({ customer_name: '', amount: '', notes: '' })
    setShowAddDue(false)
    loadDues()
  }

  const markDuePaid = async (id: string, amount: number) => {
    const { error } = await supabase.from('credit_entries').update({ paid_amount: amount, status: 'paid' }).eq('id', id)
    if (error) { toast.error('আপডেট করতে সমস্যা হয়েছে'); return }
    loadDues()
  }

  const pendingDues = dues.filter(d => d.status !== 'paid')
  const totalDue = pendingDues.reduce((sum, d) => sum + (Number(d.amount) - Number(d.paid_amount || 0)), 0)

  // ── Vendor/supplier dues — same table SupplyDashboard reads, just
  // summed here for the header stat card (mirrors Dokan's "সরবরাহ বাকি"). ──
  const [supplierDue, setSupplierDue] = useState(0)
  const loadSupplierDue = useCallback(async () => {
    const { data, error } = await supabase.from('vendors').select('due_amount').eq('user_id', userId)
    if (error) { console.error('vendors fetch:', error); return }
    setSupplierDue((data || []).reduce((sum, v: any) => sum + Number(v.due_amount || 0), 0))
  }, [userId])
  useEffect(() => { loadSupplierDue() }, [loadSupplierDue])

  // ── Keep in sync with the AI chat panel ───────────────────────
  // This dashboard and the AgentRunner chat next to it are two independent
  // sibling components — the chat writes stock/sales/customers/dues rows
  // straight to Supabase, but nothing told THIS component to refetch, so a
  // customer added via chat ("customer add koro...") never appeared here
  // until a full page reload. Poll every few seconds so new chat-saved data
  // shows up on its own, on whichever tab the user is looking at.
  useEffect(() => {
    const interval = setInterval(() => {
      loadStock(); loadSales(); loadCustomers(); loadDues(); loadSupplierDue()
    }, 4000)
    return () => clearInterval(interval)
  }, [loadStock, loadSales, loadCustomers, loadDues, loadSupplierDue])

  // ── Shared UI bits ───────────────────────────────────────────
  const TabButton = ({ id, label, icon: I, badge }: { id: Tab; label: string; icon: any; badge?: number }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all bengali ${
        tab === id ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      style={tab === id ? { background: accentColor } : {}}>
      <I size={13} /> {label}
      {!!badge && <span className={`text-[10px] font-bold px-1.5 rounded-full ${tab === id ? 'bg-white/25 text-white' : 'bg-red-100 text-red-600'}`}>{badge}</span>}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Header — same solid-accent card + settings button as DokanManagerUI,
          so every template's dashboard opens with the identical look. */}
      <div className="rounded-2xl p-4 flex items-center gap-3 text-white" style={{ background: accentColor }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 bg-white/20">{icon}</div>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nameDraft}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveBizName(); if (e.key === 'Escape') { setEditingName(false); setNameDraft(bizName) } }}
                className="min-w-0 flex-1 bg-white/20 placeholder-white/60 text-white font-bold text-sm rounded-lg px-2 py-1 outline-none border border-white/30 bengali"
                placeholder="ব্যবসার নাম"
              />
              <button onClick={saveBizName} disabled={savingName} className="p-1 rounded-md bg-white/20 hover:bg-white/30 flex-shrink-0">
                <Check size={14} />
              </button>
              <button onClick={() => { setEditingName(false); setNameDraft(bizName) }} className="p-1 rounded-md bg-white/20 hover:bg-white/30 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="font-bold text-white bengali truncate">{bizName}</div>
              <button onClick={() => { setNameDraft(bizName); setEditingName(true) }} title="নাম পরিবর্তন করুন" className="text-white/70 hover:text-white flex-shrink-0">
                <Pencil size={12} />
              </button>
            </div>
          )}
          <div className="text-[11px] text-white/80 bengali">স্টক, বিক্রি, কাস্টমার, বাকি — সব এক জায়গায়</div>
        </div>
        <button
          onClick={() => { setTab('stock'); setShowAddCategory(true) }}
          title="ক্যাটাগরি সেটিংস"
          className="flex items-center gap-1 text-xs font-bold bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 bengali"
        >
          <Settings size={13} /> সেটিংস
        </button>
      </div>

      {/* Stat cards — same 4-up at-a-glance row as the bespoke library
          agents (Dokan Manager etc.), visible on every tab, not tucked
          away in "রিপোর্ট". */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'আজকের আয়', value: `৳${todaySalesTotal.toLocaleString()}`, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'কাস্টমার বাকি', value: `৳${totalDue.toLocaleString()}`, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'কম স্টক', value: `${lowStockCount}`, color: lowStockCount > 0 ? 'text-amber-700' : 'text-gray-500', bg: lowStockCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200' },
          { label: 'সরবরাহ বাকি', value: `৳${supplierDue.toLocaleString()}`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
        ].map(c => (
          <div key={c.label} className={`rounded-xl p-2.5 border ${c.bg}`}>
            <div className="text-[10px] text-gray-500 bengali truncate">{c.label}</div>
            <div className={`text-sm font-extrabold ${c.color} truncate`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs — same 7-tab set as DokanManagerUI (স্টক/বিক্রি/বাকি/কাস্টমার/
          ফলোআপ/সরবরাহ/রিপোর্ট) on every template's dashboard. */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <TabButton id="stock" label="স্টক" icon={Package} badge={lowStockCount} />
        <TabButton id="sales" label="বিক্রি" icon={TrendingUp} />
        <TabButton id="dues" label="বাকি" icon={IndianRupee} badge={pendingDues.length} />
        <TabButton id="customers" label="কাস্টমার" icon={Users} />
        <TabButton id="followup" label="ফলোআপ" icon={Clock} />
        <TabButton id="supplier" label="সরবরাহ" icon={Truck} />
        <TabButton id="reports" label="রিপোর্ট" icon={BarChart2} />
      </div>

      {/* ── STOCK ── */}
      {tab === 'stock' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input value={stockSearch} onChange={e => setStockSearch(e.target.value)} placeholder="খুঁজুন..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[13px] bengali" />
            </div>
            <button onClick={() => setShowAddStock(s => !s)}
              className="px-3 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1 bengali" style={{ background: accentColor }}>
              <Plus size={13} /> যোগ করুন
            </button>
            <button onClick={() => {
              let csv = 'নাম,ক্যাটাগরি,একক,স্টক,ক্রয়মূল্য\n'
              filteredStock.forEach(i => { csv += `"${i.item_name}","${i.category || ''}","${i.unit}",${i.current_qty},${i.unit_cost || 0}\n` })
              downloadCSV(csv, `${agentName}-stock-${today()}.csv`)
            }} title="CSV ডাউনলোড" className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
              <Download size={13} />
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
            {CATS.map(c => (
              <button key={c} onClick={() => setStockCat(c)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap bengali transition-all ${stockCat === c ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                style={stockCat === c ? { background: accentColor } : {}}>{c}</button>
            ))}
            {showAddCategory ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { const ok = await addCategory(newCategoryName); if (ok) { setNewCategoryName(''); setShowAddCategory(false) } }
                    else if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryName('') }
                  }}
                  placeholder="নতুন ক্যাটাগরি..."
                  className="px-2.5 py-1 rounded-full text-xs border border-gray-300 focus:outline-none focus:ring-1 w-28 bengali" />
                <button onClick={async () => { const ok = await addCategory(newCategoryName); if (ok) { setNewCategoryName(''); setShowAddCategory(false) } }}
                  className="text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                <button onClick={() => { setShowAddCategory(false); setNewCategoryName('') }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddCategory(true)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:text-gray-600 flex items-center gap-1 flex-shrink-0 bengali">
                <Plus size={11} /> ক্যাটাগরি
              </button>
            )}
          </div>

          {showAddStock && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <input placeholder="পণ্যের নাম" value={newStock.item_name} onChange={e => setNewStock(s => ({ ...s, item_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="grid grid-cols-2 gap-2">
                <select value={newStock.category} onChange={e => setNewStock(s => ({ ...s, category: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali">
                  {CATS.filter(c => c !== 'সব').map(c => <option key={c}>{c}</option>)}
                </select>
                <select value={newStock.unit} onChange={e => setNewStock(s => ({ ...s, unit: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]">
                  {['pcs', 'kg', 'litre', 'box', 'গ্রাম'].map(u => <option key={u}>{u}</option>)}
                </select>
                <input type="number" placeholder="পরিমাণ" value={newStock.current_qty} onChange={e => setNewStock(s => ({ ...s, current_qty: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                <input type="number" placeholder="সর্বনিম্ন (alert)" value={newStock.min_qty} onChange={e => setNewStock(s => ({ ...s, min_qty: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                <input type="number" placeholder="প্রতি ইউনিট দাম (৳)" value={newStock.unit_cost} onChange={e => setNewStock(s => ({ ...s, unit_cost: e.target.value }))}
                  className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              </div>
              <div className="flex gap-2">
                <button onClick={addStockItem} className="flex-1 py-2 rounded-lg text-white text-xs font-bold bengali" style={{ background: accentColor }}>যোগ করুন</button>
                <button onClick={() => setShowAddStock(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 bengali">বাতিল</button>
              </div>
            </div>
          )}

          {stockLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : filteredStock.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm bengali">কোনো পণ্য নেই</div>
          ) : (
            <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
              {filteredStock.map(item => {
                const low = Number(item.current_qty) <= Number(item.min_qty)
                if (editingStockId === item.id) {
                  return (
                    <div key={item.id} className="rounded-xl border-2 p-3 space-y-2 bg-indigo-50/40" style={{ borderColor: accentColor }}>
                      <input placeholder="পণ্যের নাম" value={editStock.item_name} onChange={e => setEditStock(s => ({ ...s, item_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="বিভাগ" value={editStock.category} onChange={e => setEditStock(s => ({ ...s, category: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                        <select value={editStock.unit} onChange={e => setEditStock(s => ({ ...s, unit: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]">
                          {['pcs', 'kg', 'litre', 'box', 'গ্রাম'].map(u => <option key={u}>{u}</option>)}
                        </select>
                        <input type="number" placeholder="পরিমাণ" value={editStock.current_qty} onChange={e => setEditStock(s => ({ ...s, current_qty: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                        <input type="number" placeholder="সর্বনিম্ন (alert)" value={editStock.min_qty} onChange={e => setEditStock(s => ({ ...s, min_qty: e.target.value }))}
                          className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                        <input type="number" placeholder="প্রতি ইউনিট দাম (৳)" value={editStock.unit_cost} onChange={e => setEditStock(s => ({ ...s, unit_cost: e.target.value }))}
                          className="col-span-2 px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEditStock} className="flex-1 py-2 rounded-lg text-white text-xs font-bold bengali" style={{ background: accentColor }}>সংরক্ষণ করুন</button>
                        <button onClick={() => setEditingStockId(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 bengali">বাতিল</button>
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={item.id} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border ${low ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'}`}>
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-gray-800 bengali truncate">{item.item_name}</div>
                      <div className="text-[10px] text-gray-400 bengali">{item.category}{Number(item.unit_cost) > 0 ? ` · ৳${Number(item.unit_cost).toLocaleString()}/${item.unit}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className={`text-[13px] font-bold ${low ? 'text-amber-600' : 'text-gray-700'}`}>{item.current_qty} {item.unit}</div>
                      {low && <AlertTriangle size={13} className="text-amber-500" />}
                      <button onClick={() => startEditStock(item)} className="text-gray-300 hover:text-indigo-500"><Pencil size={13} /></button>
                      <button onClick={() => deleteStockItem(item.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SALES ── */}
      {tab === 'sales' && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: `${accentColor}12` }}>
            <div>
              <div className="text-[11px] text-gray-500 bengali">আজকের মোট বিক্রি</div>
              <div className="text-xl font-extrabold text-gray-900">৳{todaySalesTotal.toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAddSale(s => !s)}
                className="px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1 bengali" style={{ background: accentColor }}>
                <Plus size={13} /> বিক্রি যোগ
              </button>
              <button onClick={() => {
                let csv = 'তারিখ,পণ্য/সার্ভিস,পরিমাণ,দাম,মোট\n'
                sales.forEach(s => { csv += `"${s.sale_date}","${s.item_name}",${s.quantity},${s.unit_price},${s.total_amount}\n` })
                downloadCSV(csv, `${agentName}-sales-${today()}.csv`)
              }} title="CSV ডাউনলোড" className="px-3 py-2 rounded-xl bg-white text-gray-600 flex items-center justify-center border border-gray-200">
                <Download size={13} />
              </button>
            </div>
          </div>

          {showAddSale && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <input placeholder="পণ্য/সার্ভিসের নাম" value={newSale.item_name} onChange={e => setNewSale(s => ({ ...s, item_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="পরিমাণ" value={newSale.quantity} onChange={e => setNewSale(s => ({ ...s, quantity: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                <input type="number" placeholder="প্রতি ইউনিট দাম (৳)" value={newSale.unit_price} onChange={e => setNewSale(s => ({ ...s, unit_price: e.target.value }))}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              </div>
              <div className="flex gap-2">
                <button onClick={addSale} className="flex-1 py-2 rounded-lg text-white text-xs font-bold bengali" style={{ background: accentColor }}>যোগ করুন</button>
                <button onClick={() => setShowAddSale(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 bengali">বাতিল</button>
              </div>
            </div>
          )}

          {salesLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : sales.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm bengali">কোনো বিক্রি রেকর্ড নেই</div>
          ) : (
            <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
              {sales.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-gray-100">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-gray-800 bengali truncate">{s.item_name}</div>
                    <div className="text-[10px] text-gray-400">{s.sale_date} · {s.quantity} × ৳{s.unit_price}</div>
                  </div>
                  <div className="text-[13px] font-bold text-gray-700 flex-shrink-0">৳{Number(s.total_amount).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS ── */}
      {tab === 'customers' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setShowAddCustomer(s => !s)}
              className="flex-1 px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1 bengali" style={{ background: accentColor }}>
              <Plus size={13} /> কাস্টমার যোগ করুন
            </button>
            <button onClick={() => {
              let csv = 'নাম,ফোন,ঠিকানা,নোট\n'
              customers.forEach(c => { csv += `"${c.name}","${c.phone || ''}","${c.address || ''}","${c.notes || ''}"\n` })
              downloadCSV(csv, `${agentName}-customers-${today()}.csv`)
            }} title="CSV ডাউনলোড" className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center">
              <Download size={13} />
            </button>
          </div>

          {showAddCustomer && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <input placeholder="নাম" value={newCustomer.name} onChange={e => setNewCustomer(c => ({ ...c, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder="ফোন নম্বর" value={newCustomer.phone} onChange={e => setNewCustomer(c => ({ ...c, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <input placeholder="ঠিকানা (ঐচ্ছিক)" value={newCustomer.address} onChange={e => setNewCustomer(c => ({ ...c, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <textarea placeholder="নোট (ঐচ্ছিক)" value={newCustomer.notes} onChange={e => setNewCustomer(c => ({ ...c, notes: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="flex gap-2">
                <button onClick={addCustomer} className="flex-1 py-2 rounded-lg text-white text-xs font-bold bengali" style={{ background: accentColor }}>যোগ করুন</button>
                <button onClick={() => setShowAddCustomer(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 bengali">বাতিল</button>
              </div>
            </div>
          )}

          {custLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm bengali">কোনো কাস্টমার নেই</div>
          ) : (
            <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
              {customers.map(c => (
                editingCustomerId === c.id ? (
                  <div key={c.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                    <input placeholder="নাম" value={editCustomer.name} onChange={e => setEditCustomer(v => ({ ...v, name: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                    <input placeholder="ফোন নম্বর" value={editCustomer.phone} onChange={e => setEditCustomer(v => ({ ...v, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
                    <input placeholder="ঠিকানা (ঐচ্ছিক)" value={editCustomer.address} onChange={e => setEditCustomer(v => ({ ...v, address: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                    <textarea placeholder="নোট (ঐচ্ছিক)" value={editCustomer.notes} onChange={e => setEditCustomer(v => ({ ...v, notes: e.target.value }))} rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
                    <div className="flex gap-2">
                      <button onClick={saveEditCustomer} className="flex-1 py-2 rounded-lg text-white text-xs font-bold bengali" style={{ background: accentColor }}>সংরক্ষণ করুন</button>
                      <button onClick={() => setEditingCustomerId(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 bengali">বাতিল</button>
                    </div>
                  </div>
                ) : (
                <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-gray-100">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-gray-800 bengali truncate">{c.name}</div>
                    {c.address && <div className="text-[10px] text-gray-400 bengali truncate">{c.address}</div>}
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-[11px] font-bold" style={{ color: accentColor }}>
                        <Phone size={11} /> {c.phone}
                      </a>
                    )}
                    <button onClick={() => startEditCustomer(c)} className="text-gray-300 hover:text-indigo-500"><Pencil size={13} /></button>
                    <button onClick={() => deleteCustomer(c.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                </div>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DUES (বাকি) ── */}
      {tab === 'dues' && (
        <div className="space-y-3">
          <div className="rounded-2xl p-4 flex items-center justify-between bg-amber-50 border border-amber-100">
            <div>
              <div className="text-[11px] text-amber-600 bengali">মোট বাকি</div>
              <div className="text-xl font-extrabold text-amber-700">৳{totalDue.toLocaleString()}</div>
            </div>
            <button onClick={() => setShowAddDue(s => !s)}
              className="px-3.5 py-2 rounded-xl text-white text-xs font-bold flex items-center gap-1 bengali" style={{ background: accentColor }}>
              <Plus size={13} /> বাকি যোগ
            </button>
          </div>

          {pendingDues.length > 0 && (
            <button onClick={() => {
              let csv = 'কাস্টমার,মোট,পরিশোধ,বাকি,নোট\n'
              pendingDues.forEach(d => { csv += `"${d.customer_name}",${d.amount},${d.paid_amount || 0},${Number(d.amount) - Number(d.paid_amount || 0)},"${d.notes || ''}"\n` })
              downloadCSV(csv, `${agentName}-dues-${today()}.csv`)
            }} className="text-[11px] font-bold text-gray-500 flex items-center gap-1 bengali">
              <Download size={11} /> CSV ডাউনলোড
            </button>
          )}

          {showAddDue && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
              <input placeholder="কাস্টমারের নাম" value={newDue.customer_name} onChange={e => setNewDue(d => ({ ...d, customer_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input type="number" placeholder="টাকার পরিমাণ" value={newDue.amount} onChange={e => setNewDue(d => ({ ...d, amount: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <input placeholder="নোট (ঐচ্ছিক)" value={newDue.notes} onChange={e => setNewDue(d => ({ ...d, notes: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="flex gap-2">
                <button onClick={addDue} className="flex-1 py-2 rounded-lg text-white text-xs font-bold bengali" style={{ background: accentColor }}>যোগ করুন</button>
                <button onClick={() => setShowAddDue(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 bengali">বাতিল</button>
              </div>
            </div>
          )}

          {duesLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : pendingDues.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm bengali">কোনো বাকি নেই 🎉</div>
          ) : (
            <div className="space-y-1.5 max-h-[230px] overflow-y-auto pr-1">
              {pendingDues.map(d => (
                <div key={d.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-gray-100">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-gray-800 bengali truncate">{d.customer_name}</div>
                    {d.notes && <div className="text-[10px] text-gray-400 bengali truncate">{d.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-[13px] font-bold text-amber-600">৳{(Number(d.amount) - Number(d.paid_amount || 0)).toLocaleString()}</div>
                    <button onClick={() => markDuePaid(d.id, d.amount)}
                      className="text-[10px] font-bold text-emerald-600 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-50 bengali">পরিশোধ</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ফলোআপ (customers to follow up + low stock alerts) — same
          generic component the dashboard's own "ফলোআপ" nav item uses,
          now embedded per-template so it matches Dokan's dashboard. ── */}
      {tab === 'followup' && <FollowUpDashboard userId={userId} agentId={agentId} />}

      {/* ── সরবরাহ (supplier/vendor dues) — same generic component the
          dashboard's own "সরবরাহ" nav item uses. ── */}
      {tab === 'supplier' && (
        <div onClick={() => { /* keep due total fresh right after any edit inside */ setTimeout(loadSupplierDue, 500) }}>
          <SupplyDashboard userId={userId} />
        </div>
      )}

      {/* ── REPORTS ── */}
      {tab === 'reports' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4 bg-white border border-gray-100">
            <div className="text-[11px] text-gray-400 bengali mb-1">আজকের বিক্রি</div>
            <div className="text-lg font-extrabold text-gray-900">৳{todaySalesTotal.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100">
            <div className="text-[11px] text-gray-400 bengali mb-1">মোট পণ্য</div>
            <div className="text-lg font-extrabold text-gray-900">{stock.length}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100">
            <div className="text-[11px] text-gray-400 bengali mb-1">কম স্টক</div>
            <div className="text-lg font-extrabold text-amber-600">{lowStockCount}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100">
            <div className="text-[11px] text-gray-400 bengali mb-1">কাস্টমার বাকি</div>
            <div className="text-lg font-extrabold text-amber-600">৳{totalDue.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100">
            <div className="text-[11px] text-gray-400 bengali mb-1">সরবরাহ বাকি</div>
            <div className="text-lg font-extrabold text-orange-600">৳{supplierDue.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl p-4 bg-white border border-gray-100">
            <div className="text-[11px] text-gray-400 bengali mb-1">মোট কাস্টমার</div>
            <div className="text-lg font-extrabold text-gray-900">{customers.length}</div>
          </div>
        </div>
      )}
    </div>
  )
}
