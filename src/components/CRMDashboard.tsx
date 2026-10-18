'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  Search, Plus, Download, Camera, Mic, MicOff,
  X, Check, ChevronDown, ChevronUp, Phone, MapPin,
  User, ShoppingBag, FileText, AlertCircle, Loader2, Trash2,
  Users, UserCheck, UserPlus2, IndianRupee, MessageCircle, PhoneCall,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { tr } from '@/lib/i18n/tr'
// ── Types ───────────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  name_bn?: string
  age?: number
  gender?: string
  phone?: string
  address?: string
  doctor_name?: string
  blood_group?: string
  notes?: string
  business_type: string
  created_at: string
}

interface Purchase {
  id: string
  customer_id: string
  purchase_date: string
  item_name: string
  item_category?: string
  quantity: number
  unit: string
  unit_price: number
  total_amount: number
  paid_amount: number
  due_amount: number
  payment_status: string
  notes?: string
  source: string
}

interface Prescription {
  id: string
  customer_id: string
  prescription_date: string
  doctor_name?: string
  hospital_clinic?: string
  diagnosis?: string
  medicines: any[]
  notes?: string
}

interface Props {
  userId: string
  agentId: string
  businessType?: string
  agentName?: string
  // Bumping this (e.g. after the AI Assistant panel writes a customer/
  // purchase via /api/business-chat) forces a refetch, so this list stays
  // in sync with writes that happened outside this component.
  refreshSignal?: number
}

const BUSINESS_LABELS: Record<string, string> = {
  pharmacy: 'ফার্মেসি CRM',
  dokan: 'দোকান CRM',
  hotel: 'হোটেল CRM',
  coaching: 'কোচিং CRM',
}

const ITEM_UNITS: Record<string, string[]> = {
  pharmacy: ['strip', 'tablet', 'bottle', 'tube', 'injection', 'pcs'],
  dokan:    ['kg', 'pcs', 'litre', 'packet', 'box', 'dozen'],
  hotel:    ['plate', 'portion', 'glass', 'item', 'day'],
  coaching: ['session', 'month', 'batch', 'exam'],
}

// ── Excel export ─────────────────────────────────────────────
function exportToExcel(customer: Customer, purchases: Purchase[], prescriptions: Prescription[]) {
  const bom = '\uFEFF'
  const rows: string[][] = []

  // Customer info header
  rows.push(['=== Customer Details ==='])
  rows.push(['Name', customer.name])
  rows.push(['Bengali Name', customer.name_bn || ''])
  rows.push(['Age', String(customer.age || '')])
  rows.push(['Gender', customer.gender || ''])
  rows.push(['Phone', customer.phone || ''])
  rows.push(['Address', customer.address || ''])
  rows.push(['Doctor', customer.doctor_name || ''])
  rows.push(['Blood Group', customer.blood_group || ''])
  rows.push([])

  // Purchase history
  rows.push(['=== Purchase History ==='])
  rows.push(['Date', 'Item', 'Category', 'Qty', 'Unit', 'Unit Price', 'Total', 'Paid', 'Due', 'Status', 'Source'])
  purchases.forEach(p => {
    rows.push([
      p.purchase_date, p.item_name, p.item_category || '',
      String(p.quantity), p.unit, String(p.unit_price),
      String(p.total_amount), String(p.paid_amount),
      String(p.due_amount), p.payment_status, p.source,
    ])
  })
  rows.push(['', '', '', '', '', 'TOTAL',
    String(purchases.reduce((s, p) => s + Number(p.total_amount), 0)),
    String(purchases.reduce((s, p) => s + Number(p.paid_amount), 0)),
    String(purchases.reduce((s, p) => s + Number(p.due_amount), 0)),
  ])
  rows.push([])

  // Prescriptions
  if (prescriptions.length > 0) {
    rows.push(['=== Prescriptions ==='])
    rows.push(['Date', 'Doctor', 'Hospital/Clinic', 'Diagnosis', 'Medicines', 'Notes'])
    prescriptions.forEach(p => {
      const meds = (p.medicines || []).map((m: any) => `${m.name} ${m.dosage || ''}`).join('; ')
      rows.push([p.prescription_date, p.doctor_name || '', p.hospital_clinic || '', p.diagnosis || '', meds, p.notes || ''])
    })
  }

  const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${customer.name}-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`${customer.name}-এর Excel download হচ্ছে!`)
}

