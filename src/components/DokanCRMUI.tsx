'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Search, Plus, Download, Mic, MicOff,
  X, Check, Phone, User, ShoppingBag, FileText,
  Loader2, Trash2, Edit2, Save, MessageCircle, Send,
  Printer, IndianRupee, Package, BarChart2,
  BookOpen, TrendingUp, ChevronDown, ChevronUp,
  RefreshCw, Share2, AlertTriangle, Calendar
} from 'lucide-react'
import toast from 'react-hot-toast'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

// ─── Types ────────────────────────────────────────────────────────
interface Customer {
  id: string
  user_id?: string
  name: string
  phone: string
  address: string
  notes: string
  total_due?: number
  total_spent?: number
  last_purchase?: string
}

interface SaleItem {
  name: string
  qty: number
  price: number
}

interface Sale {
  id: string
  user_id?: string
  customer_id: string
  customer_name?: string
  purchase_date: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  paid_amount: number
  due_amount: number
  payment_status: string
  notes: string
}

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

interface HalkhataEntry {
  customer: Customer
  sales: Sale[]
  total_due: number
  last_purchase: string
}

// ─── Helpers ──────────────────────────────────────────────────────
function today() { return new Date().toISOString().slice(0, 10) }
function fmtAmt(n: number) { return `₹${Number(n || 0).toFixed(0)}` }
function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

const PRODUCT_CATEGORIES = ['সব', 'চাল-ডাল', 'তেল-মশলা', 'সাবান-শ্যাম্পু', 'বিস্কুট-চকোলেট', 'চা-চিনি', 'সবজি', 'ডিম-মাছ-মাংস', 'পোশাক', 'বই-খাতা', 'ইলেকট্রনিক্স', 'অন্যান্য']
const UNITS = ['পিস', 'কেজি', 'গ্রাম', 'লিটার', 'মিলি', 'প্যাকেট', 'বস্তা', 'ডজন', 'বোতল', 'মিটার']

// ─── Voice Hook ────────────────────────────────────────────────────
function useVoice(onResult: (t: string) => void) {
  const [listening, setListening] = useState(false)
  const [lang, setLang] = useState<'bn-IN' | 'en-IN'>('bn-IN')
  const ref = useRef<any>(null)

  const start = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('ভয়েস সাপোর্ট নেই'); return }
    const r = new SR(); ref.current = r
    r.lang = lang; r.interimResults = true; r.continuous = false
    r.onstart = () => setListening(true)
    r.onresult = (e: any) => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; onResult(t) }
    r.onerror = () => setListening(false); r.onend = () => setListening(false); r.start()
  }
  const stop = () => { ref.current?.stop(); setListening(false) }
  useEffect(() => () => ref.current?.abort(), [])
  return { listening, lang, setLang, start, stop }
}

