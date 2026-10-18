'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Plus, Search, Trash2, Edit2, Save, Download,
  Loader2, Check, X, Phone, MessageCircle,
  Send, Share2, Printer, IndianRupee, Package,
  BarChart2, Users, ShoppingBag, Truck, Tag
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

// ─── Types ────────────────────────────────────────────────────────
interface Product {
  id: string
  user_id?: string
  name: string
  category: string
  size: string
  color: string
  stock_qty: number
  min_stock: number
  purchase_price: number
  sell_price: number
  supplier: string
  is_available: boolean
}

interface Sale {
  id: string
  user_id?: string
  customer_name: string
  customer_phone: string
  item_name: string
  qty: number
  sell_price: number
  discount: number
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
  print_footer: string
}

// ─── Helpers ──────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function fmtAmt(n: number) { return `₹${Number(n || 0).toFixed(0)}` }
function downloadCSV(csv: string, fn: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.click()
}

const DEFAULT_KAPOR_CATS = ['সব', 'শাড়ি', 'সালোয়ার কামিজ', 'কুর্তা', 'পাঞ্জাবি', 'শার্ট', 'প্যান্ট', 'জিন্স', 'টি-শার্ট', 'শিশু পোশাক', 'লেহেঙ্গা', 'ব্লাউজ', 'অন্যান্য']
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ফ্রি সাইজ', '28', '30', '32', '34', '36', '38', '40']
const SEASONS = ['গ্রীষ্ম', 'বর্ষা', 'শীত', 'সব মৌসুম', 'উৎসব']

