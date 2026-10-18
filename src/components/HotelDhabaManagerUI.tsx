'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Plus, Search, Trash2, Edit2, Save, Download,
  Loader2, Check, X, Phone, User, MessageCircle,
  Send, Share2, Printer, IndianRupee, Package,
  BarChart2, BookOpen, ChevronDown, RefreshCw,
  Utensils, ShoppingBag, Users, Clock, TrendingUp
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

// ─── Types ────────────────────────────────────────────────────────
interface MenuItem {
  id: string
  user_id?: string
  name: string
  name_bn: string
  category: string
  price: number
  cost_price: number
  is_available: boolean
  is_veg: boolean
  description: string
}

interface TableOrder {
  id: string
  user_id?: string
  table_no: string
  customer_name: string
  items: OrderItem[]
  total_amount: number
  paid_amount: number
  due_amount: number
  status: string
  created_at: string
  notes: string
}

interface OrderItem {
  menu_item_id: string
  name: string
  qty: number
  price: number
}

interface Customer {
  id: string
  user_id?: string
  name: string
  phone: string
  address: string
  total_due: number
  total_spent: number
  last_visit: string
  notes: string
}

interface StockItem {
  id: string
  user_id?: string
  name: string
  category: string
  quantity: number
  unit: string
  min_quantity: number
  cost_per_unit: number
  last_updated: string
}

interface HotelProfile {
  hotel_name: string
  owner_name: string
  phone: string
  address: string
  gstin: string
  upi_id: string
  print_footer: string
}

// ─── Helpers ──────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function fmtAmt(n: number) { return `₹${Number(n || 0).toFixed(0)}` }
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

const DEFAULT_MENU_CATS = ['সব', 'ভাত-রুটি', 'তরকারি', 'ডাল-সবজি', 'মাছ-মাংস', 'চা-কফি', 'মিষ্টি', 'ড্রিংক্স', 'স্ন্যাক্স', 'অন্যান্য']
const DEFAULT_STOCK_CATS = ['চাল-ডাল', 'তেল-মশলা', 'সবজি', 'মাছ-মাংস', 'দুধ-ডিম', 'জ্বালানি', 'প্যাকেজিং', 'অন্যান্য']
const STOCK_UNITS = ['কেজি', 'গ্রাম', 'লিটার', 'মিলি', 'পিস', 'প্যাকেট', 'বস্তা', 'ডজন']
const TABLES = Array.from({ length: 20 }, (_, i) => `টেবিল ${i + 1}`)

