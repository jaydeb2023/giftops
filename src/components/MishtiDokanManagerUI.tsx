'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Plus, Search, Trash2, Edit2, Save, Download,
  Loader2, Check, X, Phone, MessageCircle,
  Send, Share2, Printer, IndianRupee, Package,
  BarChart2, BookOpen, RefreshCw, TrendingUp,
  Users, AlertTriangle, Calendar,
  Mic, MicOff,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

// ─── Types ────────────────────────────────────────────────────────
interface MishtiItem {
  id: string
  user_id?: string
  name: string
  name_bn: string
  category: string
  price_per_kg: number
  cost_per_kg: number
  stock_kg: number
  min_stock_kg: number
  shelf_life_days: number
  is_available: boolean
  made_today_kg: number
  production_date: string
}

interface Sale {
  id: string
  user_id?: string
  customer_name: string
  customer_phone: string
  item_name: string
  quantity_kg: number
  price_per_kg: number
  total_amount: number
  paid_amount: number
  due_amount: number
  payment_status: string
  sale_date: string
  occasion: string
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
  last_purchase: string
  is_regular: boolean
}

interface Production {
  id: string
  user_id?: string
  item_name: string
  quantity_kg: number
  cost_total: number
  production_date: string
  expiry_date: string
  notes: string
  batch_no: string
}

interface ShopProfile {
  shop_name: string
  owner_name: string
  phone: string
  address: string
  upi_id: string
  print_footer: string
  festival_mode: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function addDays(date: string, days: number) {
  const d = new Date(date); d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
function fmtAmt(n: number) { return `₹${Number(n || 0).toFixed(0)}` }
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

const DEFAULT_MISHTI_CATS = ['সব', 'সন্দেশ', 'রসগোল্লা', 'মিষ্টি দই', 'কালোজাম', 'পান্তুয়া', 'ছানার মিষ্টি', 'মোয়া-নাড়ু', 'পিঠাপুলি', 'অন্যান্য']
const OCCASIONS = ['সাধারণ', 'পূজা', 'ঈদ', 'বিয়ে', 'জন্মদিন', 'অনুষ্ঠান', 'উপহার']

// ══════════════════════════════════════════════════════════════════
// ─── Voice Hook ─────────────────────────────────────────────────
declare global { interface Window { SpeechRecognition: any; webkitSpeechRecognition: any } }
function useMishtiVoice(onFinalResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [interim, setInterim] = useState('')
  const ref = useRef<any>(null)
  const finalRef = useRef('')
  useEffect(() => { if (!window.SpeechRecognition && !window.webkitSpeechRecognition) setSupported(false) }, [])
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { return }
    if (ref.current) ref.current.stop()
    finalRef.current = ''; setInterim('')
    const r = new SR()
    ref.current = r
    r.lang = 'bn-IN'; r.interimResults = true; r.continuous = false
    r.onstart = () => setListening(true)
    r.onresult = (e: any) => {
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalRef.current += e.results[i][0].transcript + ' '
        else interimText += e.results[i][0].transcript
      }
      setInterim(interimText)
    }
    r.onerror = () => { setListening(false); setInterim('') }
    r.onend = () => {
      setListening(false); setInterim('')
      const final = finalRef.current.trim()
      if (final) onFinalResult(final)
    }
    r.start()
  }, [onFinalResult])
  const stop = useCallback(() => { ref.current?.stop(); setListening(false); setInterim('') }, [])
  useEffect(() => () => ref.current?.abort(), [])
  return { listening, supported, start, stop, interim }
}

