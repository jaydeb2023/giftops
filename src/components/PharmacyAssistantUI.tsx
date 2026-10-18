'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from "@/lib/supabaseClient"
import {
  AlertTriangle, Package, Plus, Printer, Trash2, Search,
  TrendingUp, DollarSign, Clock, FileText, Phone, User,
  Download, Check, X, RefreshCw, Send, Mic, MicOff,
  Camera, ChevronDown, ChevronUp, Globe, ShoppingBag,
  Stethoscope, Truck, BarChart2, BookOpen, Edit2,
  Save, Share2, MessageCircle, IndianRupee, Calendar,
  Heart, Loader2, CheckCircle, XCircle, Bell, Settings, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCustomCategories } from '@/lib/useCustomCategories'
import { LIBRARY_AGENT_IDS } from '@/lib/libraryAgentIds'

// ─── Types ────────────────────────────────────────────────────────
interface Medicine {
  id: string
  user_id?: string
  name: string
  generic: string
  category: string
  stock: number
  unit: string
  expiry: string
  mrp: number
  cost_price: number
  min_stock: number
  supplier: string
  rack: string
  prescription_required: boolean
}

interface Patient {
  id: string
  user_id?: string
  name: string
  age: number
  gender: string
  phone: string
  guardian_name: string
  address: string
  doctor_name: string
  blood_group: string
  notes: string
  total_due?: number
}

interface Purchase {
  id: string
  user_id?: string
  customer_id: string
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
  customer_name?: string
}

interface HalkhataEntry {
  patient: Patient
  purchases: Purchase[]
  total_due: number
  last_purchase: string
}

interface PharmacySettings {
  pharmacy_name: string
  owner_name: string
  phone: string
  address: string
  license_no: string
  gstin: string
  upi_id: string
  print_footer: string
}

// ─── Helpers ──────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9) }
function today() { return new Date().toISOString().slice(0, 10) }
function monthYear() { return new Date().toISOString().slice(0, 7) }

function expiryStatus(expiry: string) {
  const now = new Date()
  const exp = new Date(expiry + '-01')
  const diffDays = (exp.getTime() - now.getTime()) / 86400000
  if (diffDays < 0) return 'expired'
  if (diffDays < 30) return 'critical'
  if (diffDays < 90) return 'warning'
  return 'ok'
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

function fmtAmt(n: number) { return `₹${Number(n || 0).toFixed(0)}` }

// ─── Voice Hook ────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = ['সব', 'Analgesic', 'Antibiotic', 'Cardiac', 'Diabetes', 'GI', 'Antihistamine', 'Electrolyte', 'Vitamin', 'Skin', 'Other']
const UNITS = ['strip', 'tablet', 'capsule', 'bottle', 'tube', 'injection', 'pcs', 'sachet', 'vial', 'kg', 'ml']
// ─── Voice Hook ─────────────────────────────────────────────────
declare global { interface Window { SpeechRecognition: any; webkitSpeechRecognition: any } }
function usePharmVoice(onFinalResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(true)
  const [lang, setLang] = useState<'bn-IN' | 'en-IN'>('bn-IN')
  const [interim, setInterim] = useState('')
  const ref = useRef<any>(null)
  const finalRef = useRef('')
  useEffect(() => { if (!window.SpeechRecognition && !window.webkitSpeechRecognition) setSupported(false) }, [])
  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { toast.error('Browser voice support নেই'); return }
    if (ref.current) ref.current.stop()
    finalRef.current = ''
    setInterim('')
    const r = new SR()
    ref.current = r
    r.lang = lang; r.interimResults = true; r.continuous = false
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
  }, [lang, onFinalResult])
  const stop = useCallback(() => { ref.current?.stop(); setListening(false); setInterim('') }, [])
  useEffect(() => () => ref.current?.abort(), [])
  return { listening, supported, lang, setLang, start, stop, interim }
}

// ══════════════════════════════════════════════════════════════════
export default function PharmacyAssistantUI({ userId: propUserId }: { userId?: string }) {
  // using shared supabase singleton from lib
  const [userId, setUserId] = useState<string | null>(propUserId || null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('stock')
  const [pharmacySettings, setPharmacySettings] = useState<PharmacySettings>({
    pharmacy_name: '', owner_name: '', phone: '', address: '',
    license_no: '', gstin: '', upi_id: '', print_footer: 'ধন্যবাদ 🙏'
  })

  // ── Data state ────────────────────────────────────────────────
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [halkhataData, setHalkhataData] = useState<HalkhataEntry[]>([])

  // ── Stock tab ─────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState('')
  const [catFilter, setCatFilter] = useState('সব')
  const { categories: CATEGORIES, addCategory } = useCustomCategories(userId || undefined, 'pharmacy', DEFAULT_CATEGORIES)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showAddMed, setShowAddMed] = useState(false)
  const [editMed, setEditMed] = useState<Medicine | null>(null)
  const [newMed, setNewMed] = useState<Partial<Medicine>>({ unit: 'strip', category: 'Analgesic', prescription_required: false, stock: 0, min_stock: 20 })
  const [savingMed, setSavingMed] = useState(false)

  // ── Billing tab ───────────────────────────────────────────────
  const [showNewSale, setShowNewSale] = useState(false)
  const [salePatient, setSalePatient] = useState<Patient | null>(null)
  const [salePatientSearch, setSalePatientSearch] = useState('')
  const [saleItems, setSaleItems] = useState<{ name: string; qty: number; mrp: number; discount: number }[]>([{ name: '', qty: 1, mrp: 0, discount: 0 }])
  const [salePaid, setSalePaid] = useState(0)
  const [saleDoctor, setSaleDoctor] = useState('')
  const [savingSale, setSavingSale] = useState(false)
  const [recentSales, setRecentSales] = useState<Purchase[]>([])

  // ── Patient tab ───────────────────────────────────────────────
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [newPatient, setNewPatient] = useState<Partial<Patient>>({ gender: 'পুরুষ', blood_group: 'জানা নেই' })
  const [savingPatient, setSavingPatient] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientPurchases, setPatientPurchases] = useState<Purchase[]>([])

  // ── হালখাতা tab ───────────────────────────────────────────────
  const [halkhataSearch, setHalkhataSearch] = useState('')
  const [selectedHalkhata, setSelectedHalkhata] = useState<HalkhataEntry | null>(null)
  const [showCardPreview, setShowCardPreview] = useState(false)

  // ── Payment modal ─────────────────────────────────────────────
  const [payingPurchase, setPayingPurchase] = useState<Purchase | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [savingPayment, setSavingPayment] = useState(false)

  // ── Voice for stock input ─────────────────────────────────────
  const [voiceMedField, setVoiceMedField] = useState<string | null>(null)
  const pharmVoiceFinalRef = useRef('')
  const pharmVoice = usePharmVoice((text: string) => {
    if (voiceMedField) {
      setNewMed(p => ({ ...p, [voiceMedField]: text }))
      setVoiceMedField(null)
    }
  })

  const loadMedicines = async (uid: string) => {
    const { data } = await supabase.from('pharmacy_medicines').select('*').eq('user_id', uid).order('name')
    if (data) setMedicines(data)
  }

  const loadPatients = async (uid: string) => {
    const { data: customers } = await supabase.from('crm_customers').select('*').eq('user_id', uid).eq('business_type', 'pharmacy').order('name')
    if (!customers) return
    const { data: purchasesData } = await supabase.from('crm_purchases').select('customer_id, due_amount, paid_amount, total_amount, purchase_date, item_name, unit_price, quantity, payment_status, unit, notes, id').eq('user_id', uid).neq('payment_status', 'paid')
    const dueMap: Record<string, number> = {}
    if (purchasesData) purchasesData.forEach((p: any) => { dueMap[p.customer_id] = (dueMap[p.customer_id] || 0) + Number(p.due_amount || 0) })
    const patientsWithDue = customers.map((c: any) => ({ id: c.id, user_id: c.user_id, name: c.name, age: c.age || 0, gender: c.gender || 'অজানা', phone: c.phone || '', guardian_name: c.guardian_name || '', address: c.address || '', doctor_name: c.doctor_name || '', blood_group: c.blood_group || 'জানা নেই', notes: c.notes || '', total_due: dueMap[c.id] || 0 }))
    setPatients(patientsWithDue)
    buildHalkhata(patientsWithDue, purchasesData || [])
  }

  const loadRecentPurchases = async (uid: string) => {
    const { data } = await supabase.from('crm_purchases').select('*, crm_customers(name, phone)').eq('user_id', uid).order('purchase_date', { ascending: false }).limit(50)
    if (data) { const mapped = data.map((p: any) => ({ ...p, customer_name: p.crm_customers?.name || '' })); setRecentSales(mapped); setPurchases(mapped) }
  }

  const loadPharmacySettings = async (uid: string) => {
    const { data } = await supabase.from('pharmacy_profiles').select('*').eq('user_id', uid).single()
    if (data) setPharmacySettings({
      pharmacy_name: data.business_name || data.pharmacy_name || '',
      owner_name: data.owner_name || '',
      phone: data.phone || '',
      address: data.address || '',
      license_no: data.license_no || '',
      gstin: data.gstin || '',
      upi_id: data.upi_id || '',
      print_footer: data.print_footer || 'ধন্যবাদ 🙏',
    })
  }

  // ── Auth & initial load (after all load functions are defined) ──
  useEffect(() => {
    const init = async () => {
      const uid = propUserId || (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)
      await Promise.all([loadMedicines(uid), loadPatients(uid), loadRecentPurchases(uid), loadPharmacySettings(uid)])
      setLoading(false)
    }
    init()
  }, [propUserId])

  // ── Expose reload for chat panel sync ─────────────────────────
