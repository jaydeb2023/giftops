'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Plus, Search, Trash2, Edit2, Save, Download,
  Loader2, Check, X, Phone, MessageCircle,
  Send, Printer, IndianRupee, Package,
  BarChart2, Users, Truck, Tag, BookOpen,
  AlertTriangle, TrendingUp, Settings, Clock, Filter,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'
import StockManager from '@/components/StockManager'

// This panel is only ever mounted for the one prebuilt Dokan Manager library
// agent, so its agent_id tag is fixed — not a prop. All reads/writes below
// go through the canonical tables (stock_items / daily_sales / crm_customers
// / credit_entries / crm_purchases), the same ones /api/business-chat writes
// to and the global Dashboard (Overview/বিক্রি/স্টক/বাকি) reads from.
// dokan_suppliers and dokan_profiles stay as-is — they're vertical-only
// concepts with no canonical equivalent.
const DOKAN_AGENT_ID = LIBRARY_AGENT_IDS.dokan

// ─── Types ────────────────────────────────────────────────────────
interface Product {
  id: string
  user_id?: string
  name: string
  category: string
  stock: number
  unit: string
  price: number
  cost_price: number
  min_stock: number
}

interface Sale {
  id: string
  user_id?: string
  customer_name: string
  customer_phone: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  paid_amount: number
  due_amount: number
  sale_date: string
  payment_status: string
  notes: string
}

interface Customer {
  id: string
  user_id?: string
  name: string
  father_name?: string
  phone: string
  address: string
  notes: string
  total_due: number
  total_spent: number
  last_visit: string
}

interface Supplier {
  id: string
  user_id?: string
  supplier_name: string
  phone: string
  item_ordered: string
  qty_ordered: number
  unit: string
  cost_total: number
  paid_amount: number
  due_amount: number
  order_date: string
  expected_date: string
  status: string
  notes: string
}

interface ShopProfile {
  shop_name: string
  owner_name: string
  phone: string
  address: string
  upi_id: string
  gstin: string
  print_footer: string
  logo_url?: string
}

// ─── Helpers ──────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function fmtAmt(n: number) { return `₹${Number(n || 0).toFixed(0)}` }
function downloadCSV(csv: string, fn: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click()
}

const DEFAULT_DOKAN_CATS = ['সব', 'চাল-ডাল', 'তেল-মশলা', 'আটা-ময়দা', 'চা-চিনি', 'সাবান-শ্যাম্পু', 'বিস্কুট-চকোলেট', 'ডিম-মাছ-মাংস', 'সবজি-ফল', 'পানীয়', 'স্টেশনারি', 'অন্যান্য']
const UNITS = ['কেজি', 'গ্রাম', 'লিটার', 'মিলি', 'পিস', 'প্যাকেট', 'বস্তা', 'ডজন', 'বোতল', 'কার্টন']
const ACCENT = '#16a34a' // green — general store colour