// ══════════════════════════════════════════════════════════════════
export default function KaporDokanManagerUI({ userId: propUserId }: { userId?: string }) {
  const [userId, setUserId] = useState<string | null>(propUserId || null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')

  // Data
  const [products, setProducts] = useState<Product[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [profile, setProfile] = useState<ShopProfile>({ shop_name: 'আমার কাপড়ের দোকান', owner_name: '', phone: '', address: '', upi_id: '', print_footer: 'ধন্যবাদ! আবার আসবেন 🙏' })

  // Stock tab
  const [prodSearch, setProdSearch] = useState('')
  const [prodCat, setProdCat] = useState('সব')
  const { categories: KAPOR_CATS, addCategory } = useCustomCategories(userId || undefined, 'kapor', DEFAULT_KAPOR_CATS)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddProd, setShowAddProd] = useState(false)
  const [editProd, setEditProd] = useState<Product | null>(null)
  const [newProd, setNewProd] = useState<Partial<Product>>({ category: 'শাড়ি', size: 'ফ্রি সাইজ', is_available: true, stock_qty: 0, min_stock: 3 })
  const [savingProd, setSavingProd] = useState(false)

  // Sale tab
  const [showNewSale, setShowNewSale] = useState(false)
  const [saleProdId, setSaleProdId] = useState('')
  const [saleQty, setSaleQty] = useState(1)
  const [salePrice, setSalePrice] = useState(0)
  const [saleDiscount, setSaleDiscount] = useState(0)
  const [saleCustName, setSaleCustName] = useState('')
  const [saleCustPhone, setSaleCustPhone] = useState('')
  const [salePaid, setSalePaid] = useState(0)
  const [saleNotes, setSaleNotes] = useState('')
  const [savingSale, setSavingSale] = useState(false)

  // Customer tab
  const [custSearch, setCustSearch] = useState('')
  const [showAddCust, setShowAddCust] = useState(false)
  const [newCust, setNewCust] = useState<Partial<Customer>>({})
  const [savingCust, setSavingCust] = useState(false)
  const [msgCust, setMsgCust] = useState<Customer | null>(null)
  const [msgText, setMsgText] = useState('')

  // Supplier tab
  const [showAddSupplier, setShowAddSupplier] = useState(false)
  const [newSupplier, setNewSupplier] = useState<Partial<Supplier>>({ order_date: today(), status: 'ordered' })
  const [savingSupplier, setSavingSupplier] = useState(false)

  // Payment modal
  const [payingSale, setPayingSale] = useState<Sale | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [savingPay, setSavingPay] = useState(false)

  // Settings
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Load ──────────────────────────────────────────────────────
  const loadProducts = async (uid: string) => {
    const { data } = await supabase.from('kapor_products').select('*').eq('user_id', uid).order('name')
    if (data) setProducts(data)
  }
  const loadSales = async (uid: string) => {
    const { data } = await supabase.from('kapor_sales').select('*').eq('user_id', uid).order('sale_date', { ascending: false }).limit(100)
    if (data) setSales(data)
  }
  const loadCustomers = async (uid: string) => {
    const { data } = await supabase.from('kapor_customers').select('*').eq('user_id', uid).order('name')
    if (data) setCustomers(data)
  }
  const loadSuppliers = async (uid: string) => {
    const { data } = await supabase.from('kapor_suppliers').select('*').eq('user_id', uid).order('order_date', { ascending: false })
    if (data) setSuppliers(data)
  }
  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('kapor_profiles').select('*').eq('user_id', uid).single()
    if (data) setProfile({ shop_name: data.shop_name || 'আমার কাপড়ের দোকান', owner_name: data.owner_name || '', phone: data.phone || '', address: data.address || '', upi_id: data.upi_id || '', print_footer: data.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏' })
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

  // ✅ Fix 3: expose reloadAll via window so AgentChat can trigger left panel refresh
  useEffect(() => {
    if (!userId) return
    const reloadAll = async () => {
      await Promise.all([loadProducts(userId), loadSales(userId), loadCustomers(userId), loadSuppliers(userId)])
    }
    ;(window as any).__kaporReload = reloadAll
    return () => { delete (window as any).__kaporReload }
  }, [userId])

  const todaySales = sales.filter(s => s.sale_date === today())
  const todayRevenue = todaySales.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const todayCollection = todaySales.reduce((s, r) => s + Number(r.paid_amount || 0), 0)
  const totalDue = customers.reduce((s, c) => s + Number(c.total_due || 0), 0)
  const supplierDue = suppliers.reduce((s, sup) => s + Number(sup.due_amount || 0), 0)
  const lowStock = products.filter(p => p.stock_qty <= p.min_stock)
  const selectedProd = products.find(p => p.id === saleProdId)
  const saleTotal = Math.max(0, saleQty * salePrice - saleDiscount)
  const filteredProds = products.filter(p => { const mq = !prodSearch || p.name.toLowerCase().includes(prodSearch.toLowerCase()); const mc = prodCat === 'সব' || p.category === prodCat; return mq && mc })
  const filteredCusts = customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))

  // ── Product CRUD ──────────────────────────────────────────────
  const saveProduct = async () => {
    if (!newProd.name) { toast.error('পোশাকের নাম দিন'); return }
    if (!userId) return
    setSavingProd(true)
    try {
      const payload = { user_id: userId, name: newProd.name, category: newProd.category || 'অন্যান্য', size: newProd.size || 'ফ্রি সাইজ', color: newProd.color || '', stock_qty: Number(newProd.stock_qty || 0), min_stock: Number(newProd.min_stock || 3), purchase_price: Number(newProd.purchase_price || 0), sell_price: Number(newProd.sell_price || 0), supplier: newProd.supplier || '', is_available: newProd.is_available !== false }
      if (editProd) { await supabase.from('kapor_products').update(payload).eq('id', editProd.id); toast.success('আপডেট হয়েছে!') }
      else { await supabase.from('kapor_products').insert(payload); toast.success('পোশাক যোগ হয়েছে!') }
      setNewProd({ category: 'শাড়ি', size: 'ফ্রি সাইজ', is_available: true, stock_qty: 0, min_stock: 3 }); setShowAddProd(false); setEditProd(null)
      await loadProducts(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingProd(false) }
  }

  const quickStock = async (prod: Product, delta: number) => {
    const newQty = Math.max(0, prod.stock_qty + delta)
    await supabase.from('kapor_products').update({ stock_qty: newQty }).eq('id', prod.id)
    setProducts(products.map(p => p.id === prod.id ? { ...p, stock_qty: newQty } : p))
  }

  // ── Sale ──────────────────────────────────────────────────────
  const saveSale = async () => {
    if (!saleProdId || !saleQty || !salePrice) { toast.error('পোশাক ও দাম দিন'); return }
    if (!userId) return
    setSavingSale(true)
    try {
      const due = Math.max(0, saleTotal - salePaid)
      const itemName = selectedProd ? `${selectedProd.name} (${selectedProd.size})` : 'অজানা'
      await supabase.from('kapor_sales').insert({ user_id: userId, agent_id: LIBRARY_AGENT_IDS.kapor, customer_name: saleCustName || 'অজানা', customer_phone: saleCustPhone, item_name: itemName, qty: saleQty, sell_price: salePrice, discount: saleDiscount, total_amount: saleTotal, paid_amount: salePaid, due_amount: due, sale_date: today(), payment_status: due <= 0 ? 'paid' : salePaid > 0 ? 'partial' : 'pending', notes: saleNotes })
      // Deduct stock
      if (selectedProd) await supabase.from('kapor_products').update({ stock_qty: Math.max(0, selectedProd.stock_qty - saleQty) }).eq('id', selectedProd.id)
      // Update customer
      if (saleCustPhone && due > 0) {
        const cust = customers.find(c => c.phone === saleCustPhone)
        if (cust) await supabase.from('kapor_customers').update({ total_due: (cust.total_due || 0) + due, total_spent: (cust.total_spent || 0) + saleTotal, last_visit: today() }).eq('id', cust.id)
      }
      toast.success('বিক্রি সেভ হয়েছে! ✅')
      if (confirm('রসিদ প্রিন্ট করবেন?')) printBill(itemName, saleQty, salePrice, saleDiscount, saleTotal, salePaid, saleCustName)
      setSaleProdId(''); setSaleQty(1); setSalePrice(0); setSaleDiscount(0); setSaleCustName(''); setSaleCustPhone(''); setSalePaid(0); setSaleNotes(''); setShowNewSale(false)
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
      await supabase.from('kapor_sales').update({ paid_amount: newPaid, due_amount: newDue, payment_status: newDue <= 0 ? 'paid' : 'partial' }).eq('id', payingSale.id)
      const cust = customers.find(c => c.name === payingSale.customer_name)
      if (cust) await supabase.from('kapor_customers').update({ total_due: Math.max(0, (cust.total_due || 0) - payAmount) }).eq('id', cust.id)
      toast.success(`₹${payAmount} পেমেন্ট রেকর্ড! ✅`)
      setPayingSale(null); setPayAmount(0)
      await Promise.all([loadSales(userId), loadCustomers(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingPay(false) }
  }

  // ── Customer ──────────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!newCust.name) { toast.error('নাম দিন'); return }
    if (!userId) return
    setSavingCust(true)
    try {
      await supabase.from('kapor_customers').insert({ user_id: userId, name: newCust.name, phone: newCust.phone || '', address: newCust.address || '', notes: newCust.notes || '', total_due: 0, total_spent: 0, last_visit: today() })
      toast.success('খদ্দের যোগ হয়েছে!'); setNewCust({}); setShowAddCust(false); await loadCustomers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingCust(false) }
  }

  const shareWhatsApp = (c: Customer, customMsg?: string) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const msg = customMsg || ((c.total_due || 0) > 0
      ? `নমস্কার ${c.name}! ${profile.shop_name}-এ আপনার বাকি: *₹${(c.total_due || 0).toFixed(0)}*। পরিশোধ করুন। 🙏`
      : `নমস্কার ${c.name}! ${profile.shop_name} থেকে যোগাযোগ করা হচ্ছে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ── Supplier ──────────────────────────────────────────────────
  const saveSupplier = async () => {
    if (!newSupplier.supplier_name || !newSupplier.item_ordered) { toast.error('সরবরাহকারী ও পোশাক দিন'); return }
    if (!userId) return
    setSavingSupplier(true)
    try {
      const due = Math.max(0, Number(newSupplier.cost_total || 0) - Number(newSupplier.paid_amount || 0))
      await supabase.from('kapor_suppliers').insert({ user_id: userId, agent_id: LIBRARY_AGENT_IDS.kapor, supplier_name: newSupplier.supplier_name, phone: newSupplier.phone || '', item_ordered: newSupplier.item_ordered, qty_ordered: Number(newSupplier.qty_ordered || 0), cost_total: Number(newSupplier.cost_total || 0), paid_amount: Number(newSupplier.paid_amount || 0), due_amount: due, order_date: newSupplier.order_date || today(), expected_date: newSupplier.expected_date || '', status: 'ordered', notes: newSupplier.notes || '' })
      toast.success('অর্ডার যোগ হয়েছে!'); setNewSupplier({ order_date: today(), status: 'ordered' }); setShowAddSupplier(false); await loadSuppliers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingSupplier(false) }
  }

  const updateSupplierStatus = async (sup: Supplier, status: string) => {
    await supabase.from('kapor_suppliers').update({ status }).eq('id', sup.id)
    setSuppliers(suppliers.map(s => s.id === sup.id ? { ...s, status } : s))
    toast.success('আপডেট হয়েছে!')
  }

  // ── Print ─────────────────────────────────────────────────────
  const printBill = (itemName: string, qty: number, price: number, discount: number, total: number, paid: number, custName: string) => {
    const due = total - paid
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>রসিদ</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
body{font-family:'Hind Siliguri',sans-serif;padding:20px;max-width:360px;margin:auto;color:#111}
h2{text-align:center;color:#7c3aed;margin:0 0 2px;font-size:18px}
.sub{text-align:center;font-size:11px;color:#666;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:12px}th{background:#7c3aed;color:white;padding:5px 8px;text-align:left}td{padding:4px 8px;border-bottom:1px solid #eee}
.footer{text-align:center;margin-top:12px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px}
</style></head><body>
<h2>👗 ${profile.shop_name}</h2>
<div class="sub">${profile.address || ''} ${profile.phone ? '| ' + profile.phone : ''}<br>তারিখ: ${new Date().toLocaleDateString('bn-IN')}</div>
${custName && custName !== 'অজানা' ? `<p style="margin:4px 0"><b>খদ্দের:</b> ${custName}</p>` : ''}
<table><tr><th>পোশাক</th><th>পরিমাণ</th><th>দর</th><th>মোট</th></tr>
<tr><td>${itemName}</td><td>${qty} পিস</td><td>₹${price}</td><td>₹${(qty * price).toFixed(0)}</td></tr>
${discount > 0 ? `<tr><td colspan="3" style="color:#16a34a">ছাড়</td><td style="color:#16a34a">-₹${discount.toFixed(0)}</td></tr>` : ''}
<tr style="background:#f5f3ff"><td colspan="3"><b>মোট</b></td><td><b>₹${total.toFixed(0)}</b></td></tr>
<tr><td colspan="3" style="color:#16a34a">পরিশোধ</td><td style="color:#16a34a">₹${paid.toFixed(0)}</td></tr>
${due > 0 ? `<tr><td colspan="3" style="color:#dc2626">বাকি</td><td style="color:#dc2626">₹${due.toFixed(0)}</td></tr>` : ''}
</table>
${profile.upi_id ? `<p style="text-align:center;font-size:11px;margin-top:8px">UPI: <b>${profile.upi_id}</b></p>` : ''}
<div class="footer">${profile.print_footer}</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('kapor_profiles').upsert({ user_id: userId, ...profile }, { onConflict: 'user_id' })
      if (error) throw error
      toast.success('সেটিংস সেভ হয়েছে! ✅')
    } catch (e: any) {
      console.error('kapor_profiles save failed:', e)
      toast.error(e.message || 'সেভ করা যায়নি')
    } finally { setSavingProfile(false) }
  }

  const TABS = [
    { id: 'stock', label: 'স্টক', icon: <Package size={13} /> },
    { id: 'sale', label: 'বিক্রি', icon: <IndianRupee size={13} /> },
    { id: 'customers', label: 'খদ্দের', icon: <Users size={13} /> },
    { id: 'supplier', label: 'সরবরাহ', icon: <Truck size={13} /> },
    { id: 'report', label: 'রিপোর্ট', icon: <BarChart2 size={13} /> },
    { id: 'settings', label: 'সেটিংস', icon: <Save size={13} /> },
  ]

  // ══════════════════════════════════════════════════════════════
  if (loading) return <div className="flex items-center justify-center py-16 text-purple-600"><Loader2 className="animate-spin mr-2" size={22} /><span className="bengali text-sm">লোড হচ্ছে...</span></div>
  if (!userId) return (
    <div className="text-center py-16">
      <p className="bengali text-gray-500 mb-3">লগইন করুন</p>
      <a href="/login" className="bg-purple-600 text-white px-6 py-2 rounded-xl text-sm bengali">লগইন</a>
    </div>
  )

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 rounded-2xl p-4 text-white flex items-center justify-between">
        <div>
          <div className="font-black text-lg bengali">👗 {profile.shop_name}</div>
          <div className="text-xs opacity-80 bengali">{profile.address || 'ঠিকানা সেট করুন'}</div>
        </div>
        <button onClick={() => setTab('settings')} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold bengali">সেটিংস</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
          { label: 'উঠেছে', value: fmtAmt(todayCollection), color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'খদ্দের বাকি', value: fmtAmt(totalDue), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'সরবরাহ বাকি', value: fmtAmt(supplierDue), color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-3`}>
            <div className={`font-extrabold text-lg ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3">
          <div className="font-bold text-orange-800 bengali text-sm mb-1">📦 কম স্টক — নতুন মাল আনুন</div>
          <div className="flex flex-wrap gap-2">{lowStock.map(p => <span key={p.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg bengali">👗 {p.name} ({p.stock_qty} পিস)</span>)}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bengali transition-all
              ${tab === t.id ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setShowNewSale(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700 bengali whitespace-nowrap">
          <Plus size={13} /> নতুন বিক্রি
        </button>
      </div>

      {/* ════════ NEW SALE ════════ */}
      {showNewSale && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between"><div className="font-bold text-purple-800 bengali">👗 নতুন বিক্রি</div><button onClick={() => setShowNewSale(false)}><X size={16} className="text-gray-400" /></button></div>

          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 bengali">পোশাক বেছে নিন *</label>
              <select value={saleProdId} onChange={e => { setSaleProdId(e.target.value); const p = products.find(x => x.id === e.target.value); if (p) setSalePrice(p.sell_price) }}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                <option value="">বেছে নিন</option>
                {products.filter(p => p.is_available).map(p => <option key={p.id} value={p.id}>{p.name} ({p.size}) — স্টক: {p.stock_qty}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">পরিমাণ (পিস)</label>
              <input type="number" min={1} value={saleQty} onChange={e => setSaleQty(+e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">বিক্রির দাম (₹)</label>
              <input type="number" value={salePrice || ''} onChange={e => setSalePrice(+e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">ছাড় (₹)</label>
              <input type="number" min={0} value={saleDiscount || ''} onChange={e => setSaleDiscount(+e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">খদ্দেরের নাম</label>
              <input type="text" value={saleCustName} onChange={e => setSaleCustName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 bengali">ফোন নম্বর</label>
              <input type="tel" value={saleCustPhone} onChange={e => setSaleCustPhone(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
            </div>
          </div>

          {saleTotal > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
              {saleDiscount > 0 && <div className="flex justify-between text-sm"><span className="bengali text-gray-500">আগের দাম</span><span className="line-through text-gray-400">{fmtAmt(saleQty * salePrice)}</span></div>}
              <div className="flex justify-between text-sm font-bold"><span className="bengali">মোট</span><span>{fmtAmt(saleTotal)}</span></div>
              <div className="flex items-center gap-2">
                <span className="bengali text-sm text-gray-600 flex-1">পরিশোধ</span>
                <input type="number" min={0} value={salePaid || ''} onChange={e => setSalePaid(+e.target.value)}
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
            <input type="text" value={saleNotes} onChange={e => setSaleNotes(e.target.value)} placeholder="বিশেষ নির্দেশনা..." className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
          </div>

          <div className="flex gap-2">
            <button onClick={saveSale} disabled={savingSale}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-sm font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
              {savingSale ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} সেভ করুন
            </button>
            <button onClick={() => setShowNewSale(false)} className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}

      {/* ════════ STOCK TAB ════════ */}
      {tab === 'stock' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="পোশাক খুঁজুন..." value={prodSearch} onChange={e => setProdSearch(e.target.value)} />
            </div>
            <button onClick={() => { setShowAddProd(true); setEditProd(null); setNewProd({ category: 'শাড়ি', size: 'ফ্রি সাইজ', is_available: true, stock_qty: 0, min_stock: 3 }) }}
              className="bg-purple-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali"><Plus size={13} /> যোগ করুন</button>
            <button onClick={() => { let csv = 'নাম,Category,Size,Color,স্টক,ক্রয়মূল্য,বিক্রয়মূল্য\n'; products.forEach(p => { csv += `"${p.name}","${p.category}","${p.size}","${p.color}",${p.stock_qty},${p.purchase_price},${p.sell_price}\n` }); downloadCSV(csv, `kapor-stock-${today()}.csv`) }}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
            {KAPOR_CATS.map(c => (
              <button key={c} onClick={() => setProdCat(c)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap bengali ${prodCat === c ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
            ))}
            {showAddCategory ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { const ok = await addCategory(newCategoryName); if (ok) { setNewCategoryName(''); setShowAddCategory(false) } }
                    else if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryName('') }
                  }}
                  placeholder="নতুন ক্যাটাগরি..."
                  className="px-2.5 py-1 rounded-full text-xs border border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400 w-28 bengali" />
                <button onClick={async () => { const ok = await addCategory(newCategoryName); if (ok) { setNewCategoryName(''); setShowAddCategory(false) } }}
                  className="text-purple-600 hover:text-purple-700"><Check size={14} /></button>
                <button onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
                  className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddCategory(true)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:border-purple-300 hover:text-purple-600 flex items-center gap-1 flex-shrink-0 bengali">
                <Plus size={11} /> ক্যাটাগরি
              </button>
            )}
          </div>

          {showAddProd && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-purple-800 bengali text-sm">{editProd ? '✏️ সম্পাদনা' : '➕ নতুন পোশাক'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'পোশাকের নাম *', key: 'name', type: 'text', full: true }, { label: 'রঙ', key: 'color', type: 'text' }, { label: 'স্টক (পিস)', key: 'stock_qty', type: 'number' }, { label: 'ন্যূনতম স্টক', key: 'min_stock', type: 'number' }, { label: 'ক্রয়মূল্য (₹)', key: 'purchase_price', type: 'number' }, { label: 'বিক্রয়মূল্য (₹)', key: 'sell_price', type: 'number' }, { label: 'সরবরাহকারী', key: 'supplier', type: 'text', full: true }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newProd as any)[f.key] || ''} onChange={e => setNewProd(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">Category</label>
                  <select value={newProd.category} onChange={e => setNewProd(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {KAPOR_CATS.filter(c => c !== 'সব').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 bengali">Size</label>
                  <select value={newProd.size} onChange={e => setNewProd(p => ({ ...p, size: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {SIZES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" checked={newProd.is_available !== false} onChange={e => setNewProd(p => ({ ...p, is_available: e.target.checked }))} />
                  <label className="text-xs text-gray-600 bengali">পাওয়া যাচ্ছে</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveProduct} disabled={savingProd} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingProd ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => { setShowAddProd(false); setEditProd(null) }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {filteredProds.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{products.length === 0 ? '👗 পোশাক যোগ করুন' : 'পাওয়া যায়নি'}</div>
            : (
              <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '276px' }}>
                {filteredProds.map(p => {
              const isLow = p.stock_qty <= p.min_stock
              const margin = p.sell_price - p.purchase_price
              return (
                <div key={p.id} className={`border rounded-xl p-3 ${isLow ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-800 bengali text-sm">{p.name}
                        {p.color && <span className="ml-1 text-xs text-gray-400">· {p.color}</span>}
                        {!p.is_available && <span className="ml-1 text-xs text-gray-400">(বন্ধ)</span>}
                      </div>
                      <div className="text-xs text-gray-400 bengali">{p.category} · Size: {p.size} {p.supplier ? `· ${p.supplier}` : ''}</div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditProd(p); setNewProd({ ...p }); setShowAddProd(true) }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={async () => { if (!confirm('মুছবেন?')) return; await supabase.from('kapor_products').delete().eq('id', p.id); setProducts(products.filter(x => x.id !== p.id)) }} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 bengali">স্টক:</span>
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.stock_qty} পিস</span>
                      <button onClick={() => quickStock(p, -1)} className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-xs">−</button>
                      <button onClick={() => quickStock(p, 1)} className="w-5 h-5 rounded bg-purple-100 flex items-center justify-center font-bold text-purple-700 text-xs">+</button>
                    </div>
                    <span className="text-gray-500">বিক্রি: <b className="text-gray-800">₹{p.sell_price}</b></span>
                    {margin > 0 && <span className="text-green-600 bengali">মার্জিন: ₹{margin}</span>}
                    {isLow && <span className="text-orange-600 font-bold bengali">⚠️ কম!</span>}
                  </div>
                </div>
              )
                })}
              </div>
            )}
        </div>
      )}

      {/* ════════ SALE TAB ════════ */}
      {tab === 'sale' && (
        <div className="space-y-2">
          <div className="font-bold text-gray-700 bengali text-sm">বিক্রির ইতিহাস ({sales.length})</div>
          {sales.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">এখনো কোনো বিক্রি নেই</div>
            : sales.slice(0, 30).map(s => (
              <div key={s.id} className={`border rounded-xl p-3 ${Number(s.due_amount) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 bengali text-sm">{s.item_name}</div>
                    <div className="text-xs text-gray-500 bengali">{s.customer_name} · {s.sale_date} · {s.qty} পিস × ₹{s.sell_price}</div>
                    {Number(s.discount) > 0 && <div className="text-xs text-green-600 bengali">ছাড়: ₹{s.discount}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{fmtAmt(s.total_amount)}</div>
                    {Number(s.due_amount) > 0
                      ? <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-red-500 bengali">বাকি {fmtAmt(s.due_amount)}</span>
                          <button onClick={() => { setPayingSale(s); setPayAmount(Number(s.due_amount)) }}
                            className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full bengali">নিন</button>
                        </div>
                      : <span className="text-xs text-green-600 bengali">✅ পরিশোধ</span>}
                  </div>
                </div>
                <button onClick={() => printBill(s.item_name, s.qty, s.sell_price, s.discount, s.total_amount, s.paid_amount, s.customer_name)}
                  className="mt-1.5 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg bengali flex items-center gap-0.5 w-fit">
                  <Printer size={11} /> প্রিন্ট
                </button>
              </div>
            ))}
        </div>
      )}

      {/* ════════ CUSTOMERS TAB ════════ */}
      {tab === 'customers' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="নাম বা ফোন..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowAddCust(true)} className="bg-purple-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali"><Plus size={13} /> খদ্দের</button>
            <button onClick={() => { let csv = 'নাম,ফোন,ঠিকানা,মোট বাকি,মোট কেনা\n'; customers.forEach(c => { csv += `"${c.name}","${c.phone}","${c.address}",${c.total_due},${c.total_spent}\n` }); downloadCSV(csv, `kapor-customers-${today()}.csv`) }}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          {showAddCust && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-purple-800 bengali text-sm">👤 নতুন খদ্দের</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'নাম *', key: 'name', type: 'text', full: true }, { label: 'ফোন', key: 'phone', type: 'tel' }, { label: 'ঠিকানা', key: 'address', type: 'text' }, { label: 'নোট', key: 'notes', type: 'text', full: true }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newCust as any)[f.key] || ''} onChange={e => setNewCust(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCustomer} disabled={savingCust} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingCust ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => setShowAddCust(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
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
                    {c.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</div>}
                    {c.address && <div className="text-xs text-gray-400 bengali">📍 {c.address}</div>}
                    <div className="text-xs text-gray-400 bengali mt-0.5">মোট কেনা: {fmtAmt(c.total_spent || 0)} · শেষ ভিজিট: {c.last_visit || 'নেই'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(c.total_due || 0) > 0
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold bengali">বাকি {fmtAmt(c.total_due || 0)}</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">✅ ক্লিয়ার</span>}
                    <div className="flex gap-1">
                      <button onClick={() => shareWhatsApp(c)} className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg"><MessageCircle size={13} /></button>
                      <button onClick={() => { setMsgCust(c); setMsgText('') }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Share2 size={13} /></button>
                      <button onClick={async () => { if (!confirm('মুছবেন?')) return; await supabase.from('kapor_customers').delete().eq('id', c.id); setCustomers(customers.filter(x => x.id !== c.id)) }} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
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
            <button onClick={() => setShowAddSupplier(true)} className="bg-purple-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali"><Plus size={13} /> অর্ডার</button>
          </div>

          {showAddSupplier && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-purple-800 bengali text-sm">🚚 নতুন অর্ডার</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'সরবরাহকারীর নাম *', key: 'supplier_name', type: 'text', full: true }, { label: 'ফোন', key: 'phone', type: 'tel' }, { label: 'কোন পোশাক *', key: 'item_ordered', type: 'text', full: true }, { label: 'পরিমাণ (পিস)', key: 'qty_ordered', type: 'number' }, { label: 'মোট দাম (₹)', key: 'cost_total', type: 'number' }, { label: 'অগ্রিম দিয়েছেন (₹)', key: 'paid_amount', type: 'number' }, { label: 'অর্ডারের তারিখ', key: 'order_date', type: 'date' }, { label: 'আসার তারিখ', key: 'expected_date', type: 'date' }, { label: 'নোট', key: 'notes', type: 'text', full: true }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newSupplier as any)[f.key] || ''} onChange={e => setNewSupplier(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
              </div>
              {Number(newSupplier.cost_total) > 0 && Number(newSupplier.paid_amount) >= 0 && (
                <div className="bg-white border border-red-200 rounded-xl px-3 py-2 text-sm bengali text-red-600">
                  বাকি দেনা: {fmtAmt(Math.max(0, Number(newSupplier.cost_total) - Number(newSupplier.paid_amount || 0)))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={saveSupplier} disabled={savingSupplier} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingSupplier ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => setShowAddSupplier(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {suppliers.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">কোনো অর্ডার নেই</div>
            : suppliers.map(sup => (
              <div key={sup.id} className={`border rounded-xl p-3 ${sup.status === 'received' ? 'bg-green-50 border-green-200' : sup.status === 'cancelled' ? 'bg-gray-50 border-gray-200' : 'bg-white border-purple-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 bengali text-sm">{sup.supplier_name}</div>
                    <div className="text-xs text-gray-500 bengali">{sup.item_ordered} · {sup.qty_ordered} পিস · {sup.order_date}</div>
                    {sup.expected_date && <div className="text-xs text-gray-400 bengali">আসার তারিখ: {sup.expected_date}</div>}
                    {sup.notes && <div className="text-xs text-gray-400 bengali">{sup.notes}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{fmtAmt(sup.cost_total)}</div>
                    {Number(sup.due_amount) > 0 && <div className="text-xs text-red-500 bengali">দেনা: {fmtAmt(sup.due_amount)}</div>}
                    <span className={`text-xs font-semibold bengali ${sup.status === 'received' ? 'text-green-600' : sup.status === 'cancelled' ? 'text-gray-400' : 'text-purple-600'}`}>
                      {sup.status === 'received' ? '✅ পেয়েছি' : sup.status === 'cancelled' ? '❌ বাতিল' : '🚚 অপেক্ষায়'}
                    </span>
                  </div>
                </div>
                {sup.status === 'ordered' && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => updateSupplierStatus(sup, 'received')} className="flex-1 bg-green-100 text-green-700 py-1.5 rounded-xl text-xs font-bold bengali hover:bg-green-200">✅ মাল পেয়েছি</button>
                    <button onClick={() => updateSupplierStatus(sup, 'cancelled')} className="bg-red-100 text-red-600 px-3 py-1.5 rounded-xl text-xs font-bold bengali hover:bg-red-200">বাতিল</button>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* ════════ REPORT TAB ════════ */}
      {tab === 'report' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), icon: '📈', color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'উঠেছে', value: fmtAmt(todayCollection), icon: '💰', color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'খদ্দের বাকি', value: fmtAmt(totalDue), icon: '💸', color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'সরবরাহ দেনা', value: fmtAmt(supplierDue), icon: '🚚', color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'মোট পোশাক', value: `${products.length}টি`, icon: '👗', color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'কম স্টক', value: `${lowStock.length}টি`, icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className={`font-black text-xl ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 bengali">{c.label}</div>
              </div>
            ))}
          </div>

          {customers.filter(c => (c.total_due || 0) > 0).length > 0 && (
            <div>
              <div className="font-bold text-gray-700 bengali text-sm mb-2">🏆 সবচেয়ে বেশি বাকি</div>
              {customers.filter(c => (c.total_due || 0) > 0).sort((a, b) => (b.total_due || 0) - (a.total_due || 0)).slice(0, 5).map((c, i) => (
                <div key={c.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2 mb-1.5">
                  <span className="bengali text-sm font-semibold">#{i + 1} {c.name}</span>
                  <span className="font-bold text-red-600 text-sm">{fmtAmt(c.total_due || 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { let csv = 'তারিখ,পোশাক,খদ্দের,পরিমাণ,মোট,ছাড়,পরিশোধ,বাকি\n'; sales.forEach(s => { csv += `"${s.sale_date}","${s.item_name}","${s.customer_name}",${s.qty},${s.total_amount},${s.discount},${s.paid_amount},${s.due_amount}\n` }); downloadCSV(csv, `kapor-sales-${today()}.csv`); toast.success('রিপোর্ট ডাউনলোড!') }}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali"><Download size={13} /> বিক্রির রিপোর্ট</button>
            <button onClick={() => { let csv = 'নাম,Category,Size,স্টক,বিক্রয়মূল্য,ক্রয়মূল্য\n'; products.forEach(p => { csv += `"${p.name}","${p.category}","${p.size}",${p.stock_qty},${p.sell_price},${p.purchase_price}\n` }); downloadCSV(csv, `kapor-stock-${today()}.csv`); toast.success('স্টক রিপোর্ট ডাউনলোড!') }}
              className="flex-1 bg-pink-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali"><Download size={13} /> স্টক রিপোর্ট</button>
          </div>
        </div>
      )}

      {/* ════════ SETTINGS TAB ════════ */}
      {tab === 'settings' && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="font-bold text-purple-800 bengali text-sm">🏪 দোকানের তথ্য</div>
          {[{ label: 'দোকানের নাম *', key: 'shop_name', placeholder: 'যেমন: রহিম গার্মেন্টস' }, { label: 'মালিকের নাম', key: 'owner_name', placeholder: '' }, { label: 'ফোন', key: 'phone', placeholder: '' }, { label: 'ঠিকানা', key: 'address', placeholder: '' }, { label: 'UPI ID', key: 'upi_id', placeholder: '' }, { label: 'রসিদের শেষে বার্তা', key: 'print_footer', placeholder: 'ধন্যবাদ! আবার আসবেন 🙏' }].map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 bengali">{f.label}</label>
              <input type="text" placeholder={f.placeholder} value={(profile as any)[f.key] || ''}
                onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          ))}
          <button onClick={saveProfile} disabled={savingProfile}
            className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-2 hover:bg-purple-700">
            {savingProfile ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} সেভ করুন
          </button>
        </div>
      )}

      {/* ════════ PAYMENT MODAL ════════ */}
      {payingSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingSale(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট নিন</div>
            <div className="text-sm text-gray-500 bengali mb-3">{payingSale.item_name} · বাকি: {fmtAmt(payingSale.due_amount)}</div>
            <input type="number" value={payAmount} onChange={e => setPayAmount(+e.target.value)}
              className="w-full border-2 border-purple-400 rounded-xl px-3 py-2.5 text-2xl font-bold text-center mt-1 mb-4" />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={savingPay || payAmount <= 0}
                className="flex-1 bg-purple-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
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
            <textarea rows={5} className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 text-sm resize-none bengali"
              value={msgText || ((msgCust.total_due || 0) > 0 ? `নমস্কার ${msgCust.name}! ${profile.shop_name}-এ আপনার বাকি: ₹${(msgCust.total_due || 0).toFixed(0)}। পরিশোধ করুন। 🙏` : `নমস্কার ${msgCust.name}! ${profile.shop_name} থেকে যোগাযোগ।`)}
              onChange={e => setMsgText(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => shareWhatsApp(msgCust, msgText || undefined)}
                className="bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5">
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button onClick={() => { const phone = msgCust.phone?.replace(/[^0-9]/g, '') || ''; if (!phone) { toast.error('ফোন নেই'); return } window.open(`sms:+91${phone}?body=${encodeURIComponent(msgText || '')}`, '_blank') }}
                className="bg-purple-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5">
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