export default function MishtiDokanManagerUI({ userId: propUserId }: { userId?: string }) {
  const [userId, setUserId] = useState<string | null>(propUserId || null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')

  // Data
  const [mishtiItems, setMishtiItems] = useState<MishtiItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [productions, setProductions] = useState<Production[]>([])
  const [profile, setProfile] = useState<ShopProfile>({ shop_name: 'আমার মিষ্টির দোকান', owner_name: '', phone: '', address: '', upi_id: '', print_footer: 'ধন্যবাদ! আবার আসবেন 🙏', festival_mode: false })

  // Stock/Mishti tab
  const [mishtiSearch, setMishtiSearch] = useState('')
  const [mishtiCat, setMishtiCat] = useState('সব')
  const { categories: MISHTI_CATS, addCategory } = useCustomCategories(userId || undefined, 'mishti', DEFAULT_MISHTI_CATS)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddMishti, setShowAddMishti] = useState(false)
  const [editMishti, setEditMishti] = useState<MishtiItem | null>(null)
  const [newMishti, setNewMishti] = useState<Partial<MishtiItem>>({ category: 'সন্দেশ', is_available: true, shelf_life_days: 3, min_stock_kg: 2 })
  const [savingMishti, setSavingMishti] = useState(false)

  // Production tab
  const [showAddProd, setShowAddProd] = useState(false)
  const [newProd, setNewProd] = useState<Partial<Production>>({ production_date: today() })
  const [savingProd, setSavingProd] = useState(false)

  // Sale tab
  const [showNewSale, setShowNewSale] = useState(false)
  const [saleCustSearch, setSaleCustSearch] = useState('')
  const [saleItems, setSaleItems] = useState<{ name: string; qty: number; price: number }[]>([{ name: '', qty: 0.5, price: 0 }])
  const [saleCustName, setSaleCustName] = useState('')
  const [saleCustPhone, setSaleCustPhone] = useState('')
  const [saleOccasion, setSaleOccasion] = useState('সাধারণ')
  const [salePaid, setSalePaid] = useState(0)
  const [savingSale, setSavingSale] = useState(false)

  // Customer tab
  const [custSearch, setCustSearch] = useState('')
  const [showAddCust, setShowAddCust] = useState(false)
  const [newCust, setNewCust] = useState<Partial<Customer>>({})
  const [savingCust, setSavingCust] = useState(false)
  const [msgCust, setMsgCust] = useState<Customer | null>(null)
  const [msgText, setMsgText] = useState('')

  // Payment modal
  const [payingSale, setPayingSale] = useState<Sale | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [savingPay, setSavingPay] = useState(false)

  // Settings
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Init ──────────────────────────────────────────────────────
  // ── Voice for mishti form ────────────────────────────────────
  const [voiceMishtiField, setVoiceMishtiField] = useState<string | null>(null)
  const mishtiVoice = useMishtiVoice((text: string) => {
    if (voiceMishtiField) {
      setNewMishti((p: any) => ({ ...p, [voiceMishtiField]: text }))
      setVoiceMishtiField(null)
    }
  })

  // ── Load ──────────────────────────────────────────────────────
  const loadMishti = async (uid: string) => {
    const { data } = await supabase.from('mishti_items').select('*').eq('user_id', uid).order('category').order('name')
    if (data) setMishtiItems(data)
  }

  const loadSales = async (uid: string) => {
    const { data } = await supabase.from('mishti_sales').select('*').eq('user_id', uid).order('sale_date', { ascending: false }).limit(100)
    if (data) setSales(data)
  }

  const loadCustomers = async (uid: string) => {
    const { data } = await supabase.from('mishti_customers').select('*').eq('user_id', uid).order('name')
    if (data) setCustomers(data)
  }

  const loadProductions = async (uid: string) => {
    const { data } = await supabase.from('mishti_production').select('*').eq('user_id', uid).order('production_date', { ascending: false }).limit(50)
    if (data) setProductions(data)
  }

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from('mishti_profiles').select('*').eq('user_id', uid).single()
    if (data) setProfile({ shop_name: data.shop_name || 'আমার মিষ্টির দোকান', owner_name: data.owner_name || '', phone: data.phone || '', address: data.address || '', upi_id: data.upi_id || '', print_footer: data.print_footer || 'ধন্যবাদ! আবার আসবেন 🙏', festival_mode: data.festival_mode || false })
  }

  // ── Init ──────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const uid = propUserId || (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)
      await Promise.all([loadMishti(uid), loadSales(uid), loadCustomers(uid), loadProductions(uid), loadProfile(uid)])
      setLoading(false)
    }
    init()
  }, [propUserId])

  // ── Reload trigger via window.__mishtiReload ─────────────────────
  useEffect(() => {
    ;(window as any).__mishtiReload = async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) return
      await Promise.all([loadMishti(uid), loadSales(uid), loadCustomers(uid), loadProductions(uid)])
    }
    return () => { delete (window as any).__mishtiReload }
  }, [])

  // ── Derived ───────────────────────────────────────────────────
  const todaySales = sales.filter(s => s.sale_date === today())
  const todayRevenue = todaySales.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const totalDue = customers.reduce((s, c) => s + Number(c.total_due || 0), 0)
  const lowStock = mishtiItems.filter(m => m.stock_kg <= m.min_stock_kg)
  const expiringSoon = mishtiItems.filter(m => {
    if (!m.production_date || !m.shelf_life_days) return false
    const expiry = addDays(m.production_date, m.shelf_life_days)
    const diffDays = (new Date(expiry).getTime() - new Date().getTime()) / 86400000
    return diffDays >= 0 && diffDays <= 1
  })
  const saleGross = saleItems.reduce((s, i) => s + i.qty * i.price, 0)

  const filteredMishti = mishtiItems.filter(m => {
    const mq = !mishtiSearch || m.name.toLowerCase().includes(mishtiSearch.toLowerCase()) || m.name_bn?.includes(mishtiSearch)
    const mc = mishtiCat === 'সব' || m.category === mishtiCat
    return mq && mc
  })
  const filteredCusts = customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone?.includes(custSearch))

  // ── Mishti CRUD ───────────────────────────────────────────────
  const saveMishti = async () => {
    if (!newMishti.name) { toast.error('মিষ্টির নাম দিন'); return }
    if (!userId) return
    setSavingMishti(true)
    try {
      const payload = { user_id: userId, name: newMishti.name, name_bn: newMishti.name_bn || newMishti.name, category: newMishti.category || 'অন্যান্য', price_per_kg: Number(newMishti.price_per_kg || 0), cost_per_kg: Number(newMishti.cost_per_kg || 0), stock_kg: Number(newMishti.stock_kg || 0), min_stock_kg: Number(newMishti.min_stock_kg || 2), shelf_life_days: Number(newMishti.shelf_life_days || 3), is_available: newMishti.is_available !== false, made_today_kg: 0, production_date: today() }
      if (editMishti) { await supabase.from('mishti_items').update(payload).eq('id', editMishti.id); toast.success('আপডেট হয়েছে!') }
      else { await supabase.from('mishti_items').insert(payload); toast.success('মিষ্টি যোগ হয়েছে! 🍬') }
      setNewMishti({ category: 'সন্দেশ', is_available: true, shelf_life_days: 3, min_stock_kg: 2 }); setShowAddMishti(false); setEditMishti(null)
      await loadMishti(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingMishti(false) }
  }

  const deleteMishti = async (id: string) => {
    if (!confirm('মুছবেন?')) return
    await supabase.from('mishti_items').delete().eq('id', id)
    setMishtiItems(mishtiItems.filter(m => m.id !== id))
  }

  const quickUpdateStock = async (item: MishtiItem, delta: number) => {
    const newStock = Math.max(0, Math.round((item.stock_kg + delta) * 10) / 10)
    await supabase.from('mishti_items').update({ stock_kg: newStock }).eq('id', item.id)
    setMishtiItems(mishtiItems.map(m => m.id === item.id ? { ...m, stock_kg: newStock } : m))
  }

  // ── Production ────────────────────────────────────────────────
  const saveProduction = async () => {
    if (!newProd.item_name || !newProd.quantity_kg) { toast.error('মিষ্টির নাম ও পরিমাণ দিন'); return }
    if (!userId) return
    setSavingProd(true)
    try {
      const item = mishtiItems.find(m => m.name === newProd.item_name || m.name_bn === newProd.item_name)
      const expiryDate = addDays(newProd.production_date || today(), item?.shelf_life_days || 3)
      const batchNo = `B${Date.now().toString().slice(-6)}`
      await supabase.from('mishti_production').insert({ user_id: userId, item_name: newProd.item_name, quantity_kg: Number(newProd.quantity_kg), cost_total: Number(newProd.cost_total || 0), production_date: newProd.production_date || today(), expiry_date: expiryDate, notes: newProd.notes || '', batch_no: batchNo })
      // Update stock
      if (item) {
        const newStock = (item.stock_kg || 0) + Number(newProd.quantity_kg)
        await supabase.from('mishti_items').update({ stock_kg: newStock, production_date: newProd.production_date || today(), made_today_kg: Number(newProd.quantity_kg) }).eq('id', item.id)
      }
      toast.success(`${newProd.quantity_kg} কেজি ${newProd.item_name} তৈরি রেকর্ড হয়েছে! ✅`)
      setNewProd({ production_date: today() }); setShowAddProd(false)
      await Promise.all([loadMishti(userId), loadProductions(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingProd(false) }
  }

  // ── Sale ──────────────────────────────────────────────────────
  const saveSale = async () => {
    if (saleItems.every(i => !i.name || !i.qty)) { toast.error('পণ্য যোগ করুন'); return }
    if (!userId) return
    setSavingSale(true)
    try {
      const validItems = saleItems.filter(i => i.name && i.qty > 0)
      const rows = validItems.map(i => {
        const total = i.qty * i.price
        const perItemPaid = salePaid / validItems.length
        const due = Math.max(0, total - perItemPaid)
        return { user_id: userId, agent_id: LIBRARY_AGENT_IDS.mishti, customer_name: saleCustName || 'অজানা', customer_phone: saleCustPhone || '', item_name: i.name, quantity_kg: i.qty, price_per_kg: i.price, total_amount: total, paid_amount: perItemPaid, due_amount: due, payment_status: due <= 0 ? 'paid' : perItemPaid > 0 ? 'partial' : 'pending', sale_date: today(), occasion: saleOccasion, notes: '' }
      })
      const { error } = await supabase.from('mishti_sales').insert(rows)
      if (error) throw error
      // Deduct stock
      for (const i of validItems) {
        const item = mishtiItems.find(m => m.name === i.name || m.name_bn === i.name)
        if (item) await supabase.from('mishti_items').update({ stock_kg: Math.max(0, item.stock_kg - i.qty) }).eq('id', item.id)
      }
      // Update customer
      const totalDueNew = rows.reduce((s, r) => s + r.due_amount, 0)
      if (saleCustPhone && totalDueNew > 0) {
        const cust = customers.find(c => c.phone === saleCustPhone)
        if (cust) await supabase.from('mishti_customers').update({ total_due: (cust.total_due || 0) + totalDueNew, total_spent: (cust.total_spent || 0) + saleGross, last_purchase: today() }).eq('id', cust.id)
      }
      toast.success('বিক্রি সেভ হয়েছে! 🎉')
      if (confirm('বিল প্রিন্ট করবেন?')) printBill(saleCustName, validItems, saleGross, salePaid, saleOccasion)
      setSaleItems([{ name: '', qty: 0.5, price: 0 }]); setSaleCustName(''); setSaleCustPhone(''); setSalePaid(0); setSaleOccasion('সাধারণ'); setShowNewSale(false)
      await Promise.all([loadMishti(userId), loadSales(userId), loadCustomers(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingSale(false) }
  }

  const savePayment = async () => {
    if (!payingSale || !userId) return
    setSavingPay(true)
    try {
      const newPaid = Number(payingSale.paid_amount) + Number(payAmount)
      const newDue = Math.max(0, Number(payingSale.total_amount) - newPaid)
      await supabase.from('mishti_sales').update({ paid_amount: newPaid, due_amount: newDue, payment_status: newDue <= 0 ? 'paid' : 'partial' }).eq('id', payingSale.id)
      const cust = customers.find(c => c.name === payingSale.customer_name)
      if (cust) await supabase.from('mishti_customers').update({ total_due: Math.max(0, (cust.total_due || 0) - payAmount) }).eq('id', cust.id)
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
      await supabase.from('mishti_customers').insert({ user_id: userId, name: newCust.name, phone: newCust.phone || '', address: newCust.address || '', notes: newCust.notes || '', total_due: 0, total_spent: 0, last_purchase: today(), is_regular: false })
      toast.success('খদ্দের যোগ হয়েছে!')
      setNewCust({}); setShowAddCust(false); await loadCustomers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingCust(false) }
  }

  const shareWhatsApp = (c: Customer, customMsg?: string) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const msg = customMsg || ((c.total_due || 0) > 0
      ? `নমস্কার ${c.name}! ${profile.shop_name}-এ আপনার বাকি: *₹${(c.total_due || 0).toFixed(0)}*। পরিশোধ করুন। 🙏`
      : `নমস্কার ${c.name}! ${profile.shop_name} থেকে যোগাযোগ করা হচ্ছে। 🍬`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // ── Print ─────────────────────────────────────────────────────
  const printBill = (custName: string, items: any[], total: number, paid: number, occasion: string) => {
    const due = total - paid
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>বিল</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
body{font-family:'Hind Siliguri',sans-serif;padding:20px;max-width:380px;margin:auto;color:#111}
h2{text-align:center;color:#db2777;margin:0 0 2px;font-size:18px}
.sub{text-align:center;font-size:11px;color:#666;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#db2777;color:white;padding:5px 8px;text-align:left}
td{padding:4px 8px;border-bottom:1px solid #eee}
.footer{text-align:center;margin-top:12px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px}
</style></head><body>
<h2>🍬 ${profile.shop_name}</h2>
<div class="sub">${profile.address || ''} ${profile.phone ? '| ' + profile.phone : ''}<br>তারিখ: ${new Date().toLocaleDateString('bn-IN')} ${occasion !== 'সাধারণ' ? '| ' + occasion : ''}</div>
${custName && custName !== 'অজানা' ? `<p style="margin:4px 0"><b>খদ্দের:</b> ${custName}</p>` : ''}
<table><tr><th>মিষ্টি</th><th>পরিমাণ (কেজি)</th><th>₹/কেজি</th><th>মোট</th></tr>
${items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price}</td><td>₹${(i.qty * i.price).toFixed(0)}</td></tr>`).join('')}
<tr style="background:#fdf2f8;font-weight:bold"><td colspan="3">মোট</td><td>₹${total.toFixed(0)}</td></tr>
<tr><td colspan="3" style="color:#16a34a">পরিশোধ</td><td style="color:#16a34a">₹${paid.toFixed(0)}</td></tr>
${due > 0 ? `<tr><td colspan="3" style="color:#dc2626">বাকি</td><td style="color:#dc2626">₹${due.toFixed(0)}</td></tr>` : ''}
</table>
${profile.upi_id ? `<p style="text-align:center;font-size:11px;margin-top:8px">UPI: <b>${profile.upi_id}</b></p>` : ''}
<div class="footer">${profile.print_footer}<br>Sahayak AI</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const saveProfile = async () => {
    if (!userId) return
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('mishti_profiles').upsert({ user_id: userId, ...profile }, { onConflict: 'user_id' })
      if (error) throw error
      toast.success('সেটিংস সেভ হয়েছে! ✅')
    } catch (e: any) {
      console.error('mishti_profiles save failed:', e)
      toast.error(e.message || 'সেভ করা যায়নি')
    } finally { setSavingProfile(false) }
  }

  const TABS = [
    { id: 'stock', label: 'স্টক', icon: <Package size={13} /> },
    { id: 'production', label: 'উৎপাদন', icon: <RefreshCw size={13} /> },
    { id: 'sale', label: 'বিক্রি', icon: <IndianRupee size={13} /> },
    { id: 'customers', label: 'খদ্দের', icon: <Users size={13} /> },
    { id: 'report', label: 'রিপোর্ট', icon: <BarChart2 size={13} /> },
    { id: 'settings', label: 'সেটিংস', icon: <Save size={13} /> },
  ]

  // ══════════════════════════════════════════════════════════════
  if (loading) return <div className="flex items-center justify-center py-16 text-pink-600"><Loader2 className="animate-spin mr-2" size={22} /><span className="bengali text-sm">লোড হচ্ছে...</span></div>
  if (!userId) return <div className="text-center py-16"><p className="bengali text-gray-500 mb-3">লগইন করুন</p><a href="/login" className="bg-pink-600 text-white px-6 py-2 rounded-xl text-sm bengali">লগইন</a></div>

  return (
    <div className="space-y-3">

      {/* Header */}
      <div className="bg-gradient-to-r from-pink-600 to-rose-500 rounded-2xl p-4 text-white flex items-center justify-between">
        <div>
          <div className="font-black text-lg bengali">{profile.shop_name}</div>
          <div className="text-xs opacity-80 bengali">{profile.address || 'ঠিকানা সেট করুন'}</div>
        </div>
        <button onClick={() => setTab('settings')} className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold bengali">সেটিংস</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), color: 'text-pink-700', bg: 'bg-pink-50 border-pink-200' },
          { label: 'মোট বাকি', value: fmtAmt(totalDue), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'কম স্টক', value: `${lowStock.length}টি`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
          { label: 'মেয়াদ শেষ হচ্ছে', value: `${expiringSoon.length}টি`, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-3`}>
            <div className={`font-extrabold text-lg ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {expiringSoon.length > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3">
          <div className="font-bold text-red-800 bengali text-sm mb-1.5">🚨 আজই শেষ হবে মেয়াদ — এখনই বিক্রি করুন</div>
          <div className="flex flex-wrap gap-2">{expiringSoon.map(m => <span key={m.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg bengali">🍬 {m.name_bn || m.name}: {m.stock_kg} কেজি</span>)}</div>
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3">
          <div className="font-bold text-orange-800 bengali text-sm mb-1.5">📦 কম স্টক — তৈরি করুন</div>
          <div className="flex flex-wrap gap-2">{lowStock.map(m => <span key={m.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg bengali">{m.name_bn || m.name}: {m.stock_kg} কেজি</span>)}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bengali transition-all
              ${tab === t.id ? 'bg-pink-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setShowNewSale(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-pink-600 text-white hover:bg-pink-700 bengali whitespace-nowrap">
          <Plus size={13} /> নতুন বিক্রি
        </button>
      </div>

      {/* ════════ NEW SALE FORM ════════ */}
      {showNewSale && (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between">
            <div className="font-bold text-pink-800 bengali">🍬 নতুন বিক্রি</div>
            <button onClick={() => setShowNewSale(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 bengali">খদ্দেরের নাম</label>
              <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 bengali" placeholder="নাম (ঐচ্ছিক)" value={saleCustName} onChange={e => setSaleCustName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 bengali">ফোন</label>
              <input className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" placeholder="01XXXXXXXXX" value={saleCustPhone} onChange={e => setSaleCustPhone(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 bengali">উপলক্ষ</label>
              <select value={saleOccasion} onChange={e => setSaleOccasion(e.target.value)} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 bengali">
                {OCCASIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-600 bengali">মিষ্টির তালিকা</div>
            {saleItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-7 gap-1.5 items-center">
                <div className="col-span-3">
                  <select value={item.name} onChange={e => {
                    const m = mishtiItems.find(x => x.name === e.target.value || x.name_bn === e.target.value)
                    const items = [...saleItems]; items[idx] = { ...items[idx], name: e.target.value, price: m ? m.price_per_kg : 0 }
                    setSaleItems(items)
                  }} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bengali">
                    <option value="">মিষ্টি বেছে নিন</option>
                    {mishtiItems.filter(m => m.is_available).map(m => <option key={m.id} value={m.name}>{m.name_bn || m.name} (স্টক: {m.stock_kg}kg)</option>)}
                  </select>
                </div>
                <input type="number" step="0.1" min="0.1" placeholder="কেজি" value={item.qty || ''}
                  onChange={e => { const i = [...saleItems]; i[idx].qty = +e.target.value; setSaleItems(i) }}
                  className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                <input type="number" placeholder="₹/kg" value={item.price || ''}
                  onChange={e => { const i = [...saleItems]; i[idx].price = +e.target.value; setSaleItems(i) }}
                  className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                <button onClick={() => setSaleItems(saleItems.filter((_, i) => i !== idx))} className="text-red-400 flex justify-center"><X size={13} /></button>
              </div>
            ))}
            <button onClick={() => setSaleItems([...saleItems, { name: '', qty: 0.5, price: 0 }])}
              className="text-xs text-pink-600 flex items-center gap-1 font-semibold bengali"><Plus size={13} /> মিষ্টি যোগ করুন</button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm"><span className="bengali text-gray-600">মোট</span><span className="font-bold">{fmtAmt(saleGross)}</span></div>
            <div className="flex items-center gap-2">
              <span className="bengali text-sm text-gray-600 flex-1">আজকে নিলেন</span>
              <input type="number" min={0} value={salePaid || ''} onChange={e => setSalePaid(+e.target.value)}
                className="w-28 border-2 border-green-400 rounded-lg px-2 py-1.5 text-sm font-bold text-right" />
            </div>
            {saleGross - salePaid > 0 && salePaid >= 0 && (
              <div className="flex justify-between text-sm bg-red-50 rounded-lg px-2 py-1.5">
                <span className="bengali text-red-600 font-semibold">বাকি থাকবে</span>
                <span className="font-bold text-red-600">{fmtAmt(saleGross - salePaid)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={saveSale} disabled={savingSale}
              className="flex-1 bg-pink-600 text-white py-2.5 rounded-xl text-sm font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
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
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="মিষ্টি খুঁজুন..." value={mishtiSearch} onChange={e => setMishtiSearch(e.target.value)} />
            </div>
            <button onClick={() => { setShowAddMishti(true); setEditMishti(null); setNewMishti({ category: 'সন্দেশ', is_available: true, shelf_life_days: 3, min_stock_kg: 2 }) }}
              className="bg-pink-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali"><Plus size={13} /> যোগ করুন</button>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
            {MISHTI_CATS.map(c => (
              <button key={c} onClick={() => setMishtiCat(c)}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap bengali transition-all ${mishtiCat === c ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{c}</button>
            ))}
            {showAddCategory ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') { const ok = await addCategory(newCategoryName); if (ok) { setNewCategoryName(''); setShowAddCategory(false) } }
                    else if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryName('') }
                  }}
                  placeholder="নতুন ক্যাটাগরি..."
                  className="px-2.5 py-1 rounded-full text-xs border border-pink-300 focus:outline-none focus:ring-1 focus:ring-pink-400 w-28 bengali" />
                <button onClick={async () => { const ok = await addCategory(newCategoryName); if (ok) { setNewCategoryName(''); setShowAddCategory(false) } }}
                  className="text-pink-600 hover:text-pink-700"><Check size={14} /></button>
                <button onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
                  className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddCategory(true)}
                className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:border-pink-300 hover:text-pink-600 flex items-center gap-1 flex-shrink-0 bengali">
                <Plus size={11} /> ক্যাটাগরি
              </button>
            )}
          </div>

          {showAddMishti && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-pink-800 bengali text-sm">{editMishti ? '✏️ সম্পাদনা' : '🍬 নতুন মিষ্টি'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'নাম (English) *', key: 'name', type: 'text', full: false, voice: true },
                  { label: 'নাম (বাংলা)', key: 'name_bn', type: 'text', full: false, voice: true },
                  { label: 'স্টক (কেজি)', key: 'stock_kg', type: 'number', full: false },
                  { label: 'ন্যূনতম স্টক (কেজি)', key: 'min_stock_kg', type: 'number', full: false },
                  { label: '₹/কেজি (বিক্রি)', key: 'price_per_kg', type: 'number', full: false },
                  { label: '₹/কেজি (কস্ট)', key: 'cost_per_kg', type: 'number', full: false },
                  { label: 'মেয়াদ (দিন)', key: 'shelf_life_days', type: 'number', full: false },
                ].map((f: any) => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <div className="flex gap-1 mt-0.5">
                      <input type={f.type} value={(newMishti as any)[f.key] || ''}
                        onChange={e => setNewMishti((p: any) => ({ ...p, [f.key]: e.target.value }))}
                        className={`flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 ${voiceMishtiField === f.key && mishtiVoice.listening ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                      {f.voice && (
                        <button type="button"
                          onClick={() => {
                            if (mishtiVoice.listening && voiceMishtiField === f.key) {
                              mishtiVoice.stop(); setVoiceMishtiField(null)
                            } else {
                              setVoiceMishtiField(f.key); mishtiVoice.start()
                            }
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${mishtiVoice.listening && voiceMishtiField === f.key ? 'bg-red-500 animate-pulse' : 'bg-pink-100 hover:bg-pink-200'}`}>
                          {mishtiVoice.listening && voiceMishtiField === f.key
                            ? <MicOff size={12} className="text-white" />
                            : <Mic size={12} className="text-pink-700" />}
                        </button>
                      )}
                    </div>
                    {mishtiVoice.listening && voiceMishtiField === f.key && mishtiVoice.interim && (
                      <div className="text-xs text-red-500 bengali mt-0.5 truncate">🎤 {mishtiVoice.interim}</div>
                    )}
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">Category</label>
                  <select value={newMishti.category} onChange={e => setNewMishti(p => ({ ...p, category: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 bengali">
                    {MISHTI_CATS.filter(c => c !== 'সব').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-3">
                  <input type="checkbox" id="avail" checked={newMishti.is_available !== false} onChange={e => setNewMishti(p => ({ ...p, is_available: e.target.checked }))} />
                  <label htmlFor="avail" className="text-xs text-gray-600 bengali">পাওয়া যাচ্ছে</label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveMishti} disabled={savingMishti}
                  className="bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingMishti ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => { setShowAddMishti(false); setEditMishti(null) }} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {filteredMishti.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{mishtiItems.length === 0 ? '🍬 মিষ্টি যোগ করুন' : 'পাওয়া যায়নি'}</div>
            : (
              <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '270px' }}>
              {filteredMishti.map(m => {
              const isLow = m.stock_kg <= m.min_stock_kg
              const expiry = m.production_date && m.shelf_life_days ? addDays(m.production_date, m.shelf_life_days) : null
              const isExpiring = expiry && (new Date(expiry).getTime() - new Date().getTime()) / 86400000 <= 1
              return (
                <div key={m.id} className={`border rounded-xl p-3 ${isExpiring ? 'bg-red-50 border-red-300' : isLow ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-800 bengali">{m.name_bn || m.name}</div>
                      <div className="text-xs text-gray-400 bengali">{m.category} · মেয়াদ: {expiry || 'অজানা'}</div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <span className={`font-black text-lg ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{m.stock_kg} <span className="text-xs font-normal text-gray-400">কেজি</span></span>
                      <div className="flex flex-col gap-0.5 ml-1">
                        <button onClick={() => quickUpdateStock(m, 0.5)} className="w-6 h-5 rounded bg-pink-100 text-pink-700 font-bold text-xs flex items-center justify-center">+</button>
                        <button onClick={() => quickUpdateStock(m, -0.5)} className="w-6 h-5 rounded bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center">−</button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-3 text-xs">
                      <span className="text-gray-500">₹{m.price_per_kg}/কেজি</span>
                      {m.cost_per_kg > 0 && <span className="text-gray-400">মার্জিন: {Math.round((m.price_per_kg - m.cost_per_kg) / m.price_per_kg * 100)}%</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditMishti(m); setNewMishti({ ...m }); setShowAddMishti(true) }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => deleteMishti(m.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
              </div>
            )}
        </div>
      )}

      {/* ════════ PRODUCTION TAB ════════ */}
      {tab === 'production' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="font-bold text-gray-700 bengali text-sm">📋 উৎপাদন লগ</div>
            <button onClick={() => setShowAddProd(true)} className="bg-pink-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> উৎপাদন যোগ করুন
            </button>
          </div>

          {showAddProd && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-pink-800 bengali text-sm">🍬 আজকের উৎপাদন</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 bengali">মিষ্টির নাম *</label>
                  <select value={newProd.item_name || ''} onChange={e => setNewProd(p => ({ ...p, item_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 bengali">
                    <option value="">মিষ্টি বেছে নিন</option>
                    {mishtiItems.map(m => <option key={m.id} value={m.name}>{m.name_bn || m.name}</option>)}
                  </select>
                </div>
                {[{ label: 'পরিমাণ (কেজি) *', key: 'quantity_kg', type: 'number' }, { label: 'কস্ট (₹)', key: 'cost_total', type: 'number' }].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newProd as any)[f.key] || ''} onChange={e => setNewProd(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">তারিখ</label>
                  <input type="date" value={newProd.production_date || today()} onChange={e => setNewProd(p => ({ ...p, production_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-500 bengali">নোট</label>
                  <input type="text" value={newProd.notes || ''} onChange={e => setNewProd(p => ({ ...p, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" placeholder="বিশেষ নোট..." />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveProduction} disabled={savingProd}
                  className="bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingProd ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => setShowAddProd(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {/* Today production summary */}
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-3">
            <div className="font-bold text-pink-800 bengali text-sm mb-2">📊 আজকের উৎপাদন সারসংক্ষেপ</div>
            {mishtiItems.filter(m => m.production_date === today() && m.made_today_kg > 0).length === 0
              ? <div className="text-xs text-gray-400 bengali">আজ কোনো উৎপাদন রেকর্ড নেই</div>
              : mishtiItems.filter(m => m.production_date === today() && m.made_today_kg > 0).map(m => (
                <div key={m.id} className="flex justify-between text-xs py-1 border-b border-pink-100 bengali">
                  <span className="font-semibold">{m.name_bn || m.name}</span>
                  <span className="text-pink-700 font-bold">{m.made_today_kg} কেজি</span>
                </div>
              ))}
          </div>

          {productions.length === 0
            ? <div className="text-center py-6 text-gray-400 bengali text-sm">কোনো উৎপাদন লগ নেই</div>
            : (
              <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '270px' }}>
              {productions.map(p => (
              <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between">
                  <div>
                    <div className="font-semibold text-gray-800 bengali">{p.item_name}</div>
                    <div className="text-xs text-gray-500 bengali">তারিখ: {p.production_date} · মেয়াদ: {p.expiry_date}</div>
                    <div className="text-xs text-gray-400 bengali">Batch: {p.batch_no} {p.notes ? `· ${p.notes}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-pink-700 bengali">{p.quantity_kg} কেজি</div>
                    {p.cost_total > 0 && <div className="text-xs text-gray-400">কস্ট: ₹{p.cost_total}</div>}
                  </div>
                </div>
              </div>
            ))}
              </div>
            )}
        </div>
      )}

      {/* ════════ SALE TAB ════════ */}
      {tab === 'sale' && (
        <div className="space-y-2">
          <div className="font-bold text-gray-700 bengali text-sm">বিক্রির ইতিহাস ({sales.length})</div>
          {sales.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">কোনো বিক্রি নেই</div>
            : (
              <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '270px' }}>
              {sales.slice(0, 30).map(s => (
              <div key={s.id} className={`border rounded-xl p-3 ${Number(s.due_amount) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-800 bengali">{s.item_name}</div>
                    <div className="text-xs text-gray-500 bengali">{s.customer_name} · {s.quantity_kg} কেজি · {s.sale_date}</div>
                    {s.occasion !== 'সাধারণ' && <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full bengali">{s.occasion}</span>}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800">{fmtAmt(s.total_amount)}</div>
                    {Number(s.due_amount) > 0
                      ? <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-red-500 bengali">বাকি {fmtAmt(s.due_amount)}</span>
                          <button onClick={() => { setPayingSale(s); setPayAmount(Number(s.due_amount)) }}
                            className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full bengali hover:bg-pink-200">নিন</button>
                        </div>
                      : <span className="text-xs text-green-600 bengali">✅ পরিশোধ</span>}
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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="নাম বা ফোন..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowAddCust(true)} className="bg-pink-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> খদ্দের
            </button>
            <button onClick={() => { let csv = 'নাম,ফোন,ঠিকানা,বাকি,মোট খরচ\n'; customers.forEach(c => { csv += `"${c.name}","${c.phone}","${c.address}",${c.total_due},${c.total_spent}\n` }); downloadCSV(csv, `mishti-customers-${today()}.csv`) }}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          {showAddCust && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-pink-800 bengali text-sm">👤 নতুন খদ্দের</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'নাম *', key: 'name', full: true }, { label: 'ফোন', key: 'phone', full: false }, { label: 'ঠিকানা', key: 'address', full: false }, { label: 'নোট', key: 'notes', full: true }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type="text" value={(newCust as any)[f.key] || ''} onChange={e => setNewCust(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 bengali" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCustomer} disabled={savingCust}
                  className="bg-pink-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingCust ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => setShowAddCust(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {filteredCusts.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{customers.length === 0 ? '👤 খদ্দের নেই' : 'পাওয়া যায়নি'}</div>
            : (
              <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '270px' }}>
              {filteredCusts.map(c => (
              <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 bengali">{c.name} {c.is_regular && <span className="text-xs bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full ml-1">নিয়মিত</span>}</div>
                    {c.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</div>}
                    <div className="text-xs text-gray-400 bengali mt-0.5">মোট খরচ: {fmtAmt(c.total_spent || 0)} · শেষ কেনা: {c.last_purchase || 'নেই'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {(c.total_due || 0) > 0
                      ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold bengali">বাকি {fmtAmt(c.total_due || 0)}</span>
                      : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">✅ ক্লিয়ার</span>}
                    <div className="flex gap-1">
                      <button onClick={() => shareWhatsApp(c)} className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg"><MessageCircle size={13} /></button>
                      <button onClick={() => { setMsgCust(c); setMsgText('') }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Share2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
              </div>
            )}
        </div>
      )}

      {/* ════════ REPORT TAB ════════ */}
      {tab === 'report' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), icon: '📈', color: 'text-pink-700', bg: 'bg-pink-50' },
              { label: 'মোট বাকি', value: fmtAmt(totalDue), icon: '💸', color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'মিষ্টির ধরন', value: `${mishtiItems.length}টি`, icon: '🍬', color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'মোট খদ্দের', value: `${customers.length}জন`, icon: '👥', color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'কম স্টক', value: `${lowStock.length}টি`, icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'আজকের বিক্রি সংখ্যা', value: `${todaySales.length}টি`, icon: '🛍️', color: 'text-teal-700', bg: 'bg-teal-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className={`font-black text-xl ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 bengali">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Top selling */}
          {sales.length > 0 && (() => {
            const salesMap: Record<string, number> = {}
            sales.forEach(s => { salesMap[s.item_name] = (salesMap[s.item_name] || 0) + Number(s.quantity_kg) })
            const topItems = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
            return (
              <div>
                <div className="font-bold text-gray-700 bengali text-sm mb-2">🏆 সবচেয়ে বেশি বিকায়</div>
                {topItems.map(([name, qty], i) => (
                  <div key={name} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                      <span className="bengali text-sm font-semibold">{name}</span>
                    </div>
                    <span className="font-bold text-pink-600 text-sm">{qty.toFixed(1)} কেজি</span>
                  </div>
                ))}
              </div>
            )
          })()}

          <div className="flex gap-2">
            <button onClick={() => { let csv = 'তারিখ,মিষ্টি,খদ্দের,পরিমাণ(কেজি),মোট,পরিশোধ,বাকি,উপলক্ষ\n'; sales.forEach(s => { csv += `"${s.sale_date}","${s.item_name}","${s.customer_name}",${s.quantity_kg},${s.total_amount},${s.paid_amount},${s.due_amount},"${s.occasion}"\n` }); downloadCSV(csv, `mishti-sales-${today()}.csv`); toast.success('বিক্রির রিপোর্ট ডাউনলোড!') }}
              className="flex-1 bg-pink-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> বিক্রির রিপোর্ট
            </button>
            <button onClick={() => { let csv = 'তারিখ,মিষ্টি,পরিমাণ(কেজি),কস্ট,Batch\n'; productions.forEach(p => { csv += `"${p.production_date}","${p.item_name}",${p.quantity_kg},${p.cost_total},"${p.batch_no}"\n` }); downloadCSV(csv, `production-${today()}.csv`); toast.success('উৎপাদন রিপোর্ট ডাউনলোড!') }}
              className="flex-1 bg-rose-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> উৎপাদন লগ
            </button>
          </div>
        </div>
      )}

      {/* ════════ SETTINGS TAB ════════ */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
            <div className="font-bold text-pink-800 bengali text-sm mb-3">🍬 দোকানের তথ্য</div>
            <div className="space-y-3">
              {[{ label: 'দোকানের নাম *', key: 'shop_name', placeholder: 'যেমন: সুভাষ মিষ্টান্ন ভান্ডার' }, { label: 'মালিকের নাম', key: 'owner_name', placeholder: 'আপনার নাম' }, { label: 'ফোন', key: 'phone', placeholder: '01XXXXXXXXX' }, { label: 'ঠিকানা', key: 'address', placeholder: 'গ্রাম, ব্লক, জেলা' }, { label: 'UPI ID', key: 'upi_id', placeholder: 'আপনার UPI ID' }, { label: 'বিলের শেষে বার্তা', key: 'print_footer', placeholder: 'ধন্যবাদ! আবার আসবেন 🙏' }].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 bengali">{f.label}</label>
                  <input type="text" placeholder={f.placeholder} value={(profile as any)[f.key] || ''}
                    onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-pink-400" />
                </div>
              ))}
              <label className="flex items-center gap-2 text-sm text-gray-600 bengali">
                <input type="checkbox" checked={profile.festival_mode} onChange={e => setProfile(p => ({ ...p, festival_mode: e.target.checked }))} />
                🎉 উৎসব মোড (বিশেষ মিষ্টির চাহিদা বেশি)
              </label>
            </div>
            <button onClick={saveProfile} disabled={savingProfile}
              className="mt-4 w-full bg-pink-600 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-2 hover:bg-pink-700">
              {savingProfile ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />} সেভ করুন
            </button>
          </div>
        </div>
      )}

      {/* ════════ PAYMENT MODAL ════════ */}
      {payingSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingSale(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট নিন</div>
            <div className="text-sm text-gray-500 bengali mb-3">{payingSale.customer_name} · {payingSale.item_name} · বাকি: {fmtAmt(payingSale.due_amount)}</div>
            <label className="text-xs text-gray-500 bengali">পরিমাণ (₹)</label>
            <input type="number" value={payAmount} onChange={e => setPayAmount(+e.target.value)}
              className="w-full border-2 border-pink-400 rounded-xl px-3 py-2.5 text-2xl font-bold text-center mt-1 mb-4" />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={savingPay || payAmount <= 0}
                className="flex-1 bg-pink-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
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
            <div className="font-bold text-gray-800 bengali">💬 বার্তা পাঠান</div>
            <div className="text-sm text-pink-700 font-semibold bengali">{msgCust.name} {msgCust.phone ? `(${msgCust.phone})` : ''}</div>
            <textarea rows={5} className="w-full border-2 border-pink-200 rounded-xl px-3 py-2 text-sm resize-none bengali"
              value={msgText || ((msgCust.total_due || 0) > 0 ? `নমস্কার ${msgCust.name}! ${profile.shop_name}-এ আপনার বাকি: ₹${(msgCust.total_due || 0).toFixed(0)}। পরিশোধ করুন। 🙏` : `নমস্কার ${msgCust.name}! ${profile.shop_name} থেকে যোগাযোগ করা হচ্ছে। 🍬`)}
              onChange={e => setMsgText(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => shareWhatsApp(msgCust, msgText || undefined)}
                className="bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5">
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button onClick={() => { const phone = msgCust.phone?.replace(/[^0-9]/g, '') || ''; if (phone) window.open(`sms:+91${phone}?body=${encodeURIComponent(msgText || '')}`, '_blank') }}
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