// ══════════════════════════════════════════════════════════════════
export default function HotelDhabaManagerUI({ userId: propUserId }: { userId?: string }) {
  const [userId, setUserId] = useState<string | null>(propUserId || null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('order')

  // Data
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [orders, setOrders] = useState<TableOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [stockItems, setStockItems] = useState<StockItem[]>([])
  const [profile, setProfile] = useState<HotelProfile>({ hotel_name: 'আমার হোটেল', owner_name: '', phone: '', address: '', gstin: '', upi_id: '', print_footer: 'ধন্যবাদ! আবার আসবেন 🙏' })

  // Menu tab
  const [menuSearch, setMenuSearch] = useState('')
  const [menuCat, setMenuCat] = useState('সব')
  const { categories: MENU_CATS, addCategory: addMenuCategory } = useCustomCategories(userId || undefined, 'hotel_menu', DEFAULT_MENU_CATS)
  const [showAddMenuCategory, setShowAddMenuCategory] = useState(false)
  const [newMenuCategoryName, setNewMenuCategoryName] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [editMenu, setEditMenu] = useState<MenuItem | null>(null)
  const [newMenu, setNewMenu] = useState<Partial<MenuItem>>({ category: 'ভাত-রুটি', is_available: true, is_veg: true })
  const [savingMenu, setSavingMenu] = useState(false)

  // Order tab
  const [showNewOrder, setShowNewOrder] = useState(false)
  const [orderTable, setOrderTable] = useState('টেবিল ১')
  const [orderCustomer, setOrderCustomer] = useState('')
  const [orderCustomerPhone, setOrderCustomerPhone] = useState('')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [orderNotes, setOrderNotes] = useState('')
  const [orderPaid, setOrderPaid] = useState(0)
  const [savingOrder, setSavingOrder] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<TableOrder | null>(null)

  // Customer tab
  const [custSearch, setCustSearch] = useState('')
  const [showAddCust, setShowAddCust] = useState(false)
  const [newCust, setNewCust] = useState<Partial<Customer>>({})
  const [savingCust, setSavingCust] = useState(false)
  const [msgCust, setMsgCust] = useState<Customer | null>(null)
  const [msgText, setMsgText] = useState('')

  // Stock tab
  const [stockSearch, setStockSearch] = useState('')
  const [stockCat, setStockCat] = useState('সব')
  const { categories: STOCK_CATS, addCategory: addStockCategory } = useCustomCategories(userId || undefined, 'hotel_stock', DEFAULT_STOCK_CATS)
  const [showAddStockCategory, setShowAddStockCategory] = useState(false)
  const [newStockCategoryName, setNewStockCategoryName] = useState('')
  const [showAddStock, setShowAddStock] = useState(false)
  const [editStock, setEditStock] = useState<StockItem | null>(null)
  const [newStock, setNewStock] = useState<Partial<StockItem>>({ unit: 'কেজি', category: 'চাল-ডাল', quantity: 0, min_quantity: 5 })
  const [savingStock, setSavingStock] = useState(false)

  // Payment modal
  const [payingOrder, setPayingOrder] = useState<TableOrder | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [savingPay, setSavingPay] = useState(false)

  // Settings
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const uid = propUserId || (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)
      await Promise.all([loadMenu(uid), loadOrders(uid), loadCustomers(uid), loadStock(uid), loadProfile(uid)])
      setLoading(false)
    }
    init()
  }, [propUserId])

  // ── Load ──────────────────────────────────────────────────────
  const loadMenu = async (uid: string) => {
    const { data } = await supabase.from('hotel_menu').select('*').eq('user_id', uid).order('category').order('name')
    if (data) setMenuItems(data)
  }

  const loadOrders = async (uid: string) => {
    const { data } = await supabase.from('hotel_orders').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(100)
    if (data) setOrders(data.map((o: any) => ({ ...o, items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []) })))
  }

  const loadCustomers = async (uid: string) => {
    const { data } = await supabase.from('hotel_customers').select('*').eq('user_id', uid).order('name')
    if (data) setCustomers(data)
  }

  const loadStock = async (uid: string) => {
    const { data } = await supabase.from('hotel_stock').select('*').eq('user_id', uid).order('name')
    if (data) setStockItems(data)
  }

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('hotel_profiles').select('*').eq('user_id', uid).single()
    if (data) setProfile({ hotel_name: data.hotel_name || 'আমার হোটেল', owner_name: data.owner_name || '', phone: data.phone || '', address: data.address || '', gstin: data.gstin || '', upi_id: data.upi_id || '', print_footer: data.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏' })
  }

  // ── Expose reload for AI chat panel ──────────────────────────
  useEffect(() => {
    const reloadAll = async () => {
      if (!userId) return
      await Promise.all([loadMenu(userId), loadOrders(userId), loadCustomers(userId), loadStock(userId)])
    }
    ;(window as any).__hotelReload = reloadAll
    return () => { delete (window as any).__hotelReload }
  })

  // ── Derived ───────────────────────────────────────────────────
  const todayOrders = orders.filter(o => o.created_at?.slice(0, 10) === today())
  const todayRevenue = todayOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const todayCollection = todayOrders.reduce((s, o) => s + Number(o.paid_amount || 0), 0)
  const totalDue = customers.reduce((s, c) => s + Number(c.total_due || 0), 0)
  const activeOrders = orders.filter(o => o.status === 'active' || o.status === 'pending')
  const lowStock = stockItems.filter(s => s.quantity <= s.min_quantity)
  const orderTotal = orderItems.reduce((s, i) => s + i.qty * i.price, 0)

  const filteredMenu = menuItems.filter(m => {
    const mq = !menuSearch || m.name.toLowerCase().includes(menuSearch.toLowerCase()) || m.name_bn?.includes(menuSearch)
    const mc = menuCat === 'সব' || m.category === menuCat
    return mq && mc
  })
  const filteredCusts = customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))
  const filteredStock = stockItems.filter(s => {
    const mq = !stockSearch || s.name.toLowerCase().includes(stockSearch.toLowerCase())
    const mc = stockCat === 'সব' || s.category === stockCat
    return mq && mc
  })

  // ── Menu CRUD ─────────────────────────────────────────────────
  const saveMenu = async () => {
    if (!newMenu.name) { toast.error('পদের নাম দিন'); return }
    if (!userId) return
    setSavingMenu(true)
    try {
      const payload = { user_id: userId, name: newMenu.name, name_bn: newMenu.name_bn || newMenu.name, category: newMenu.category || 'অন্যান্য', price: Number(newMenu.price || 0), cost_price: Number(newMenu.cost_price || 0), is_available: newMenu.is_available !== false, is_veg: !!newMenu.is_veg, description: newMenu.description || '' }
      if (editMenu) { await supabase.from('hotel_menu').update(payload).eq('id', editMenu.id); toast.success('আপডেট হয়েছে!') }
      else { await supabase.from('hotel_menu').insert(payload); toast.success('মেনুতে যোগ হয়েছে!') }
      setNewMenu({ category: 'ভাত-রুটি', is_available: true, is_veg: true }); setShowAddMenu(false); setEditMenu(null)
      await loadMenu(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingMenu(false) }
  }

  const deleteMenu = async (id: string) => {
    if (!confirm('মুছবেন?')) return
    await supabase.from('hotel_menu').delete().eq('id', id)
    setMenuItems(menuItems.filter(m => m.id !== id))
  }

  const toggleAvailable = async (item: MenuItem) => {
    await supabase.from('hotel_menu').update({ is_available: !item.is_available }).eq('id', item.id)
    setMenuItems(menuItems.map(m => m.id === item.id ? { ...m, is_available: !m.is_available } : m))
  }

  // ── Order CRUD ────────────────────────────────────────────────
  const addItemToOrder = (item: MenuItem) => {
    const existing = orderItems.find(i => i.menu_item_id === item.id)
    if (existing) {
      setOrderItems(orderItems.map(i => i.menu_item_id === item.id ? { ...i, qty: i.qty + 1 } : i))
    } else {
      setOrderItems([...orderItems, { menu_item_id: item.id, name: item.name_bn || item.name, qty: 1, price: item.price }])
    }
  }

  const saveOrder = async () => {
    if (orderItems.length === 0) { toast.error('অর্ডার করুন'); return }
    if (!userId) return
    setSavingOrder(true)
    try {
      const due = Math.max(0, orderTotal - orderPaid)
      const payload = { user_id: userId, table_no: orderTable, customer_name: orderCustomer || 'অজানা', customer_phone: orderCustomerPhone, items: JSON.stringify(orderItems), total_amount: orderTotal, paid_amount: orderPaid, due_amount: due, status: due > 0 ? 'pending' : 'paid', notes: orderNotes, created_at: new Date().toISOString(), agent_id: LIBRARY_AGENT_IDS.hotel }
      const { error } = await supabase.from('hotel_orders').insert(payload)
      if (error) throw error

      // Update customer due if phone given
      if (orderCustomerPhone && due > 0) {
        const cust = customers.find(c => c.phone === orderCustomerPhone)
        if (cust) {
          await supabase.from('hotel_customers').update({ total_due: (cust.total_due || 0) + due, total_spent: (cust.total_spent || 0) + orderTotal, last_visit: today() }).eq('id', cust.id)
        }
      }

      toast.success('অর্ডার সেভ হয়েছে! ✅')
      if (confirm('KOT / বিল প্রিন্ট করবেন?')) printBill({ ...payload, id: '', items: orderItems } as any)
      setOrderItems([]); setOrderCustomer(''); setOrderCustomerPhone(''); setOrderNotes(''); setOrderPaid(0); setShowNewOrder(false)
      await Promise.all([loadOrders(userId), loadCustomers(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingOrder(false) }
  }

  const updateOrderStatus = async (order: TableOrder, status: string) => {
    await supabase.from('hotel_orders').update({ status }).eq('id', order.id)
    setOrders(orders.map(o => o.id === order.id ? { ...o, status } : o))
    toast.success(status === 'paid' ? 'পরিশোধিত ✅' : 'আপডেট হয়েছে')
  }

  const savePayment = async () => {
    if (!payingOrder || !userId) return
    setSavingPay(true)
    try {
      const newPaid = Number(payingOrder.paid_amount) + Number(payAmount)
      const newDue = Math.max(0, Number(payingOrder.total_amount) - newPaid)
      await supabase.from('hotel_orders').update({ paid_amount: newPaid, due_amount: newDue, status: newDue <= 0 ? 'paid' : 'partial' }).eq('id', payingOrder.id)
      // Update customer due
      if (payingOrder.customer_name) {
        const cust = customers.find(c => c.name === payingOrder.customer_name)
        if (cust) await supabase.from('hotel_customers').update({ total_due: Math.max(0, (cust.total_due || 0) - payAmount) }).eq('id', cust.id)
      }
      toast.success(`₹${payAmount} পেমেন্ট রেকর্ড! ✅`)
      setPayingOrder(null); setPayAmount(0)
      await Promise.all([loadOrders(userId), loadCustomers(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingPay(false) }
  }

  // ── Customer CRUD ─────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!newCust.name) { toast.error('নাম দিন'); return }
    if (!userId) return
    setSavingCust(true)
    try {
      await supabase.from('hotel_customers').insert({ user_id: userId, name: newCust.name, phone: newCust.phone || '', address: newCust.address || '', notes: newCust.notes || '', total_due: 0, total_spent: 0, last_visit: today() })
      toast.success('খদ্দের যোগ হয়েছে!')
      setNewCust({}); setShowAddCust(false); await loadCustomers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingCust(false) }
  }

  const shareWhatsApp = (c: Customer, customMsg?: string) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const msg = customMsg || ((c.total_due || 0) > 0
      ? `নমস্কার ${c.name}! ${profile.hotel_name}-এ আপনার বাকি: *₹${(c.total_due || 0).toFixed(0)}*। পরিশোধ করুন। 🙏`
      : `নমস্কার ${c.name}! ${profile.hotel_name} থেকে যোগাযোগ করা হচ্ছে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const shareSMS = (c: Customer) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const msg = (c.total_due || 0) > 0 ? `${c.name}, ${profile.hotel_name}-এ বাকি ₹${(c.total_due || 0).toFixed(0)}। পরিশোধ করুন।` : `${c.name}, ${profile.hotel_name} থেকে যোগাযোগ।`
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`sms:+91${phone}?body=${encodeURIComponent(msg)}`, '_blank')
  }

  // ── Stock CRUD ────────────────────────────────────────────────
  const logStockPurchase = async (itemId: string, itemName: string, qtyAdded: number, unit: string, unitCost: number) => {
    if (qtyAdded <= 0 || unitCost <= 0 || !userId) return
    await supabase.from('stock_purchases').insert({
      user_id: userId, agent_id: LIBRARY_AGENT_IDS.hotel, source_table: 'hotel_stock', source_id: itemId,
      item_name: itemName, quantity: qtyAdded, unit, unit_cost: unitCost,
    })
  }

  const saveStock = async () => {
    if (!newStock.name) { toast.error('পণ্যের নাম দিন'); return }
    if (!userId) return
    setSavingStock(true)
    try {
      const payload = { user_id: userId, name: newStock.name, category: newStock.category || 'অন্যান্য', quantity: Number(newStock.quantity || 0), unit: newStock.unit || 'কেজি', min_quantity: Number(newStock.min_quantity || 5), cost_per_unit: Number(newStock.cost_per_unit || 0), last_updated: today() }
      const oldQty = editStock ? Number(editStock.quantity) : 0
      let savedId = editStock?.id
      if (editStock) { await supabase.from('hotel_stock').update(payload).eq('id', editStock.id); toast.success('আপডেট হয়েছে!') }
      else {
        const { data } = await supabase.from('hotel_stock').insert(payload).select().single()
        savedId = data?.id
        toast.success('স্টক যোগ হয়েছে!')
      }
      if (savedId) await logStockPurchase(savedId, payload.name, payload.quantity - oldQty, payload.unit, payload.cost_per_unit)
      setNewStock({ unit: 'কেজি', category: 'চাল-ডাল', quantity: 0, min_quantity: 5 }); setShowAddStock(false); setEditStock(null)
      await loadStock(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingStock(false) }
  }

  const quickUpdateStock = async (item: StockItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta)
    await supabase.from('hotel_stock').update({ quantity: newQty, last_updated: today() }).eq('id', item.id)
    setStockItems(stockItems.map(s => s.id === item.id ? { ...s, quantity: newQty } : s))
    if (delta > 0) await logStockPurchase(item.id, item.name, delta, item.unit, item.cost_per_unit)
  }

  // ── Profile ───────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('hotel_profiles').upsert({ user_id: userId, ...profile }, { onConflict: 'user_id' })
      if (error) throw error
      toast.success('সেটিংস সেভ হয়েছে! ✅')
    } catch (e: any) {
      console.error('hotel_profiles save failed:', e)
      toast.error(e.message || 'সেভ করা যায়নি')
    } finally { setSavingProfile(false) }
  }

  // ── Print ─────────────────────────────────────────────────────
  const printBill = (order: TableOrder) => {
    const items = Array.isArray(order.items) ? order.items : []
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>বিল</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
body{font-family:'Hind Siliguri',sans-serif;padding:20px;max-width:380px;margin:auto;color:#111}
h2{text-align:center;color:#d97706;margin:0 0 2px;font-size:18px}
.sub{text-align:center;font-size:11px;color:#666;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#d97706;color:white;padding:5px 8px;text-align:left}
td{padding:4px 8px;border-bottom:1px solid #eee}
.total{font-weight:bold;background:#fef3c7}.footer{text-align:center;margin-top:12px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px}
</style></head><body>
<h2>🍽️ ${profile.hotel_name}</h2>
<div class="sub">${profile.address || ''} ${profile.phone ? '| ' + profile.phone : ''}<br>তারিখ: ${new Date().toLocaleDateString('bn-IN')} | ${order.table_no}</div>
${order.customer_name && order.customer_name !== 'অজানা' ? `<p style="margin:4px 0"><b>খদ্দের:</b> ${order.customer_name}</p>` : ''}
<table><tr><th>পদ</th><th>পরিমাণ</th><th>দাম</th><th>মোট</th></tr>
${items.map((i: any) => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price}</td><td>₹${(i.qty * i.price).toFixed(0)}</td></tr>`).join('')}
<tr class="total"><td colspan="3">মোট</td><td>₹${Number(order.total_amount).toFixed(0)}</td></tr>
<tr><td colspan="3" style="color:#16a34a">পরিশোধ</td><td style="color:#16a34a">₹${Number(order.paid_amount).toFixed(0)}</td></tr>
${Number(order.due_amount) > 0 ? `<tr><td colspan="3" style="color:#dc2626">বাকি</td><td style="color:#dc2626">₹${Number(order.due_amount).toFixed(0)}</td></tr>` : ''}
</table>
${profile.upi_id ? `<p style="text-align:center;font-size:11px;margin-top:8px">UPI: <b>${profile.upi_id}</b></p>` : ''}
<div class="footer">${profile.print_footer}<br>Sahayak AI দ্বারা পরিচালিত</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const exportSalesCSV = () => {
    let csv = 'তারিখ,টেবিল,খদ্দের,মোট,পরিশোধ,বাকি,স্ট্যাটাস\n'
    orders.forEach(o => { csv += `"${o.created_at?.slice(0, 10)}","${o.table_no}","${o.customer_name}",${o.total_amount},${o.paid_amount},${o.due_amount},"${o.status}"\n` })
    downloadCSV(csv, `hotel-sales-${today()}.csv`); toast.success('রিপোর্ট ডাউনলোড হয়েছে!')
  }

  const TABS = [
    { id: 'order', label: 'অর্ডার', icon: <Utensils size={13} /> },
    { id: 'menu', label: 'মেনু', icon: <BookOpen size={13} /> },
    { id: 'customers', label: 'খদ্দের', icon: <Users size={13} /> },
    { id: 'stock', label: 'স্টক', icon: <Package size={13} /> },
    { id: 'report', label: 'রিপোর্ট', icon: <BarChart2 size={13} /> },
    { id: 'settings', label: 'সেটিংস', icon: <Save size={13} /> },
  ]

  // ══════════════════════════════════════════════════════════════
  if (loading) return <div className="flex items-center justify-center py-16 text-amber-600"><Loader2 className="animate-spin mr-2" size={22} /><span className="bengali text-sm">লোড হচ্ছে...</span></div>
  if (!userId) return <div className="text-center py-16"><p className="bengali text-gray-500 mb-3">লগইন করুন</p><a href="/login" className="bg-amber-600 text-white px-6 py-2 rounded-xl text-sm bengali">লগইন</a></div>

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-500 rounded-2xl p-4 text-white flex items-center justify-between">
        <div>
          <div className="font-black text-lg bengali">{profile.hotel_name}</div>
          <div className="text-xs opacity-80 bengali">{profile.address || 'ঠিকানা সেট করুন'}</div>
        </div>
        <button onClick={() => setTab('settings')} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold bengali">সেটিংস</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'উঠেছে', value: fmtAmt(todayCollection), color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'মোট বাকি', value: fmtAmt(totalDue), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'চলমান অর্ডার', value: `${activeOrders.length}টি`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
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
          <div className="font-bold text-orange-800 bengali text-sm mb-1">📦 কম স্টক</div>
          <div className="flex flex-wrap gap-2">{lowStock.map(s => <span key={s.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg bengali">{s.name}: {s.quantity} {s.unit}</span>)}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bengali transition-all
              ${tab === t.id ? 'bg-amber-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => { setShowNewOrder(true); setOrderItems([]) }}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 bengali whitespace-nowrap">
          <Plus size={13} /> নতুন অর্ডার
        </button>
      </div>

      {/* ════════ NEW ORDER FORM ════════ */}
      {showNewOrder && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div className="font-bold text-amber-800 bengali">🍽️ নতুন অর্ডার</div>
            <button onClick={() => setShowNewOrder(false)}><X size={16} className="text-gray-400" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 bengali">টেবিল নম্বর</label>
              <select value={orderTable} onChange={e => setOrderTable(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                {TABLES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">খদ্দেরের নাম</label>
              <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5"
                placeholder="নাম (ঐচ্ছিক)" value={orderCustomer} onChange={e => setOrderCustomer(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 bengali">ফোন নম্বর</label>
              <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5"
                placeholder="ফোন (বাকি থাকলে দরকার)" value={orderCustomerPhone} onChange={e => setOrderCustomerPhone(e.target.value)} />
            </div>
          </div>

          {/* Menu items grid */}
          <div>
            <div className="text-xs font-bold text-gray-600 bengali mb-2">মেনু থেকে বেছে নিন</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none mb-2">
              {MENU_CATS.map(c => (
                <button key={c} onClick={() => setMenuCat(c)}
                  className={`px-2.5 py-1 rounded-full text-xs whitespace-nowrap bengali transition-all ${menuCat === c ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
              {menuItems.filter(m => m.is_available && (menuCat === 'সব' || m.category === menuCat)).map(item => (
                <button key={item.id} onClick={() => addItemToOrder(item)}
                  className="flex justify-between items-center bg-white border border-gray-200 rounded-xl px-3 py-2 text-left hover:border-amber-400 hover:bg-amber-50 transition-all">
                  <div>
                    <div className="text-xs font-semibold text-gray-800 bengali">{item.name_bn || item.name}</div>
                    <div className="text-xs text-gray-400">{item.is_veg ? '🟢' : '🔴'} ₹{item.price}</div>
                  </div>
                  <Plus size={14} className="text-amber-600 shrink-0" />
                </button>
              ))}
              {menuItems.filter(m => m.is_available && (menuCat === 'সব' || m.category === menuCat)).length === 0 && (
                <div className="col-span-2 text-center text-xs text-gray-400 bengali py-4">মেনুতে কোনো পদ নেই</div>
              )}
            </div>
          </div>

          {/* Order items */}
          {orderItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
              <div className="font-bold text-xs text-gray-600 bengali">অর্ডার তালিকা</div>
              {orderItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="bengali text-gray-800 flex-1">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setOrderItems(orderItems.map((i, j) => j === idx ? { ...i, qty: Math.max(1, i.qty - 1) } : i))} className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200">−</button>
                    <span className="font-bold w-6 text-center">{item.qty}</span>
                    <button onClick={() => setOrderItems(orderItems.map((i, j) => j === idx ? { ...i, qty: i.qty + 1 } : i))} className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center font-bold text-amber-700 hover:bg-amber-200">+</button>
                    <span className="text-gray-500 w-14 text-right">₹{(item.qty * item.price).toFixed(0)}</span>
                    <button onClick={() => setOrderItems(orderItems.filter((_, j) => j !== idx))} className="text-red-400 hover:text-red-600"><X size={13} /></button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-2 space-y-2">
                <div className="flex justify-between font-bold text-sm">
                  <span className="bengali">মোট</span><span>{fmtAmt(orderTotal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bengali text-sm text-gray-600 flex-1">আজকে নিলেন</span>
                  <input type="number" min={0} value={orderPaid || ''} onChange={e => setOrderPaid(+e.target.value)}
                    className="w-28 border-2 border-green-400 rounded-lg px-2 py-1 text-sm font-bold text-right" />
                </div>
                {orderTotal - orderPaid > 0 && orderPaid >= 0 && (
                  <div className="flex justify-between text-sm bg-red-50 rounded-lg px-2 py-1.5">
                    <span className="bengali text-red-600 font-semibold">বাকি থাকবে</span>
                    <span className="font-bold text-red-600">{fmtAmt(orderTotal - orderPaid)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 bengali">নোট</label>
            <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" placeholder="বিশেষ নির্দেশনা..." value={orderNotes} onChange={e => setOrderNotes(e.target.value)} />
          </div>

          <div className="flex gap-2">
            <button onClick={saveOrder} disabled={savingOrder || orderItems.length === 0}
              className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
              {savingOrder ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} অর্ডার সেভ করুন
            </button>
            <button onClick={() => setShowNewOrder(false)} className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}

      {/* ════════ ORDER TAB ════════ */}
      {tab === 'order' && (
        <div className="space-y-2">
          {activeOrders.length > 0 && (
            <div className="font-bold text-amber-700 bengali text-sm">⚡ চলমান অর্ডার ({activeOrders.length})</div>
          )}
          {orders.length === 0
            ? <div className="text-center py-10 text-gray-400 bengali text-sm">🍽️ এখনো কোনো অর্ডার নেই</div>
            : orders.slice(0, 30).map(o => (
              <div key={o.id} className={`border rounded-xl p-3 ${o.status === 'paid' ? 'bg-white border-gray-100' : o.status === 'active' ? 'bg-amber-50 border-amber-300' : 'bg-red-50 border-red-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 bengali text-sm">{o.table_no} — {o.customer_name}</div>
                    <div className="text-xs text-gray-500">{o.created_at?.slice(0, 16).replace('T', ' ')} · {(o.items as any[])?.length || 0}টি পদ</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(Array.isArray(o.items) ? o.items : []).slice(0, 3).map((i: any, idx: number) => (
                        <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full bengali">{i.name} ×{i.qty}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-gray-800">{fmtAmt(o.total_amount)}</div>
                    {Number(o.due_amount) > 0
                      ? <div className="flex gap-1 mt-1">
                          <span className="text-xs text-red-500 bengali">বাকি {fmtAmt(o.due_amount)}</span>
                          <button onClick={() => { setPayingOrder(o); setPayAmount(Number(o.due_amount)) }}
                            className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali hover:bg-green-200">নিন</button>
                        </div>
                      : <span className="text-xs text-green-600 bengali">✅ পরিশোধ</span>}
                  </div>
                </div>
                <div className="flex gap-1.5 mt-2">
                  <button onClick={() => printBill(o)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg bengali flex items-center gap-0.5"><Printer size={11} /> প্রিন্ট</button>
                  {o.status !== 'paid' && <button onClick={() => updateOrderStatus(o, 'paid')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg bengali">✅ পরিশোধ</button>}
                  <button onClick={() => updateOrderStatus(o, 'cancelled')} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg bengali">বাতিল</button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ════════ MENU TAB ════════ */}
      {tab === 'menu' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="পদ খুঁজুন..." value={menuSearch} onChange={e => setMenuSearch(e.target.value)} />
            </div>
            <button onClick={() => { setShowAddMenu(true); setEditMenu(null); setNewMenu({ category: 'ভাত-রুটি', is_available: true, is_veg: true }) }}
              className="bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> যোগ করুন
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
            {MENU_CATS.map(c => (
              <button key={c} onClick={() => setMenuCat(c)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap bengali transition-all ${menuCat === c ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
            ))}
            {showAddMenuCategory ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newMenuCategoryName} onChange={e => setNewMenuCategoryName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { const ok = await addMenuCategory(newMenuCategoryName); if (ok) { setNewMenuCategoryName(''); setShowAddMenuCategory(false) } }
                    else if (e.key === 'Escape') { setShowAddMenuCategory(false); setNewMenuCategoryName('') }
                  }}
                  placeholder="নতুন ক্যাটাগরি..."
                  className="px-2.5 py-1 rounded-full text-xs border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 w-28 bengali" />
                <button onClick={async () => { const ok = await addMenuCategory(newMenuCategoryName); if (ok) { setNewMenuCategoryName(''); setShowAddMenuCategory(false) } }}
                  className="text-amber-600 hover:text-amber-700"><Check size={14} /></button>
                <button onClick={() => { setShowAddMenuCategory(false); setNewMenuCategoryName('') }}
                  className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddMenuCategory(true)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:border-amber-300 hover:text-amber-600 flex items-center gap-1 flex-shrink-0 bengali">
                <Plus size={11} /> ক্যাটাগরি
              </button>
            )}
          </div>

          {showAddMenu && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-amber-800 bengali text-sm">{editMenu ? '✏️ সম্পাদনা' : '➕ নতুন পদ'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'পদের নাম (English) *', key: 'name', type: 'text', full: false }, { label: 'পদের নাম (বাংলা)', key: 'name_bn', type: 'text', full: false }, { label: 'বিক্রির দাম (₹)', key: 'price', type: 'number', full: false }, { label: 'কস্ট প্রাইস (₹)', key: 'cost_price', type: 'number', full: false }, { label: 'বিবরণ', key: 'description', type: 'text', full: true }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newMenu as any)[f.key] || ''} onChange={e => setNewMenu(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">Category</label>
                  <select value={newMenu.category} onChange={e => setNewMenu(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {MENU_CATS.filter(c => c !== 'সব').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs text-gray-600 bengali">
                    <input type="checkbox" checked={!!newMenu.is_veg} onChange={e => setNewMenu(p => ({ ...p, is_veg: e.target.checked }))} /> 🟢 নিরামিষ
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-600 bengali">
                    <input type="checkbox" checked={newMenu.is_available !== false} onChange={e => setNewMenu(p => ({ ...p, is_available: e.target.checked }))} /> ✅ পাওয়া যাচ্ছে
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveMenu} disabled={savingMenu}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingMenu ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => { setShowAddMenu(false); setEditMenu(null) }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {filteredMenu.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{menuItems.length === 0 ? '🍽️ মেনু খালি — পদ যোগ করুন' : 'পাওয়া যায়নি'}</div>
            : filteredMenu.map(item => (
              <div key={item.id} className={`border rounded-xl p-3 ${!item.is_available ? 'opacity-50 bg-gray-50 border-gray-200' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 bengali text-sm">{item.name_bn || item.name}
                      <span className="ml-1 text-xs">{item.is_veg ? '🟢' : '🔴'}</span>
                    </div>
                    <div className="text-xs text-gray-500 bengali">{item.category} {item.description ? `· ${item.description}` : ''}</div>
                  </div>
                  <div className="flex gap-1 items-center">
                    <span className="font-bold text-amber-700">₹{item.price}</span>
                    <button onClick={() => toggleAvailable(item)} className={`text-xs px-2 py-0.5 rounded-full font-semibold ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>{item.is_available ? 'চালু' : 'বন্ধ'}</button>
                    <button onClick={() => { setEditMenu(item); setNewMenu({ ...item }); setShowAddMenu(true) }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit2 size={12} /></button>
                    <button onClick={() => deleteMenu(item.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={12} /></button>
                  </div>
                </div>
                {item.cost_price > 0 && <div className="text-xs text-gray-400 mt-0.5 bengali">মার্জিন: ₹{item.price - item.cost_price} ({Math.round((item.price - item.cost_price) / item.price * 100)}%)</div>}
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
            <button onClick={() => setShowAddCust(true)} className="bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> খদ্দের
            </button>
            <button onClick={() => { let csv = 'নাম,ফোন,ঠিকানা,মোট খরচ,বাকি,শেষ ভিজিট\n'; customers.forEach(c => { csv += `"${c.name}","${c.phone}","${c.address}",${c.total_spent},${c.total_due},"${c.last_visit}"\n` }); downloadCSV(csv, `customers-${today()}.csv`) }}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          {showAddCust && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-amber-800 bengali text-sm">👤 নতুন খদ্দের</div>
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
                <button onClick={saveCustomer} disabled={savingCust}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
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
                  <div>
                    <div className="font-bold text-gray-800 bengali">{c.name}</div>
                    {c.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</div>}
                    {c.address && <div className="text-xs text-gray-400 bengali">📍 {c.address}</div>}
                    <div className="text-xs text-gray-400 bengali mt-0.5">মোট খরচ: {fmtAmt(c.total_spent || 0)} · শেষ ভিজিট: {c.last_visit || 'নেই'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(c.total_due || 0) > 0
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold bengali">বাকি {fmtAmt(c.total_due || 0)}</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">✅ ক্লিয়ার</span>}
                    <div className="flex gap-1">
                      <button onClick={() => shareWhatsApp(c)} className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg"><MessageCircle size={13} /></button>
                      <button onClick={() => shareSMS(c)} className="text-purple-500 hover:bg-purple-50 p-1.5 rounded-lg"><Send size={13} /></button>
                      <button onClick={() => { setMsgCust(c); setMsgText('') }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Share2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ════════ STOCK TAB ════════ */}
      {tab === 'stock' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="স্টক খুঁজুন..." value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
            </div>
            <button onClick={() => { setShowAddStock(true); setEditStock(null); setNewStock({ unit: 'কেজি', category: 'চাল-ডাল', quantity: 0, min_quantity: 5 }) }}
              className="bg-amber-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> যোগ করুন
            </button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
            {['সব', ...STOCK_CATS].map(c => (
              <button key={c} onClick={() => setStockCat(c)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap bengali transition-all ${stockCat === c ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
            ))}
            {showAddStockCategory ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newStockCategoryName} onChange={e => setNewStockCategoryName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { const ok = await addStockCategory(newStockCategoryName); if (ok) { setNewStockCategoryName(''); setShowAddStockCategory(false) } }
                    else if (e.key === 'Escape') { setShowAddStockCategory(false); setNewStockCategoryName('') }
                  }}
                  placeholder="নতুন ক্যাটাগরি..."
                  className="px-2.5 py-1 rounded-full text-xs border border-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 w-28 bengali" />
                <button onClick={async () => { const ok = await addStockCategory(newStockCategoryName); if (ok) { setNewStockCategoryName(''); setShowAddStockCategory(false) } }}
                  className="text-amber-600 hover:text-amber-700"><Check size={14} /></button>
                <button onClick={() => { setShowAddStockCategory(false); setNewStockCategoryName('') }}
                  className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddStockCategory(true)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:border-amber-300 hover:text-amber-600 flex items-center gap-1 flex-shrink-0 bengali">
                <Plus size={11} /> ক্যাটাগরি
              </button>
            )}
          </div>

          {showAddStock && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-amber-800 bengali text-sm">{editStock ? '✏️ সম্পাদনা' : '➕ নতুন স্টক'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'উপাদানের নাম *', key: 'name', type: 'text', full: true }, { label: 'পরিমাণ', key: 'quantity', type: 'number' }, { label: 'ন্যূনতম পরিমাণ', key: 'min_quantity', type: 'number' }, { label: 'কস্ট/ইউনিট (₹)', key: 'cost_per_unit', type: 'number' }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newStock as any)[f.key] || ''} onChange={e => setNewStock(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">Unit</label>
                  <select value={newStock.unit} onChange={e => setNewStock(p => ({ ...p, unit: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {STOCK_UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 bengali">Category</label>
                  <select value={newStock.category} onChange={e => setNewStock(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {STOCK_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveStock} disabled={savingStock}
                  className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingStock ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => { setShowAddStock(false); setEditStock(null) }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {filteredStock.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{stockItems.length === 0 ? '📦 স্টক নেই' : 'পাওয়া যায়নি'}</div>
            : filteredStock.map(s => {
              const isLow = s.quantity <= s.min_quantity
              return (
                <div key={s.id} className={`border rounded-xl p-3 ${isLow ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-800 bengali text-sm">{s.name}</div>
                      <div className="text-xs text-gray-400 bengali">{s.category} · শেষ আপডেট: {s.last_updated}</div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => { setEditStock(s); setNewStock({ ...s }); setShowAddStock(true) }} className="text-blue-500 p-1.5 rounded-lg hover:bg-blue-50"><Edit2 size={12} /></button>
                      <button onClick={async () => { if (!confirm('মুছবেন?')) return; await supabase.from('hotel_stock').delete().eq('id', s.id); setStockItems(stockItems.filter(x => x.id !== s.id)) }} className="text-red-400 p-1.5 rounded-lg hover:bg-red-50"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 bengali">পরিমাণ:</span>
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{s.quantity} {s.unit}</span>
                      <button onClick={() => quickUpdateStock(s, -1)} className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center font-bold text-gray-600">−</button>
                      <button onClick={() => quickUpdateStock(s, 1)} className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center font-bold text-amber-700">+</button>
                    </div>
                    {s.cost_per_unit > 0 && <span className="text-gray-400">₹{s.cost_per_unit}/{s.unit}</span>}
                    {isLow && <span className="text-orange-600 font-bold">⚠️ কম!</span>}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* ════════ REPORT TAB ════════ */}
      {tab === 'report' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), icon: '📈', color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'আজকে উঠেছে', value: fmtAmt(todayCollection), icon: '💰', color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'মোট বাকি', value: fmtAmt(totalDue), icon: '💸', color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'মোট মেনু', value: `${menuItems.length}টি`, icon: '🍽️', color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'মোট খদ্দের', value: `${customers.length}জন`, icon: '👥', color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'কম স্টক', value: `${lowStock.length}টি`, icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50' },
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                    <span className="bengali text-sm font-semibold">{c.name}</span>
                  </div>
                  <span className="font-bold text-red-600 text-sm">{fmtAmt(c.total_due || 0)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={exportSalesCSV} className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> বিক্রির রিপোর্ট
            </button>
            <button onClick={() => { let csv = 'নাম,Category,পরিমাণ,Unit,ন্যূনতম\n'; stockItems.forEach(s => { csv += `"${s.name}","${s.category}",${s.quantity},"${s.unit}",${s.min_quantity}\n` }); downloadCSV(csv, `stock-${today()}.csv`); toast.success('স্টক রিপোর্ট ডাউনলোড!') }}
              className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> স্টক রিপোর্ট
            </button>
          </div>
        </div>
      )}

      {/* ════════ SETTINGS TAB ════════ */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="font-bold text-amber-800 bengali text-sm mb-3">🏪 হোটেলের তথ্য</div>
            <div className="space-y-3">
              {[
                { label: 'হোটেল/ধাবার নাম *', key: 'hotel_name', placeholder: 'যেমন: রহমান ধাবা' },
                { label: 'মালিকের নাম', key: 'owner_name', placeholder: 'আপনার নাম' },
                { label: 'ফোন', key: 'phone', placeholder: '01XXXXXXXXX' },
                { label: 'ঠিকানা', key: 'address', placeholder: 'গ্রাম, ব্লক, জেলা' },
                { label: 'GSTIN', key: 'gstin', placeholder: 'GST নম্বর' },
                { label: 'UPI ID', key: 'upi_id', placeholder: 'আপনার UPI ID' },
                { label: 'বিলের শেষে বার্তা', key: 'print_footer', placeholder: 'ধন্যবাদ! আবার আসবেন 🙏' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 bengali">{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={(profile as any)[f.key] || ''}
                    onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                </div>
              ))}
            </div>
            <button onClick={saveProfile} disabled={savingProfile}
              className="mt-4 w-full bg-amber-600 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-2 hover:bg-amber-700">
              {savingProfile ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} সেভ করুন
            </button>
          </div>
        </div>
      )}

      {/* ════════ PAYMENT MODAL ════════ */}
      {payingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingOrder(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট নিন</div>
            <div className="text-sm text-gray-500 bengali mb-3">{payingOrder.table_no} · বাকি: {fmtAmt(payingOrder.due_amount)}</div>
            <label className="text-xs text-gray-500 bengali">পরিমাণ (₹)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(+e.target.value)}
              className="w-full border-2 border-amber-400 rounded-xl px-3 py-2.5 text-2xl font-bold text-center mt-1 mb-4" />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={savingPay || payAmount <= 0}
                className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
                {savingPay ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} নিশ্চিত
              </button>
              <button onClick={() => setPayingOrder(null)} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold bengali">বাতিল</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ CUSTOM MESSAGE MODAL ════════ */}
      {msgCust && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMsgCust(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali">💬 বার্তা পাঠান</div>
            <div className="text-sm text-amber-700 font-semibold bengali">{msgCust.name} {msgCust.phone ? `(${msgCust.phone})` : ''}</div>
            <textarea rows={5} className="w-full border-2 border-amber-200 rounded-xl px-3 py-2 text-sm resize-none bengali"
              placeholder="বার্তা লিখুন..."
              value={msgText || ((msgCust.total_due || 0) > 0 ? `নমস্কার ${msgCust.name}! ${profile.hotel_name}-এ আপনার বাকি: ₹${(msgCust.total_due || 0).toFixed(0)}। পরিশোধ করুন। 🙏` : `নমস্কার ${msgCust.name}! ${profile.hotel_name} থেকে যোগাযোগ করা হচ্ছে।`)}
              onChange={e => setMsgText(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => shareWhatsApp(msgCust, msgText || undefined)}
                className="bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5 hover:bg-green-600">
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button onClick={() => shareSMS(msgCust)}
                className="bg-purple-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5 hover:bg-purple-600">
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