function exportAllCustomers(customers: Customer[], allPurchases: Purchase[]) {
  const bom = '\uFEFF'
  const rows: string[][] = [
    ['Name', 'Bengali Name', 'Age', 'Phone', 'Address', 'Doctor', 'Total Purchases', 'Total Amount', 'Total Due', 'Joined'],
  ]
  customers.forEach(c => {
    const cp = allPurchases.filter(p => p.customer_id === c.id)
    rows.push([
      c.name, c.name_bn || '', String(c.age || ''), c.phone || '', c.address || '',
      c.doctor_name || '',
      String(cp.length),
      String(cp.reduce((s, p) => s + Number(p.total_amount), 0)),
      String(cp.reduce((s, p) => s + Number(p.due_amount), 0)),
      new Date(c.created_at).toLocaleDateString('bn-IN'),
    ])
  })
  const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `all-customers-${new Date().toISOString().split('T')[0]}.csv`; a.click()
  URL.revokeObjectURL(url)
  toast.success('সব customer-এর Excel download হচ্ছে!')
}

// ── Main component ─────────────────────────────────────────────
export default function CRMDashboard({ userId, agentId, businessType = 'pharmacy', agentName = 'CRM', refreshSignal }: Props) {
  const [tab, setTab] = useState<'customers' | 'add_customer' | 'detail' | 'import'>('customers')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'due' | 'new' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 10
  const [customers, setCustomers] = useState<Customer[]>([])
  const [allPurchases, setAllPurchases] = useState<Purchase[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerPurchases, setCustomerPurchases] = useState<Purchase[]>([])
  const [customerRx, setCustomerRx] = useState<Prescription[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddPurchase, setShowAddPurchase] = useState(false)
  const [showAddRx, setShowAddRx] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState<any>(null)
  const recognitionRef = useRef<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const units = ITEM_UNITS[businessType] || ITEM_UNITS.dokan

  // ── Fetch data ──────────────────────────────────────────────
  // FIX (cross-agent leak): this used to filter only by business_type,
  // not agent_id — even though writes elsewhere in this file DO tag rows
  // with agent_id correctly. Two agents sharing a business_type (e.g. two
  // custom agents both left on the default "general") would show each
  // other's customers mixed together. Now scoped the same way writes are.
  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    const { data: custs } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })

    const { data: purch } = await supabase
      .from('crm_purchases')
      .select('*')
      .eq('user_id', userId)
      .order('purchase_date', { ascending: false })

    if (custs) setCustomers(custs)
    if (purch) setAllPurchases(purch)
    setLoading(false)
  }, [userId, agentId])

  useEffect(() => { fetchCustomers() }, [fetchCustomers, refreshSignal])

  const loadCustomerDetail = async (customer: Customer) => {
    setSelectedCustomer(customer)
    const [{ data: purch }, { data: rx }] = await Promise.all([
      supabase.from('crm_purchases').select('*').eq('customer_id', customer.id).order('purchase_date', { ascending: false }),
      supabase.from('crm_prescriptions').select('*').eq('customer_id', customer.id).order('prescription_date', { ascending: false }),
    ])
    setCustomerPurchases(purch || [])
    setCustomerRx(rx || [])
    setTab('detail')
  }

  // ── Add customer ────────────────────────────────────────────
  const [newCustomer, setNewCustomer] = useState({ name: '', name_bn: '', age: '', gender: 'unknown', phone: '', address: '', doctor_name: '', blood_group: '', notes: '' })

  const saveCustomer = async () => {
    if (!newCustomer.name) return toast.error('নাম দিন')
    const { error } = await supabase.from('crm_customers').insert({
      user_id: userId, agent_id: agentId, business_type: businessType,
      name: newCustomer.name, name_bn: newCustomer.name_bn || null,
      age: newCustomer.age ? parseInt(newCustomer.age) : null,
      gender: newCustomer.gender, phone: newCustomer.phone || null,
      address: newCustomer.address || null,
      doctor_name: newCustomer.doctor_name || null,
      blood_group: newCustomer.blood_group || null,
      notes: newCustomer.notes || null,
    })
    if (error) return toast.error('সেভ করতে সমস্যা')
    toast.success('Customer যোগ করা হয়েছে!')
    setNewCustomer({ name: '', name_bn: '', age: '', gender: 'unknown', phone: '', address: '', doctor_name: '', blood_group: '', notes: '' })
    fetchCustomers()
    setTab('customers')
  }

  // ── Add purchase ────────────────────────────────────────────
  const [newPurch, setNewPurch] = useState({ item_name: '', item_category: '', quantity: '1', unit: units[0], unit_price: '', paid_amount: '', notes: '', purchase_date: new Date().toISOString().split('T')[0] })

  const savePurchase = async () => {
    if (!newPurch.item_name || !newPurch.unit_price) return toast.error('ওষুধের নাম ও মূল্য দিন')
    if (!selectedCustomer) return
    const total = parseFloat(newPurch.quantity) * parseFloat(newPurch.unit_price)
    const paid = parseFloat(newPurch.paid_amount || '0')
    const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending'
    const { error } = await supabase.from('crm_purchases').insert({
      user_id: userId, customer_id: selectedCustomer.id,
      purchase_date: newPurch.purchase_date,
      item_name: newPurch.item_name,
      item_category: newPurch.item_category || null,
      quantity: parseFloat(newPurch.quantity),
      unit: newPurch.unit,
      unit_price: parseFloat(newPurch.unit_price),
      paid_amount: paid,
      payment_status: status,
      notes: newPurch.notes || null,
      source: 'manual',
    })
    if (error) return toast.error('সেভ করতে সমস্যা')
    toast.success('Purchase যোগ করা হয়েছে!')
    setNewPurch({ item_name: '', item_category: '', quantity: '1', unit: units[0], unit_price: '', paid_amount: '', notes: '', purchase_date: new Date().toISOString().split('T')[0] })
    setShowAddPurchase(false)
    loadCustomerDetail(selectedCustomer)
  }

  // ── Add prescription ────────────────────────────────────────
  const [newRx, setNewRx] = useState({ prescription_date: new Date().toISOString().split('T')[0], doctor_name: '', hospital_clinic: '', diagnosis: '', medicines_text: '', notes: '' })

  const saveRx = async () => {
    if (!selectedCustomer) return
    const meds = newRx.medicines_text.split('\n').filter(Boolean).map(line => {
      const parts = line.split(',')
      return { name: parts[0]?.trim(), dosage: parts[1]?.trim(), duration: parts[2]?.trim() }
    })
    const { error } = await supabase.from('crm_prescriptions').insert({
      user_id: userId, customer_id: selectedCustomer.id,
      prescription_date: newRx.prescription_date,
      doctor_name: newRx.doctor_name || null,
      hospital_clinic: newRx.hospital_clinic || null,
      diagnosis: newRx.diagnosis || null,
      medicines: meds,
      notes: newRx.notes || null,
    })
    if (error) return toast.error('সেভ করতে সমস্যা')
    toast.success('Prescription যোগ করা হয়েছে!')
    setNewRx({ prescription_date: new Date().toISOString().split('T')[0], doctor_name: '', hospital_clinic: '', diagnosis: '', medicines_text: '', notes: '' })
    setShowAddRx(false)
    loadCustomerDetail(selectedCustomer)
  }

  // ── Voice input ─────────────────────────────────────────────
  const startVoice = useCallback((onResult: (text: string) => void) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return toast.error('Voice input support নেই')
    const r = new SR()
    recognitionRef.current = r
    r.lang = 'bn-IN'
    r.interimResults = false
    r.onstart = () => setIsListening(true)
    r.onend = () => setIsListening(false)
    r.onerror = () => { setIsListening(false); toast.error('Voice input error') }
    r.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      onResult(text)
    }
    r.start()
  }, [])

  const stopVoice = () => { recognitionRef.current?.stop(); setIsListening(false) }

  // Parse voice into purchase fields
  const handleVoiceForPurchase = () => {
    startVoice((text) => {
      // Simple parse: "Paracetamol ২টি strip ১৫ টাকা"
      setNewPurch(p => ({ ...p, item_name: text }))
      toast.success(`বললেন: "${text}"`)
    })
  }

  // ── Photo import ─────────────────────────────────────────────
  const handlePhotoImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setTab('import')
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = (ev.target?.result as string).split(',')[1]
        const mimeType = file.type
        const res = await fetch('/api/crm-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, businessType, mimeType }),
        })
        const data = await res.json()
        if (data.success) {
          setImportPreview(data.data)
          toast.success(`${data.data.customers?.length || 0}টি customer পাওয়া গেছে!`)
        } else {
          toast.error('খাতা পড়তে সমস্যা হয়েছে')
        }
        setImporting(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setImporting(false)
      toast.error('Photo import করতে সমস্যা')
    }
  }

  const confirmImport = async () => {
    if (!importPreview?.customers) return
    let imported = 0
    for (const c of importPreview.customers) {
      const { data: newCust } = await supabase.from('crm_customers').insert({
        user_id: userId, agent_id: agentId, business_type: businessType,
        name: c.name || 'Unknown', phone: c.phone || null, address: c.address || null,
      }).select().single()

      if (newCust && c.transactions) {
        for (const t of c.transactions) {
          if (!t.item_name) continue
          await supabase.from('crm_purchases').insert({
            user_id: userId, customer_id: newCust.id,
            purchase_date: new Date().toISOString().split('T')[0],
            item_name: t.item_name,
            quantity: t.quantity || 1,
            unit: units[0],
            unit_price: t.unit_price || 0,
            paid_amount: t.paid_amount || 0,
            payment_status: (t.paid_amount >= t.total_amount) ? 'paid' : 'pending',
            source: 'photo',
          })
        }
      }
      imported++
    }
    toast.success(`${imported}টি customer import হয়েছে!`)
    setImportPreview(null)
    fetchCustomers()
    setTab('customers')
  }

  // ── Summary stats ────────────────────────────────────────────
  const totalCustomers = customers.length
  const totalDue = allPurchases.reduce((s, p) => s + Number(p.due_amount || 0), 0)
  const totalRevenue = allPurchases.reduce((s, p) => s + Number(p.total_amount || 0), 0)

  // Per-customer purchase aggregates — same "active in last 30 days /
  // new in last 7 days" convention already used by CustomerBillingTable,
  // kept identical here so "active"/"new" mean the same thing everywhere
  // in the app.
  const ACTIVE_WINDOW_DAYS = 30
  const NEW_WINDOW_DAYS = 7
  const isRecentDate = (d: string | null | undefined, days: number) =>
    !!d && (Date.now() - new Date(d).getTime()) / 86400000 <= days

  const purchasesByCustomer: Record<string, Purchase[]> = {}
  for (const p of allPurchases) {
    if (!purchasesByCustomer[p.customer_id]) purchasesByCustomer[p.customer_id] = []
    purchasesByCustomer[p.customer_id].push(p)
  }
  const customerStats: Record<string, { count: number; spent: number; due: number; lastDate: string | null }> = {}
  for (const c of customers) {
    const list = purchasesByCustomer[c.id] || []
    const spent = list.reduce((s, p) => s + Number(p.total_amount || 0), 0)
    const due = list.reduce((s, p) => s + Number(p.due_amount || 0), 0)
    const lastDate = list.length
      ? list.reduce((max, p) => (p.purchase_date > max ? p.purchase_date : max), list[0].purchase_date)
      : null
    customerStats[c.id] = { count: list.length, spent, due, lastDate }
  }

  let activeCount = 0, dueCount = 0, freshCount = 0
  for (const c of customers) {
    const s = customerStats[c.id]
    if (isRecentDate(s.lastDate, ACTIVE_WINDOW_DAYS)) activeCount++
    if (s.due > 0) dueCount++
    if (isRecentDate(c.created_at, NEW_WINDOW_DAYS)) freshCount++
  }
  const overallStats = {
    total: totalCustomers, active: activeCount, inactive: totalCustomers - activeCount,
    due: dueCount, dueTotal: totalDue, fresh: freshCount,
  }

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone?.includes(search)) ||
      (c.name_bn?.includes(search))
    if (!matchesSearch) return false
    const s = customerStats[c.id]
    const active = isRecentDate(s.lastDate, ACTIVE_WINDOW_DAYS)
    if (statusFilter === 'active') return active
    if (statusFilter === 'inactive') return !active
    if (statusFilter === 'due') return s.due > 0
    if (statusFilter === 'new') return isRecentDate(c.created_at, NEW_WINDOW_DAYS)
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const pagedCustomers = filteredCustomers.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)
  useEffect(() => { setPage(1) }, [search, statusFilter])

  // ── UI ───────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-gray-800 bengali">{BUSINESS_LABELS[businessType] || 'CRM'}</span>
        <div className="flex-1" />
        <button onClick={() => exportAllCustomers(customers, allPurchases)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
          <Download size={13} /> {tr('Excel ডাউনলোড')}
        </button>
        <button onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
          <Camera size={13} /> {tr('খাতার ছবি')}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoImport} />
        <button onClick={() => { setTab('add_customer'); setSelectedCustomer(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus size={13} /> {tr('নতুন Customer')}
        </button>
      </div>

      {/* Stat cards — real counts/amounts computed from crm_customers +
          crm_purchases above, same convention as the কাস্টমার page. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0"><Users size={17}/></div>
          <div className="min-w-0">
            <div className="font-extrabold text-gray-900 leading-none">{overallStats.total}</div>
            <div className="text-[10.5px] text-gray-500 bengali mt-1">{tr('মোট কাস্টমার')}</div>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"><UserCheck size={17}/></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-gray-900 leading-none">{overallStats.active}</span>
              {overallStats.total > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">{Math.round(overallStats.active / overallStats.total * 100)}%</span>
              )}
            </div>
            <div className="text-[10.5px] text-gray-500 bengali mt-1">{tr('সক্রিয় কাস্টমার')}</div>
          </div>
        </div>
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center flex-shrink-0"><IndianRupee size={17}/></div>
          <div className="min-w-0">
            <div className="font-extrabold text-gray-900 leading-none">₹{overallStats.dueTotal.toLocaleString()}</div>
            <div className="text-[10.5px] text-gray-500 bengali mt-1">{tr('বাকি আছে ·')} {overallStats.due} {tr('জন')}</div>
          </div>
        </div>
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500 text-white flex items-center justify-center flex-shrink-0"><UserPlus2 size={17}/></div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-gray-900 leading-none">{overallStats.fresh}</span>
              {overallStats.total > 0 && (
                <span className="text-[10px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">{Math.round(overallStats.fresh / overallStats.total * 100)}%</span>
              )}
            </div>
            <div className="text-[10.5px] text-gray-500 bengali mt-1">{tr('গত ৭ দিনে নতুন')}</div>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      {tab === 'customers' && (
        <div className="flex flex-wrap gap-2">
          {([
            ['all', `সব কাস্টমার (${overallStats.total})`],
            ['active', `সক্রিয় (${overallStats.active})`],
            ['due', `বাকি আছে (${overallStats.due})`],
            ['new', `নতুন (${overallStats.fresh})`],
            ['inactive', `Inactive (${overallStats.inactive})`],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold bengali transition-colors ${statusFilter === key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {/* ── CUSTOMERS LIST ──────────────────────────────────── */}
      {tab === 'customers' && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tr('নাম বা phone দিয়ে খুঁজুন...')}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 bengali" />
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center text-gray-400 bengali text-sm">{tr('লোড হচ্ছে...')}</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-gray-400 bengali text-sm">{tr('কোনো customer নেই। উপরে "নতুন Customer" বাটনে click করুন।')}</p>
            </div>
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] uppercase bengali">
                    <th className="px-4 py-3 font-semibold">{tr('কাস্টমারের নাম')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('মোবাইল')}</th>
                    <th className="px-4 py-3 font-semibold">{tr('ঠিকানা')}</th>
                    <th className="px-4 py-3 font-semibold whitespace-nowrap">{tr('শেষ লেনদেন')}</th>
                    <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">{tr('মোট কেনাকাটা')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{tr('বাকি')}</th>
                    <th className="px-4 py-3 font-semibold text-center">{tr('স্ট্যাটাস')}</th>
                    <th className="px-4 py-3 font-semibold text-center">{tr('অ্যাকশন')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCustomers.map(c => {
                    const s = customerStats[c.id]
                    const active = isRecentDate(s.lastDate, ACTIVE_WINDOW_DAYS)
                    return (
                      <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-3 whitespace-nowrap cursor-pointer" onClick={() => loadCustomerDetail(c)}>
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                              {c.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-gray-900 bengali">{c.name}</div>
                              {c.name_bn && <div className="text-[10.5px] text-gray-400 bengali">{c.name_bn}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{c.phone || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 bengali max-w-[160px] truncate">{c.address || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {s.lastDate ? new Date(s.lastDate).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="font-bold text-gray-900">₹{s.spent.toLocaleString()}</div>
                          <div className="text-[10.5px] text-gray-400 bengali">{s.count} {tr('বার')}</div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`font-bold ${s.due > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{s.due.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {s.due > 0 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[10.5px] font-bold bengali">{tr('বাকি আছে')}</span>
                          ) : active ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10.5px] font-bold bengali">{tr('সক্রিয়')}</span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-400 text-[10.5px] font-bold bengali">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {c.phone && (
                              <>
                                <a href={`tel:${c.phone}`} title={tr('কল করুন')} onClick={e => e.stopPropagation()}
                                  className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center flex-shrink-0">
                                  <PhoneCall size={13} />
                                </a>
                                <a href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title={tr('WhatsApp-এ মেসেজ করুন')} onClick={e => e.stopPropagation()}
                                  className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 inline-flex items-center justify-center flex-shrink-0">
                                  <MessageCircle size={13} />
                                </a>
                              </>
                            )}
                            <button onClick={() => loadCustomerDetail(c)} title={tr('বিস্তারিত দেখুন')}
                              className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center flex-shrink-0">
                              <FileText size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-[12px] text-gray-400 bengali">{tr('মোট')} {filteredCustomers.length} {tr('জন কাস্টমার')}</span>
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
            </>
          )}
        </div>
      )}

      {/* ── ADD CUSTOMER ────────────────────────────────────── */}
      {tab === 'add_customer' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 bengali">{tr('নতুন Customer যোগ করুন')}</h3>
            <button onClick={() => setTab('customers')} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('নাম (ইংরেজিতে) *')}</label>
              <input value={newCustomer.name} onChange={e => setNewCustomer(p => ({ ...p, name: e.target.value }))}
                placeholder="Ramaprasad Mondal" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('নাম (বাংলায়)')}</label>
              <input value={newCustomer.name_bn} onChange={e => setNewCustomer(p => ({ ...p, name_bn: e.target.value }))}
                placeholder={tr('রামপ্রসাদ মণ্ডল')} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">Phone</label>
              <div className="flex gap-2">
                <input value={newCustomer.phone} onChange={e => setNewCustomer(p => ({ ...p, phone: e.target.value }))}
                  placeholder="9876543210" className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
                <button onClick={() => startVoice(t => setNewCustomer(p => ({ ...p, phone: t })))}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('বয়স')}</label>
              <input type="number" value={newCustomer.age} onChange={e => setNewCustomer(p => ({ ...p, age: e.target.value }))}
                placeholder="35" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('ঠিকানা')}</label>
              <input value={newCustomer.address} onChange={e => setNewCustomer(p => ({ ...p, address: e.target.value }))}
                placeholder={tr('গ্রাম/পাড়া, থানা, জেলা')} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bengali" />
            </div>
            {businessType === 'pharmacy' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('ডাক্তারের নাম')}</label>
                  <input value={newCustomer.doctor_name} onChange={e => setNewCustomer(p => ({ ...p, doctor_name: e.target.value }))}
                    placeholder="Dr. Amit Kumar" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">Blood Group</label>
                  <select value={newCustomer.blood_group} onChange={e => setNewCustomer(p => ({ ...p, blood_group: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400">
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg}>{bg}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('নোট')}</label>
              <textarea value={newCustomer.notes} onChange={e => setNewCustomer(p => ({ ...p, notes: e.target.value }))}
                placeholder={tr('যেকোনো বিশেষ তথ্য...')} rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none bengali" />
            </div>
          </div>
          <button onClick={saveCustomer} className="mt-5 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm bengali transition-colors">
            {tr('Customer সেভ করুন')}
          </button>
        </div>
      )}

      {/* ── CUSTOMER DETAIL ─────────────────────────────────── */}
      {tab === 'detail' && selectedCustomer && (
        <div className="space-y-4">
          {/* Back + Actions */}
          <div className="flex items-center gap-3">
            <button onClick={() => setTab('customers')} className="text-gray-500 hover:text-gray-800 text-sm flex items-center gap-1">
              {tr('← ফিরুন')}
            </button>
            <div className="flex-1" />
            <button onClick={() => exportToExcel(selectedCustomer, customerPurchases, customerRx)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
              <Download size={13} /> Excel
            </button>
          </div>

          {/* Customer card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h2 className="font-bold text-gray-900 text-lg bengali">{selectedCustomer.name}</h2>
                {selectedCustomer.name_bn && <p className="text-indigo-600 text-sm bengali">{selectedCustomer.name_bn}</p>}
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                  {selectedCustomer.phone && <span className="flex items-center gap-1"><Phone size={11} />{selectedCustomer.phone}</span>}
                  {selectedCustomer.age && <span className="flex items-center gap-1"><User size={11} />{tr('বয়স:')} {selectedCustomer.age}</span>}
                  {selectedCustomer.address && <span className="flex items-center gap-1"><MapPin size={11} />{selectedCustomer.address}</span>}
                  {selectedCustomer.doctor_name && <span className="flex items-center gap-1"><FileText size={11} />Dr. {selectedCustomer.doctor_name}</span>}
                  {selectedCustomer.blood_group && <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-semibold">{selectedCustomer.blood_group}</span>}
                </div>
              </div>
            </div>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: 'মোট কেনা', value: `₹${customerPurchases.reduce((s,p)=>s+Number(p.total_amount),0).toLocaleString()}`, color: 'text-emerald-600' },
                { label: 'পরিশোধ', value: `₹${customerPurchases.reduce((s,p)=>s+Number(p.paid_amount),0).toLocaleString()}`, color: 'text-blue-600' },
                { label: 'বাকি', value: `₹${customerPurchases.reduce((s,p)=>s+Number(p.due_amount||0),0).toLocaleString()}`, color: 'text-red-600' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className={`text-lg font-extrabold ${s.color} bengali`}>{s.value}</div>
                  <div className="text-xs text-gray-400 bengali">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Purchase history */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 bengali text-sm">Purchase History ({customerPurchases.length})</h3>
              <div className="flex gap-2">
                <button onClick={() => setIsListening(l => { if (!l) handleVoiceForPurchase(); else stopVoice(); return !l })}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                </button>
                <button onClick={() => setShowAddPurchase(s => !s)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  <Plus size={12} /> Purchase
                </button>
              </div>
            </div>

            {/* Add purchase form */}
            {showAddPurchase && (
              <div className="p-5 border-b border-gray-100 bg-indigo-50">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('ওষুধ/পণ্যের নাম *')}</label>
                    <div className="flex gap-1">
                      <input value={newPurch.item_name} onChange={e => setNewPurch(p => ({ ...p, item_name: e.target.value }))}
                        placeholder="Paracetamol 500mg" className="flex-1 border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" />
                      <button onClick={handleVoiceForPurchase} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isListening ? 'bg-red-500 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                        <Mic size={12} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Quantity</label>
                    <input type="number" value={newPurch.quantity} onChange={e => setNewPurch(p => ({ ...p, quantity: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Unit</label>
                    <select value={newPurch.unit} onChange={e => setNewPurch(p => ({ ...p, unit: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400">
                      {units.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Unit Price (₹)</label>
                    <input type="number" value={newPurch.unit_price} onChange={e => setNewPurch(p => ({ ...p, unit_price: e.target.value }))}
                      placeholder="15" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">Paid (₹)</label>
                    <input type="number" value={newPurch.paid_amount} onChange={e => setNewPurch(p => ({ ...p, paid_amount: e.target.value }))}
                      placeholder="0" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">Total</label>
                    <div className="border border-indigo-300 rounded-lg px-2.5 py-2 text-xs font-bold text-indigo-700 bg-white">
                      ₹{((parseFloat(newPurch.quantity||'0') * parseFloat(newPurch.unit_price||'0'))).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('তারিখ')}</label>
                    <input type="date" value={newPurch.purchase_date} onChange={e => setNewPurch(p => ({ ...p, purchase_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-indigo-400" />
                  </div>
                  <div className="col-span-2 sm:col-span-3 flex gap-2 justify-end">
                    <button onClick={() => setShowAddPurchase(false)} className="px-4 py-2 text-xs border border-gray-200 rounded-lg bengali">{tr('বাতিল')}</button>
                    <button onClick={savePurchase} className="px-4 py-2 text-xs bg-indigo-600 text-white font-bold rounded-lg bengali hover:bg-indigo-700">{tr('সেভ করুন')}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Purchase list */}
            {customerPurchases.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs bengali">{tr('কোনো purchase নেই')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {['তারিখ', 'ওষুধ/পণ্য', 'Qty', 'Rate', 'Total', 'Paid', 'বাকি', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 bengali">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customerPurchases.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{p.purchase_date}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{p.item_name}</td>
                        <td className="px-3 py-2 text-gray-600">{p.quantity} {p.unit}</td>
                        <td className="px-3 py-2 text-gray-600">₹{Number(p.unit_price).toLocaleString()}</td>
                        <td className="px-3 py-2 font-bold text-gray-800">₹{Number(p.total_amount).toLocaleString()}</td>
                        <td className="px-3 py-2 text-emerald-600">₹{Number(p.paid_amount).toLocaleString()}</td>
                        <td className="px-3 py-2 text-red-500 font-bold">₹{Number(p.due_amount||0).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700' : p.payment_status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                            {p.payment_status === 'paid' ? '✓ paid' : p.payment_status === 'partial' ? 'partial' : tr('বাকি')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Prescriptions — pharmacy only */}
          {businessType === 'pharmacy' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-sm bengali">Prescriptions ({customerRx.length})</h3>
                <button onClick={() => setShowAddRx(s => !s)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                  <Plus size={12} /> Prescription
                </button>
              </div>

              {showAddRx && (
                <div className="p-5 border-b border-gray-100 bg-emerald-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Doctor Name</label>
                      <input value={newRx.doctor_name} onChange={e => setNewRx(p => ({ ...p, doctor_name: e.target.value }))}
                        placeholder="Dr. Amit Kumar" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block">Hospital/Clinic</label>
                      <input value={newRx.hospital_clinic} onChange={e => setNewRx(p => ({ ...p, hospital_clinic: e.target.value }))}
                        placeholder="Apollo Hospital" className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">Diagnosis</label>
                      <input value={newRx.diagnosis} onChange={e => setNewRx(p => ({ ...p, diagnosis: e.target.value }))}
                        placeholder="Fever, Diabetes..." className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('তারিখ')}</label>
                      <input type="date" value={newRx.prescription_date} onChange={e => setNewRx(p => ({ ...p, prescription_date: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-gray-700 mb-1 block bengali">{tr('ওষুধের তালিকা (প্রতি লাইনে: নাম, dose, duration)')}</label>
                      <textarea value={newRx.medicines_text} onChange={e => setNewRx(p => ({ ...p, medicines_text: e.target.value }))}
                        placeholder={"Paracetamol 500mg, 3 times daily, 5 days\nAmoxicillin 250mg, twice daily, 7 days"}
                        rows={3} className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none resize-none" />
                    </div>
                    <div className="sm:col-span-2 flex gap-2 justify-end">
                      <button onClick={() => setShowAddRx(false)} className="px-4 py-2 text-xs border border-gray-200 rounded-lg">{tr('বাতিল')}</button>
                      <button onClick={saveRx} className="px-4 py-2 text-xs bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700">{tr('সেভ করুন')}</button>
                    </div>
                  </div>
                </div>
              )}

              {customerRx.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-xs bengali">{tr('কোনো prescription নেই')}</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {customerRx.map(rx => (
                    <div key={rx.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-semibold text-gray-800">Dr. {rx.doctor_name || 'Unknown'}</div>
                        <div className="text-xs text-gray-400">{rx.prescription_date}</div>
                      </div>
                      {rx.hospital_clinic && <div className="text-xs text-gray-500 mb-1">{rx.hospital_clinic}</div>}
                      {rx.diagnosis && <div className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block mb-2">{rx.diagnosis}</div>}
                      {rx.medicines?.length > 0 && (
                        <div className="space-y-1">
                          {rx.medicines.map((m: any, i: number) => (
                            <div key={i} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded-lg">
                              💊 {m.name} {m.dosage && `— ${m.dosage}`} {m.duration && `(${m.duration})`}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PHOTO IMPORT ─────────────────────────────────────── */}
      {tab === 'import' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 bengali">{tr('খাতার ছবি থেকে data import')}</h3>
            <button onClick={() => { setTab('customers'); setImportPreview(null) }} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          {importing && (
            <div className="text-center py-10">
              <Loader2 size={32} className="animate-spin text-indigo-600 mx-auto mb-3" />
              <p className="text-gray-600 bengali">{tr('AI খাতা পড়ছে...')}</p>
              <p className="text-gray-400 text-xs bengali mt-1">{tr('এটি ৩০ সেকেন্ড পর্যন্ত সময় লাগতে পারে')}</p>
            </div>
          )}

          {importPreview && !importing && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${importPreview.confidence === 'high' ? 'bg-emerald-500' : importPreview.confidence === 'medium' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-500">AI confidence: {importPreview.confidence}</span>
                <span className="text-xs text-gray-400">· {importPreview.customers?.length || 0} {tr('customers পাওয়া গেছে')}</span>
              </div>

              {importPreview.parse_error && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <div className="flex gap-2 items-start">
                    <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-800 bengali">{tr('AI পুরোপুরি পড়তে পারেনি')}</p>
                      <p className="text-xs text-amber-700 mt-1 bengali">{tr('Raw text দেখুন এবং manually enter করুন।')}</p>
                    </div>
                  </div>
                  {importPreview.raw_text && (
                    <pre className="text-xs text-gray-600 mt-3 bg-white p-3 rounded-lg overflow-auto max-h-40 whitespace-pre-wrap">{importPreview.raw_text}</pre>
                  )}
                </div>
              )}

              {importPreview.customers?.length > 0 && (
                <div className="space-y-3 mb-5 max-h-80 overflow-y-auto">
                  {importPreview.customers.map((c: any, i: number) => (
                    <div key={i} className="border border-gray-200 rounded-xl p-4">
                      <div className="font-semibold text-gray-900 text-sm bengali">{c.name}</div>
                      {c.phone && <div className="text-xs text-gray-500">{c.phone}</div>}
                      {c.transactions?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {c.transactions.slice(0, 3).map((t: any, j: number) => (
                            <div key={j} className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                              {t.item_name} — ₹{t.total_amount || 0}
                            </div>
                          ))}
                          {c.transactions.length > 3 && <div className="text-xs text-gray-400">+{c.transactions.length - 3} {tr('আরো...')}</div>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { setImportPreview(null); setTab('customers') }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 bengali hover:bg-gray-50">
                  {tr('বাতিল করুন')}
                </button>
                {importPreview.customers?.length > 0 && (
                  <button onClick={confirmImport}
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold bengali hover:bg-indigo-700 flex items-center justify-center gap-2">
                    <Check size={16} /> {tr('Import করুন')}
                  </button>
                )}
              </div>
            </div>
          )}

          {!importing && !importPreview && (
            <div className="text-center py-10">
              <Camera size={40} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 bengali text-sm">{tr('খাতার ছবি তুলুন')}</p>
              <p className="text-gray-400 text-xs bengali mt-1">{tr('AI স্বয়ংক্রিয়ভাবে customer ও transaction data extract করবে')}</p>
              <button onClick={() => fileRef.current?.click()}
                className="mt-4 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm bengali">
                {tr('ছবি বেছে নিন')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