// ── Expose reload for chat panel sync ─────────────────────────
  useEffect(() => {
    if (!userId) return
    const reloadAll = async () => {
      // Direct DB queries — no stale closure issue
      const { data: customers } = await supabase
        .from('crm_customers').select('*')
        .eq('user_id', userId).eq('business_type', 'pharmacy').order('name')
      if (customers) {
        const { data: purchasesData } = await supabase
          .from('crm_purchases')
          .select('customer_id, due_amount, paid_amount, total_amount, purchase_date, item_name, unit_price, quantity, payment_status, unit, notes, id')
          .eq('user_id', userId).neq('payment_status', 'paid')
        const dueMap: Record<string, number> = {}
        if (purchasesData) purchasesData.forEach((p: any) => {
          dueMap[p.customer_id] = (dueMap[p.customer_id] || 0) + Number(p.due_amount || 0)
        })
        const patientsWithDue = customers.map((c: any) => ({
          id: c.id, user_id: c.user_id, name: c.name, age: c.age || 0,
          gender: c.gender || 'অজানা', phone: c.phone || '', guardian_name: c.guardian_name || '', address: c.address || '',
          doctor_name: c.doctor_name || '', blood_group: c.blood_group || 'জানা নেই',
          notes: c.notes || '', total_due: dueMap[c.id] || 0
        }))
        setPatients(patientsWithDue)
        // rebuild halkhata
        const entries: HalkhataEntry[] = []
        patientsWithDue.forEach(p => {
          const pp = (purchasesData || []).filter((pu: any) => pu.customer_id === p.id && Number(pu.due_amount) > 0)
          if (pp.length === 0) return
          const totalDueAmt = pp.reduce((s: number, pu: any) => s + Number(pu.due_amount || 0), 0)
          const lastPurchase = pp.sort((a: any, b: any) => b.purchase_date.localeCompare(a.purchase_date))[0]?.purchase_date || ''
          entries.push({ patient: p, purchases: pp, total_due: totalDueAmt, last_purchase: lastPurchase })
        })
        setHalkhataData(entries.sort((a, b) => b.total_due - a.total_due))
      }
      const { data: meds } = await supabase
        .from('pharmacy_medicines').select('*')
        .eq('user_id', userId).order('name')
      if (meds) setMedicines(meds)
      const { data: sales } = await supabase
        .from('crm_purchases').select('*, crm_customers(name, phone)')
        .eq('user_id', userId).order('purchase_date', { ascending: false }).limit(50)
      if (sales) {
        const mapped = sales.map((p: any) => ({ ...p, customer_name: p.crm_customers?.name || '' }))
        setRecentSales(mapped)
        setPurchases(mapped)
      }
    }
    ;(window as any).__pharmReload = reloadAll
    return () => { delete (window as any).__pharmReload }
  }, [userId])

  const savePharmacyProfile = async () => {
    if (!userId) return
    const payload = {
      user_id: userId,
      business_name: pharmacySettings.pharmacy_name || 'আমার ফার্মেসি',
      owner_name: pharmacySettings.owner_name || '',
      phone: pharmacySettings.phone || '',
      address: pharmacySettings.address || '',
      license_no: pharmacySettings.license_no || '',
      gstin: pharmacySettings.gstin || '',
    }
    const { error } = await supabase.from('pharmacy_profiles').upsert(payload, { onConflict: 'user_id' })
    if (error) { toast.error('সেভ হয়নি: ' + error.message); return }
    toast.success('ফার্মেসির তথ্য সেভ হয়েছে! ✅')
    await loadPharmacySettings(userId)
  }

    const buildHalkhata = (pts: Patient[], allPurchases: any[]) => {
    const entries: HalkhataEntry[] = []
    pts.forEach(p => {
      const pp = allPurchases.filter((pu: any) => pu.customer_id === p.id && Number(pu.due_amount) > 0)
      if (pp.length === 0) return
      const totalDueAmt = pp.reduce((s: number, pu: any) => s + Number(pu.due_amount || 0), 0)
      const lastPurchase = pp.sort((a: any, b: any) => b.purchase_date.localeCompare(a.purchase_date))[0]?.purchase_date || ''
      entries.push({ patient: p, purchases: pp, total_due: totalDueAmt, last_purchase: lastPurchase })
    })
    setHalkhataData(entries.sort((a, b) => b.total_due - a.total_due))
  }

  const loadPatientPurchases = async (patientId: string) => {
    const { data } = await supabase.from('crm_purchases').select('*').eq('customer_id', patientId).order('purchase_date', { ascending: false })
    if (data) setPatientPurchases(data)
  }

  // ── Medicine CRUD ──────────────────────────────────────────────
  const logStockPurchase = async (medId: string, medName: string, qtyAdded: number, unit: string, unitCost: number) => {
    if (qtyAdded <= 0 || unitCost <= 0 || !userId) return
    await supabase.from('stock_purchases').insert({
      user_id: userId, agent_id: LIBRARY_AGENT_IDS.pharmacy, source_table: 'pharmacy_medicines', source_id: medId,
      item_name: medName, quantity: qtyAdded, unit, unit_cost: unitCost,
    })
  }

  const saveMedicine = async () => {
    if (!newMed.name) { toast.error('ওষুধের নাম দিন'); return }
    if (!userId) { toast.error('লগইন করুন'); return }
    setSavingMed(true)
    try {
      const payload = { user_id: userId, name: newMed.name, generic: newMed.generic || '', category: newMed.category || 'Other', stock: Number(newMed.stock || 0), unit: newMed.unit || 'strip', expiry: newMed.expiry || monthYear(), mrp: Number(newMed.mrp || 0), cost_price: Number(newMed.cost_price || 0), min_stock: Number(newMed.min_stock || 20), supplier: newMed.supplier || '', rack: newMed.rack || '', prescription_required: !!newMed.prescription_required }
      const oldStock = editMed ? Number(editMed.stock) : 0
      let savedId = editMed?.id
      if (editMed) { const { error } = await supabase.from('pharmacy_medicines').update(payload).eq('id', editMed.id); if (error) throw error; toast.success('আপডেট হয়েছে!') }
      else {
        const { data, error } = await supabase.from('pharmacy_medicines').insert(payload).select().single()
        if (error) throw error
        savedId = data?.id
        toast.success('যোগ হয়েছে!')
      }
      if (savedId) await logStockPurchase(savedId, payload.name, payload.stock - oldStock, payload.unit, payload.cost_price)
      setNewMed({ unit: 'strip', category: 'Analgesic', prescription_required: false, stock: 0, min_stock: 20 }); setShowAddMed(false); setEditMed(null)
      await loadMedicines(userId)
    } catch (e: any) { toast.error(e.message || 'সমস্যা হয়েছে') } finally { setSavingMed(false) }
  }

  const startEditMed = (m: Medicine) => { setEditMed(m); setNewMed({ ...m }); setShowAddMed(true) }

  const deleteMed = async (id: string) => {
    if (!confirm('মুছে ফেলবেন?')) return
    await supabase.from('pharmacy_medicines').delete().eq('id', id)
    setMedicines(medicines.filter(m => m.id !== id)); toast.success('মুছে ফেলা হয়েছে')
  }

  const updateStockDirect = async (med: Medicine, newStock: number) => {
    if (!userId) return
    await supabase.from('pharmacy_medicines').update({ stock: newStock }).eq('id', med.id)
    setMedicines(medicines.map(m => m.id === med.id ? { ...m, stock: newStock } : m))
    if (newStock > Number(med.stock)) await logStockPurchase(med.id, med.name, newStock - Number(med.stock), med.unit, med.cost_price)
  }

  // ── Patient CRUD ───────────────────────────────────────────────
  const savePatient = async () => {
    if (!newPatient.name) { toast.error('নাম দিন'); return }
    if (!userId) { toast.error('লগইন করুন'); return }
    setSavingPatient(true)
    try {
      const payload = { user_id: userId, business_type: 'pharmacy', name: newPatient.name, age: Number(newPatient.age || 0), gender: newPatient.gender || 'অজানা', phone: newPatient.phone || '', guardian_name: newPatient.guardian_name || '', address: newPatient.address || '', doctor_name: newPatient.doctor_name || '', blood_group: newPatient.blood_group || 'জানা নেই', notes: newPatient.notes || '' }
      const { error } = await supabase.from('crm_customers').insert(payload)
      if (error) throw error
      toast.success('রোগী রেজিস্ট্রেশন হয়েছে!'); setNewPatient({ gender: 'পুরুষ', blood_group: 'জানা নেই' }); setShowAddPatient(false)
      await loadPatients(userId)
    } catch (e: any) { toast.error(e.message || 'সমস্যা হয়েছে') } finally { setSavingPatient(false) }
  }

  const deletePatient = async (id: string) => {
    if (!confirm('মুছে ফেলবেন?')) return
    await supabase.from('crm_customers').delete().eq('id', id)
    setPatients(patients.filter(p => p.id !== id)); toast.success('মুছে ফেলা হয়েছে')
  }

  // ── Sale save ─────────────────────────────────────────────────
  const saveSale = async () => {
    if (!salePatient) { toast.error('রোগী বেছে নিন'); return }
    if (saleItems.every(i => !i.name)) { toast.error('ওষুধ যোগ করুন'); return }
    if (!userId) { toast.error('লগইন করুন'); return }
    setSavingSale(true)
    try {
      const validItems = saleItems.filter(i => i.name && i.qty > 0)
      const rows = validItems.map(i => {
        const total = i.qty * i.mrp * (1 - i.discount / 100)
        const due = Math.max(0, total - salePaid / validItems.length)
return { user_id: userId, agent_id: LIBRARY_AGENT_IDS.pharmacy, customer_id: salePatient.id, purchase_date: today(), item_name: i.name, item_category: 'medicine', quantity: i.qty, unit: medicines.find(m => m.name === i.name)?.unit || 'strip', unit_price: i.mrp * (1 - i.discount / 100), paid_amount: salePaid / validItems.length, payment_status: due <= 0 ? 'paid' : salePaid > 0 ? 'partial' : 'pending', notes: saleDoctor ? `ডাক্তার: ${saleDoctor}` : '', source: 'manual' }      })
      const { error } = await supabase.from('crm_purchases').insert(rows)
      if (error) throw error
      for (const i of validItems) { const med = medicines.find(m => m.name === i.name); if (med) await supabase.from('pharmacy_medicines').update({ stock: Math.max(0, med.stock - i.qty) }).eq('id', med.id) }
      toast.success('বিল সেভ হয়েছে!')
      setSalePatient(null); setSalePatientSearch(''); setSaleItems([{ name: '', qty: 1, mrp: 0, discount: 0 }]); setSalePaid(0); setSaleDoctor(''); setShowNewSale(false)
      await Promise.all([loadMedicines(userId), loadPatients(userId), loadRecentPurchases(userId)])
      if (confirm('বিল প্রিন্ট করবেন?')) printSaleBill(salePatient, validItems, saleGross, salePaid, saleDoctor)
    } catch (e: any) { toast.error(e.message || 'সমস্যা হয়েছে') } finally { setSavingSale(false) }
  }

  // ── Payment update ─────────────────────────────────────────────
  const savePayment = async () => {
    if (!payingPurchase || !userId) return
    setSavingPayment(true)
    try {
      const newPaid = Number(payingPurchase.paid_amount) + Number(payAmount)
      const newDue = Math.max(0, Number(payingPurchase.total_amount) - newPaid)
await supabase.from('crm_purchases').update({ paid_amount: newPaid, payment_status: newDue <= 0 ? 'paid' : 'partial' }).eq('id', payingPurchase.id)
toast.success(`₹${payAmount} পেমেন্ট রেকর্ড হয়েছে!`)
setPayingPurchase(null)
setPayAmount(0)
  await Promise.all([loadPatients(userId), loadRecentPurchases(userId)])
      if (selectedPatient) await loadPatientPurchases(selectedPatient.id)
    } catch (e: any) { toast.error(e.message || 'সমস্যা হয়েছে') } finally { setSavingPayment(false) }
  }

  // ── Print / Share ──────────────────────────────────────────────
  // ── Real-data AI context builder ──────────────────────────────
  const buildRealContext = () => {
    const stockSummary = medicines.slice(0, 30).map(m =>
      `${m.name}(${m.stock}${m.unit},MRP:₹${m.mrp},মেয়াদ:${m.expiry})`
    ).join('; ')

    const lowList = lowStock.map(m => `${m.name}:${m.stock}${m.unit}`).join(', ')
    const expiredList = [...expired, ...expiringSoon].map(m => `${m.name}(${m.expiry})`).join(', ')
    const dueSummary = halkhataData.slice(0, 10).map(h =>
      `${h.patient.name}(${h.patient.phone}):₹${h.total_due.toFixed(0)}`
    ).join('; ')

    const todaySalesList = todayPurchases.map(p =>
      `${p.customer_name||'অজানা'}-${p.item_name}:₹${p.total_amount}`
    ).join('; ')

    return `তুমি ${pharmacySettings.pharmacy_name || 'এই ফার্মেসি'}-র AI সহায়ক।
মালিক: ${pharmacySettings.owner_name || 'অজানা'}। ফোন: ${pharmacySettings.phone || 'অজানা'}।

=== আজকের LIVE DATA (${new Date().toLocaleDateString('bn-IN')}) ===
আজকের বিক্রি: ₹${todayRevenue.toFixed(0)} (${todayPurchases.length}টি বিল)
মোট বাকি: ₹${totalDue.toFixed(0)} (${halkhataData.length}জন রোগী)
মোট ওষুধ: ${medicines.length}টি | কম স্টক: ${lowStock.length}টি | মেয়াদ সমস্যা: ${expired.length + expiringSoon.length}টি
মোট রোগী: ${patients.length}জন

=== স্টক তালিকা (প্রথম ৩০টি) ===
${stockSummary}

=== কম স্টক ===
${lowList || 'কোনোটি নেই'}

=== মেয়াদ সমস্যা ===
${expiredList || 'কোনোটি নেই'}

=== বাকির তালিকা (শীর্ষ ১০) ===
${dueSummary || 'কোনো বাকি নেই'}

=== আজকের বিক্রি ===
${todaySalesList || 'আজকে কোনো বিক্রি নেই'}

নিয়ম:
- শুধুমাত্র উপরের REAL DATA থেকে উত্তর দাও
- কোনো তথ্য না থাকলে "ডেটা পাওয়া যাচ্ছে না" বলো
- hallucination করবে না
- বাংলায় সংক্ষেপে উত্তর দাও
- medicine dosage জিজ্ঞেস করলে general knowledge থেকে বলো কিন্তু "ডাক্তারের পরামর্শ নিন" যোগ করো`
  }

  const printSaleBill = (patient: Patient, items: any[], total: number, paid: number, doctor: string) => {
    const due = total - paid
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>বিল</title><meta charset="utf-8"><style>body{font-family:sans-serif;padding:24px;max-width:400px;margin:auto}h2{text-align:center;color:#059669}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#059669;color:white;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #eee}.footer{text-align:center;margin-top:16px;font-size:10px;color:#888}</style></head><body><h2>💊 ফার্মেসি বিল</h2><p><b>রোগী:</b> ${patient.name} ${patient.phone ? `| ${patient.phone}` : ''}</p>${doctor ? `<p><b>ডাক্তার:</b> ${doctor}</p>` : ''}<table><tr><th>ওষুধ</th><th>পরিমাণ</th><th>দাম</th><th>মোট</th></tr>${items.map(i => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${i.mrp}</td><td>₹${(i.qty * i.mrp).toFixed(0)}</td></tr>`).join('')}<tr><td colspan="3"><b>মোট</b></td><td><b>₹${total.toFixed(0)}</b></td></tr><tr><td colspan="3">পরিশোধ</td><td>₹${paid}</td></tr>${due > 0 ? `<tr><td colspan="3" style="color:red">বাকি</td><td style="color:red">₹${due.toFixed(0)}</td></tr>` : ''}</table><div class="footer">Sahayak AI ফার্মেসি</div></body></html>`)
    w.document.close(); w.print()
  }

  const printHalkhataCard = (entry: HalkhataEntry) => {
    const w = window.open('', '_blank')!
    w.document.write(`<!DOCTYPE html><html><head><title>হালখাতা</title><meta charset="utf-8"><style>body{font-family:sans-serif;padding:0;margin:0;background:#f0fdf4}.card{max-width:380px;margin:20px auto;background:white;border:3px solid #059669;border-radius:16px;overflow:hidden}.header{background:linear-gradient(135deg,#059669,#10b981);color:white;padding:20px;text-align:center}.header h1{margin:0;font-size:26px}.body{padding:20px}.amount-box{background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:16px;text-align:center;margin:12px 0}.amount-value{font-size:32px;font-weight:700;color:#92400e}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#ecfdf5;color:#065f46;padding:6px 8px;text-align:left}td{padding:5px 8px;border-bottom:1px solid #f0fdf4}.footer{background:#ecfdf5;padding:12px;text-align:center;font-size:11px;color:#065f46}</style></head><body><div class="card"><div class="header"><h1>💊 হালখাতা</h1><p>${new Date().toLocaleDateString('bn-IN', { year: 'numeric', month: 'long' })}</p></div><div class="body"><b style="font-size:18px">${entry.patient.name}</b><p style="font-size:12px;color:#6b7280">${entry.patient.phone || ''} ${entry.patient.address ? '| ' + entry.patient.address : ''}</p><div class="amount-box"><div style="font-size:12px;color:#92400e">মোট বাকি</div><div class="amount-value">₹${entry.total_due.toFixed(0)}</div></div><table><tr><th>তারিখ</th><th>ওষুধ</th><th>বাকি</th></tr>${entry.purchases.slice(0, 8).map(p => `<tr><td>${p.purchase_date}</td><td>${p.item_name}</td><td style="color:#dc2626">₹${Number(p.due_amount).toFixed(0)}</td></tr>`).join('')}</table></div><div class="footer">অনুগ্রহ করে বাকি পরিশোধ করুন 🙏 | Sahayak AI</div></div></body></html>`)
    w.document.close(); w.print()
  }

  const shareHalkhataWhatsApp = (entry: HalkhataEntry) => {
    const phone = entry.patient.phone?.replace(/[^0-9]/g, '') || ''
    let txt = `💊 *হালখাতা — বাকির বিবরণ*\n\nনাম: ${entry.patient.name}\nতারিখ: ${new Date().toLocaleDateString('bn-IN')}\n\n*মোট বাকি: ₹${entry.total_due.toFixed(0)}*\n\n`
    entry.purchases.forEach(p => { txt += `• ${p.item_name} (${p.purchase_date}) — ₹${Number(p.due_amount).toFixed(0)}\n` })
    txt += `\nঅনুগ্রহ করে পরিশোধ করুন 🙏\n— Sahayak AI ফার্মেসি`
    window.open(phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(txt)}` : `https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')
  }

  const exportHalkhataExcel = () => {
    let csv = 'রোগীর নাম,ফোন,ঠিকানা,ডাক্তার,মোট বাকি,শেষ কেনাকাটা\n'
    halkhataData.forEach(h => { csv += `"${h.patient.name}","${h.patient.phone}","${h.patient.address}","${h.patient.doctor_name}",${h.total_due.toFixed(0)},"${h.last_purchase}"\n` })
    downloadCSV(csv, `halkhata-${today()}.csv`); toast.success('Excel ডাউনলোড হয়েছে!')
  }

  // ── Quick WhatsApp / SMS to patient ──────────────────────────
  const sharePatientWhatsApp = (p: Patient, customMsg?: string) => {
    const phone = p.phone?.replace(/[^0-9]/g, '') || ''
    const due = p.total_due || 0
    const msg = customMsg || (due > 0
      ? `নমস্কার ${p.name}! আপনার ফার্মেসিতে মোট বাকি: *₹${due.toFixed(0)}*। অনুগ্রহ করে পরিশোধ করুন। 🙏\n— ${pharmacySettings.pharmacy_name || 'ফার্মেসি সহায়ক'}`
      : `নমস্কার ${p.name}! আপনার সাথে যোগাযোগ করছি ${pharmacySettings.pharmacy_name || 'ফার্মেসি সহায়ক'} থেকে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const sharePatientSMS = (p: Patient, customMsg?: string) => {
    const phone = p.phone?.replace(/[^0-9]/g, '') || ''
    const due = p.total_due || 0
    const msg = customMsg || (due > 0
      ? `${p.name}, আপনার ফার্মেসিতে বাকি ₹${due.toFixed(0)}। পরিশোধ করুন। -${pharmacySettings.pharmacy_name || 'ফার্মেসি'}`
      : `${p.name}, ${pharmacySettings.pharmacy_name || 'ফার্মেসি'} থেকে যোগাযোগ করা হচ্ছে।`)
    if (!phone) { toast.error('ফোন নম্বর নেই'); return }
    window.open(`sms:+91${phone}?body=${encodeURIComponent(msg)}`, '_blank')
  }

  const [customMsgPatient, setCustomMsgPatient] = useState<Patient | null>(null)
  const [customMsgText, setCustomMsgText] = useState('')

    const TABS = [
    { id: 'stock', label: 'স্টক', icon: <Package size={13} /> },
    { id: 'billing', label: 'বিল', icon: <FileText size={13} /> },
    { id: 'patients', label: 'রোগী', icon: <User size={13} /> },
    { id: 'halkhata', label: 'হালখাতা', icon: <BookOpen size={13} /> },
    { id: 'expiry', label: 'মেয়াদ', icon: <Clock size={13} /> },
    { id: 'report', label: 'রিপোর্ট', icon: <BarChart2 size={13} /> },
    { id: 'settings', label: 'সেটিংস', icon: <Settings size={13} /> },
  ]

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  // ── Derived stats ─────────────────────────────────────────────
  const todayPurchases = recentSales.filter(s => s.purchase_date === today())
  const todayRevenue = todayPurchases.reduce((s, r) => s + Number(r.total_amount || 0), 0)
  const totalDue = halkhataData.reduce((s, h) => s + h.total_due, 0)
  const lowStock = medicines.filter(m => m.stock <= m.min_stock)
  const expired = medicines.filter(m => expiryStatus(m.expiry) === 'expired')
  const expiringSoon = medicines.filter(m => ['critical', 'warning'].includes(expiryStatus(m.expiry)))

  const filteredMeds = medicines.filter(m => {
    const matchQ = !searchQ || m.name.toLowerCase().includes(searchQ.toLowerCase()) || m.generic.toLowerCase().includes(searchQ.toLowerCase())
    const matchCat = catFilter === 'সব' || m.category === catFilter
    return matchQ && matchCat
  })
  const filteredPatients = patients.filter(p =>
    !patientSearch || p.name.toLowerCase().includes(patientSearch.toLowerCase()) || p.phone.includes(patientSearch)
  )
  const filteredHalkhata = halkhataData.filter(h =>
    !halkhataSearch || h.patient.name.toLowerCase().includes(halkhataSearch.toLowerCase()) || h.patient.phone.includes(halkhataSearch)
  )
  const saleGross = saleItems.reduce((s, i) => s + (i.qty * i.mrp * (1 - i.discount / 100)), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-emerald-600">
        <Loader2 className="animate-spin mr-2" size={22} />
        <span className="bengali text-sm">লোড হচ্ছে...</span>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="text-center py-16">
        <p className="bengali text-gray-500 mb-3">এই ফিচার ব্যবহার করতে লগইন করুন</p>
        <a href="/login" className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-sm">লগইন করুন</a>
      </div>
    )
  }

  return (
    <div className="space-y-3">

      {/* ── Pharmacy Header ── */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-600 rounded-2xl p-4 text-white flex items-center justify-between gap-3 shadow-md">
        <div className="flex-1 min-w-0">
          <div className="font-black text-lg bengali truncate">
            💊 {pharmacySettings.pharmacy_name || 'আপনার ফার্মেসি'}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {pharmacySettings.owner_name && <span className="text-emerald-100 text-xs bengali">👤 {pharmacySettings.owner_name}</span>}
            {pharmacySettings.phone && <span className="text-emerald-100 text-xs">📞 {pharmacySettings.phone}</span>}
            {pharmacySettings.address && <span className="text-emerald-100 text-xs bengali truncate">📍 {pharmacySettings.address}</span>}
          </div>
          {!pharmacySettings.pharmacy_name && (
            <div className="text-emerald-200 text-xs bengali mt-0.5">Settings থেকে দোকানের নাম যোগ করুন →</div>
          )}
        </div>
        <button onClick={() => setTab('settings')} className="shrink-0 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-bold bengali flex items-center gap-1 transition-colors">
          <Settings size={12} /> সেটিংস
        </button>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'আজকের বিক্রি', value: fmtAmt(todayRevenue), color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
          { label: 'মোট বাকি', value: fmtAmt(totalDue), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
          { label: 'কম স্টক', value: `${lowStock.length}টি`, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
          { label: 'মেয়াদ সমস্যা', value: `${expired.length + expiringSoon.length}টি`, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-xl p-3 cursor-pointer`}>
            <div className={`font-extrabold text-lg ${c.color}`}>{c.value}</div>
            <div className="text-xs text-gray-500 bengali">{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Alerts ── */}
      {(expired.length > 0 || lowStock.length > 0) && (
        <div className="space-y-2">
          {expired.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-3">
              <div className="font-bold text-red-800 bengali text-sm mb-1.5">🚫 মেয়াদ শেষ — এখনই সরান</div>
              <div className="flex flex-wrap gap-2">{expired.map(m => <span key={m.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg bengali">💊 {m.name}</span>)}</div>
            </div>
          )}
          {lowStock.length > 0 && (
            <div className="bg-orange-50 border border-orange-300 rounded-xl p-3">
              <div className="font-bold text-orange-800 bengali text-sm mb-1.5">📦 কম স্টক — অর্ডার করুন</div>
              <div className="flex flex-wrap gap-2">{lowStock.map(m => <span key={m.id} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-lg bengali">💊 {m.name}: {m.stock} {m.unit}</span>)}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all bengali
              ${tab === t.id ? 'bg-emerald-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ STOCK TAB ════════════════ */}
      {tab === 'stock' && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="ওষুধ খুঁজুন..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
            </div>
            <button onClick={() => { setShowAddMed(true); setEditMed(null); setNewMed({ unit: 'strip', category: 'Analgesic', prescription_required: false, stock: 0, min_stock: 20 }) }}
              className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 whitespace-nowrap bengali">
              <Plus size={14} /> ওষুধ যোগ
            </button>
            <button onClick={() => { let csv = 'নাম,Generic,Category,স্টক,Unit,মেয়াদ,MRP,Cost\n'; medicines.forEach(m => { csv += `"${m.name}","${m.generic}","${m.category}",${m.stock},"${m.unit}","${m.expiry}",${m.mrp},${m.cost_price}\n` }); downloadCSV(csv, `stock-${today()}.csv`) }}
              className="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1">
              <Download size={14} />
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-center">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all
                  ${catFilter === c ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c}
              </button>
            ))}
            {/* Manual category creation — persists to custom_categories, reusable across shop types */}
            {showAddCategory ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      const ok = await addCategory(newCategoryName)
                      if (ok) { setNewCategoryName(''); setShowAddCategory(false) }
                    } else if (e.key === 'Escape') { setShowAddCategory(false); setNewCategoryName('') }
                  }}
                  placeholder="নতুন ক্যাটাগরি..."
                  className="px-2.5 py-1 rounded-full text-xs border border-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400 w-28 bengali" />
                <button onClick={async () => {
                  const ok = await addCategory(newCategoryName)
                  if (ok) { setNewCategoryName(''); setShowAddCategory(false) }
                }} className="text-emerald-600 hover:text-emerald-700"><Check size={14} /></button>
                <button onClick={() => { setShowAddCategory(false); setNewCategoryName('') }}
                  className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddCategory(true)}
                className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap border border-dashed border-gray-300 text-gray-400 hover:border-emerald-300 hover:text-emerald-600 flex items-center gap-1 flex-shrink-0 bengali">
                <Plus size={11} /> ক্যাটাগরি
              </button>
            )}
          </div>

          {/* Add/Edit Medicine Form */}
          {showAddMed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-emerald-800 bengali text-sm">{editMed ? '✏️ ওষুধ সম্পাদনা' : '➕ নতুন ওষুধ'}</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'ওষুধের নাম *', key: 'name', type: 'text', voice: true },
                  { label: 'Generic নাম', key: 'generic', type: 'text', voice: true },
                  { label: 'বর্তমান স্টক *', key: 'stock', type: 'number' },
                  { label: 'ন্যূনতম স্টক', key: 'min_stock', type: 'number' },
                  { label: 'MRP (₹)', key: 'mrp', type: 'number' },
                  { label: 'ক্রয় মূল্য (₹)', key: 'cost_price', type: 'number' },
                  { label: 'মেয়াদ (YYYY-MM)', key: 'expiry', type: 'month' },
                  { label: 'Rack/শেলফ', key: 'rack', type: 'text' },
                  { label: 'সরবরাহকারী', key: 'supplier', type: 'text' },
                ].map((f: any) => (
                  <div key={f.key}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <div className="flex gap-1 mt-0.5">
                      <input type={f.type} value={(newMed as any)[f.key] || ''}
                        onChange={e => setNewMed(p => ({ ...p, [f.key]: e.target.value }))}
                        className={`flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${voiceMedField === f.key && pharmVoice.listening ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                      {f.voice && (
                        <button type="button"
                          onClick={() => {
                            if (pharmVoice.listening && voiceMedField === f.key) {
                              pharmVoice.stop()
                              setVoiceMedField(null)
                            } else {
                              setVoiceMedField(f.key)
                              pharmVoice.start()
                            }
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${pharmVoice.listening && voiceMedField === f.key ? 'bg-red-500 animate-pulse' : 'bg-emerald-100 hover:bg-emerald-200'}`}>
                          {pharmVoice.listening && voiceMedField === f.key
                            ? <MicOff size={12} className="text-white" />
                            : <Mic size={12} className="text-emerald-700" />}
                        </button>
                      )}
                    </div>
                    {pharmVoice.listening && voiceMedField === f.key && pharmVoice.interim && (
                      <div className="text-xs text-red-500 bengali mt-0.5 truncate">🎤 {pharmVoice.interim}</div>
                    )}
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">Unit</label>
                  <select value={newMed.unit || 'strip'} onChange={e => setNewMed(p => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none mt-0.5">
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 bengali">Category</label>
                  <select value={newMed.category || 'Other'} onChange={e => setNewMed(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none mt-0.5">
                    {CATEGORIES.filter(c => c !== 'সব').map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rxReq" checked={!!newMed.prescription_required}
                  onChange={e => setNewMed(p => ({ ...p, prescription_required: e.target.checked }))} />
                <label htmlFor="rxReq" className="text-xs text-gray-600 bengali">প্রেসক্রিপশন প্রয়োজন</label>
              </div>
              <div className="flex gap-2">
                <button onClick={saveMedicine} disabled={savingMed}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali disabled:opacity-60">
                  {savingMed ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />}
                  {editMed ? 'আপডেট করুন' : 'সেভ করুন'}
                </button>
                <button onClick={() => { setShowAddMed(false); setEditMed(null) }}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {/* Medicine Table */}
          <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '270px' }}>
            {filteredMeds.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bengali text-sm">
                {medicines.length === 0 ? '💊 এখনো কোনো ওষুধ যোগ করা হয়নি' : 'কোনো ফলাফল পাওয়া যায়নি'}
              </div>
            ) : filteredMeds.map(m => {
              const status = expiryStatus(m.expiry)
              const isLow = m.stock <= m.min_stock
              const statusColor = status === 'expired' ? 'border-red-300 bg-red-50' : status === 'critical' ? 'border-orange-300 bg-orange-50' : isLow ? 'border-yellow-300 bg-yellow-50' : 'border-gray-100 bg-white'
              return (
                <div key={m.id} className={`border rounded-xl p-3 ${statusColor}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-800 text-sm truncate">{m.name}</div>
                      <div className="text-xs text-gray-500">{m.generic} · {m.category} · {m.rack}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEditMed(m)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Edit2 size={13} /></button>
                      <button onClick={() => deleteMed(m.id)} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 bengali">স্টক:</span>
                      <span className={`font-bold ${isLow ? 'text-red-600' : 'text-gray-800'}`}>{m.stock} {m.unit}</span>
                      <div className="flex gap-1 ml-1">
                        <button onClick={() => updateStockDirect(m, m.stock + 1)} className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center hover:bg-emerald-200">+</button>
                        <button onClick={() => m.stock > 0 && updateStockDirect(m, m.stock - 1)} className="w-5 h-5 rounded bg-gray-100 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-200">−</button>
                      </div>
                    </div>
                    <span className="text-gray-500">MRP: <b className="text-gray-800">₹{m.mrp}</b></span>
                    <span className={`${status !== 'ok' ? 'text-red-600 font-bold' : 'text-gray-500'} bengali`}>মেয়াদ: {m.expiry}</span>
                    {m.supplier && <span className="text-gray-400">{m.supplier}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════ BILLING TAB ════════════════ */}
      {tab === 'billing' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="font-bold text-gray-700 bengali text-sm">বিলিং ইতিহাস ({recentSales.length})</div>
            <button onClick={() => setShowNewSale(true)}
              className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Plus size={14} /> নতুন বিল
            </button>
          </div>

          {/* New Sale Form */}
          {showNewSale && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-blue-800 bengali text-sm">🧾 নতুন বিল তৈরি</div>

              {/* Patient search */}
              <div>
                <label className="text-xs text-gray-500 bengali">রোগী বেছে নিন *</label>
                <div className="relative mt-0.5">
                  <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
                  <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                    placeholder="নাম বা ফোন দিয়ে খুঁজুন..."
                    value={salePatient ? salePatient.name : salePatientSearch}
                    onChange={e => { setSalePatientSearch(e.target.value); setSalePatient(null) }} />
                </div>
                {!salePatient && salePatientSearch && (
                  <div className="mt-1 border border-gray-200 rounded-lg bg-white max-h-32 overflow-y-auto">
                    {patients.filter(p => p.name.toLowerCase().includes(salePatientSearch.toLowerCase()) || p.phone.includes(salePatientSearch))
                      .map(p => (
                        <div key={p.id} onClick={() => { setSalePatient(p); setSalePatientSearch('') }}
                          className="px-3 py-2 text-sm hover:bg-blue-50 cursor-pointer bengali">
                          {p.name} {p.phone ? `(${p.phone})` : ''} {(p.total_due || 0) > 0 ? <span className="text-red-500 text-xs">বাকি: ₹{p.total_due}</span> : ''}
                        </div>
                      ))}
                    {patients.filter(p => p.name.toLowerCase().includes(salePatientSearch.toLowerCase()) || p.phone.includes(salePatientSearch)).length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-400 bengali">পাওয়া যায়নি — প্রথমে রোগী ট্যাবে যোগ করুন</div>
                    )}
                  </div>
                )}
                {salePatient && (
                  <div className="mt-1 bg-white border border-emerald-300 rounded-lg px-3 py-2 flex justify-between items-center">
                    <span className="bengali text-sm font-semibold text-emerald-700">✅ {salePatient.name} {salePatient.phone && `(${salePatient.phone})`}</span>
                    <button onClick={() => setSalePatient(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500 bengali">ডাক্তারের নাম</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-0.5"
                  placeholder="ডা. ..." value={saleDoctor} onChange={e => setSaleDoctor(e.target.value)} />
              </div>

              {/* Items */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-600 bengali">ওষুধ তালিকা</div>
                {saleItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-1.5 items-center">
                    <div className="col-span-2">
                      <select value={item.name} onChange={e => {
                        const med = medicines.find(m => m.name === e.target.value)
                        const items = [...saleItems]
                        items[idx] = { ...items[idx], name: e.target.value, mrp: med ? med.mrp : 0 }
                        setSaleItems(items)
                      }} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        <option value="">ওষুধ বেছে নিন</option>
                        {medicines.map(m => <option key={m.id} value={m.name}>{m.name} (স্টক:{m.stock})</option>)}
                      </select>
                    </div>
                    <input type="number" min={1} placeholder="পরিমাণ" value={item.qty}
                      onChange={e => { const i = [...saleItems]; i[idx].qty = +e.target.value; setSaleItems(i) }}
                      className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">₹{(item.qty * item.mrp).toFixed(0)}</span>
                      <button onClick={() => setSaleItems(saleItems.filter((_, i) => i !== idx))} className="text-red-400 ml-auto"><X size={12} /></button>
                    </div>
                  </div>
                ))}
                <button onClick={() => setSaleItems([...saleItems, { name: '', qty: 1, mrp: 0, discount: 0 }])}
                  className="text-xs text-emerald-600 flex items-center gap-1 font-semibold bengali">
                  <Plus size={13} /> ওষুধ যোগ করুন
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="bengali text-gray-600">মোট</span>
                  <span className="font-bold">{fmtAmt(saleGross)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="bengali text-sm text-gray-600">আজকে পরিশোধ</span>
                  <input type="number" min={0} max={saleGross} value={salePaid}
                    onChange={e => setSalePaid(+e.target.value)}
                    className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right font-bold" />
                </div>
                {saleGross - salePaid > 0 && (
                  <div className="flex justify-between text-sm bg-red-50 rounded-lg px-2 py-1.5">
                    <span className="bengali text-red-600 font-semibold">বাকি থাকবে</span>
                    <span className="font-bold text-red-600">{fmtAmt(saleGross - salePaid)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={saveSale} disabled={savingSale}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
                  {savingSale ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  বিল সেভ করুন
                </button>
                <button onClick={() => setShowNewSale(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          {/* Recent Sales */}
          <div className="space-y-2">
            {recentSales.length === 0 ? (
              <div className="text-center py-8 text-gray-400 bengali text-sm">এখনো কোনো বিল নেই</div>
            ) : recentSales.map(s => (
              <div key={s.id} className="bg-white border border-gray-100 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800 text-sm bengali">{s.customer_name}</div>
                    <div className="text-xs text-gray-500">{s.item_name} × {s.quantity} · {s.purchase_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-800 text-sm">{fmtAmt(s.total_amount)}</div>
                    {Number(s.due_amount) > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-red-500 bengali">বাকি: {fmtAmt(s.due_amount)}</span>
                        <button onClick={() => { setPayingPurchase(s); setPayAmount(Number(s.due_amount)) }}
                          className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold bengali hover:bg-emerald-200">পরিশোধ</button>
                      </div>
                    ) : (
                      <span className="text-xs text-emerald-600 bengali flex items-center gap-0.5"><CheckCircle size={11} /> পরিশোধিত</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════ PATIENTS TAB ════════════════ */}
      {tab === 'patients' && (
        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={14} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="নাম বা ফোন দিয়ে খুঁজুন..." value={patientSearch} onChange={e => setPatientSearch(e.target.value)} />
            </div>
            <button onClick={() => setShowAddPatient(true)}
              className="bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 whitespace-nowrap bengali">
              <Plus size={14} /> রোগী যোগ
            </button>
          </div>

          {showAddPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
              <div className="font-bold text-blue-800 bengali text-sm">👤 নতুন রোগী রেজিস্ট্রেশন</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'নাম *', key: 'name', type: 'text', full: true },
                  { label: 'বয়স', key: 'age', type: 'number' },
                  { label: 'ফোন', key: 'phone', type: 'tel' },
                  { label: 'পিতা/মাতা বা অভিভাবকের নাম', key: 'guardian_name', type: 'text' },
                  { label: 'ডাক্তারের নাম', key: 'doctor_name', type: 'text' },
                  { label: 'ঠিকানা', key: 'address', type: 'text', full: true },
                  { label: 'নোট (রোগ ইত্যাদি)', key: 'notes', type: 'text', full: true },
                ].map(f => (
                  <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                    <label className="text-xs text-gray-500 bengali">{f.label}</label>
                    <input type={f.type} value={(newPatient as any)[f.key] || ''}
                      onChange={e => setNewPatient(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mt-0.5" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-500 bengali">লিঙ্গ</label>
                  <select value={newPatient.gender} onChange={e => setNewPatient(p => ({ ...p, gender: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    <option>পুরুষ</option><option>মহিলা</option><option>অন্যান্য</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 bengali">রক্তের গ্রুপ</label>
                  <select value={newPatient.blood_group} onChange={e => setNewPatient(p => ({ ...p, blood_group: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm mt-0.5">
                    {['জানা নেই', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={savePatient} disabled={savingPatient}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali disabled:opacity-60">
                  {savingPatient ? <Loader2 className="animate-spin" size={13} /> : <Save size={13} />} সেভ করুন
                </button>
                <button onClick={() => setShowAddPatient(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold bengali">বাতিল</button>
              </div>
            </div>
          )}

          <div className="overflow-y-auto space-y-2 pr-1" style={{ maxHeight: '270px' }}>
          {filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bengali text-sm">
              {patients.length === 0 ? '👤 এখনো কোনো রোগী নেই' : 'কোনো ফলাফল পাওয়া যায়নি'}
            </div>
          ) : filteredPatients.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-3 hover:shadow-sm transition-shadow">
              <div className="flex justify-between items-start">
                <div className="cursor-pointer flex-1" onClick={async () => {
                  setSelectedPatient(p); await loadPatientPurchases(p.id); setTab('patient_detail')
                }}>
                  <div className="font-bold text-gray-800 bengali">{p.name}
                    <span className="text-xs font-normal text-gray-400 ml-2">{p.gender} · {p.age ? `${p.age} বছর` : ''}</span>
                  </div>
                  {p.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{p.phone}</div>}
                  {p.guardian_name && <div className="text-xs text-gray-400 bengali">👪 {p.guardian_name}</div>}
                  {p.doctor_name && <div className="text-xs text-gray-400 bengali">🩺 {p.doctor_name}</div>}
                  {p.notes && <div className="text-xs text-gray-400 bengali mt-0.5">{p.notes}</div>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {(p.total_due || 0) > 0 ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold bengali">বাকি ₹{(p.total_due || 0).toFixed(0)}</span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full bengali">✅ ক্লিয়ার</span>
                  )}
                  <button onClick={() => sharePatientWhatsApp(p)} title="WhatsApp" className="text-green-500 hover:bg-green-50 p-1.5 rounded-lg"><MessageCircle size={13} /></button>
                  <button onClick={() => sharePatientSMS(p)} title="SMS" className="text-purple-500 hover:bg-purple-50 p-1.5 rounded-lg"><Send size={13} /></button>
                  <button onClick={() => { setCustomMsgPatient(p); setCustomMsgText('') }} title="Custom message" className="text-blue-500 hover:bg-blue-50 p-1.5 rounded-lg"><Share2 size={13} /></button>
                  <button onClick={() => deletePatient(p.id)} className="text-red-400 hover:bg-red-50 p-1 rounded-lg"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* ════════════════ PATIENT DETAIL (inline) ════════════════ */}
      {tab === 'patient_detail' && selectedPatient && (
        <div className="space-y-3">
          <button onClick={() => setTab('patients')} className="flex items-center gap-1 text-sm text-emerald-600 font-semibold bengali">
            ← রোগীর তালিকায় ফিরুন
          </button>
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-lg text-gray-800 bengali">{selectedPatient.name}</div>
                <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                  {selectedPatient.phone && <div className="flex items-center gap-1"><Phone size={11} />{selectedPatient.phone}</div>}
                  {selectedPatient.address && <div>📍 {selectedPatient.address}</div>}
                  {selectedPatient.guardian_name && <div className="bengali">👪 {selectedPatient.guardian_name}</div>}
                  {selectedPatient.doctor_name && <div className="bengali">🩺 {selectedPatient.doctor_name}</div>}
                  {selectedPatient.notes && <div className="bengali">{selectedPatient.notes}</div>}
                </div>
              </div>
              <div className="text-right">
                {(selectedPatient.total_due || 0) > 0 ? (
                  <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-2 text-center">
                    <div className="text-xs text-red-500 bengali">মোট বাকি</div>
                    <div className="text-xl font-black text-red-600">₹{(selectedPatient.total_due || 0).toFixed(0)}</div>
                  </div>
                ) : (
                  <div className="bg-green-100 border border-green-200 rounded-xl px-4 py-2 text-center">
                    <div className="text-emerald-600 font-bold bengali text-sm">✅ সব পরিশোধিত</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="font-bold text-gray-700 bengali text-sm">কেনাকাটার ইতিহাস ({patientPurchases.length})</div>
          {patientPurchases.length === 0 ? (
            <div className="text-center py-6 text-gray-400 bengali text-sm">কোনো কেনাকাটা নেই</div>
          ) : patientPurchases.map(p => (
            <div key={p.id} className={`border rounded-xl p-3 ${Number(p.due_amount) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-sm text-gray-800">{p.item_name}</div>
                  <div className="text-xs text-gray-500">{p.quantity} × ₹{p.unit_price} · {p.purchase_date}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{fmtAmt(p.total_amount)}</div>
                  {Number(p.due_amount) > 0 ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs text-red-500 bengali">বাকি: {fmtAmt(p.due_amount)}</span>
                      <button onClick={() => { setPayingPurchase(p); setPayAmount(Number(p.due_amount)) }}
                        className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full bengali hover:bg-emerald-200">পরিশোধ</button>
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-600 bengali">✅ পরিশোধিত</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ হালখাতা TAB ════════════════ */}
      {tab === 'halkhata' && (
        <div className="space-y-3">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-black text-amber-800 bengali text-base">📒 হালখাতা</div>
                <div className="text-xs text-amber-600 bengali">মোট {halkhataData.length} রোগীর কাছে বাকি আছে</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-amber-700">{fmtAmt(totalDue)}</div>
                <div className="text-xs text-amber-500 bengali">মোট বাকি</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 text-gray-400" size={13} />
              <input className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm"
                placeholder="রোগীর নাম বা ফোন..." value={halkhataSearch} onChange={e => setHalkhataSearch(e.target.value)} />
            </div>
            <button onClick={exportHalkhataExcel}
              className="bg-green-600 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 bengali">
              <Download size={13} /> Excel
            </button>
          </div>

          {filteredHalkhata.length === 0 ? (
            <div className="text-center py-8 text-gray-400 bengali text-sm">
              {halkhataData.length === 0 ? '🎉 কোনো বাকি নেই! সব পরিশোধিত।' : 'কোনো ফলাফল নেই'}
            </div>
          ) : filteredHalkhata.map(entry => (
            <div key={entry.patient.id} className="bg-white border border-amber-200 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-bold text-gray-800 bengali">{entry.patient.name}</div>
                  <div className="text-xs text-gray-500 space-y-0.5 mt-0.5">
                    {entry.patient.phone && <div className="flex items-center gap-1"><Phone size={10} />{entry.patient.phone}</div>}
                    {entry.patient.address && <div>📍 {entry.patient.address}</div>}
                    {entry.patient.doctor_name && <div className="bengali">🩺 {entry.patient.doctor_name}</div>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 bengali">
                    {entry.purchases.length}টি কেনাকাটায় বাকি · শেষ: {entry.last_purchase}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-red-600">₹{entry.total_due.toFixed(0)}</div>
                  <div className="text-xs text-red-400 bengali">বাকি</div>
                </div>
              </div>

              {/* Details */}
              <div className="mt-3 space-y-1.5">
                {entry.purchases.slice(0, 3).map(p => (
                  <div key={p.id} className="flex justify-between text-xs bg-amber-50 rounded-lg px-2 py-1.5">
                    <span className="text-gray-600">{p.item_name} ({p.purchase_date})</span>
                    <span className="font-bold text-red-600">বাকি ₹{Number(p.due_amount).toFixed(0)}</span>
                  </div>
                ))}
                {entry.purchases.length > 3 && (
                  <div className="text-xs text-gray-400 bengali text-center">+ আরো {entry.purchases.length - 3}টি...</div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mt-3">
                <button onClick={() => shareHalkhataWhatsApp(entry)}
                  className="flex-1 bg-green-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali hover:bg-green-600">
                  <MessageCircle size={13} /> WhatsApp
                </button>
                <button onClick={() => printHalkhataCard(entry)}
                  className="flex-1 bg-blue-500 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali hover:bg-blue-600">
                  <Printer size={13} /> প্রিন্ট কার্ড
                </button>
                <button onClick={() => { setPayingPurchase(entry.purchases[0]); setPayAmount(entry.total_due) }}
                  className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali hover:bg-emerald-700">
                  <IndianRupee size={13} /> পরিশোধ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ════════════════ EXPIRY TAB ════════════════ */}
      {tab === 'expiry' && (
        <div className="space-y-3">
          {expired.length > 0 && (
            <div>
              <div className="font-bold text-red-700 bengali text-sm mb-2">🚫 মেয়াদ উত্তীর্ণ ({expired.length}টি)</div>
              {expired.map(m => (
                <div key={m.id} className="bg-red-50 border border-red-200 rounded-xl p-3 mb-2 flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-red-800 text-sm">{m.name}</div>
                    <div className="text-xs text-red-500 bengali">মেয়াদ: {m.expiry} · স্টক: {m.stock} {m.unit}</div>
                  </div>
                  <button onClick={() => deleteMed(m.id)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div>
              <div className="font-bold text-orange-700 bengali text-sm mb-2">⚠️ শীঘ্রই মেয়াদ শেষ ({expiringSoon.length}টি)</div>
              {expiringSoon.map(m => {
                const status = expiryStatus(m.expiry)
                return (
                  <div key={m.id} className={`border rounded-xl p-3 mb-2 ${status === 'critical' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
                    <div className="font-semibold text-sm">{m.name}</div>
                    <div className="text-xs text-gray-500 bengali">মেয়াদ: {m.expiry} · স্টক: {m.stock} {m.unit} · সরবরাহকারী: {m.supplier || 'অজানা'}</div>
                  </div>
                )
              })}
            </div>
          )}
          {expired.length === 0 && expiringSoon.length === 0 && (
            <div className="text-center py-10 text-gray-400 bengali text-sm">✅ সব ওষুধের মেয়াদ ঠিক আছে!</div>
          )}
        </div>
      )}

      {/* ════════════════ REPORT TAB ════════════════ */}
      {tab === 'report' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'মোট ওষুধ', value: `${medicines.length}টি`, icon: '💊', color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'মোট রোগী', value: `${patients.length}জন`, icon: '👤', color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'মোট বাকি', value: fmtAmt(totalDue), icon: '💰', color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'আজকের আয়', value: fmtAmt(todayRevenue), icon: '📈', color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'কম স্টক', value: `${lowStock.length}টি`, icon: '📦', color: 'text-orange-700', bg: 'bg-orange-50' },
              { label: 'মেয়াদ সমস্যা', value: `${expired.length + expiringSoon.length}টি`, icon: '⚠️', color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center`}>
                <div className="text-2xl mb-1">{c.icon}</div>
                <div className={`font-black text-xl ${c.color}`}>{c.value}</div>
                <div className="text-xs text-gray-500 bengali">{c.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={() => { let csv = 'রোগী,ওষুধ,পরিমাণ,মোট,পরিশোধ,বাকি,তারিখ\n'; recentSales.forEach(s => { csv += `"${s.customer_name}","${s.item_name}",${s.quantity},${s.total_amount},${s.paid_amount},${s.due_amount},"${s.purchase_date}"\n` }); downloadCSV(csv, `sales-${today()}.csv`) }}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali hover:bg-blue-700">
              <Download size={14} /> বিক্রির রিপোর্ট
            </button>
            <button onClick={exportHalkhataExcel}
              className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali hover:bg-amber-600">
              <Download size={14} /> হালখাতা Excel
            </button>
          </div>
          <button onClick={() => { let csv = 'নাম,Generic,Category,স্টক,Unit,মেয়াদ,MRP,Cost\n'; medicines.forEach(m => { csv += `"${m.name}","${m.generic}","${m.category}",${m.stock},"${m.unit}","${m.expiry}",${m.mrp},${m.cost_price}\n` }); downloadCSV(csv, `stock-${today()}.csv`) }}
            className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 bengali hover:bg-emerald-700">
            <Download size={14} /> স্টক রিপোর্ট Excel
          </button>
        </div>
      )}


      {/* ════════════════ SETTINGS TAB ════════════════ */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <div className="font-bold text-emerald-800 bengali text-sm mb-3">🏪 ফার্মেসির তথ্য</div>
            <div className="space-y-3">
              {[
                { label: 'ফার্মেসির নাম *', key: 'pharmacy_name', placeholder: 'যেমন: রহমান ফার্মেসি' },
                { label: 'মালিকের নাম', key: 'owner_name', placeholder: 'আপনার নাম' },
                { label: 'ফোন নম্বর', key: 'phone', placeholder: '01XXXXXXXXX' },
                { label: 'ঠিকানা', key: 'address', placeholder: 'গ্রাম, ব্লক, জেলা' },
                { label: 'লাইসেন্স নম্বর', key: 'license_no', placeholder: 'ড্রাগ লাইসেন্স নম্বর' },
                { label: 'GSTIN', key: 'gstin', placeholder: 'GST নম্বর (যদি থাকে)' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 bengali">{f.label}</label>
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    value={(pharmacySettings as any)[f.key] || ''}
                    onChange={e => setPharmacySettings(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={savePharmacyProfile}
              className="mt-4 w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
            >
              <Save size={15} /> সেভ করুন
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="font-bold text-blue-800 bengali text-sm mb-2">💡 AI সহায়ক সম্পর্কে</div>
            <p className="text-xs text-gray-600 bengali leading-relaxed">
              আপনার ফার্মেসির AI সহায়ক আপনার <b>real stock, রোগীর তালিকা, বিক্রির ইতিহাস</b> দেখে উত্তর দেয়।
              কোনো তথ্য বানিয়ে বলে না। ফার্মেসির নাম সেভ করলে AI উত্তরে সেই নাম ব্যবহার করবে।
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="font-bold text-gray-700 bengali text-sm mb-2">⚠️ Data সুরক্ষা</div>
            <p className="text-xs text-gray-500 bengali leading-relaxed">
              আপনার সমস্ত ডেটা Supabase-এ encrypted ভাবে সংরক্ষিত। শুধুমাত্র আপনি আপনার data দেখতে পারবেন।
              অন্য কোনো ফার্মেসি আপনার data দেখতে পারবে না।
            </p>
          </div>
        </div>
      )}


      {/* ════════════════ CUSTOM MESSAGE MODAL ════════════════ */}
      {customMsgPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCustomMsgPatient(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali">💬 বার্তা পাঠান</div>
            <div className="text-sm text-blue-700 font-semibold bengali">{customMsgPatient.name} {customMsgPatient.phone ? `(${customMsgPatient.phone})` : ''}</div>
            <textarea
              rows={5}
              className="w-full border-2 border-blue-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bengali"
              placeholder="এখানে বার্তা লিখুন..."
              value={customMsgText || (customMsgPatient.total_due && customMsgPatient.total_due > 0
                ? `নমস্কার ${customMsgPatient.name}! আপনার ফার্মেসিতে মোট বাকি: ₹${(customMsgPatient.total_due || 0).toFixed(0)}। অনুগ্রহ করে পরিশোধ করুন। 🙏\n— ${pharmacySettings.pharmacy_name || 'ফার্মেসি সহায়ক'}`
                : `নমস্কার ${customMsgPatient.name}! ${pharmacySettings.pharmacy_name || 'ফার্মেসি সহায়ক'} থেকে যোগাযোগ করা হচ্ছে।`)}
              onChange={e => setCustomMsgText(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => sharePatientWhatsApp(customMsgPatient, customMsgText || undefined)}
                className="bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5 hover:bg-green-600">
                <MessageCircle size={15} /> WhatsApp
              </button>
              <button
                onClick={() => sharePatientSMS(customMsgPatient, customMsgText || undefined)}
                className="bg-purple-500 text-white py-2.5 rounded-xl text-sm font-bold bengali flex items-center justify-center gap-1.5 hover:bg-purple-600">
                <Send size={15} /> SMS
              </button>
            </div>
            <button onClick={() => setCustomMsgPatient(null)} className="w-full bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-bold bengali">বাতিল</button>
          </div>
        </div>
      )}


      {/* ════════════════ PAYMENT MODAL ════════════════ */}
      {payingPurchase && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPayingPurchase(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-gray-800 bengali mb-1">💰 পেমেন্ট গ্রহণ</div>
            <div className="text-xs text-gray-500 bengali mb-3">{payingPurchase.item_name} · বাকি: {fmtAmt(payingPurchase.due_amount)}</div>
            <label className="text-xs text-gray-500 bengali">পরিশোধের পরিমাণ (₹)</label>
            <input type="number" value={payAmount} min={1} max={Number(payingPurchase.due_amount)}
              onChange={e => setPayAmount(+e.target.value)}
              className="w-full border-2 border-emerald-400 rounded-xl px-3 py-2.5 text-xl font-bold text-center mt-1 mb-4 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={savePayment} disabled={savingPayment || payAmount <= 0}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-bold bengali disabled:opacity-60 flex items-center justify-center gap-1">
                {savingPayment ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />} নিশ্চিত করুন
              </button>
              <button onClick={() => setPayingPurchase(null)}
                className="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl font-bold bengali">বাতিল</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