// ══════════════════════════════════════════════════════════════════
export default function DokanManagerUI({ userId: propUserId, initialTab }: { userId?: string; initialTab?: string }) {
  const [userId, setUserId] = useState<string | null>(propUserId || null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(initialTab || 'stock')

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [profile, setProfile] = useState<ShopProfile>({
    shop_name: 'আমার দোকান', owner_name: '', phone: '', address: '', upi_id: '', gstin: '', print_footer: 'ধন্যবাদ! আবার আসবেন 🙏', logo_url: ''
  })
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Stock tab
  const [prodSearch, setProdSearch] = useState('')
  const [prodCat, setProdCat] = useState('সব')
  const { categories: DOKAN_CATS, addCategory } = useCustomCategories(userId || undefined, 'dokan', DEFAULT_DOKAN_CATS)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddProd, setShowAddProd] = useState(false)
  const [editProd, setEditProd] = useState<Product | null>(null)
  const [editCust, setEditCust] = useState<Customer | null>(null)
  const [newProd, setNewProd] = useState<Partial<Product>>({ category: 'চাল-ডাল', unit: 'কেজি', stock: 0, min_stock: 5 })
  const [savingProd, setSavingProd] = useState(false)

  // Sale tab
  const [showNewSale, setShowNewSale] = useState(false)
  const [saleProdId, setSaleProdId] = useState('')
  const [saleQty, setSaleQty] = useState(1)
  const [saleUnit, setSaleUnit] = useState('কেজি')
  const [salePrice, setSalePrice] = useState(0)
  const [saleCustName, setSaleCustName] = useState('')
  const [saleCustPhone, setSaleCustPhone] = useState('')
  const [salePaid, setSalePaid] = useState(0)
  const [saleNotes, setSaleNotes] = useState('')
  const [savingSale, setSavingSale] = useState(false)
  const [saleFilter, setSaleFilter] = useState('all') // all | due | paid

  // Baki tab (credit ledger)
  const [bakiSearch, setBakiSearch] = useState('')
  const [payingSale, setPayingSale] = useState<Sale | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [savingPay, setSavingPay] = useState(false)

  // Customer tab
  const [custSearch, setCustSearch] = useState('')
  const [showAddCust, setShowAddCust] = useState(false)
  const [newCust, setNewCust] = useState<Partial<Customer>>({})
  const [savingCust, setSavingCust] = useState(false)
  const [msgCust, setMsgCust] = useState<Customer | null>(null)
  const [msgText, setMsgText] = useState('')

  // Supplier tab
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ order_date: today(), status: 'ordered', unit: 'কেজি' })
  const [savingSupplier, setSavingSupplier] = useState(false)

  // Customer filter/sort + billing date range
  const [custFilter, setCustFilter] = useState<'all' | 'due' | 'clear'>('all')
  const [custSort, setCustSort] = useState<'name' | 'due_desc' | 'recent'>('name')
  const [billFrom, setBillFrom] = useState('')
  const [billTo, setBillTo] = useState('')

  // Settings
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Loaders ───────────────────────────────────────────────────
  // Kept for supplier/profile calls below, which still use dokan_suppliers /
  // dokan_profiles (no canonical equivalent exists for those).
  const scopeToAgent = (q: any) => q.eq('agent_id', DOKAN_AGENT_ID)

  const loadProducts = async (uid: string) => {
    const { data, error } = await supabase.from('stock_items').select('*')
      .eq('user_id', uid).eq('agent_id', DOKAN_AGENT_ID).order('item_name')
    if (error) { console.error('loadProducts:', error); return }
    setProducts((data || []).map((r: any): Product => ({
      id: r.id, user_id: r.user_id,
      name: r.item_name, category: r.category || 'অন্যান্য',
      stock: Number(r.current_qty || 0), unit: r.unit || 'কেজি',
      price: Number(r.sell_price || 0), cost_price: Number(r.unit_cost || 0),
      min_stock: Number(r.min_qty || 0),
    })))
  }

  // Sale tab reads crm_purchases (has paid/due/status built in, joined to
  // crm_customers for name+phone) as the primary source, plus any daily_sales
  // rows with no matching purchase — e.g. a cash sale recorded via chat with
  // no customer named, which only ever gets a daily_sales row.
  const loadSales = async (uid: string) => {
    const [purchRes, dsRes] = await Promise.all([
      supabase.from('crm_purchases')
        .select('*, crm_customers!inner(name, phone, agent_id)')
        .eq('user_id', uid).eq('crm_customers.agent_id', DOKAN_AGENT_ID)
        .order('purchase_date', { ascending: false }).limit(200),
      supabase.from('daily_sales').select('*')
        .eq('user_id', uid).eq('agent_id', DOKAN_AGENT_ID)
        .order('sale_date', { ascending: false }).limit(200),
    ])
    if (purchRes.error) console.error('loadSales (crm_purchases):', purchRes.error)
    if (dsRes.error) console.error('loadSales (daily_sales):', dsRes.error)

    const fromPurchases: Sale[] = (purchRes.data || []).map((r: any): Sale => ({
      id: r.id, user_id: r.user_id,
      customer_name: r.crm_customers?.name || 'নগদ',
      customer_phone: r.crm_customers?.phone || '',
      item_name: r.item_name, quantity: Number(r.quantity || 0), unit: r.unit || 'কেজি',
      unit_price: Number(r.unit_price || 0), total_amount: Number(r.total_amount || 0),
      paid_amount: Number(r.paid_amount || 0), due_amount: Number(r.due_amount || 0),
      sale_date: r.purchase_date, payment_status: r.payment_status || 'paid',
      notes: r.notes || '',
    }))
    // Loose de-dupe key (no shared id between the two tables) so a sale
    // that already has a crm_purchases row isn't shown twice.
    const already = new Set(fromPurchases.map(p => `${p.sale_date}|${p.item_name}|${p.total_amount}`))
    const cashOnly: Sale[] = (dsRes.data || [])
      .filter((r: any) => !already.has(`${r.sale_date}|${r.item_name}|${r.total_amount}`))
      .map((r: any): Sale => ({
        id: r.id, user_id: r.user_id,
        customer_name: 'নগদ', customer_phone: '',
        item_name: r.item_name, quantity: Number(r.quantity || 0), unit: 'কেজি',
        unit_price: Number(r.unit_price || 0), total_amount: Number(r.total_amount || 0),
        paid_amount: Number(r.total_amount || 0), due_amount: 0,
        sale_date: r.sale_date, payment_status: 'paid', notes: r.notes || '',
      }))
    setSales([...fromPurchases, ...cashOnly].sort((a, b) => b.sale_date.localeCompare(a.sale_date)))
  }

  const loadCustomers = async (uid: string) => {
    const { data, error } = await supabase.from('crm_customers').select('*')
      .eq('user_id', uid).eq('agent_id', DOKAN_AGENT_ID).order('name')
    if (error) { console.error('loadCustomers:', error); return }
    const custs = data || []
    // total_due / total_spent aren't stored columns on crm_customers — derive
    // them from credit_entries (unpaid balance) and crm_purchases (lifetime spend).
    const [creditRes, purchRes] = await Promise.all([
      supabase.from('credit_entries').select('customer_name, amount, paid_amount, status')
        .eq('user_id', uid).eq('agent_id', DOKAN_AGENT_ID).neq('status', 'paid'),
      custs.length
        ? supabase.from('crm_purchases').select('customer_id, total_amount, purchase_date')
            .eq('user_id', uid).in('customer_id', custs.map((c: any) => c.id))
        : Promise.resolve({ data: [] as any[] }),
    ])
    const dueByName: Record<string, number> = {}
    for (const c of creditRes.data || []) {
      dueByName[c.customer_name] = (dueByName[c.customer_name] || 0) + Math.max(0, Number(c.amount) - Number(c.paid_amount))
    }
    const spentById: Record<string, number> = {}
    const lastVisitById: Record<string, string> = {}
    for (const p of (purchRes as any).data || []) {
      spentById[p.customer_id] = (spentById[p.customer_id] || 0) + Number(p.total_amount || 0)
      if (!lastVisitById[p.customer_id] || p.purchase_date > lastVisitById[p.customer_id]) {
        lastVisitById[p.customer_id] = p.purchase_date
      }
    }
    setCustomers(custs.map((r: any): Customer => ({
      id: r.id, user_id: r.user_id, name: r.name, father_name: r.father_name || '',
      phone: r.phone || '', address: r.address || '', notes: r.notes || '',
      total_due: dueByName[r.name] || 0,
      total_spent: spentById[r.id] || 0,
      last_visit: lastVisitById[r.id] || r.updated_at?.slice(0, 10) || r.created_at?.slice(0, 10) || today(),
    })))
  }

  const loadSuppliers = async (uid: string) => {
    const { data } = await supabase.from('dokan_suppliers').select('*').eq('user_id', uid).order('order_date', { ascending: false })
    if (data) setSuppliers(data)
  }
  const loadProfile = async (uid: string) => {
    const { data, error } = await supabase.from('dokan_profiles').select('*').eq('user_id', uid).maybeSingle()
    if (error) console.error('dokan_profiles load failed:', error)
    if (data) setProfile({ shop_name: data.shop_name || 'আমার দোকান', owner_name: data.owner_name || '', phone: data.phone || '', address: data.address || '', upi_id: data.upi_id || '', gstin: data.gstin || '', print_footer: data.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏', logo_url: data.logo_url || '' })
  }

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const uid = propUserId || (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)
      await Promise.all([loadProducts(uid), loadSales(uid), loadCustomers(uid), loadSuppliers(uid), loadProfile(uid)])
      setLoading(false)
    }
    init()
  }, [propUserId])

  useEffect(() => {
    if (!userId) return
    const reloadAll = async () => {
      await Promise.all([loadProducts(userId), loadSales(userId), loadCustomers(userId), loadSuppliers(userId)])
    }
    ;(window as any).__dokanReload = reloadAll
    return () => { delete (window as any).__dokanReload }
  }, [userId])

  // ── Derived ───────────────────────────────────────────────────
  const todaySales = sales.filter(s => s.sale_date === today())
  const todayRevenue = todaySales.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const todayCollection = todaySales.reduce((s, r) => s + Number(r.paid_amount || 0), 0)
  const totalDue = customers.reduce((s, c) => s + Number(c.total_due || 0), 0)
  const supplierDue = suppliers.reduce((s, sup) => s + Number(sup.due_amount || 0), 0)
  const lowStock = products.filter(p => Number(p.stock) <= Number(p.min_stock))
  const selectedProd = products.find(p => p.id === saleProdId)
  const saleTotal = saleQty * salePrice
  const filteredProds = products.filter(p => {
    const mq = !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase())
    const mc = prodCat === 'সব' || p.category === prodCat
    return mq && mc
  })
  // When "সব" is selected, group products by category so each category shows as its own section
  const groupedProds = filteredProds.reduce((acc: Record<string, Product[]>, p) => {
    const key = p.category || 'অন্যান্য'
    ;(acc[key] = acc[key] || []).push(p)
    return acc
  }, {} as Record<string, Product[]>)
  const groupedCatOrder = DOKAN_CATS.filter(c => c !== 'সব' && groupedProds[c]?.length)
    .concat(Object.keys(groupedProds).filter(c => !DOKAN_CATS.includes(c)))
  const filteredCusts = customers
    .filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))
    .filter(c => custFilter === 'all' ? true : custFilter === 'due' ? (c.total_due || 0) > 0 : (c.total_due || 0) === 0)
    .sort((a, b) => {
      if (custSort === 'due_desc') return (b.total_due || 0) - (a.total_due || 0)
      if (custSort === 'recent') return (b.last_visit || '').localeCompare(a.last_visit || '')
      return a.name.localeCompare(b.name)
    })
  const dueSales = sales.filter(s => Number(s.due_amount) > 0)
  const filteredBaki = dueSales.filter(s => !bakiSearch || s.customer_name.toLowerCase().includes(bakiSearch.toLowerCase()) || s.customer_phone?.includes(bakiSearch))

  // Billing filtered by date range (report tab)
  const billedSales = sales.filter(s => (!billFrom || s.sale_date >= billFrom) && (!billTo || s.sale_date <= billTo))

  // Follow-up: customers with no due, who haven't visited in 14+ days (or never)
  const followUpCusts = customers
    .filter(c => (c.total_due || 0) === 0)
    .map(c => {
      const days = c.last_visit ? Math.floor((Date.now() - new Date(c.last_visit).getTime()) / 86400000) : Infinity
      return { ...c, daysSince: days }
    })
    .filter(c => c.daysSince >= 14)
    .sort((a, b) => b.daysSince - a.daysSince)

  // Last 7 days sales trend (for report tab chart)
  const salesTrend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    const dayTotal = sales.filter(s => s.sale_date === key).reduce((s, r) => s + Number(r.total_amount || 0), 0)
    return { day: d.toLocaleDateString('bn-BD', { weekday: 'short' }), amount: dayTotal }
  })

  // ── Product CRUD ──────────────────────────────────────────────
  const saveProduct = async () => {
    if (!newProd.name?.trim()) { toast.error('পণ্যের নাম দিন'); return }
    if (!userId) return
    setSavingProd(true)
    try {
      const payload = {
        user_id: userId, agent_id: DOKAN_AGENT_ID, item_name: newProd.name.trim(),
        category: newProd.category || 'অন্যান্য',
        unit: newProd.unit || 'কেজি',
        current_qty: Number(newProd.stock || 0),
        min_qty: Number(newProd.min_stock || 5),
        sell_price: Number(newProd.price || 0),
        unit_cost: Number(newProd.cost_price || 0),
      }
      if (editProd) {
        await supabase.from('stock_items').update(payload).eq('id', editProd.id)
        toast.success('আপডেট হয়েছে!')
      } else {
        await supabase.from('stock_items').insert(payload)
        toast.success('পণ্য যোগ হয়েছে! ✅')
      }
      setNewProd({ category: 'চাল-ডাল', unit: 'কেজি', stock: 0, min_stock: 5 })
      setShowAddProd(false); setEditProd(null)
      await loadProducts(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingProd(false) }
  }

  const quickStock = async (prod: Product, delta: number) => {
    const newQty = Math.max(0, Number(prod.stock) + delta)
    await supabase.from('stock_items').update({ current_qty: newQty }).eq('id', prod.id)
    setProducts(products.map(p => p.id === prod.id ? { ...p, stock: newQty } : p))
  }

  // ── Sale ──────────────────────────────────────────────────────
  const saveSale = async () => {
    if (!saleProdId || !saleQty || !salePrice) { toast.error('পণ্য ও দাম দিন'); return }
    if (!userId) return
    setSavingSale(true)
    try {
      const due = Math.max(0, saleTotal - salePaid)
      const itemName = selectedProd ? `${selectedProd.name}` : 'অজানা'
      const custName = saleCustName?.trim() || 'নগদ'
      const paymentStatus = due <= 0 ? 'paid' : salePaid > 0 ? 'partial' : 'pending'

      // 1. Mirror into daily_sales — this is what the global Dashboard's
      //    Overview/বিক্রি totals read (pooled across every agent).
      await supabase.from('daily_sales').insert({
        user_id: userId, agent_id: DOKAN_AGENT_ID, sale_date: today(),
        item_name: itemName, quantity: saleQty, unit_price: salePrice,
        notes: custName !== 'নগদ' ? `খদ্দের: ${custName}` : '',
        source: 'manual',
      })

      // 2. Resolve/create the customer — even a generic "নগদ" one — so this
      //    sale has a crm_purchases row and shows up in this panel's Sale tab.
      let custId: string | null = null
      const { data: existingCust } = await supabase.from('crm_customers')
        .select('id').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
        .eq('name', custName).maybeSingle()
      if (existingCust) {
        custId = existingCust.id
        if (saleCustPhone) await supabase.from('crm_customers').update({ phone: saleCustPhone }).eq('id', existingCust.id)
      } else {
        const { data: created } = await supabase.from('crm_customers').insert({
          user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan',
          name: custName, phone: saleCustPhone || '',
        }).select('id').single()
        custId = created?.id || null
      }

      // 3. crm_purchases — the detailed record this panel's Sale tab reads.
      if (custId) {
        await supabase.from('crm_purchases').insert({
          user_id: userId, customer_id: custId, purchase_date: today(),
          item_name: itemName, quantity: saleQty, unit: saleUnit, unit_price: salePrice,
          paid_amount: salePaid, payment_status: paymentStatus, notes: saleNotes, source: 'manual',
        })
      }

      // 4. Deduct stock
      if (selectedProd) {
        await supabase.from('stock_items').update({
          current_qty: Math.max(0, Number(selectedProd.stock) - saleQty)
        }).eq('id', selectedProd.id)
      }

      // 5. Baki ledger
      if (due > 0) {
        await supabase.from('credit_entries').insert({
          user_id: userId, agent_id: DOKAN_AGENT_ID, customer_name: custName,
          amount: saleTotal, paid_amount: salePaid,
          status: salePaid > 0 ? 'partial' : 'pending', notes: itemName, source: 'manual',
        })
      }

      toast.success('বিক্রি সেভ হয়েছে! ✅')
      if (confirm('রসিদ প্রিন্ট করবেন?')) printBill(itemName, saleQty, saleUnit, salePrice, saleTotal, salePaid, saleCustName)
      setSaleProdId(''); setSaleQty(1); setSalePrice(0); setSaleCustName(''); setSaleCustPhone(''); setSalePaid(0); setSaleNotes(''); setShowNewSale(false)
      await Promise.all([loadSales(userId), loadProducts(userId), loadCustomers(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingSale(false) }
  }

  // ── Payment ───────────────────────────────────────────────────
  const savePayment = async () => {
    if (!payingSale || !userId) return
    setSavingPay(true)
    try {
      const newPaid = Number(payingSale.paid_amount) + Number(payAmount)
      const newDue = Math.max(0, Number(payingSale.total_amount) - newPaid)
      // payingSale.id here is a crm_purchases row id — only rows sourced
      // from crm_purchases ever have due_amount > 0, so this modal can only
      // ever be opened on those.
      await supabase.from('crm_purchases').update({
        paid_amount: newPaid,
        payment_status: newDue <= 0 ? 'paid' : 'partial'
      }).eq('id', payingSale.id)
      // Close/update the matching credit_entries row (best-effort match —
      // credit_entries has no direct FK back to the originating sale).
      const { data: creditRow } = await supabase.from('credit_entries')
        .select('id, paid_amount').eq('user_id', userId).eq('agent_id', DOKAN_AGENT_ID)
        .eq('customer_name', payingSale.customer_name).eq('notes', payingSale.item_name)
        .neq('status', 'paid').order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (creditRow) {
        const creditNewPaid = Number(creditRow.paid_amount) + Number(payAmount)
        await supabase.from('credit_entries').update({
          paid_amount: creditNewPaid, status: newDue <= 0 ? 'paid' : 'partial'
        }).eq('id', creditRow.id)
      }
      toast.success(`${fmtAmt(payAmount)} পেমেন্ট রেকর্ড! ✅`)
      setPayingSale(null); setPayAmount(0)
      await Promise.all([loadSales(userId), loadCustomers(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingPay(false) }
  }

  // ── Customer ──────────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!newCust.name?.trim()) { toast.error('নাম দিন'); return }
    if (!userId) return
    setSavingCust(true)
    try {
      if (editCust) {
        await supabase.from('crm_customers').update({
          name: newCust.name.trim(), father_name: newCust.father_name || '', phone: newCust.phone || '',
          address: newCust.address || '', notes: newCust.notes || '',
        }).eq('id', editCust.id)
        toast.success('খদ্দের আপডেট হয়েছে!')
      } else {
        // Prevent duplicate by exact name match, within this agent only
        const { data: existing } = await scopeToAgent(supabase.from('crm_customers')
          .select('id').eq('user_id', userId).eq('name', newCust.name.trim())).maybeSingle()
        if (existing) { toast.error('এই নামে খদ্দের আগেই আছে!'); setSavingCust(false); return }
        await supabase.from('crm_customers').insert({
          user_id: userId, agent_id: DOKAN_AGENT_ID, business_type: 'dokan', name: newCust.name.trim(),
          father_name: newCust.father_name || '', phone: newCust.phone || '', address: newCust.address || '',
          notes: newCust.notes || '',
        })
        toast.success('খদ্দের যোগ হয়েছে!')
      }
      setNewCust({}); setShowAddCust(false); setEditCust(null)
      await loadCustomers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingCust(false) }
  }

  const shareWhatsApp = (c: Customer, customMsg?: string) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const msg = customMsg || ((c.total_due || 0) > 0
      ? `নমস্কার ${c.name}দা! ${profile.shop_name}-এ আপনার বাকি আছে *${fmtAmt(c.total_due)}*। সুবিধামতো দিয়ে যাবেন। 🙏`
      : `নমস্কার ${c.name}! ${profile.shop_name} থেকে যোগাযোগ করা হচ্ছে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // Send a formatted bill/invoice as WhatsApp text — with or without GST
  const [billGst, setBillGst] = useState<Record<string, boolean>>({})
  const sendBillWhatsApp = (s: Sale) => {
    const phone = s.customer_phone?.replace(/[^0-9]/g, '') || ''
    if (!phone) { toast.error('খদ্দেরের ফোন নম্বর নেই'); return }
    const withGst = !!billGst[s.id]
    const gstAmt = withGst ? Number(s.total_amount) * 0.18 : 0
    const grandTotal = Number(s.total_amount) + gstAmt
    const lines = [
      `🧾 *${profile.shop_name}*`,
      profile.gstin && withGst ? `GSTIN: ${profile.gstin}` : '',
      '───────────────',
      `পণ্য: ${s.item_name}`,
      `পরিমাণ: ${s.quantity} ${s.unit} × ₹${s.unit_price}`,
      `উপমোট: ${fmtAmt(s.total_amount)}`,
      withGst ? `GST (18%): ₹${gstAmt.toFixed(0)}` : '',
      `*মোট: ${fmtAmt(grandTotal)}*`,
      `পরিশোধ: ${fmtAmt(s.paid_amount)}`,
      Number(s.due_amount) > 0 ? `বাকি: ${fmtAmt(s.due_amount)}` : '✅ সম্পূর্ণ পরিশোধিত',
      '───────────────',
      profile.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏',
    ].filter(Boolean)
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank')
  }

  // ── Supplier ──────────────────────────────────────────────────
  const saveSupplier = async () => {
    if (!newSupplier.supplier_name?.trim() || !newSupplier.item_ordered?.trim()) {
      toast.error('সরবরাহকারী ও পণ্যের নাম দিন'); return
    }
    if (!userId) return
    setSavingSupplier(true)
    try {
      const due = Math.max(0, Number(newSupplier.cost_total || 0) - Number(newSupplier.paid_amount || 0))
      await supabase.from('dokan_suppliers').insert({
        user_id: userId, agent_id: DOKAN_AGENT_ID,
        supplier_name: newSupplier.supplier_name.trim(),
        phone: newSupplier.phone || '',
        item_ordered: newSupplier.item_ordered.trim(),
        qty_ordered: Number(newSupplier.qty_ordered || 0),
        unit: newSupplier.unit || 'কেজি',
        cost_total: Number(newSupplier.cost_total || 0),
        paid_amount: Number(newSupplier.paid_amount || 0),
        due_amount: due,
        order_date: newSupplier.order_date || today(),
        expected_date: newSupplier.expected_date || '',
        status: 'ordered',
        notes: newSupplier.notes || '',
      })
      toast.success('অর্ডার যোগ হয়েছে!')
      setNewSupplier({ order_date: today(), status: 'ordered', unit: 'কেজি' })
      setShowAddSupplier(false)
      await loadSuppliers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingSupplier(false) }
  }

  const updateSupplierStatus = async (sup: Supplier, status: string) => {
    await supabase.from('dokan_suppliers').update({ status }).eq('id', sup.id)
    setSuppliers(suppliers.map(s => s.id === sup.id ? { ...s, status } : s))
    toast.success('আপডেট হয়েছে!')
  }

  // ── Print ─────────────────────────────────────────────────────
  const printBill = (itemName: string, qty: number, unit: string, price: number, total: number, paid: number, custName: string, gstPercent: number = 0) => {
    const due = total - paid
    const gstAmt = gstPercent > 0 ? (total * gstPercent / 100) : 0
    const totalWithGst = total + gstAmt
    const billNo = `INV-${Date.now().toString().slice(-6)}`
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>রসিদ - ${profile.shop_name}</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
*{box-sizing:border-box}
body{font-family:'Hind Siliguri',sans-serif;padding:16px;max-width:380px;margin:auto;color:#111;font-size:13px}
.header{text-align:center;border-bottom:2px solid #16a34a;padding-bottom:10px;margin-bottom:10px}
h2{color:#16a34a;margin:0 0 3px;font-size:20px;font-weight:700}
.sub{font-size:11px;color:#555}
.bill-no{display:flex;justify-content:space-between;font-size:11px;color:#777;margin-bottom:10px;padding:6px;background:#f9fafb;border-radius:6px}
.customer{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;margin-bottom:10px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
th{background:#16a34a;color:white;padding:6px 8px;text-align:left;font-size:11px}
td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
tr:last-child td{border-bottom:none}
.total-row{background:#f0fdf4;font-weight:700}
.gst-row{color:#6b7280;font-size:11px}
.paid-row{color:#16a34a;font-weight:600}
.due-row{color:#dc2626;font-weight:700;background:#fef2f2}
.footer{text-align:center;margin-top:12px;font-size:11px;color:#888;border-top:1px dashed #ccc;padding-top:10px}
.upi{text-align:center;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px;margin:8px 0;font-size:12px}
.badge{display:inline-block;background:#16a34a;color:white;font-size:9px;padding:1px 6px;border-radius:10px;margin-left:4px}
@media print{body{padding:0}button{display:none}}
</style></head><body>
<div class="header">
  <h2>🏪 ${profile.shop_name}</h2>
  <div class="sub">${profile.address || ''}${profile.phone ? ' | ' + profile.phone : ''}</div>
  ${profile.gstin ? `<div class="sub" style="margin-top:2px">GSTIN: <b>${profile.gstin}</b></div>` : ''}
</div>
<div class="bill-no">
  <span>রসিদ নং: <b>${billNo}</b></span>
  <span>তারিখ: <b>${new Date().toLocaleDateString('bn-IN', {day:'numeric',month:'short',year:'numeric'})}</b></span>
</div>
${custName && custName !== 'নগদ' ? `<div class="customer">👤 <b>খদ্দের:</b> ${custName}</div>` : '<div class="customer">👤 নগদ বিক্রি</div>'}
<table>
<tr><th>পণ্য</th><th>পরিমাণ</th><th>দর</th><th>মোট</th></tr>
<tr><td>${itemName}</td><td>${qty} ${unit}</td><td>₹${price.toFixed(0)}/${unit}</td><td>₹${total.toFixed(0)}</td></tr>
<tr class="total-row"><td colspan="3">উপমোট</td><td>₹${total.toFixed(0)}</td></tr>
${gstPercent > 0 ? `<tr class="gst-row"><td colspan="3">GST (${gstPercent}%)</td><td>₹${gstAmt.toFixed(2)}</td></tr>
<tr class="total-row"><td colspan="3"><b>মোট (GST সহ)</b></td><td><b>₹${totalWithGst.toFixed(0)}</b></td></tr>` : ''}
<tr class="paid-row"><td colspan="3">✅ পরিশোধ</td><td>₹${paid.toFixed(0)}</td></tr>
${due > 0 ? `<tr class="due-row"><td colspan="3">⚠️ বাকি</td><td>₹${due.toFixed(0)}</td></tr>` : '<tr style="color:#16a34a"><td colspan="3">পরিপূর্ণ পরিশোধ</td><td>✅</td></tr>'}
</table>
${profile.upi_id ? `<div class="upi">💳 UPI Payment: <b>${profile.upi_id}</b></div>` : ''}
<div class="footer">
  <p style="margin:0 0 4px">${profile.print_footer}</p>
  <p style="margin:0;font-size:10px;color:#aaa">Powered by Sahayak AI · sahayakai.tech</p>
</div>
</body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 300)
  }

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('dokan_profiles').upsert({ user_id: userId, ...profile }, { onConflict: 'user_id' })
      if (error) throw error
      toast.success('সেটিংস সেভ হয়েছে! ✅')
    } catch (e: any) {
      console.error('dokan_profiles save failed:', e)
      toast.error(e.message || 'সেভ করা যায়নি')
    } finally { setSavingProfile(false) }
  }

  const onPickShopLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingLogo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${DOKAN_AGENT_ID}/logo-${uuidv4()}.${ext}`
      const { error } = await supabase.storage.from('catalog-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('catalog-images').getPublicUrl(path)
      const updated = { ...profile, logo_url: data.publicUrl }
      setProfile(updated)
      const { error: upErr } = await supabase.from('dokan_profiles').upsert({ user_id: userId, ...updated }, { onConflict: 'user_id' })
      if (upErr) throw upErr
      toast.success('লোগো আপলোড হয়েছে! ✅')
    } catch (err: any) {
      toast.error(err.message || 'লোগো আপলোড করা যায়নি')
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const TABS = [
    { id: 'stock',    label: 'স্টক',      icon: <Package size={13} /> },
    { id: 'sale',     label: 'বিক্রি',    icon: <IndianRupee size={13} /> },
    { id: 'baki',     label: 'বাকি',      icon: <BookOpen size={13} /> },
    { id: 'customers',label: 'খদ্দের',   icon: <Users size={13} /> },
    { id: 'followup', label: 'ফলোআপ',    icon: <Clock size={13} /> },
    { id: 'supplier', label: 'সরবরাহ',   icon: <Truck size={13} /> },
    { id: 'report',   label: 'রিপোর্ট',  icon: <BarChart2 size={13} /> },
    { id: 'settings', label: 'সেটিংস',   icon: <Settings size={13} /> },
  ]

  // ══════════════════════════════════════════════════════════════
  if (loading) return (
    <div className="flex items-center justify-center py-16 text-green-600">
      <Loader2 className="animate-spin mr-2" size={22} />
      <span className="bengali text-sm">লোড হচ্ছে...</span>
    </div>
  )
  if (!userId) return (
    <div className="text-center py-16">
      <p className="bengali text-gray-500 mb-3">লগইন করুন</p>
      <a href="/login" className="bg-green-600 text-white px-6 py-2 rounded-xl text-sm bengali">লগইন</a>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          {profile.logo_url
            ? <img src={profile.logo_url} alt={profile.shop_name} className="w-10 h-10 rounded-xl object-cover bg-white/20 flex-shrink-0" />
            : null}
          <div>
            <div className="font-black text-lg bengali">{!profile.logo_url && '🏪 '}{profile.shop_name}</div>
            <div className="text-xs opacity-80 bengali">{profile.address || 'ঠিকানা সেট করুন → সেটিংস'}</div>
          </div>
        </div>
        <button onClick={() => setTab('settings')}
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold bengali flex items-center gap-1">
          <Settings size={12} /> সেটিংস
        </button>
      </div>

      {/* ── Stats ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue),    color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
          { label: 'উঠেছে',         value: fmtAmt(todayCollection), color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
          { label: 'খদ্দের বাকি',  value: fmtAmt(totalDue),        color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
          { label: 'সরবরাহ বাকি', value: fmtAmt(supplierDue),      color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-3`}>
            <div className={`font-extrabold text-lg ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Low stock alert ───────────────────────────────────── */}
      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3">
          <div className="font-bold text-amber-800 bengali text-sm mb-1 flex items-center gap-1">
            <AlertTriangle size={14} /> কম স্টক — নতুন মাল আনুন
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStock.map(p => (
              <span key={p.id} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg bengali">
                📦 {p.name} ({p.stock} {p.unit})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bengali transition-all
              ${tab === t.id ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setShowNewSale(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 bengali whitespace-nowrap">
          <Plus size={13} /> নতুন বিক্রি
        </button>
      </div>

      {/* ════════ NEW SALE FORM ════════ */}
      {showNewSale && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between">
            <div className="font-bold text-green-800 bengali">🛒 নতুন বিক্রি</div>
            <button onClick={() => setShowNewSale(false)}><X size={16} className="text-gray-400" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 bengali">পণ্য বেছে নিন *</label>
              <select value={saleProdId} onChange={e => {
                setSaleProdId(e.target.value)
                const p = products.find(x => x.id === e.target.value)
                if (p) { setSalePrice(p.price); setSaleUnit(p.unit) }
              }} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                <option value="">বেছে নিন</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — স্টক: {p.stock} {p.unit}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">পরিমাণ</label>
              <input type="number" min={0.1} step={0.1} value={saleQty}
                onChange={e => setSaleQty(+e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">একক</label>
              <select value={saleUnit} onChange={e => setSaleUnit(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">দাম (₹/{saleUnit})</label>
              <input type="number" value={salePrice || ''}
                onChange={e => setSalePrice(+e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">খদ্দেরের নাম</label>
              <input type="text" value={saleCustName}
                onChange={e => setSaleCustName(e.target.value)}
                placeholder="নগদ"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 bengali">ফোন নম্বর</label>
              <input type="tel" value={saleCustPhone}
                onChange={e => setSaleCustPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
          </div>

          {saleTotal > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-sm font-bold">
                <span className="bengali">মোট</span><span>{fmtAmt(saleTotal)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="bengali text-sm text-gray-600 flex-1">পরিশোধ</span>
                <input type="number" min={0} value={salePaid || ''}
                  onChange={e => setSalePaid(+e.target.value)}
                  className="w-28 border-2 border-green-400 rounded-lg px-2 py-1.5 text-sm font-bold text-right" />
              </div>
              {saleTotal - salePaid > 0 && salePaid >= 0 && (
                <div className="flex justify-between text-sm bg-red-50 rounded-lg px-2 py-1.5">
                  <span className="bengali text-red-600 font-semibold">বাকি থাকবে</span>
                  <span className="font-bold text-red-600">{fmtAmt(saleTotal - salePaid)}</span>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 bengali">নোট</label>
            <input type="text" value={saleNotes} onChange={e => setSaleNotes(e.target.value)}
              placeholder="বিশেষ নির্দেশনা..."
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
          </div>

          <div className="flex gap-2">
            <button onClick={saveSale} disabled={savingSale}
              className="flex-1 bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
              {savingSale ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} সেভ করুন
            </button>
            <button onClick={() => setShowNewSale(false)}
              className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}

      {/* ════════ STOCK TAB ════════
          Redesigned: now delegates to the shared StockManager component
          (stats cards, status tabs, category/subcategory sidebar, table,
          bulk actions, print, Excel export, pagination) — the same UI
          used on the global cross-agent স্টক page. Scoped to this agent
          via agentId, using this shop's own category list/adder so
          "+ ক্যাটাগরি" still saves into custom_categories as before. */}
      {tab === 'stock' && userId && (
        <StockManager
          userId={userId}
          agentId={DOKAN_AGENT_ID}
          categories={DOKAN_CATS}
          onAddCategory={addCategory}
          accentColor={ACCENT}
          compact
          onDataChange={() => loadProducts(userId)}
          title="স্টক"
          subtitle="আপনার পণ্যের বর্তমান স্টক দেখুন, যোগ করুন, আপডেট করুন এবং পরিচালনা করুন।"
        />
      )}

      {/* ════════ SALE TAB ════════ */}
      {tab === 'sale' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-bold text-gray-700 bengali text-sm">বিক্রির ইতিহাস ({sales.length})</div>
            <div className="flex gap-1">
              {[['all', 'সব'], ['due', 'বাকি'], ['paid', 'পরিশোধ']].map(([v, l]) => (
                <button key={v} onClick={() => setSaleFilter(v)}
                  className={`px-2 py-1 rounded-lg text-xs bengali ${saleFilter === v ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{l}</button>
              ))}
            </div>
          </div>
          {sales.filter(s => saleFilter === 'all' || (saleFilter === 'due' ? Number(s.due_amount) > 0 : Number(s.due_amount) <= 0)).length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">এখনো কোনো বিক্রি নেই</div>
            : (
              <div className="overflow-y-auto space-y-2" style={{ maxHeight: '380px' }}>
                {sales.filter(s => saleFilter === 'all' || (saleFilter === 'due' ? Number(s.due_amount) > 0 : Number(s.due_amount) <= 0)).slice(0, 50).map(s => (
                  <div key={s.id} className={`border rounded-xl p-3 ${Number(s.due_amount) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800 bengali text-sm">{s.item_name}</div>
                        <div className="text-xs text-gray-500 bengali">{s.customer_name} · {s.sale_date} · {s.quantity} {s.unit} × ₹{s.unit_price}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-800">{fmtAmt(s.total_amount)}</div>
                        {Number(s.due_amount) > 0
                          ? <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-xs text-red-500 bengali">বাকি {fmtAmt(s.due_amount)}</span>
                              <button onClick={() => { setPayingSale(s); setPayAmount(Number(s.due_amount)) }}
                                className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">নিন</button>
                            </div>
                          : <span className="text-xs text-green-600 bengali">✅ পরিশোধ</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <button onClick={() => printBill(s.item_name, s.quantity, s.unit, s.unit_price, s.total_amount, s.paid_amount, s.customer_name, billGst[s.id] ? 18 : 0)}
                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg bengali flex items-center gap-0.5">
                        <Printer size={11} /> প্রিন্ট
                      </button>
                      <button onClick={() => sendBillWhatsApp(s)}
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg bengali flex items-center gap-0.5">
                        <MessageCircle size={11} /> বিল পাঠান
                      </button>
                      <label className="text-xs text-gray-400 bengali flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={!!billGst[s.id]}
                          onChange={e => setBillGst(p => ({ ...p, [s.id]: e.target.checked }))} />
                        GST (18%) সহ
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ════════ BAKI TAB ════════ */}
      {tab === 'baki' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-700 bengali text-sm flex items-center gap-1"><BookOpen size={14} /> হালখাতা — বাকির হিসাব</div>
              <div className="text-xs text-red-500 bengali">মোট বাকি: {fmtAmt(totalDue)}</div>
            </div>
            <button onClick={() => {
              let csv = 'তারিখ,খদ্দের,পণ্য,মোট,পরিশোধ,বাকি\n'
              dueSales.forEach(s => { csv += `"${s.sale_date}","${s.customer_name}","${s.item_name}",${s.total_amount},${s.paid_amount},${s.due_amount}\n` })
              downloadCSV(csv, `dokan-baki-${today()}.csv`)
            }} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
            <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
              placeholder="নাম বা ফোন..." value={bakiSearch} onChange={e => setBakiSearch(e.target.value)} />
          </div>

          {/* Summary by customer */}
          {customers.filter(c => (c.total_due || 0) > 0).length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 font-semibold bengali uppercase">খদ্দের অনুযায়ী বাকি</div>
              {customers.filter(c => (c.total_due || 0) > 0)
                .sort((a, b) => (b.total_due || 0) - (a.total_due || 0))
                .map(c => (
                  <div key={c.id} className="bg-white border border-red-100 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-800 bengali text-sm">{c.name}</div>
                      {c.phone && <div className="text-xs text-gray-400 flex items-center gap-1"><Phone size={9} />{c.phone}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-red-600">{fmtAmt(c.total_due || 0)}</span>
                      <button onClick={() => shareWhatsApp(c)}
                        className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg"><MessageCircle size={14} /></button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          <div className="text-xs text-gray-500 font-semibold bengali uppercase mt-2">বাকির বিস্তারিত</div>
          {filteredBaki.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">🎉 কোনো বাকি নেই</div>
            : (
              <div className="overflow-y-auto space-y-2" style={{ maxHeight: '260px' }}>
                {filteredBaki.map(s => (
                  <div key={s.id} className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-gray-800 bengali text-sm">{s.item_name}</div>
                        <div className="text-xs text-gray-500 bengali">{s.customer_name} · {s.sale_date}</div>
                        {s.customer_phone && <div className="text-xs text-gray-400 flex items-center gap-1"><Phone size={9} />{s.customer_phone}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-red-600">{fmtAmt(s.due_amount)}</div>
                        <button onClick={() => { setPayingSale(s); setPayAmount(Number(s.due_amount)) }}
                          className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full bengali mt-0.5">পেমেন্ট নিন</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {/* ════════ CUSTOMERS TAB ════════ */}
      {tab === 'customers' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {[{ id: 'all', label: 'সব' }, { id: 'due', label: 'বাকি আছে' }, { id: 'clear', label: 'ক্লিয়ার' }].map(f => (
              <button key={f.id} onClick={() => setCustFilter(f.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-bold bengali border ${custFilter === f.id ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-500 border-gray-200'}`}>
                {f.label}
              </button>
            ))}
            <select value={custSort} onChange={e => setCustSort(e.target.value as any)}
              className="ml-auto text-xs border border-gray-200 rounded-lg px-2 py-1 bengali bg-white">
              <option value="name">নাম অনুযায়ী</option>
              <option value="due_desc">বেশি বাকি আগে</option>
              <option value="recent">সাম্প্রতিক ভিজিট আগে</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
                placeholder="নাম বা ফোন..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowAddCust(true)}
              className="bg-green-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> খদ্দের
            </button>
            <button onClick={() => {
              let csv = 'নাম,পিতার নাম,ফোন,ঠিকানা,মোট বাকি,মোট কেনা\n'
              customers.forEach(c => { csv += `"${c.name}","${c.father_name || ''}","${c.phone}","${c.address}",${c.total_due},${c.total_spent}\n` })
              downloadCSV(csv, `dokan-customers-${today()}.csv`)
            }} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          {showAddCust && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-green-800 bengali text-sm">{editCust ? '✏️ খদ্দের সম্পাদনা' : '👤 নতুন খদ্দের'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'নাম *', key: 'name', type: 'text', full: true },
                  { label: 'পিতার নাম', key: 'father_name', type: 'text', full: true },
                  { label: 'ফোন', key: 'phone', type: 'tel' },
                  { label: 'ঠিকানা', key: 'address', type: 'text' },
                  { label: 'নোট', key: 'notes', type: 'text', full: true },
                ].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newCust as any)[f.key] || ''}
                      onChange={e => setNewCust(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCustomer} disabled={savingCust}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingCust ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => { setShowAddCust(false); setEditCust(null); setNewCust({}) }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {filteredCusts.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{customers.length === 0 ? '👤 খদ্দের নেই' : 'পাওয়া যায়নি'}</div>
            : filteredCusts.map(c => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 bengali">{c.name}</div>
                    {c.father_name && <div className="text-xs text-gray-400 bengali">পিতা: {c.father_name}</div>}
                    {c.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</div>}
                    {c.address && <div className="text-xs text-gray-400 bengali">📍 {c.address}</div>}
                    <div className="text-xs text-gray-400 bengali mt-0.5">
                      মোট কেনা: {fmtAmt(c.total_spent || 0)} · শেষ ভিজিট: {c.last_visit || 'নেই'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(c.total_due || 0) > 0
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold bengali">বাকি {fmtAmt(c.total_due || 0)}</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">✅ ক্লিয়ার</span>}
                    <div className="flex gap-1">
                      <button onClick={() => shareWhatsApp(c)} className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg" title="WhatsApp"><MessageCircle size={13} /></button>
                      <button onClick={() => { setMsgCust(c); setMsgText('') }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg" title="Message"><Send size={13} /></button>
                      <button onClick={() => {
                        setEditCust(c)
                        setNewCust({ name: c.name, father_name: c.father_name, phone: c.phone, address: c.address, notes: c.notes })
                        setShowAddCust(true)
                      }} className="text-orange-400 hover:bg-orange-50 p-1.5 rounded-lg" title="Edit"><Edit2 size={12} /></button>
                      <button onClick={async () => {
                        if (!confirm('মুছবেন?')) return
                        await supabase.from('crm_customers').delete().eq('id', c.id)
                        setCustomers(customers.filter(x => x.id !== c.id))
                      }} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg" title="Delete"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ════════ FOLLOW-UP TAB ════════ */}
      {tab === 'followup' && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 bengali">
            💡 যেসব খদ্দের ১৪+ দিন ধরে আসেননি (বাকি নেই এমন) — তাদের একটা মনে করিয়ে দেওয়ার মেসেজ পাঠান
          </div>
          {followUpCusts.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">🎉 সবাই সাম্প্রতিক এসেছেন, ফলোআপ দরকার নেই</div>
            : followUpCusts.map(c => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-800 bengali">{c.name}</div>
                  {c.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</div>}
                  <div className="text-xs text-amber-600 bengali mt-0.5">
                    {c.daysSince === Infinity ? 'কখনো ভিজিট করেননি' : `${c.daysSince} দিন ধরে আসেননি`}
                  </div>
                </div>
                <button
                  onClick={() => shareWhatsApp(c, `নমস্কার ${c.name}, অনেকদিন আপনাকে দোকানে দেখিনি! নতুন পণ্য এসেছে, একবার ঘুরে যান 🙏 — ${profile.shop_name}`)}
                  className="bg-green-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
                  <MessageCircle size={13} /> মনে করিয়ে দিন
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ════════ SUPPLIER TAB ════════ */}
      {tab === 'supplier' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-bold text-gray-700 bengali text-sm">সরবরাহকারী অর্ডার</div>
              {supplierDue > 0 && <div className="text-xs text-red-500 bengali">মোট দেনা: {fmtAmt(supplierDue)}</div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => {
                let csv = 'সরবরাহকারী,পণ্য,পরিমাণ,মোট,পরিশোধ,বাকি,তারিখ,স্ট্যাটাস\n'
                suppliers.forEach(s => { csv += `"${s.supplier_name}","${s.item_ordered}",${s.qty_ordered},${s.cost_total},${s.paid_amount},${s.due_amount},"${s.order_date}","${s.status}"\n` })
                downloadCSV(csv, `dokan-suppliers-${today()}.csv`)
              }} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
              <button onClick={() => setShowAddSupplier(true)}
                className="bg-green-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
                <Plus size={13} /> অর্ডার
              </button>
            </div>
          </div>

          {showAddSupplier && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-green-800 bengali text-sm">🚚 নতুন অর্ডার</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'সরবরাহকারীর নাম *', key: 'supplier_name', type: 'text', full: true },
                  { label: 'ফোন', key: 'phone', type: 'tel' },
                  { label: 'কোন পণ্য *', key: 'item_ordered', type: 'text', full: true },
                  { label: 'পরিমাণ', key: 'qty_ordered', type: 'number' },
                  { label: 'মোট দাম (₹)', key: 'cost_total', type: 'number' },
                  { label: 'অগ্রিম (₹)', key: 'paid_amount', type: 'number' },
                  { label: 'অর্ডারের তারিখ', key: 'order_date', type: 'date' },
                  { label: 'আসার তারিখ', key: 'expected_date', type: 'date' },
                  { label: 'নোট', key: 'notes', type: 'text', full: true },
                ].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newSupplier as any)[f.key] || ''}
                      onChange={e => setNewSupplier(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">একক</label>
                  <select value={newSupplier.unit} onChange={e => setNewSupplier(p => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {Number(newSupplier.cost_total) > 0 && (
                <div className="bg-white border border-red-200 rounded-xl px-3 py-2 text-sm bengali text-red-600">
                  বাকি দেনা: {fmtAmt(Math.max(0, Number(newSupplier.cost_total) - Number(newSupplier.paid_amount || 0)))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={saveSupplier} disabled={savingSupplier}
                  className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingSupplier ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => setShowAddSupplier(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {suppliers.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">কোনো অর্ডার নেই</div>
            : suppliers.map(sup => (
              <div key={sup.id} className={`border rounded-xl p-3 ${sup.status === 'received' ? 'bg-green-50 border-green-200' : sup.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-white border-green-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 bengali text-sm">{sup.supplier_name}</div>
                    <div className="text-xs text-gray-500 bengali">{sup.item_ordered} · {sup.qty_ordered} {sup.unit} · {sup.order_date}</div>
                    {sup.expected_date && <div className="text-xs text-gray-400 bengali">আসার তারিখ: {sup.expected_date}</div>}
                    {sup.notes && <div className="text-xs text-gray-400 bengali">{sup.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{fmtAmt(sup.cost_total)}</div>
                    {Number(sup.due_amount) > 0 && <div className="text-xs text-red-500 bengali">দেনা: {fmtAmt(sup.due_amount)}</div>}
                    <span className={`text-xs font-semibold bengali ${sup.status === 'received' ? 'text-green-600' : sup.status === 'cancelled' ? 'text-gray-400' : 'text-orange-600'}`}>
                      {sup.status === 'received' ? '✅ পেয়েছি' : sup.status === 'cancelled' ? '❌ বাতিল' : '🚚 অপেক্ষায়'}
                    </span>
                  </div>
                </div>
                {sup.status === 'ordered' && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => updateSupplierStatus(sup, 'received')}
                      className="flex-1 bg-green-100 text-green-700 py-1.5 rounded-xl text-xs font-bold bengali hover:bg-green-200">✅ মাল পেয়েছি</button>
                    <button onClick={() => updateSupplierStatus(sup, 'cancelled')}
                      className="bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold bengali hover:bg-red-200">বাতিল</button>
                    <button onClick={async () => {
                      if (!confirm('মুছবেন?')) return
                      await supabase.from('dokan_suppliers').delete().eq('id', sup.id)
                      setSuppliers(suppliers.filter(x => x.id !== sup.id))
                    }} className="bg-gray-100 p-1.5 rounded-xl"><Trash2 size={13} className="text-gray-400" /></button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ════════ REPORT TAB ════════ */}
      {tab === 'report' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="font-bold text-gray-700 bengali text-sm mb-2">📊 গত ৭ দিনের বিক্রির গ্রাফ</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={salesTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [`৳${v}`, 'বিক্রি']} />
                <Bar dataKey="amount" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), icon: '📈', color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'উঠেছে আজ', value: fmtAmt(todayCollection), icon: '💵', color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'খদ্দের বাকি', value: fmtAmt(totalDue), icon: '💸', color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'সরবরাহ দেনা', value: fmtAmt(supplierDue), icon: '🚚', color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'মোট পণ্য', value: `${products.length}টি`, icon: '📦', color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'কম স্টক', value: `${lowStock.length}টি`, icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'মোট বিক্রি (আজ)', value: `${todaySales.length}টি`, icon: '🛒', color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'মোট খদ্দের', value: `${customers.length}জন`, icon: '👥', color: 'text-indigo-700', bg: 'bg-indigo-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className={`font-black text-xl ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 bengali">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Top baki customers */}
          {customers.filter(c => (c.total_due || 0) > 0).length > 0 && (
            <div>
              <div className="font-bold text-gray-700 bengali text-sm mb-2">🏆 সবচেয়ে বেশি বাকি</div>
              {customers.filter(c => (c.total_due || 0) > 0)
                .sort((a, b) => (b.total_due || 0) - (a.total_due || 0)).slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2 mb-1.5">
                    <div className="bengali text-sm font-semibold">#{i + 1} {c.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-red-600 text-sm">{fmtAmt(c.total_due || 0)}</span>
                      <button onClick={() => shareWhatsApp(c)} className="text-green-500"><MessageCircle size={14} /></button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Top selling products */}
          {products.length > 0 && (
            <div>
              <div className="font-bold text-gray-700 bengali text-sm mb-2">📦 কম স্টকের পণ্য</div>
              {products.filter(p => Number(p.stock) <= Number(p.min_stock)).slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-1.5">
                  <div className="bengali text-sm font-semibold">{p.name}</div>
                  <span className="text-xs text-amber-700 font-bold bengali">{p.stock} {p.unit} বাকি</span>
                </div>
              ))}
            </div>
          )}

          {/* Date-wise billing */}
          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="font-bold text-gray-700 bengali text-sm mb-2 flex items-center gap-1"><Filter size={13} /> তারিখ অনুযায়ী বিলিং</div>
            <div className="flex gap-2 mb-2">
              <input type="date" value={billFrom} onChange={e => setBillFrom(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              <input type="date" value={billTo} onChange={e => setBillTo(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
              {(billFrom || billTo) && (
                <button onClick={() => { setBillFrom(''); setBillTo('') }} className="text-xs text-gray-400 bengali px-2">মুছুন</button>
              )}
            </div>
            <div className="text-sm bengali mb-2">
              <span className="text-gray-500">মোট {billedSales.length}টি বিল · </span>
              <span className="font-bold text-green-700">{fmtAmt(billedSales.reduce((s, r) => s + Number(r.total_amount || 0), 0))}</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {billedSales.slice(0, 50).map(s => (
                <div key={s.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-2 py-1.5">
                  <span className="bengali">{s.sale_date} · {s.customer_name || 'সাধারণ'}</span>
                  <span className="font-bold">{fmtAmt(s.total_amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CSV downloads */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => {
              let csv = 'তারিখ,পণ্য,খদ্দের,পরিমাণ,একক,দর,মোট,পরিশোধ,বাকি\n'
              billedSales.forEach(s => { csv += `"${s.sale_date}","${s.item_name}","${s.customer_name}",${s.quantity},"${s.unit}",${s.unit_price},${s.total_amount},${s.paid_amount},${s.due_amount}\n` })
              downloadCSV(csv, `dokan-sales-${billFrom || 'all'}-to-${billTo || today()}.csv`); toast.success('বিক্রির রিপোর্ট ডাউনলোড!')
            }} className="bg-green-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> বিক্রির রিপোর্ট
            </button>
            <button onClick={() => {
              let csv = 'নাম,বিভাগ,একক,স্টক,ক্রয়মূল্য,বিক্রয়মূল্য\n'
              products.forEach(p => { csv += `"${p.name}","${p.category}","${p.unit}",${p.stock},${p.cost_price},${p.price}\n` })
              downloadCSV(csv, `dokan-stock-${today()}.csv`); toast.success('স্টক রিপোর্ট ডাউনলোড!')
            }} className="bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> স্টক রিপোর্ট
            </button>
            <button onClick={() => {
              let csv = 'নাম,ফোন,মোট বাকি,মোট কেনা,শেষ ভিজিট\n'
              customers.forEach(c => { csv += `"${c.name}","${c.phone}",${c.total_due},${c.total_spent},"${c.last_visit}"\n` })
              downloadCSV(csv, `dokan-baki-${today()}.csv`); toast.success('বাকির রিপোর্ট ডাউনলোড!')
            }} className="col-span-2 bg-red-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> বাকির সম্পূর্ণ রিপোর্ট
            </button>
          </div>
        </div>
      )}

      {/* ════════ SETTINGS TAB ════════ */}
      {tab === 'settings' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
          <div className="font-bold text-green-800 bengali text-sm">🏪 দোকানের তথ্য</div>

          <div>
            <label className="text-xs text-gray-500 bengali">দোকানের লোগো</label>
            <div className="flex items-center gap-3 mt-1">
              {profile.logo_url
                ? <img src={profile.logo_url} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-green-200" />
                : <div className="w-14 h-14 rounded-xl bg-white border border-dashed border-green-300 flex items-center justify-center text-2xl">🏪</div>}
              <label className="cursor-pointer bg-white border border-green-300 text-green-700 px-3 py-1.5 rounded-lg text-xs font-bold bengali flex items-center gap-1.5">
                {uploadingLogo ? <Loader2 className="animate-spin" size={13} /> : <Plus size={13} />}
                {uploadingLogo ? 'আপলোড হচ্ছে...' : 'লোগো আপলোড করুন'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={onPickShopLogo} />
              </label>
            </div>
          </div>

          {[
            { label: 'দোকানের নাম *', key: 'shop_name', placeholder: 'যেমন: রহিম স্টোর' },
            { label: 'মালিকের নাম', key: 'owner_name', placeholder: '' },
            { label: 'ফোন নম্বর', key: 'phone', placeholder: '' },
            { label: 'ঠিকানা', key: 'address', placeholder: 'পাড়া, এলাকা' },
            { label: 'UPI ID', key: 'upi_id', placeholder: 'name@upi' },
            { label: 'রসিদের শেষে বার্তা', key: 'print_footer', placeholder: 'ধন্যবাদ! আবার আসবেন 🙏' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 bengali">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={(profile as any)[f.key] || ''}
                onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-green-400" />
            </div>
          ))}
          <button onClick={saveProfile} disabled={savingProfile}
            className="w-full bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-2 hover:bg-green-700">
            {savingProfile ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} সেভ করুন
          </button>
        </div>
      )}

      {/* ════════ PAYMENT MODAL ════════ */}
      {payingSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingSale(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট নিন</div>
            <div className="text-sm text-gray-500 bengali mb-1">{payingSale.item_name}</div>
            <div className="text-sm font-bold text-red-600 bengali mb-3">বাকি: {fmtAmt(payingSale.due_amount)}</div>
            <input type="number" value={payAmount} onChange={e => setPayAmount(+e.target.value)}
              className="w-full border-2 border-green-400 rounded-xl px-3 py-2.5 text-2xl font-bold text-center mt-1 mb-4" />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={savingPay || payAmount <= 0}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
                {savingPay ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} নিশ্চিত
              </button>
              <button onClick={() => setPayingSale(null)} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold bengali">বাতিল</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ CUSTOM MESSAGE MODAL ════════ */}
      {msgCust && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMsgCust(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali">💬 বার্তা পাঠান — {msgCust.name}</div>
            <textarea rows={5} className="w-full border-2 border-green-200 rounded-xl px-3 py-2 text-sm resize-none bengali"
              value={msgText || ((msgCust.total_due || 0) > 0
                ? `নমস্কার ${msgCust.name}! ${profile.shop_name}-এ আপনার বাকি: ${fmtAmt(msgCust.total_due)}। সুবিধামতো দিয়ে যাবেন। 🙏`
                : `নমস্কার ${msgCust.name}! ${profile.shop_name} থেকে যোগাযোগ।`)}
              onChange={e => setMsgText(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => shareWhatsApp(msgCust, msgText || undefined)}
                className="bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5">
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button onClick={() => {
                const phone = msgCust.phone?.replace(/[^0-9]/g, '') || ''
                if (!phone) { toast.error('ফোন নেই'); return }
                window.open(`sms:+91${phone}?body=${encodeURIComponent(msgText || '')}`, '_blank')
              }} className="bg-green-700 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5">
                <Send size={15} /> SMS
              </button>
            </div>
            <button onClick={() => setMsgCust(null)} className="w-full bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}

    </div>
  )
}