// ══════════════════════════════════════════════════════════════════
export default function DokanCRMUI({ userId: propUserId }: { userId?: string }) {
  const [userId, setUserId] = useState<string | null>(propUserId || null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('khata') // khata, baki, stock, report

  // Data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [halkhataData, setHalkhataData] = useState<HalkhataEntry[]>([])

  // Customer tab
  const [custSearch, setCustSearch] = useState('')
  const [showAddCust, setShowAddCust] = useState(false)
  const [newCust, setNewCust] = useState<Partial<Customer>>({})
  const [savingCust, setSavingCust] = useState(false)
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null)
  const [custSales, setCustSales] = useState<Sale[]>([])

  // New Sale
  const [showNewSale, setShowNewSale] = useState(false)
  const [saleMode, setSaleMode] = useState<'quick' | 'items'>('quick') // quick=total only, items=item list
  const [saleCust, setSaleCust] = useState<Customer | null>(null)
  const [saleCustSearch, setSaleCustSearch] = useState('')
  const [saleItems, setSaleItems] = useState<SaleItem[]>([{ name: '', qty: 1, price: 0 }])
  const [saleQuickTotal, setSaleQuickTotal] = useState(0)
  const [saleQuickNote, setSaleQuickNote] = useState('')
  const [salePaid, setSalePaid] = useState(0)
  const [savingSale, setSavingSale] = useState(false)

  // Halkhata tab
  const [bakiSearch, setBakiSearch] = useState('')

  // Payment modal
  const [payingSale, setPayingSale] = useState<Sale | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [payingBulk, setPayingBulk] = useState<HalkhataEntry | null>(null)
  const [bulkPayAmount, setBulkPayAmount] = useState(0)
  const [savingPay, setSavingPay] = useState(false)

  // Stock tab
  const [stockSearch, setStockSearch] = useState('')
  const [stockCat, setStockCat] = useState('সব')
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [newProduct, setNewProduct] = useState<Partial<Product>>({ unit: 'পিস', category: 'অন্যান্য', stock: 0, min_stock: 10 })
  const [savingProduct, setSavingProduct] = useState(false)

  // Voice
  const voice = useVoice((t) => {
    if (showNewSale) { setSaleQuickNote(t); setSaleMode('quick') }
  })

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const uid = propUserId || (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)
      await Promise.all([loadCustomers(uid), loadSales(uid), loadProducts(uid)])
      setLoading(false)
    }
    init()
  }, [propUserId])

  // ── Load ────────────────────────────────────────────────────────
  const loadCustomers = async (uid: string) => {
    const { data: custs } = await supabase.from('crm_customers').select('*').eq('user_id', uid).eq('business_type', 'dokan').order('name')
    if (!custs) return
    const { data: allSales } = await supabase.from('crm_purchases').select('customer_id, due_amount, total_amount, purchase_date').eq('user_id', uid)
    const dueMap: Record<string, number> = {}
    const spentMap: Record<string, number> = {}
    const lastMap: Record<string, string> = {}
    if (allSales) allSales.forEach((s: any) => {
      dueMap[s.customer_id] = (dueMap[s.customer_id] || 0) + Number(s.due_amount || 0)
      spentMap[s.customer_id] = (spentMap[s.customer_id] || 0) + Number(s.total_amount || 0)
      if (!lastMap[s.customer_id] || s.purchase_date > lastMap[s.customer_id]) lastMap[s.customer_id] = s.purchase_date
    })
    const enriched = custs.map((c: any) => ({ id: c.id, user_id: c.user_id, name: c.name, phone: c.phone || '', address: c.address || '', notes: c.notes || '', total_due: dueMap[c.id] || 0, total_spent: spentMap[c.id] || 0, last_purchase: lastMap[c.id] || '' }))
    setCustomers(enriched)
    buildHalkhata(enriched, allSales || [])
  }

  const loadSales = async (uid: string) => {
    const { data } = await supabase.from('crm_purchases').select('*, crm_customers(name, phone)').eq('user_id', uid).order('purchase_date', { ascending: false }).limit(100)
    if (data) setSales(data.map((s: any) => ({ ...s, customer_name: s.crm_customers?.name || '' })))
  }

  const loadProducts = async (uid: string) => {
    const { data } = await supabase.from('dokan_products').select('*').eq('user_id', uid).order('name')
    if (data) setProducts(data)
  }

  const loadCustSales = async (custId: string) => {
    const { data } = await supabase.from('crm_purchases').select('*').eq('customer_id', custId).order('purchase_date', { ascending: false })
    if (data) setCustSales(data)
  }

  const buildHalkhata = (custs: Customer[], allSales: any[]) => {
    const entries: HalkhataEntry[] = []
    custs.forEach(c => {
      const cs = allSales.filter((s: any) => s.customer_id === c.id && Number(s.due_amount) > 0)
      if (cs.length === 0) return
      const totalDue = cs.reduce((sum: number, s: any) => sum + Number(s.due_amount || 0), 0)
      const last = cs.sort((a: any, b: any) => b.purchase_date?.localeCompare(a.purchase_date))[0]?.purchase_date || ''
      entries.push({ customer: c, sales: cs, total_due: totalDue, last_purchase: last })
    })
    setHalkhataData(entries.sort((a, b) => b.total_due - a.total_due))
  }

  // ── Derived ─────────────────────────────────────────────────────
  const todaySales = sales.filter(s => s.purchase_date === today())
  const todayRevenue = todaySales.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const todayCollection = todaySales.reduce((s, r) => s + Number(r.paid_amount || 0), 0)
  const totalDue = halkhataData.reduce((s, h) => s + h.total_due, 0)
  const lowStockProducts = products.filter(p => p.stock <= p.min_stock)

  const filteredCusts = customers.filter(c => !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch))
  const filteredBaki = halkhataData.filter(h => !bakiSearch || h.customer.name.toLowerCase().includes(bakiSearch.toLowerCase()) || h.customer.phone.includes(bakiSearch))
  const filteredProducts = products.filter(p => {
    const mq = !stockSearch || p.name.toLowerCase().includes(stockSearch.toLowerCase())
    const mc = stockCat === 'সব' || p.category === stockCat
    return mq && mc
  })

  const saleGross = saleMode === 'quick' ? saleQuickTotal : saleItems.reduce((s, i) => s + i.qty * i.price, 0)

  // ── Customer CRUD ───────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!newCust.name) { toast.error('নাম দিন'); return }
    if (!userId) return
    setSavingCust(true)
    try {
      const { error } = await supabase.from('crm_customers').insert({ user_id: userId, business_type: 'dokan', name: newCust.name, phone: newCust.phone || '', address: newCust.address || '', notes: newCust.notes || '' })
      if (error) throw error
      toast.success('খদ্দের যোগ হয়েছে! 🎉')
      setNewCust({}); setShowAddCust(false); await loadCustomers(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingCust(false) }
  }

  const deleteCustomer = async (id: string) => {
    if (!confirm('এই খদ্দের মুছবেন?')) return
    await supabase.from('crm_customers').delete().eq('id', id)
    setCustomers(customers.filter(c => c.id !== id)); toast.success('মুছে ফেলা হয়েছে')
  }

  // ── Sale CRUD ───────────────────────────────────────────────────
  const saveSale = async () => {
    if (!saleCust) { toast.error('খদ্দের বেছে নিন'); return }
    if (!userId) return
    setSavingSale(true)
    try {
      let rows: any[] = []
      if (saleMode === 'quick') {
        if (!saleQuickTotal) { toast.error('মোট টাকা দিন'); setSavingSale(false); return }
        const due = Math.max(0, saleQuickTotal - salePaid)
        rows = [{ user_id: userId, agent_id: LIBRARY_AGENT_IDS.dokan, customer_id: saleCust.id, purchase_date: today(), item_name: saleQuickNote || 'বিক্রি', item_category: 'general', quantity: 1, unit: 'পিস', unit_price: saleQuickTotal, total_amount: saleQuickTotal, paid_amount: salePaid, due_amount: due, payment_status: due <= 0 ? 'paid' : salePaid > 0 ? 'partial' : 'pending', notes: '', source: 'manual' }]
      } else {
        const valid = saleItems.filter(i => i.name && i.qty > 0 && i.price > 0)
        if (!valid.length) { toast.error('পণ্য যোগ করুন'); setSavingSale(false); return }
        const perItemPaid = salePaid / valid.length
        rows = valid.map(i => {
          const total = i.qty * i.price
          const due = Math.max(0, total - perItemPaid)
          return { user_id: userId, agent_id: LIBRARY_AGENT_IDS.dokan, customer_id: saleCust.id, purchase_date: today(), item_name: i.name, item_category: 'general', quantity: i.qty, unit: 'পিস', unit_price: i.price, total_amount: total, paid_amount: perItemPaid, due_amount: due, payment_status: due <= 0 ? 'paid' : perItemPaid > 0 ? 'partial' : 'pending', notes: '', source: 'manual' }
        })
        // Deduct stock
        for (const i of valid) {
          const prod = products.find(p => p.name.toLowerCase() === i.name.toLowerCase())
          if (prod) await supabase.from('dokan_products').update({ stock: Math.max(0, prod.stock - i.qty) }).eq('id', prod.id)
        }
      }
      const { error } = await supabase.from('crm_purchases').insert(rows)
      if (error) throw error
      toast.success('বিক্রি সেভ হয়েছে! ✅')
      setSaleCust(null); setSaleCustSearch(''); setSaleItems([{ name: '', qty: 1, price: 0 }]); setSaleQuickTotal(0); setSaleQuickNote(''); setSalePaid(0); setShowNewSale(false)
      if (confirm('রসিদ প্রিন্ট করবেন?')) printBill(saleCust!, rows)
      await Promise.all([loadCustomers(userId), loadSales(userId), loadProducts(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingSale(false) }
  }

  // ── Payment ─────────────────────────────────────────────────────
  const savePayment = async () => {
    if (!payingSale || !userId) return
    setSavingPay(true)
    try {
      const newPaid = Number(payingSale.paid_amount) + Number(payAmount)
      const newDue = Math.max(0, Number(payingSale.total_amount) - newPaid)
      await supabase.from('crm_purchases').update({ paid_amount: newPaid, due_amount: newDue, payment_status: newDue <= 0 ? 'paid' : 'partial' }).eq('id', payingSale.id)
      toast.success(`₹${payAmount} পেমেন্ট রেকর্ড! ✅`)
      setPayingSale(null); setPayAmount(0)
      await Promise.all([loadCustomers(userId), loadSales(userId)])
      if (selectedCust) await loadCustSales(selectedCust.id)
    } catch (e: any) { toast.error(e.message) } finally { setSavingPay(false) }
  }

  const saveBulkPayment = async () => {
    if (!payingBulk || !userId) return
    setSavingPay(true)
    try {
      // Distribute payment across dues oldest first
      let remaining = bulkPayAmount
      for (const s of payingBulk.sales) {
        if (remaining <= 0) break
        const due = Number(s.due_amount)
        const pay = Math.min(due, remaining)
        const newPaid = Number(s.paid_amount) + pay
        const newDue = due - pay
        await supabase.from('crm_purchases').update({ paid_amount: newPaid, due_amount: newDue, payment_status: newDue <= 0 ? 'paid' : 'partial' }).eq('id', s.id)
        remaining -= pay
      }
      toast.success(`₹${bulkPayAmount} পেমেন্ট সম্পন্ন! ✅`)
      setPayingBulk(null); setBulkPayAmount(0)
      await Promise.all([loadCustomers(userId), loadSales(userId)])
    } catch (e: any) { toast.error(e.message) } finally { setSavingPay(false) }
  }

  // ── Product CRUD ────────────────────────────────────────────────
  const saveProduct = async () => {
    if (!newProduct.name) { toast.error('পণ্যের নাম দিন'); return }
    if (!userId) return
    setSavingProduct(true)
    try {
      const payload = { user_id: userId, name: newProduct.name, category: newProduct.category || 'অন্যান্য', stock: Number(newProduct.stock || 0), unit: newProduct.unit || 'পিস', price: Number(newProduct.price || 0), cost_price: Number(newProduct.cost_price || 0), min_stock: Number(newProduct.min_stock || 10) }
      if (editProduct) { await supabase.from('dokan_products').update(payload).eq('id', editProduct.id); toast.success('আপডেট হয়েছে!') }
      else { await supabase.from('dokan_products').insert(payload); toast.success('পণ্য যোগ হয়েছে!') }
      setNewProduct({ unit: 'পিস', category: 'অন্যান্য', stock: 0, min_stock: 10 }); setShowAddProduct(false); setEditProduct(null)
      await loadProducts(userId)
    } catch (e: any) { toast.error(e.message) } finally { setSavingProduct(false) }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('মুছবেন?')) return
    await supabase.from('dokan_products').delete().eq('id', id)
    setProducts(products.filter(p => p.id !== id))
  }

  const quickUpdateStock = async (prod: Product, n: number) => {
    const newStock = Math.max(0, prod.stock + n)
    await supabase.from('dokan_products').update({ stock: newStock }).eq('id', prod.id)
    setProducts(products.map(p => p.id === prod.id ? { ...p, stock: newStock } : p))
  }

  // ── Print / Share ────────────────────────────────────────────────
  const printBill = (cust: Customer, rows: any[]) => {
    const total = rows.reduce((s, r) => s + r.total_amount, 0)
    const paid = rows.reduce((s, r) => s + r.paid_amount, 0)
    const due = total - paid
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>রসিদ</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
body{font-family:'Hind Siliguri',sans-serif;padding:20px;max-width:380px;margin:auto;color:#111}
h2{text-align:center;color:#2563eb;margin:0 0 2px;font-size:20px}
.sub{text-align:center;font-size:11px;color:#666;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#2563eb;color:white;padding:5px 8px;text-align:left}
td{padding:4px 8px;border-bottom:1px solid #eee}
.paid{color:#16a34a;font-weight:700}.due{color:#dc2626;font-weight:700}
.footer{text-align:center;margin-top:14px;font-size:10px;color:#888;border-top:1px dashed #ccc;padding-top:8px}
</style></head><body>
<h2>🏪 দোকান রসিদ</h2>
<div class="sub">তারিখ: ${new Date().toLocaleDateString('bn-IN')} | Sahayak AI</div>
<p style="margin:4px 0"><b>খদ্দের:</b> ${cust.name} ${cust.phone ? `| 📞 ${cust.phone}` : ''}</p>
<table><tr><th>পণ্য</th><th>পরিমাণ</th><th>দাম</th><th>মোট</th></tr>
${rows.map(r => `<tr><td>${r.item_name}</td><td>${r.quantity}</td><td>₹${r.unit_price}</td><td>₹${r.total_amount.toFixed(0)}</td></tr>`).join('')}
<tr style="background:#f0f9ff"><td colspan="3"><b>মোট</b></td><td><b>₹${total.toFixed(0)}</b></td></tr>
<tr><td colspan="3" class="paid">পরিশোধ</td><td class="paid">₹${paid.toFixed(0)}</td></tr>
${due > 0 ? `<tr><td colspan="3" class="due">বাকি</td><td class="due">₹${due.toFixed(0)}</td></tr>` : ''}
</table>
<div class="footer">ধন্যবাদ 🙏 | Sahayak AI দোকান CRM</div>
</body></html>`)
    w.document.close(); w.print()
  }

  const printHalkhataCard = (entry: HalkhataEntry) => {
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>হালখাতা</title><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
body{font-family:'Hind Siliguri',sans-serif;padding:0;margin:0;background:#eff6ff}
.card{max-width:380px;margin:20px auto;background:white;border:3px solid #2563eb;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.header{background:linear-gradient(135deg,#2563eb,#3b82f6);color:white;padding:20px;text-align:center}
.header h1{margin:0;font-size:24px;font-weight:700}
.body{padding:20px}
.amount-box{background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:14px;text-align:center;margin:12px 0}
.amount-value{font-size:30px;font-weight:700;color:#92400e}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}
th{background:#dbeafe;color:#1e40af;padding:6px 8px;text-align:left}
td{padding:4px 8px;border-bottom:1px solid #f0f9ff}
.footer{background:#dbeafe;padding:10px;text-align:center;font-size:11px;color:#1e40af;font-weight:600}
@media print{body{background:white}.card{box-shadow:none;margin:0;border-radius:0}}
</style></head><body>
<div class="card">
  <div class="header"><h1>📒 হালখাতা বিজ্ঞপ্তি</h1><p style="margin:4px 0;opacity:.85;font-size:12px">${new Date().toLocaleDateString('bn-IN', { year: 'numeric', month: 'long' })}</p></div>
  <div class="body">
    <p style="font-size:18px;font-weight:700;margin:0 0 2px">${entry.customer.name}</p>
    <p style="font-size:12px;color:#6b7280;margin:0 0 10px">${entry.customer.phone ? `📞 ${entry.customer.phone}` : ''} ${entry.customer.address ? `| 📍 ${entry.customer.address}` : ''}</p>
    <div class="amount-box">
      <div style="font-size:12px;color:#92400e;font-weight:600">মোট বাকি টাকা</div>
      <div class="amount-value">₹${entry.total_due.toFixed(0)}</div>
    </div>
    <table><tr><th>তারিখ</th><th>পণ্য</th><th>মোট</th><th>বাকি</th></tr>
    ${entry.sales.slice(0, 8).map(s => `<tr><td>${s.purchase_date || ''}</td><td>${s.item_name}</td><td>₹${Number(s.total_amount).toFixed(0)}</td><td style="color:#dc2626;font-weight:600">₹${Number(s.due_amount).toFixed(0)}</td></tr>`).join('')}
    </table>
  </div>
  <div class="footer">অনুগ্রহ করে বাকি পরিশোধ করুন 🙏<br><span style="font-weight:400;font-size:10px">Sahayak AI দোকান CRM</span></div>
</div></body></html>`)
    w.document.close(); w.print()
  }

  const shareWhatsApp = (entry: HalkhataEntry) => {
    const phone = entry.customer.phone?.replace(/[^0-9]/g, '') || ''
    let msg = `🏪 *হালখাতা — বাকির বিজ্ঞপ্তি*\n\nপ্রিয় ${entry.customer.name},\nআপনার বর্তমান বাকি টাকার হিসাব:\n\n`
    entry.sales.slice(0, 6).forEach(s => { msg += `📅 ${s.purchase_date || ''} — ${s.item_name}: *₹${Number(s.due_amount).toFixed(0)}*\n` })
    msg += `\n💰 *মোট বাকি: ₹${entry.total_due.toFixed(0)}*\n\nঅনুগ্রহ করে সুবিধামতো পরিশোধ করুন। 🙏\n\n— Sahayak AI দোকান CRM`
    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  const shareSMS = (entry: HalkhataEntry) => {
    const phone = entry.customer.phone?.replace(/[^0-9]/g, '') || ''
    const msg = `আপনার দোকানে মোট বাকি: ₹${entry.total_due.toFixed(0)}। অনুগ্রহ করে পরিশোধ করুন। -Sahayak AI`
    if (phone) window.open(`sms:+91${phone}?body=${encodeURIComponent(msg)}`, '_blank')
    else toast.error('ফোন নম্বর নেই')
  }

  const exportBakiExcel = () => {
    let csv = 'খদ্দেরের নাম,ফোন,ঠিকানা,মোট বাকি,শেষ কেনা\n'
    halkhataData.forEach(h => { csv += `"${h.customer.name}","${h.customer.phone}","${h.customer.address}",${h.total_due.toFixed(0)},"${h.last_purchase}"\n` })
    downloadCSV(csv, `halkhata-${today()}.csv`); toast.success('Excel ডাউনলোড হয়েছে!')
  }

  const exportSalesExcel = () => {
    let csv = 'তারিখ,খদ্দের,পণ্য,পরিমাণ,মোট,পরিশোধ,বাকি\n'
    sales.forEach(s => { csv += `"${s.purchase_date}","${s.customer_name}","${s.item_name}",${s.quantity},${s.total_amount},${s.paid_amount},${s.due_amount}\n` })
    downloadCSV(csv, `sales-${today()}.csv`); toast.success('বিক্রির রিপোর্ট ডাউনলোড!')
  }

  const quickShareWhatsApp = (c: Customer, customMsg?: string) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const due = c.total_due || 0
    const msg = customMsg || (due > 0
      ? `নমস্কার ${c.name}! আপনার দোকানে মোট বাকি: *₹${due.toFixed(0)}*। সুবিধামতো পরিশোধ করুন। 🙏`
      : `নমস্কার ${c.name}! দোকান থেকে যোগাযোগ করা হচ্ছে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const quickShareSMS = (c: Customer, customMsg?: string) => {
    const phone = c.phone?.replace(/[^0-9]/g, '') || ''
    const due = c.total_due || 0
    const msg = customMsg || (due > 0
      ? `${c.name}, দোকানে বাকি ₹${due.toFixed(0)}। পরিশোধ করুন।`
      : `${c.name}, দোকান থেকে যোগাযোগ করা হচ্ছে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`sms:+91${phone}?body=${encodeURIComponent(msg)}`, '_blank')
  }

  const [msgCust, setMsgCust] = useState<Customer | null>(null)
  const [msgText, setMsgText] = useState('')

    const TABS = [
    { id: 'khata', label: 'খাতা', icon: <BookOpen size={13} /> },
    { id: 'baki', label: 'বাকি', icon: <IndianRupee size={13} /> },
    { id: 'stock', label: 'স্টক', icon: <Package size={13} /> },
    { id: 'report', label: 'রিপোর্ট', icon: <BarChart2 size={13} /> },
  ]

  // ══════════════════════════════════════════════════════════════
  if (loading) return <div className="flex items-center justify-center py-16 text-blue-600"><Loader2 className="animate-spin mr-2" size={22} /><span className="bengali text-sm">লোড হচ্ছে...</span></div>
  if (!userId) return <div className="text-center py-16"><p className="bengali text-gray-500 mb-3">লগইন করুন</p><a href="/login" className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm bengali">লগইন</a></div>

  return (
    <div className="space-y-3">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
          { label: 'আজকে উঠেছে', value: fmtAmt(todayCollection), color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'মোট বাকি', value: fmtAmt(totalDue), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          { label: 'মোট খদ্দের', value: `${customers.length}জন`, color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-3`}>
            <div className={`font-extrabold text-lg ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStockProducts.length > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3">
          <div className="font-bold text-orange-800 bengali text-sm mb-1.5">📦 কম স্টক — অর্ডার করুন</div>
          <div className="flex flex-wrap gap-2">{lowStockProducts.map(p => <span key={p.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg bengali">{p.name}: {p.stock} {p.unit}</span>)}</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap bengali transition-all
              ${tab === t.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setShowNewSale(true)}
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 bengali">
          <Plus size={13} /> নতুন বিক্রি
        </button>
      </div>

      {/* ════════ NEW SALE MODAL ════════ */}
      {showNewSale && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <div className="font-bold text-blue-800 bengali">🛒 নতুন বিক্রি</div>
            <button onClick={() => setShowNewSale(false)}><X size={16} className="text-gray-400" /></button>
          </div>

          {/* Customer search */}
          <div>
            <label className="text-xs text-gray-500 bengali">খদ্দের *</label>
            <div className="relative mt-0.5">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                placeholder="নাম বা ফোন..." value={saleCust ? saleCust.name : saleCustSearch}
                onChange={e => { setSaleCustSearch(e.target.value); setSaleCust(null) }} />
            </div>
            {!saleCust && saleCustSearch && (
              <div className="mt-1 border border-gray-200 rounded-lg bg-white max-h-32 overflow-y-auto">
                {customers.filter(c => c.name.toLowerCase().includes(saleCustSearch.toLowerCase()) || c.phone.includes(saleCustSearch)).map(c => (
                  <div key={c.id} onClick={() => { setSaleCust(c); setSaleCustSearch('') }}
                    className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer bengali flex justify-between">
                    <span>{c.name} {c.phone ? `(${c.phone})` : ''}</span>
                    {(c.total_due || 0) > 0 && <span className="text-red-500 text-xs">বাকি ₹{c.total_due}</span>}
                  </div>
                ))}
                {customers.filter(c => c.name.toLowerCase().includes(saleCustSearch.toLowerCase()) || c.phone.includes(saleCustSearch)).length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400 bengali">নেই — আগে খদ্দের যোগ করুন</div>
                )}
              </div>
            )}
            {saleCust && (
              <div className="mt-1 bg-white border border-blue-300 rounded-lg px-3 py-1.5 flex justify-between items-center">
                <span className="bengali text-sm font-semibold text-blue-700">✅ {saleCust.name}</span>
                <button onClick={() => setSaleCust(null)}><X size={13} className="text-gray-400" /></button>
              </div>
            )}
          </div>

          {/* Mode switcher */}
          <div className="flex gap-2">
            <button onClick={() => setSaleMode('quick')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold bengali transition-all ${saleMode === 'quick' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              ⚡ দ্রুত (মোট টাকা)
            </button>
            <button onClick={() => setSaleMode('items')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold bengali transition-all ${saleMode === 'items' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              📋 পণ্য তালিকা
            </button>
          </div>

          {/* Quick mode */}
          {saleMode === 'quick' && (
            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 bengali">কী বিক্রি হলো</label>
                  <div className="flex gap-1 mt-0.5">
                    <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      placeholder="যেমন: চাল, তেল..." value={saleQuickNote} onChange={e => setSaleQuickNote(e.target.value)} />
                    <button onClick={voice.listening ? voice.stop : voice.start}
                      className={`p-2 rounded-lg ${voice.listening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                      {voice.listening ? <MicOff size={15} /> : <Mic size={15} />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 bengali">মোট টাকা *</label>
                <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-lg font-bold mt-0.5"
                  placeholder="₹ 0" value={saleQuickTotal || ''} onChange={e => setSaleQuickTotal(+e.target.value)} />
              </div>
            </div>
          )}

          {/* Items mode */}
          {saleMode === 'items' && (
            <div className="space-y-2">
              {saleItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-7 gap-1.5 items-center">
                  <div className="col-span-3">
                    <input list="product-list" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="পণ্যের নাম" value={item.name}
                      onChange={e => {
                        const items = [...saleItems]; items[idx].name = e.target.value
                        const prod = products.find(p => p.name.toLowerCase() === e.target.value.toLowerCase())
                        if (prod) items[idx].price = prod.price
                        setSaleItems(items)
                      }} />
                    <datalist id="product-list">{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
                  </div>
                  <input type="number" min={1} className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    placeholder="পরিমাণ" value={item.qty}
                    onChange={e => { const i = [...saleItems]; i[idx].qty = +e.target.value; setSaleItems(i) }} />
                  <input type="number" className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                    placeholder="₹ দাম" value={item.price || ''}
                    onChange={e => { const i = [...saleItems]; i[idx].price = +e.target.value; setSaleItems(i) }} />
                  <button onClick={() => setSaleItems(saleItems.filter((_, i) => i !== idx))} className="text-red-400 flex justify-center"><X size={13} /></button>
                </div>
              ))}
              <button onClick={() => setSaleItems([...saleItems, { name: '', qty: 1, price: 0 }])}
                className="text-xs text-blue-600 flex items-center gap-1 font-semibold bengali"><Plus size={13} /> পণ্য যোগ</button>
            </div>
          )}

          {/* Payment */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="bengali text-gray-600">মোট</span>
              <span className="font-bold">{fmtAmt(saleGross)}</span>
            </div>
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
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
              {savingSale ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} সেভ করুন
            </button>
            <button onClick={() => setShowNewSale(false)} className="bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}

      {/* ════════ KHATA TAB ════════ */}
      {tab === 'khata' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="খদ্দেরের নাম বা ফোন..." value={custSearch} onChange={e => setCustSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowAddCust(true)}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> খদ্দের
            </button>
            <button onClick={exportSalesExcel} className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl">
              <Download size={14} />
            </button>
          </div>

          {/* Add Customer */}
          {showAddCust && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-blue-800 bengali text-sm">👤 নতুন খদ্দের</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'নাম *', key: 'name', type: 'text', full: true }, { label: 'ফোন', key: 'phone', type: 'tel' }, { label: 'ঠিকানা', key: 'address', type: 'text' }, { label: 'নোট', key: 'notes', type: 'text', full: true }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newCust as any)[f.key] || ''}
                      onChange={e => setNewCust(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={saveCustomer} disabled={savingCust}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingCust ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => setShowAddCust(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {/* Customer list */}
          {filteredCusts.length === 0 ? (
            <div className="text-center py-10 text-gray-400 bengali text-sm">{customers.length === 0 ? '👤 এখনো খদ্দের নেই — যোগ করুন' : 'পাওয়া যায়নি'}</div>
          ) : filteredCusts.map(c => (
            <div key={c.id} className="bg-white border border-gray-100 rounded-xl p-3 hover:shadow-sm transition-all">
              <div className="flex justify-between items-start">
                <div className="flex-1 cursor-pointer" onClick={async () => { setSelectedCust(c); await loadCustSales(c.id); setTab('cust_detail') }}>
                  <div className="font-bold text-gray-800 bengali">{c.name}</div>
                  {c.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{c.phone}</div>}
                  {c.address && <div className="text-xs text-gray-400 bengali">📍 {c.address}</div>}
                  <div className="text-xs text-gray-400 mt-0.5 bengali">মোট কেনা: {fmtAmt(c.total_spent || 0)}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {(c.total_due || 0) > 0
                    ? <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold bengali">বাকি {fmtAmt(c.total_due || 0)}</span>
                    : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">✅ ক্লিয়ার</span>}
                  <button onClick={() => quickShareWhatsApp(c)} title="WhatsApp" className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg"><MessageCircle size={13} /></button>
                  <button onClick={() => quickShareSMS(c)} title="SMS" className="text-purple-500 hover:bg-purple-50 p-1.5 rounded-lg"><Send size={13} /></button>
                  <button onClick={() => { setMsgCust(c); setMsgText('') }} title="Custom message" className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Share2 size={13} /></button>
                  <button onClick={() => deleteCustomer(c.id)} className="text-red-400 hover:bg-red-50 p-1 rounded-lg"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════ CUSTOMER DETAIL ════════ */}
      {tab === 'cust_detail' && selectedCust && (
        <div className="space-y-3">
          <button onClick={() => setTab('khata')} className="flex items-center gap-1 text-sm text-blue-600 font-semibold bengali">← খাতায় ফিরুন</button>
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-black text-lg text-gray-800 bengali">{selectedCust.name}</div>
                {selectedCust.phone && <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><Phone size={12} />{selectedCust.phone}</div>}
                {selectedCust.address && <div className="text-xs text-gray-400 bengali">📍 {selectedCust.address}</div>}
              </div>
              <div className="text-right">
                {(selectedCust.total_due || 0) > 0
                  ? <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-2 text-center"><div className="text-xs text-red-500 bengali">মোট বাকি</div><div className="text-xl font-black text-red-600">{fmtAmt(selectedCust.total_due || 0)}</div></div>
                  : <div className="bg-green-100 border border-green-200 rounded-xl px-4 py-2 text-center"><div className="text-emerald-600 font-bold bengali text-sm">✅ ক্লিয়ার</div></div>}
              </div>
            </div>
          </div>

          <div className="font-bold text-gray-700 bengali text-sm">কেনার ইতিহাস ({custSales.length}টি)</div>
          {custSales.length === 0
            ? <div className="text-center py-6 text-gray-400 bengali text-sm">কোনো কেনাকাটা নেই</div>
            : custSales.map(s => (
              <div key={s.id} className={`border rounded-xl p-3 ${Number(s.due_amount) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{s.item_name}</div>
                    <div className="text-xs text-gray-500">{s.quantity} × ₹{s.unit_price} · {s.purchase_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{fmtAmt(s.total_amount)}</div>
                    {Number(s.due_amount) > 0
                      ? <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-red-500 bengali">বাকি {fmtAmt(s.due_amount)}</span>
                          <button onClick={() => { setPayingSale(s); setPayAmount(Number(s.due_amount)) }}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full bengali hover:bg-blue-200">নিন</button>
                        </div>
                      : <span className="text-xs text-green-600 bengali">✅ পরিশোধ</span>}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ════════ BAKI TAB ════════ */}
      {tab === 'baki' && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="font-black text-red-800 bengali text-base">📒 বাকির খাতা</div>
              <div className="text-xs text-red-500 bengali">{halkhataData.length}জন খদ্দেরের বাকি আছে</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-red-700">{fmtAmt(totalDue)}</div>
              <div className="text-xs text-red-400 bengali">মোট বাকি</div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
                placeholder="নাম বা ফোন..." value={bakiSearch} onChange={e => setBakiSearch(e.target.value)} />
            </div>
            <button onClick={exportBakiExcel} className="bg-green-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Download size={13} /> Excel
            </button>
          </div>

          {filteredBaki.length === 0
            ? <div className="text-center py-10 text-gray-400 bengali text-sm">{halkhataData.length === 0 ? '🎉 কোনো বাকি নেই! সব পরিশোধিত।' : 'পাওয়া যায়নি'}</div>
            : filteredBaki.map(entry => (
              <div key={entry.customer.id} className="bg-white border border-red-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 bengali">{entry.customer.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
                      {entry.customer.phone && <div className="flex items-center gap-1"><Phone size={10} />{entry.customer.phone}</div>}
                      {entry.customer.address && <div>📍 {entry.customer.address}</div>}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 bengali">{entry.sales.length}টি বকেয়া · শেষ: {entry.last_purchase}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-red-600">{fmtAmt(entry.total_due)}</div>
                    <div className="text-xs text-red-400 bengali">বাকি</div>
                  </div>
                </div>

                {/* Detail rows */}
                <div className="mt-3 space-y-1">
                  {entry.sales.slice(0, 4).map(s => (
                    <div key={s.id} className="flex justify-between text-xs bg-red-50 rounded-lg px-2 py-1.5">
                      <span className="text-gray-600 bengali">{s.item_name} ({s.purchase_date})</span>
                      <span className="font-bold text-red-600">{fmtAmt(Number(s.due_amount))}</span>
                    </div>
                  ))}
                  {entry.sales.length > 4 && <div className="text-xs text-gray-400 bengali text-center">+ আরো {entry.sales.length - 4}টি...</div>}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-4 gap-1.5 mt-3">
                  <button onClick={() => shareWhatsApp(entry)}
                    className="bg-green-500 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 hover:bg-green-600 bengali">
                    <MessageCircle size={14} /><span>WhatsApp</span>
                  </button>
                  <button onClick={() => printHalkhataCard(entry)}
                    className="bg-blue-500 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 hover:bg-blue-600 bengali">
                    <Printer size={14} /><span>প্রিন্ট</span>
                  </button>
                  <button onClick={() => shareSMS(entry)}
                    className="bg-purple-500 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 hover:bg-purple-600 bengali">
                    <Send size={14} /><span>SMS</span>
                  </button>
                  <button onClick={() => { setPayingBulk(entry); setBulkPayAmount(entry.total_due) }}
                    className="bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold flex flex-col items-center gap-0.5 hover:bg-emerald-700 bengali">
                    <IndianRupee size={14} /><span>নিন</span>
                  </button>
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
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
                placeholder="পণ্য খুঁজুন..." value={stockSearch} onChange={e => setStockSearch(e.target.value)} />
            </div>
            <button onClick={() => { setShowAddProduct(true); setEditProduct(null); setNewProduct({ unit: 'পিস', category: 'অন্যান্য', stock: 0, min_stock: 10 }) }}
              className="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={13} /> পণ্য
            </button>
            <button onClick={() => { let csv = 'নাম,Category,স্টক,Unit,দাম,ক্রয়মূল্য\n'; products.forEach(p => { csv += `"${p.name}","${p.category}",${p.stock},"${p.unit}",${p.price},${p.cost_price}\n` }); downloadCSV(csv, `stock-${today()}.csv`) }}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl"><Download size={14} /></button>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {PRODUCT_CATEGORIES.map(c => (
              <button key={c} onClick={() => setStockCat(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all bengali
                  ${stockCat === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
            ))}
          </div>

          {/* Add/Edit Product Form */}
          {showAddProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-blue-800 bengali text-sm">{editProduct ? '✏️ পণ্য সম্পাদনা' : '➕ নতুন পণ্য'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: 'পণ্যের নাম *', key: 'name', type: 'text', full: true }, { label: 'স্টক', key: 'stock', type: 'number' }, { label: 'ন্যূনতম স্টক', key: 'min_stock', type: 'number' }, { label: 'বিক্রির দাম (₹)', key: 'price', type: 'number' }, { label: 'ক্রয়মূল্য (₹)', key: 'cost_price', type: 'number' }].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newProduct as any)[f.key] || ''}
                      onChange={e => setNewProduct(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">Unit</label>
                  <select value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 bengali">Category</label>
                  <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {PRODUCT_CATEGORIES.filter(c => c !== 'সব').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveProduct} disabled={savingProduct}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold bengali disabled:opacity-60 flex items-center gap-1">
                  {savingProduct ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ
                </button>
                <button onClick={() => { setShowAddProduct(false); setEditProduct(null) }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {/* Products */}
          {filteredProducts.length === 0
            ? <div className="text-center py-8 text-gray-400 bengali text-sm">{products.length === 0 ? '📦 কোনো পণ্য নেই — যোগ করুন' : 'পাওয়া যায়নি'}</div>
            : filteredProducts.map(p => {
              const isLow = p.stock <= p.min_stock
              return (
                <div key={p.id} className={`border rounded-xl p-3 ${isLow ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-100'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 bengali text-sm">{p.name}</div>
                      <div className="text-xs text-gray-400 bengali">{p.category}</div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => { setEditProduct(p); setNewProduct({ ...p }); setShowAddProduct(true) }} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit2 size={12} /></button>
                      <button onClick={() => deleteProduct(p.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 bengali">স্টক:</span>
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{p.stock} {p.unit}</span>
                      <button onClick={() => quickUpdateStock(p, 1)} className="w-5 h-5 rounded bg-blue-100 text-blue-700 font-bold flex items-center justify-center">+</button>
                      <button onClick={() => quickUpdateStock(p, -1)} className="w-5 h-5 rounded bg-gray-100 text-gray-600 font-bold flex items-center justify-center">−</button>
                    </div>
                    <span className="text-gray-500">দাম: <b>₹{p.price}</b></span>
                    <span className="text-gray-400">ক্রয়: ₹{p.cost_price}</span>
                    {isLow && <span className="text-orange-600 font-bold bengali text-xs">⚠ কম!</span>}
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
              { label: 'মোট খদ্দের', value: `${customers.length}জন`, icon: '👤', color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'মোট পণ্য', value: `${products.length}টি`, icon: '📦', color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'মোট বাকি', value: fmtAmt(totalDue), icon: '💰', color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'আজকের আয়', value: fmtAmt(todayRevenue), icon: '📈', color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'আজকে উঠেছে', value: fmtAmt(todayCollection), icon: '🏦', color: 'text-teal-700', bg: 'bg-teal-50' },
              { label: 'কম স্টক', value: `${lowStockProducts.length}টি`, icon: '⚠️', color: 'text-orange-700', bg: 'bg-orange-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className={`font-black text-xl ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 bengali">{c.label}</div>
              </div>
            ))}
          </div>

          {/* Top debtors */}
          {halkhataData.length > 0 && (
            <div>
              <div className="font-bold text-gray-700 bengali text-sm mb-2">🏆 সবচেয়ে বেশি বাকি</div>
              {halkhataData.slice(0, 5).map((h, i) => (
                <div key={h.customer.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400 w-5">#{i + 1}</span>
                    <span className="bengali text-sm font-semibold text-gray-800">{h.customer.name}</span>
                  </div>
                  <span className="font-bold text-red-600 text-sm">{fmtAmt(h.total_due)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={exportSalesExcel}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> বিক্রির রিপোর্ট
            </button>
            <button onClick={exportBakiExcel}
              className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
              <Download size={13} /> বাকির Excel
            </button>
          </div>
          <button onClick={() => { let csv = 'পণ্য,Category,স্টক,Unit,দাম\n'; products.forEach(p => { csv += `"${p.name}","${p.category}",${p.stock},"${p.unit}",${p.price}\n` }); downloadCSV(csv, `stock-${today()}.csv`) }}
            className="w-full bg-purple-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali">
            <Download size={13} /> স্টক রিপোর্ট
          </button>
        </div>
      )}

      {/* ════════ CUSTOM MESSAGE MODAL ════════ */}
      {msgCust && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMsgCust(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali">💬 বার্তা পাঠান</div>
            <div className="text-sm text-blue-700 font-semibold bengali">{msgCust.name} {msgCust.phone ? `(${msgCust.phone})` : ''}</div>
            <textarea rows={5}
              className="w-full border-2 border-blue-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bengali"
              placeholder="বার্তা লিখুন..."
              value={msgText || ((msgCust.total_due || 0) > 0
                ? `নমস্কার ${msgCust.name}! আপনার দোকানে মোট বাকি: ₹${(msgCust.total_due || 0).toFixed(0)}। সুবিধামতো পরিশোধ করুন। 🙏`
                : `নমস্কার ${msgCust.name}! দোকান থেকে যোগাযোগ করা হচ্ছে।`)}
              onChange={e => setMsgText(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => quickShareWhatsApp(msgCust, msgText || undefined)}
                className="bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5 hover:bg-green-600">
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button onClick={() => quickShareSMS(msgCust, msgText || undefined)}
                className="bg-purple-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5 hover:bg-purple-600">
                <Send size={15} /> SMS
              </button>
            </div>
            <button onClick={() => setMsgCust(null)} className="w-full bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}


      {/* ════════ PAYMENT MODAL (single sale) ════════ */}
      {payingSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingSale(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট নিন</div>
            <div className="text-xs text-gray-500 bengali mb-3">{payingSale.item_name} · বাকি: {fmtAmt(payingSale.due_amount)}</div>
            <label className="text-xs text-gray-500 bengali">পরিমাণ (₹)</label>
            <input type="number" value={payAmount} min={1} max={Number(payingSale.due_amount)}
              onChange={e => setPayAmount(+e.target.value)}
              className="w-full border-2 border-blue-400 rounded-xl px-3 py-2.5 text-2xl font-bold text-center mt-1 mb-4" />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={savingPay || payAmount <= 0}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
                {savingPay ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} নিশ্চিত
              </button>
              <button onClick={() => setPayingSale(null)} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold bengali">বাতিল</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ BULK PAYMENT MODAL ════════ */}
      {payingBulk && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingBulk(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট নিন</div>
            <div className="font-bold text-blue-700 bengali mb-0.5">{payingBulk.customer.name}</div>
            <div className="text-xs text-gray-500 bengali mb-3">মোট বাকি: {fmtAmt(payingBulk.total_due)}</div>
            <label className="text-xs text-gray-500 bengali">আজকে কত নিলেন (₹)</label>
            <input type="number" value={bulkPayAmount} min={1} max={payingBulk.total_due}
              onChange={e => setBulkPayAmount(+e.target.value)}
              className="w-full border-2 border-blue-400 rounded-xl px-3 py-2.5 text-2xl font-bold text-center mt-1 mb-2" />
            {bulkPayAmount < payingBulk.total_due && bulkPayAmount > 0 && (
              <div className="text-xs text-orange-500 bengali mb-3">বাকি থাকবে: {fmtAmt(payingBulk.total_due - bulkPayAmount)}</div>
            )}
            <div className="flex gap-2">
              <button onClick={saveBulkPayment} disabled={savingPay || bulkPayAmount <= 0}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
                {savingPay ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} নিশ্চিত
              </button>
              <button onClick={() => setPayingBulk(null)} className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold bengali">বাতিল</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
