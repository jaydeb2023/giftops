'use client'

import { useEffect, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { readCache, writeCache, useIsoLayoutEffect } from '@/lib/swrCache'
import {
  Search, Plus, X, FileText, Printer, MessageCircle, History, Phone, MapPin,
  Download, Loader2, Store, Users, UserCheck, IndianRupee, UserPlus2,
  PhoneCall, SlidersHorizontal, ChevronLeft, ChevronRight, MoreVertical,
} from 'lucide-react'
import {
  printBill, sendBillWhatsApp, printMultiBill, sendMultiBillWhatsApp, BillingProfile,
} from '@/lib/billing'
import { exportCustomersToExcel, CustomerExportRow, PurchaseExportRow } from '@/lib/exportCustomers'
import { libraryAgentDisplayById } from '@/lib/libraryAgentIds'
import toast from 'react-hot-toast'

import { tr } from '@/lib/i18n/tr'
interface Customer {
  id: string
  agent_id: string | null
  name: string
  father_name: string | null
  phone: string | null
  address: string | null
  pin_code: string | null
  created_at: string
}
interface Purchase {
  id: string
  customer_id: string
  purchase_date: string
  item_name: string
  quantity: number
  unit: string
  unit_price: number
  paid_amount: number
  payment_status: string
}
interface AgentLite {
  id: string
  name: string
  name_bn?: string | null
  icon?: string | null
  color?: string | null
  shop_name?: string | null
  owner_name?: string | null
  phone?: string | null
  address?: string | null
  upi_id?: string | null
  gstin?: string | null
  print_footer?: string | null
  logo_url?: string | null
  signature_url?: string | null
}

const emptyAgentProfileForm = {
  shop_name: '', owner_name: '', phone: '', address: '', upi_id: '', gstin: '', print_footer: '',
}

const AVATAR_COLORS = ['#7C3AED', '#0D9488', '#DB2777', '#4F46E5', '#D97706', '#0284C7', '#DC2626']
const avatarColor = (name: string) => AVATAR_COLORS[Array.from(name).reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length]
const emptyCustomerForm = { name: '', father_name: '', phone: '', address: '', pin_code: '', agent_id: '' }
const emptyBillForm = { item_name: '', quantity: '1', unit: 'পিস', unit_price: '', paid: '' }
const GENERAL_LABEL = 'সাধারণ'

export default function CustomerBillingTable({ userId }: { userId: string }) {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [agentsList, setAgentsList] = useState<AgentLite[]>([])
  const [pendingByName, setPendingByName] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [q, setQ] = useState('')
  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'due' | 'new' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [profile, setProfile] = useState<BillingProfile>({ shop_name: 'আমার দোকান' })

  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm)
  const [savingCustomer, setSavingCustomer] = useState(false)

  const [historyFor, setHistoryFor] = useState<Customer | null>(null)

  const [billFor, setBillFor] = useState<Customer | 'cash' | null>(null)
  const [billForm, setBillForm] = useState(emptyBillForm)
  const [withGst, setWithGst] = useState(false)

  // Per-agent shop identity editor (each agent = its own shop on invoices)
  const [agentProfileFor, setAgentProfileFor] = useState<AgentLite | null>(null)
  const [agentProfileForm, setAgentProfileForm] = useState(emptyAgentProfileForm)
  const [savingAgentProfile, setSavingAgentProfile] = useState(false)
  const [uploadingAgentLogo, setUploadingAgentLogo] = useState(false)
  const [uploadingAgentSignature, setUploadingAgentSignature] = useState(false)

  const applyBundle = (b: any) => {
    setCustomers(b.customers || [])
    setPurchases(b.purchases || [])
    setAgentsList(b.agentsList || [])
    if (b.profile) setProfile(b.profile)
    const pending: Record<string, number> = {}
    for (const c of b.credits || []) {
      const remaining = Number(c.amount) - Number(c.paid_amount || 0)
      pending[c.customer_name.toLowerCase()] = (pending[c.customer_name.toLowerCase()] || 0) + remaining
    }
    setPendingByName(pending)
  }

  const load = async () => {
    const ck = `customers:${userId}`
    const cached = readCache<any>(ck)
    if (cached) { applyBundle(cached); setLoading(false) } else setLoading(true)
    const [custRes, purchaseRes, agentsRes, creditRes, profileRes] = await Promise.all([
      supabase.from('crm_customers').select('id, agent_id, name, father_name, phone, address, pin_code, created_at').eq('user_id', userId).order('name'),
      supabase.from('crm_purchases').select('id, customer_id, purchase_date, item_name, quantity, unit, unit_price, paid_amount, payment_status').eq('user_id', userId).order('purchase_date', { ascending: false }),
      supabase.from('agents').select('id, name, name_bn, icon, color, shop_name, owner_name, phone, address, upi_id, gstin, print_footer, logo_url, signature_url').eq('user_id', userId),
      supabase.from('credit_entries').select('customer_name, amount, paid_amount').eq('user_id', userId).neq('status', 'paid'),
      supabase.from('profiles').select('shop_name, owner_name, phone, address, upi_id, gstin, print_footer, logo_url, signature_url').eq('id', userId).single(),
    ])
    if (custRes.error) console.error('crm_customers fetch:', custRes.error)
    if (purchaseRes.error) console.error('crm_purchases fetch:', purchaseRes.error)
    const bundle = { customers: custRes.data || [], purchases: purchaseRes.data || [], agentsList: agentsRes.data || [], profile: profileRes.data || null, credits: creditRes.data || [] }
    applyBundle(bundle)
    if (!custRes.error) writeCache(ck, bundle)
    setLoading(false)
  }

  useIsoLayoutEffect(() => { load() }, [userId])

  const agentNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [id, info] of Object.entries(libraryAgentDisplayById())) map[id] = info.name
    agentsList.forEach(a => { map[a.id] = a.name_bn || a.name })
    return map
  }, [agentsList])

  const agentIconById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const [id, info] of Object.entries(libraryAgentDisplayById())) map[id] = info.icon
    agentsList.forEach(a => { map[a.id] = a.icon || '🤖' })
    return map
  }, [agentsList])

  const agentById = useMemo(() => {
    const map: Record<string, AgentLite> = {}
    agentsList.forEach(a => { map[a.id] = a })
    return map
  }, [agentsList])

  /** The shop identity to bill under: the customer's own agent's saved details
   *  where set, falling back field-by-field to the account-wide profile. This
   *  is what fixes a customer under e.g. "Muktifresh Urbana" printing with a
   *  different agent's ("Maa Tara") name — each agent can carry its own. */
  const resolveProfile = (agentId: string | null | undefined): BillingProfile => {
    const a = agentId ? agentById[agentId] : null
    if (!a) return profile
    return {
      shop_name: a.shop_name || profile.shop_name,
      owner_name: a.owner_name || profile.owner_name,
      phone: a.phone || profile.phone,
      address: a.address || profile.address,
      upi_id: a.upi_id || profile.upi_id,
      gstin: a.gstin || profile.gstin,
      print_footer: a.print_footer || profile.print_footer,
      logo_url: a.logo_url || profile.logo_url,
      signature_url: a.signature_url || profile.signature_url,
    }
  }

  const purchasesByCustomer = useMemo(() => {
    const map: Record<string, Purchase[]> = {}
    for (const p of purchases) {
      if (!map[p.customer_id]) map[p.customer_id] = []
      map[p.customer_id].push(p)
    }
    return map
  }, [purchases])

  const customerStats = useMemo(() => {
    const map: Record<string, { count: number; spent: number; paid: number; lastDate: string | null }> = {}
    for (const c of customers) {
      const list = purchasesByCustomer[c.id] || []
      const spent = list.reduce((s, p) => s + p.quantity * p.unit_price, 0)
      const paid = list.reduce((s, p) => s + Number(p.paid_amount || 0), 0)
      const lastDate = list.length ? list.reduce((max, p) => p.purchase_date > max ? p.purchase_date : max, list[0].purchase_date) : null
      map[c.id] = { count: list.length, spent, paid, lastDate }
    }
    return map
  }, [customers, purchasesByCustomer])

  const pendingByCustomer = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of customers) map[c.id] = pendingByName[c.name.toLowerCase()] || 0
    return map
  }, [customers, pendingByName])

  const ACTIVE_WINDOW_DAYS = 30
  const NEW_WINDOW_DAYS = 7
  const isRecentDate = (d: string | null, days: number) => !!d && (Date.now() - new Date(d).getTime()) / 86400000 <= days

  // Account-wide counts for the stat cards — computed from the full
  // customer list, not the filtered/paginated view below.
  const overallStats = useMemo(() => {
    let active = 0, due = 0, dueTotal = 0, fresh = 0
    for (const c of customers) {
      const stats = customerStats[c.id] || { count: 0, spent: 0, paid: 0, lastDate: null }
      const pending = pendingByCustomer[c.id] || 0
      if (isRecentDate(stats.lastDate, ACTIVE_WINDOW_DAYS)) active++
      if (pending > 0) { due++; dueTotal += pending }
      if (isRecentDate(c.created_at, NEW_WINDOW_DAYS)) fresh++
    }
    return { total: customers.length, active, inactive: customers.length - active, due, dueTotal, fresh }
  }, [customers, customerStats, pendingByCustomer])

  const filtered = customers.filter(c => {
    const matchesQ = c.name.toLowerCase().includes(q.toLowerCase()) || (c.phone || '').includes(q)
    if (!matchesQ) return false
    if (agentFilter === 'general' && c.agent_id) return false
    if (agentFilter !== 'all' && agentFilter !== 'general' && c.agent_id !== agentFilter) return false
    const stats = customerStats[c.id] || { count: 0, spent: 0, paid: 0, lastDate: null }
    const pending = pendingByCustomer[c.id] || 0
    const active = isRecentDate(stats.lastDate, ACTIVE_WINDOW_DAYS)
    if (statusFilter === 'active') return active
    if (statusFilter === 'inactive') return !active
    if (statusFilter === 'due') return pending > 0
    if (statusFilter === 'new') return isRecentDate(c.created_at, NEW_WINDOW_DAYS)
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)
  // Any change to what's being filtered should land back on page 1, or a
  // narrower filter could leave the view on a now-empty later page.
  useEffect(() => { setPage(1) }, [q, agentFilter, statusFilter])

  const saveCustomer = async () => {
    if (!customerForm.name.trim()) { toast.error('নাম দিন'); return }
    setSavingCustomer(true)
    const { error } = await supabase.from('crm_customers').insert({
      user_id: userId, name: customerForm.name.trim(), father_name: customerForm.father_name || null,
      phone: customerForm.phone || null, address: customerForm.address || null, pin_code: customerForm.pin_code || null,
      agent_id: customerForm.agent_id || null,
      business_type: 'general', source: 'manual',
    })
    if (error) { console.error('crm_customers insert:', error); toast.error('সেভ করতে সমস্যা হয়েছে') }
    else { toast.success('কাস্টমার যোগ হয়েছে'); setCustomerForm(emptyCustomerForm); setShowAddCustomer(false); load() }
    setSavingCustomer(false)
  }

  const openAddCustomer = () => {
    setCustomerForm({ ...emptyCustomerForm, agent_id: agentFilter !== 'all' && agentFilter !== 'general' ? agentFilter : '' })
    setShowAddCustomer(true)
  }

  const openHistory = (c: Customer) => setHistoryFor(c)

  const openBill = (target: Customer | 'cash') => {
    setBillFor(target)
    setBillForm(emptyBillForm)
    setWithGst(false)
  }

  const qty = Number(billForm.quantity || 0)
  const price = Number(billForm.unit_price || 0)
  const total = qty * price
  const paid = billForm.paid ? Number(billForm.paid) : total
  const billValid = billForm.item_name.trim() && qty > 0 && price > 0

  const buildSale = () => {
    const c = billFor !== 'cash' ? billFor : null
    return {
      item_name: billForm.item_name, quantity: qty, unit: billForm.unit, unit_price: price,
      total_amount: total, paid_amount: paid,
      customer_name: c?.name, customer_phone: c?.phone || undefined,
    }
  }

  /** Also records the sale as a crm_purchases row (when tied to a real customer) so it shows up in their history. */
  const recordPurchaseIfCustomer = async () => {
    if (billFor === 'cash' || !billFor) return
    const { error } = await supabase.from('crm_purchases').insert({
      user_id: userId, customer_id: billFor.id, purchase_date: new Date().toISOString().slice(0, 10),
      item_name: billForm.item_name, quantity: qty, unit: billForm.unit, unit_price: price,
      paid_amount: paid, payment_status: paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending',
      source: 'manual',
    })
    if (error) console.error('crm_purchases insert (from quick bill):', error)
    else load()
  }

  const handlePrint = async () => {
    if (!billValid) { toast.error('পণ্য, পরিমাণ ও দাম দিন'); return }
    const billProfile = resolveProfile(billFor !== 'cash' ? billFor?.agent_id : null)
    printBill(billProfile, buildSale(), withGst ? 18 : 0)
    await recordPurchaseIfCustomer()
  }
  const handleWhatsApp = async () => {
    if (!billValid) { toast.error('পণ্য, পরিমাণ ও দাম দিন'); return }
    const billProfile = resolveProfile(billFor !== 'cash' ? billFor?.agent_id : null)
    const ok = sendBillWhatsApp(billProfile, buildSale(), withGst)
    if (!ok) { toast.error('কাস্টমারের ফোন নম্বর নেই'); return }
    await recordPurchaseIfCustomer()
  }

  // ── Date-wise invoice from purchase history ─────────────────
  const sendDateInvoice = (c: Customer, dateItems: Purchase[], via: 'print' | 'whatsapp') => {
    const items = dateItems.map(p => ({ item_name: p.item_name, quantity: p.quantity, unit: p.unit, unit_price: p.unit_price }))
    const paidSum = dateItems.reduce((s, p) => s + Number(p.paid_amount || 0), 0)
    const dateLabel = new Date(dateItems[0].purchase_date).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    const sale = { items, paid_amount: paidSum, customer_name: c.name, customer_phone: c.phone || undefined, date_label: dateLabel }
    const billProfile = resolveProfile(c.agent_id) // ← this customer's own agent's shop identity, not the account default
    if (via === 'print') {
      printMultiBill(billProfile, sale, 0)
    } else {
      const ok = sendMultiBillWhatsApp(billProfile, sale, false)
      if (!ok) toast.error('কাস্টমারের ফোন নম্বর নেই')
    }
  }

  // ── Per-agent shop identity (logo/name/address/signature for invoices) ──
  const openAgentProfile = (a: AgentLite) => {
    setAgentProfileFor(a)
    setAgentProfileForm({
      shop_name: a.shop_name || '', owner_name: a.owner_name || '', phone: a.phone || '',
      address: a.address || '', upi_id: a.upi_id || '', gstin: a.gstin || '', print_footer: a.print_footer || '',
    })
  }

  const saveAgentProfile = async () => {
    if (!agentProfileFor) return
    setSavingAgentProfile(true)
    const { error } = await supabase.from('agents').update(agentProfileForm).eq('id', agentProfileFor.id)
    if (error) { console.error('agent shop profile update:', error); toast.error('সেভ করতে সমস্যা হয়েছে') }
    else { toast.success('সেভ হয়েছে!'); await load(); setAgentProfileFor(null) }
    setSavingAgentProfile(false)
  }

  const uploadAgentBrandImage = async (file: File, kind: 'logo' | 'signature') => {
    if (!agentProfileFor) return
    const setUploading = kind === 'logo' ? setUploadingAgentLogo : setUploadingAgentSignature
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/agent-${agentProfileFor.id}-${kind}-${uuidv4()}.${ext}`
      const { error: upErr } = await supabase.storage.from('catalog-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('catalog-images').getPublicUrl(path)
      const field = kind === 'logo' ? 'logo_url' : 'signature_url'
      const { error: dbErr } = await supabase.from('agents').update({ [field]: pub.publicUrl }).eq('id', agentProfileFor.id)
      if (dbErr) throw dbErr
      setAgentProfileFor(prev => prev ? { ...prev, [field]: pub.publicUrl } : prev)
      await load()
      toast.success(kind === 'logo' ? 'লোগো আপডেট হয়েছে!' : 'স্বাক্ষর আপডেট হয়েছে!')
    } catch (e: any) {
      toast.error(e.message || 'ছবি আপলোড করা যায়নি')
    } finally {
      setUploading(false)
    }
  }

  // ── Excel export ──────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true)
    try {
      const customerRows: CustomerExportRow[] = filtered.map(c => {
        const stats = customerStats[c.id] || { count: 0, spent: 0, paid: 0, lastDate: null }
        return {
          Name: c.name,
          Agent: c.agent_id ? (agentNameById[c.agent_id] || 'Unknown') : GENERAL_LABEL,
          'Father Name': c.father_name || '',
          Phone: c.phone || '',
          Address: c.address || '',
          'Pin Code': c.pin_code || '',
          'Total Purchases': stats.count,
          'Total Spent (₹)': Math.round(stats.spent),
          'Total Paid (₹)': Math.round(stats.paid),
          'Total Due (₹)': Math.round(stats.spent - stats.paid),
          'Last Purchase Date': stats.lastDate || '',
        }
      })

      const filteredIds = new Set(filtered.map(c => c.id))
      const purchaseRows: PurchaseExportRow[] = purchases
        .filter(p => filteredIds.has(p.customer_id))
        .map(p => {
          const c = customers.find(x => x.id === p.customer_id)
          const totalAmt = p.quantity * p.unit_price
          return {
            Customer: c?.name || 'Unknown',
            Agent: c?.agent_id ? (agentNameById[c.agent_id] || 'Unknown') : GENERAL_LABEL,
            Date: p.purchase_date,
            Item: p.item_name,
            Quantity: p.quantity,
            Unit: p.unit,
            'Unit Price (₹)': p.unit_price,
            'Total (₹)': Math.round(totalAmt),
            'Paid (₹)': Math.round(Number(p.paid_amount || 0)),
            'Due (₹)': Math.round(totalAmt - Number(p.paid_amount || 0)),
            Status: p.payment_status,
          }
        })

      exportCustomersToExcel(customerRows, purchaseRows)
      toast.success('Excel ডাউনলোড হচ্ছে...')
    } catch (e) {
      console.error('export failed:', e)
      toast.error('Excel তৈরি করতে সমস্যা হয়েছে। "npm install xlsx" চালিয়ে নিশ্চিত করুন।')
    }
    setExporting(false)
  }

  const historyGroups = useMemo(() => {
    if (!historyFor) return []
    const list = purchasesByCustomer[historyFor.id] || []
    const byDate: Record<string, Purchase[]> = {}
    for (const p of list) {
      if (!byDate[p.purchase_date]) byDate[p.purchase_date] = []
      byDate[p.purchase_date].push(p)
    }
    return Object.entries(byDate).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [historyFor, purchasesByCustomer])

  return (
    <div className="max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center max-sm:flex-row justify-between gap-3 max-sm:gap-2 mb-4 sm:mb-5 max-sm:mb-2">
        <div>
          <h1 className="text-xl max-sm:text-lg font-extrabold text-gray-900 bengali flex items-center gap-2">
            <Users size={20} className="text-indigo-500"/> {tr('কাস্টমার')}
          </h1>
          <p className="max-sm:hidden text-gray-400 text-[13px] bengali mt-0.5">{tr('আপনার সকল কাস্টমার দেখুন, পরিচালনা করুন এবং সম্পর্ক আরও শক্তিশালী করুন।')}</p>
        </div>
        <div className="grid grid-cols-2 max-sm:flex sm:flex sm:flex-wrap items-center gap-2 max-sm:gap-1.5">
          <button onClick={handleExport} disabled={exporting || filtered.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 max-sm:px-2.5 py-2.5 max-sm:py-2 rounded-lg bg-emerald-50 text-emerald-700 text-[13px] font-bold bengali whitespace-nowrap disabled:opacity-50">
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} <span className="max-sm:hidden">{tr('Excel ডাউনলোড')}</span>
          </button>
          <button onClick={() => openBill('cash')}
            className="flex items-center justify-center gap-1.5 px-3 max-sm:px-2.5 py-2.5 max-sm:py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-bold bengali whitespace-nowrap">
            <FileText size={14} /> <span className="max-sm:hidden">{tr('ইনভয়েস তৈরি করুন')}</span><span className="sm:hidden">{tr('ইনভয়েস')}</span>
          </button>
          <button onClick={openAddCustomer}
            className="col-span-2 max-sm:col-span-1 sm:col-span-1 flex items-center justify-center gap-1.5 px-3 max-sm:px-2.5 py-2.5 max-sm:py-2 rounded-lg bg-gray-100 text-gray-700 text-[13px] font-bold bengali whitespace-nowrap">
            <Plus size={14} /> <span className="max-sm:hidden">{tr('নতুন Customer')}</span><span className="sm:hidden">{tr('নতুন')}</span>
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 max-sm:grid-cols-4 lg:grid-cols-4 gap-2.5 sm:gap-3 max-sm:gap-1.5 mb-4 max-sm:mb-2">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 max-sm:p-2 flex items-center max-sm:flex-col max-sm:items-start gap-2.5 max-sm:gap-0.5 min-w-0">
          <div className="max-sm:hidden w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0"><Users size={17}/></div>
          <div className="min-w-0">
            <div className="font-extrabold text-gray-900 leading-none max-sm:text-sm">{overallStats.total}</div>
            <div className="text-[10.5px] max-sm:text-[9.5px] max-sm:leading-tight text-gray-500 bengali mt-1 max-sm:mt-0">{tr('মোট কাস্টমার')}</div>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 max-sm:p-2 flex items-center max-sm:flex-col max-sm:items-start gap-2.5 max-sm:gap-0.5 min-w-0">
          <div className="max-sm:hidden w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"><UserCheck size={17}/></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-gray-900 leading-none max-sm:text-sm">{overallStats.active}</span>
              {overallStats.total > 0 && (
                <span className="max-sm:hidden text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">{Math.round(overallStats.active / overallStats.total * 100)}%</span>
              )}
            </div>
            <div className="text-[10.5px] max-sm:text-[9.5px] max-sm:leading-tight text-gray-500 bengali mt-1 max-sm:mt-0">{tr('সক্রিয় কাস্টমার')}</div>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 max-sm:p-2 flex items-center max-sm:flex-col max-sm:items-start gap-2.5 max-sm:gap-0.5 min-w-0">
          <div className="max-sm:hidden w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0"><IndianRupee size={17}/></div>
          <div className="min-w-0">
            <div className="font-extrabold text-gray-900 leading-none max-sm:text-sm">₹{overallStats.dueTotal.toFixed(0)}</div>
            <div className="text-[10.5px] max-sm:text-[9.5px] max-sm:leading-tight text-gray-500 bengali mt-1 max-sm:mt-0">{tr('বাকি আছে ·')} {overallStats.due} {tr('জন')}</div>
          </div>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 max-sm:p-2 flex items-center max-sm:flex-col max-sm:items-start gap-2.5 max-sm:gap-0.5 min-w-0">
          <div className="max-sm:hidden w-9 h-9 rounded-xl bg-violet-500 text-white flex items-center justify-center flex-shrink-0"><UserPlus2 size={17}/></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-gray-900 leading-none max-sm:text-sm">{overallStats.fresh}</span>
              {overallStats.total > 0 && (
                <span className="max-sm:hidden text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">{Math.round(overallStats.fresh / overallStats.total * 100)}%</span>
              )}
            </div>
            <div className="text-[10.5px] max-sm:text-[9.5px] max-sm:leading-tight text-gray-500 bengali mt-1 max-sm:mt-0">{tr('আজ+৭দিনে নতুন')}</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-3 max-sm:mb-2 overflow-x-auto sm:flex-wrap sm:overflow-visible -mx-3 px-3 sm:mx-0 sm:px-0 pb-1 sm:pb-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {([
          ['all', `সব (${overallStats.total})`],
          ['active', `সক্রিয় (${overallStats.active})`],
          ['due', `বাকি আছে (${overallStats.due})`],
          ['new', `নতুন (${overallStats.fresh})`],
          ['inactive', `Inactive (${overallStats.inactive})`],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold bengali transition-colors whitespace-nowrap flex-shrink-0 ${statusFilter === key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search + agent filter */}
      <div className="flex flex-wrap max-sm:flex-nowrap items-center gap-2 mb-4 sm:mb-5 max-sm:mb-2">
        <div className="w-full sm:w-auto sm:flex-1 sm:min-w-[180px] max-sm:flex-1 max-sm:min-w-0 max-sm:w-auto relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('নাম বা ফোন দিয়ে খুঁজুন...')}
            className="w-full pl-9 pr-3 py-2.5 max-sm:py-2 rounded-lg border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-100" />
        </div>
        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="flex-1 sm:flex-none max-sm:flex-none max-sm:max-w-[110px] min-w-0 max-w-full px-3 max-sm:px-2 py-2.5 max-sm:py-2 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
          <option value="all">{tr('সব Agent')}</option>
          <option value="general">{GENERAL_LABEL}</option>
          {Object.keys(agentNameById).map(id => (
            <option key={id} value={id}>{agentIconById[id]} {agentNameById[id]}</option>
          ))}
        </select>
        <div className="max-sm:hidden flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] text-gray-500 bengali whitespace-nowrap">
          <SlidersHorizontal size={13}/> {filtered.length} {tr('জন')}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl text-gray-400 text-[13px] bengali">
          {tr('কোনো কাস্টমার পাওয়া যায়নি। "+ নতুন Customer" দিয়ে যোগ করুন।')}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden max-sm:flex-1 max-sm:min-h-0 max-sm:flex max-sm:flex-col">
          {/* Desktop / tablet: table. Less important columns appear only when there is room (2xl). */}
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] bengali">
                <th className="px-3 py-3 font-semibold">{tr('নাম')}</th>
                <th className="px-3 py-3 font-semibold hidden 2xl:table-cell">{tr('কোন Agent এর কাস্টমার')}</th>
                <th className="px-3 py-3 font-semibold hidden 2xl:table-cell">{tr('ফোন নম্বর')}</th>
                <th className="px-3 py-3 font-semibold hidden 2xl:table-cell">{tr('ঠিকানা')}</th>
                <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">{tr('মোট ক্রয়')}</th>
                <th className="px-3 py-3 font-semibold whitespace-nowrap hidden 2xl:table-cell">{tr('সর্বশেষ ক্রয়')}</th>
                <th className="px-3 py-3 font-semibold text-right">{tr('বাকি')}</th>
                <th className="px-3 py-3 font-semibold text-center">{tr('স্ট্যাটাস')}</th>
                <th className="px-3 py-3 font-semibold text-center">{tr('অ্যাকশন')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(c => {
                const pending = pendingByName[c.name.toLowerCase()] || 0
                const stats = customerStats[c.id] || { count: 0, spent: 0, paid: 0, lastDate: null }
                const rowAgent = c.agent_id ? agentById[c.agent_id] : undefined
                const active = isRecentDate(stats.lastDate, ACTIVE_WINDOW_DAYS)
                const agentChip = c.agent_id ? (
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => router.push(`/agents/${c.agent_id}`)}
                      title={tr('এই এজেন্টের ড্যাশবোর্ডে যান')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-semibold bengali hover:bg-indigo-100 transition-colors max-w-[150px]"
                    >
                      <span>{agentIconById[c.agent_id] || '🤖'}</span>
                      <span className="truncate">{agentNameById[c.agent_id] || 'Unknown'}</span>
                    </button>
                    {rowAgent && (
                      <button
                        onClick={() => openAgentProfile(rowAgent)}
                        title={tr('এই এজেন্টের শপ প্রোফাইল (ইনভয়েসে যা দেখাবে) সম্পাদনা করুন')}
                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center flex-shrink-0"
                      >
                        <Store size={11} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-[11px] font-semibold bengali">
                    {GENERAL_LABEL}
                  </span>
                )
                const statusBadge = pending > 0 ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10.5px] font-bold bengali whitespace-nowrap">{tr('বাকি আছে')}</span>
                ) : active ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10.5px] font-bold bengali whitespace-nowrap">{tr('সক্রিয়')}</span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 text-[10.5px] font-bold bengali whitespace-nowrap">Inactive</span>
                )
                return (
                  <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-3 py-3 max-w-[180px]">
                      <div className="font-bold text-gray-900 bengali truncate">{c.name}</div>
                      {/* When the phone / agent columns are hidden, show them under the name */}
                      <div className="2xl:hidden mt-0.5 space-y-1">
                        {c.phone && <div className="text-[11.5px] text-gray-500">{c.phone}</div>}
                        <div>{agentChip}</div>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap hidden 2xl:table-cell">{agentChip}</td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden 2xl:table-cell">{c.phone || '—'}</td>
                    <td className="px-3 py-3 text-gray-500 bengali max-w-[160px] truncate hidden 2xl:table-cell">{c.address || '—'}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="font-bold text-gray-900">₹{stats.spent.toFixed(0)}</div>
                      <div className="text-[10.5px] text-gray-400 bengali">{stats.count} {tr('বার')}</div>
                    </td>
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap hidden 2xl:table-cell">
                      {stats.lastDate ? new Date(stats.lastDate).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className={`font-bold ${pending > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{pending.toFixed(0)}</span>
                    </td>
                    <td className="px-3 py-3 text-center">{statusBadge}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => openHistory(c)} title={tr('ক্রয়ের ইতিহাস')} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 inline-flex items-center justify-center flex-shrink-0">
                          <History size={13} />
                        </button>
                        <button onClick={() => openBill(c)} title={tr('বিল তৈরি করুন')}
                          className="h-8 min-w-[32px] px-2 2xl:px-3 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold whitespace-nowrap bengali inline-flex items-center justify-center gap-1 flex-shrink-0">
                          <FileText size={13} className="2xl:hidden" />
                          <span className="hidden 2xl:inline">{tr('বিল তৈরি করুন')}</span>
                        </button>
                        {c.phone && (
                          <>
                            <a href={`tel:${c.phone}`} title={tr('কল করুন')}
                              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center flex-shrink-0">
                              <PhoneCall size={13} />
                            </a>
                            <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title={tr('WhatsApp-এ মেসেজ করুন')}
                              className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 inline-flex items-center justify-center flex-shrink-0">
                              <MessageCircle size={13} />
                            </a>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {/* Phones: one card per customer instead of a wide table */}
          <div className="md:hidden divide-y divide-gray-100 max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto">
            {paged.map(c => {
              const pending = pendingByName[c.name.toLowerCase()] || 0
              const stats = customerStats[c.id] || { count: 0, spent: 0, paid: 0, lastDate: null }
              const active = isRecentDate(stats.lastDate, ACTIVE_WINDOW_DAYS)
              return (
                <div key={c.id} className="flex items-center gap-2.5 px-3 py-2.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-extrabold text-[13px] flex-shrink-0" style={{ background: avatarColor(c.name) }}>
                    {String(Array.from(String(c.name).trim())[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-gray-900 bengali text-[13px] truncate">{c.name}</div>
                    <div className="text-[11px] text-gray-400 bengali truncate">{c.phone || c.address || '—'} {tr('· মোট ₹')}{stats.spent.toFixed(0)} · {stats.count} {tr('বার')}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-extrabold text-[13px] ${pending > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{pending.toFixed(0)}</div>
                    <div className={`text-[9px] font-bold bengali ${pending > 0 ? 'text-rose-500' : active ? 'text-emerald-600' : 'text-gray-400'}`}>{pending > 0 ? tr('বাকি') : active ? tr('সক্রিয়') : 'Inactive'}</div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openBill(c)} title={tr('বিল তৈরি করুন')} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 inline-flex items-center justify-center"><FileText size={14} /></button>
                    <button onClick={() => openHistory(c)} title={tr('ক্রয়ের ইতিহাস')} className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 inline-flex items-center justify-center"><History size={14} /></button>
                    {c.phone && (
                      <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 inline-flex items-center justify-center"><MessageCircle size={14} /></a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 max-sm:px-3 py-3 max-sm:py-1.5 border-t border-gray-100 shrink-0">
              <span className="text-[12px] text-gray-400 bengali">{tr('মোট')} {filtered.length} {tr('জন কাস্টমার')}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pageSafe === 1}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 inline-flex items-center justify-center">
                  <ChevronLeft size={14}/>
                </button>
                <span className="text-[12px] font-semibold text-gray-600 px-2 bengali">{pageSafe} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={pageSafe === totalPages}
                  className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-30 inline-flex items-center justify-center">
                  <ChevronRight size={14}/>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add customer modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setShowAddCustomer(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">{tr('নতুন Customer')}</h3>
              <button onClick={() => setShowAddCustomer(false)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder={tr('নাম')} value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder={tr('পিতার নাম')} value={customerForm.father_name} onChange={e => setCustomerForm(f => ({ ...f, father_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder={tr('ফোন নম্বর')} value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <input placeholder={tr('ঠিকানা')} value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder={tr('পিন কোড')} value={customerForm.pin_code} onChange={e => setCustomerForm(f => ({ ...f, pin_code: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <select value={customerForm.agent_id} onChange={e => setCustomerForm(f => ({ ...f, agent_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
                <option value="">{GENERAL_LABEL} {tr('(কোনো Agent নেই)')}</option>
                {Object.keys(agentNameById).map(id => (
                  <option key={id} value={id}>{agentIconById[id]} {agentNameById[id]}</option>
                ))}
              </select>
              <button onClick={saveCustomer} disabled={savingCustomer}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">
                {savingCustomer ? tr('সেভ হচ্ছে...') : tr('যোগ করুন')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Purchase history modal — grouped date-wise, each date can be invoiced */}
      {historyFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setHistoryFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 bengali">{historyFor.name} {tr('— ক্রয়ের ইতিহাস (তারিখ অনুযায়ী)')}</h3>
              <button onClick={() => setHistoryFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-4">
              {historyFor.phone && <span className="flex items-center gap-1"><Phone size={10} />{historyFor.phone}</span>}
              {historyFor.address && <span className="flex items-center gap-1 bengali"><MapPin size={10} />{historyFor.address}</span>}
            </div>
            {historyGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-[13px] bengali">{tr('কোনো ক্রয়ের রেকর্ড নেই')}</div>
            ) : (
              <div className="space-y-4">
                {historyGroups.map(([date, items]) => {
                  const dateTotal = items.reduce((s, p) => s + p.quantity * p.unit_price, 0)
                  const datePaid = items.reduce((s, p) => s + Number(p.paid_amount || 0), 0)
                  return (
                    <div key={date} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                        <span className="text-[12px] font-bold text-gray-700 bengali">
                          {new Date(date).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => sendDateInvoice(historyFor, items, 'print')}
                            title={tr('এই তারিখের ইনভয়েস প্রিন্ট করুন')}
                            className="w-7 h-7 rounded-lg bg-white border border-gray-200 text-gray-500 inline-flex items-center justify-center">
                            <Printer size={12} />
                          </button>
                          <button onClick={() => sendDateInvoice(historyFor, items, 'whatsapp')}
                            title={tr('এই তারিখের ইনভয়েস WhatsApp-এ পাঠান')}
                            className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 inline-flex items-center justify-center">
                            <MessageCircle size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {items.map(h => (
                          <div key={h.id} className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-800 text-[12.5px] bengali">{h.item_name}</div>
                              <div className="text-[10.5px] text-gray-400 bengali">{h.quantity}{h.unit} × ₹{h.unit_price}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-gray-900 text-[12.5px]">₹{(h.quantity * h.unit_price).toFixed(0)}</div>
                              <div className={`text-[10px] font-semibold bengali ${h.payment_status === 'paid' ? 'text-emerald-600' : 'text-red-500'}`}>
                                {h.payment_status === 'paid' ? tr('পরিশোধিত') : h.payment_status === 'partial' ? tr('আংশিক') : tr('বাকি')}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[12px]">
                          <span className="text-gray-500 bengali">{tr('এই তারিখের মোট')}</span>
                          <span className="font-bold text-indigo-600">₹{dateTotal.toFixed(0)} <span className="text-gray-400 font-normal">{tr('(পরিশোধ ₹')}{datePaid.toFixed(0)})</span></span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-agent shop identity editor — what prints on this agent's invoices */}
      {agentProfileFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setAgentProfileFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-gray-900 bengali flex items-center gap-2">
                <span>{agentProfileFor.icon || '🤖'}</span>
                {agentProfileFor.name_bn || agentProfileFor.name} {tr('— শপ প্রোফাইল')}
              </h3>
              <button onClick={() => setAgentProfileFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <p className="text-[11px] text-gray-400 bengali mb-4">
              {tr('এই তথ্য শুধু এই এজেন্টের কাস্টমারদের ইনভয়েসে দেখাবে। খালি রাখলে আপনার একাউন্টের ডিফল্ট শপ তথ্য ব্যবহার হবে।')}
            </p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1.5">{tr('লোগো')}</label>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {agentProfileFor.logo_url
                      ? <img src={agentProfileFor.logo_url} alt={tr('লোগো')} className="w-full h-full object-cover" />
                      : <span className="text-xl">🏪</span>}
                  </div>
                  <label className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold bengali cursor-pointer text-center">
                    {uploadingAgentLogo ? '...' : tr('আপলোড')}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingAgentLogo}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAgentBrandImage(f, 'logo'); e.target.value = '' }} />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1.5">{tr('স্বাক্ষর')}</label>
                <div className="flex items-center gap-2">
                  <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {agentProfileFor.signature_url
                      ? <img src={agentProfileFor.signature_url} alt={tr('স্বাক্ষর')} className="w-full h-full object-contain" />
                      : <span className="text-lg text-gray-300">✍️</span>}
                  </div>
                  <label className="px-2.5 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-[11px] font-bold bengali cursor-pointer text-center">
                    {uploadingAgentSignature ? '...' : tr('আপলোড')}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingAgentSignature}
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAgentBrandImage(f, 'signature'); e.target.value = '' }} />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <input placeholder={tr('শপের নাম (এই এজেন্টের)')} value={agentProfileForm.shop_name}
                onChange={e => setAgentProfileForm(f => ({ ...f, shop_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder={tr('মালিকের নাম')} value={agentProfileForm.owner_name}
                onChange={e => setAgentProfileForm(f => ({ ...f, owner_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder={tr('ফোন নম্বর')} value={agentProfileForm.phone}
                onChange={e => setAgentProfileForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <input placeholder={tr('ঠিকানা')} value={agentProfileForm.address}
                onChange={e => setAgentProfileForm(f => ({ ...f, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <input placeholder={tr('GSTIN (ঐচ্ছিক)')} value={agentProfileForm.gstin}
                onChange={e => setAgentProfileForm(f => ({ ...f, gstin: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <input placeholder={tr('UPI ID (ঐচ্ছিক)')} value={agentProfileForm.upi_id}
                onChange={e => setAgentProfileForm(f => ({ ...f, upi_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px]" />
              <textarea placeholder={tr('ইনভয়েসের নিচের বার্তা (ঐচ্ছিক)')} value={agentProfileForm.print_footer} rows={2}
                onChange={e => setAgentProfileForm(f => ({ ...f, print_footer: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali" />
              <button onClick={saveAgentProfile} disabled={savingAgentProfile}
                className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali disabled:opacity-50">
                {savingAgentProfile ? tr('সেভ হচ্ছে...') : tr('সেভ করুন')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/share bill modal */}
      {billFor && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => setBillFor(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 bengali">
                {tr('বিল —')} {billFor === 'cash' ? tr('নগদ বিক্রি') : billFor.name}
              </h3>
              <button onClick={() => setBillFor(null)}><X size={18} className="text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder={tr('পণ্য/সেবার নাম')} value={billForm.item_name} onChange={e => setBillForm(f => ({ ...f, item_name: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali" />
              <div className="grid grid-cols-3 gap-3">
                <input placeholder={tr('পরিমাণ')} type="number" value={billForm.quantity} onChange={e => setBillForm(f => ({ ...f, quantity: e.target.value }))}
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]" />
                <input placeholder={tr('একক')} value={billForm.unit} onChange={e => setBillForm(f => ({ ...f, unit: e.target.value }))}
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px] bengali" />
                <input placeholder={tr('দাম/একক')} type="number" value={billForm.unit_price} onChange={e => setBillForm(f => ({ ...f, unit_price: e.target.value }))}
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]" />
              </div>
              <input placeholder={`পরিশোধ (ডিফল্ট: পুরো ₹${total.toFixed(0)})`} type="number" value={billForm.paid} onChange={e => setBillForm(f => ({ ...f, paid: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]" />
              <label className="flex items-center gap-2 text-[13px] text-gray-600 bengali">
                <input type="checkbox" checked={withGst} onChange={e => setWithGst(e.target.checked)} className="rounded" />
                {tr('GST (18%) সহ')}
              </label>
              <div className="bg-indigo-50 rounded-lg p-3 flex items-center justify-between text-[13px]">
                <span className="text-indigo-700 font-semibold bengali">{tr('মোট')}</span>
                <span className="text-indigo-700 font-extrabold">₹{(withGst ? total * 1.18 : total).toFixed(0)}</span>
              </div>
              {billFor !== 'cash' && (
                <p className="text-[10.5px] text-gray-400 bengali">{tr('এই বিল সেভ হবে এবং কাস্টমারের ক্রয়ের ইতিহাসে যুক্ত হবে।')}</p>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={handlePrint} className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[13px] bengali">
                  <Printer size={14} /> {tr('প্রিন্ট করুন')}
                </button>
                <button onClick={handleWhatsApp} className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-[13px] bengali">
                  <MessageCircle size={14} /> {tr('শেয়ার করুন')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
