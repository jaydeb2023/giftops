'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  FileText, Plus, Trash2, Printer, Download, Share2, X, Loader2, Image as ImageIcon,
  Sparkles, Mic, MicOff, Store, PenLine, ChevronDown, ChevronUp, GripVertical, ScanLine,
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import { BillingProfile } from '@/lib/billing'
import {
  createInvoice, getInvoiceWithItems, DiscountType, DocType, InvoiceLineItem, InvoiceRecord,
} from '@/lib/invoices'
import { useCustomCategories } from '@/lib/useCustomCategories'
import InvoicePrintable, { computePreviewTotals } from '@/components/InvoicePrintable'
import { downloadInvoicePdf, downloadInvoicePng, printInvoiceNode, shareInvoiceNative } from '@/lib/invoiceExport'

import { tr } from '@/lib/i18n/tr'
interface Customer { id: string; name: string; phone: string | null; address: string | null }
interface CatalogProduct { id: string; name: string; price: number }

type CustomerMode = 'existing' | 'new' | 'cash'

const GST_RATES = [0, 5, 12, 18, 28]
const DEFAULT_CATEGORIES = ['সাধারণ', 'বিক্রয়', 'সার্ভিস', 'সরবরাহ']
const emptyLine = (): InvoiceLineItem => ({ item_name: '', hsn_code: '', quantity: 1, unit: 'পিস', unit_price: 0, line_discount: 0 })

export default function InvoiceBuilder({
  userId, invoiceId, onClose, onSaved,
}: {
  userId: string
  /** Pass an existing invoice id to reopen it read-only (reprint/resend from History). */
  invoiceId?: string
  onClose?: () => void
  onSaved?: (invoice: InvoiceRecord) => void
}) {
  const previewRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<BillingProfile>({ shop_name: 'আমার দোকান' })
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [productQuery, setProductQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState<'pdf' | 'png' | 'share' | null>(null)

  // Saved invoice state — once saved (or opened from History) the form locks
  // and we show the real record instead.
  const [saved, setSaved] = useState<InvoiceRecord | null>(null)
  const readOnly = !!saved

  const { categories } = useCustomCategories(userId, 'invoice', DEFAULT_CATEGORIES)

  const [docType, setDocType] = useState<DocType>('invoice')
  const [category, setCategory] = useState(DEFAULT_CATEGORIES[0])
  const [customerMode, setCustomerMode] = useState<CustomerMode>('cash')
  const [customerId, setCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' })
  const [items, setItems] = useState<InvoiceLineItem[]>([emptyLine()])
  const [gstEnabled, setGstEnabled] = useState(false)
  const [gstRate, setGstRate] = useState(18)
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState(0)
  const [paidAmount, setPaidAmount] = useState<string>('')
  const [notes, setNotes] = useState('')

  // ── AI / voice quick-fill ────────────────────────────────────
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // ── Business info (logo / name / address / signature) ───────
  // Editable right here so the owner doesn't have to jump to Settings
  // to see their brand appear on the invoice.
  const [bizOpen, setBizOpen] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingSignature, setUploadingSignature] = useState(false)
  const [savingBiz, setSavingBiz] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('shop_name, owner_name, phone, address, upi_id, gstin, print_footer, signature_url, logo_url').eq('id', userId).single(),
      supabase.from('crm_customers').select('id, name, phone, address').eq('user_id', userId).order('name'),
      supabase.from('catalog_products').select('id, name, price').eq('user_id', userId).eq('is_active', true).order('name'),
    ]).then(([profileRes, custRes, prodRes]) => {
      if (profileRes.data) setProfile(profileRes.data)
      setCustomers(custRes.data || [])
      setProducts(prodRes.data || [])
      setLoading(false)
    })
  }, [userId])

  // Reopen an existing invoice (from Invoice History → "দেখুন")
  useEffect(() => {
    if (!invoiceId) return
    setLoading(true)
    getInvoiceWithItems(invoiceId).then(inv => {
      if (!inv) { toast.error('ইনভয়েস পাওয়া যায়নি'); setLoading(false); return }
      setSaved(inv)
      setDocType(inv.doc_type)
      setItems(inv.invoice_items.map(it => ({ ...it })))
      setGstEnabled(inv.gst_enabled)
      setGstRate(inv.gst_rate)
      setDiscountType(inv.discount_type)
      setDiscountValue(inv.discount_value)
      setPaidAmount(String(inv.paid_amount))
      setNotes(inv.notes || '')
      setLoading(false)
    })
  }, [invoiceId])

  const selectedCustomer = customers.find(c => c.id === customerId)
  const customerName =
    saved ? saved.customer_name :
    customerMode === 'existing' ? (selectedCustomer?.name || '') :
    customerMode === 'new' ? newCustomer.name : 'নগদ কাস্টমার'
  const customerPhone =
    saved ? saved.customer_phone :
    customerMode === 'existing' ? selectedCustomer?.phone :
    customerMode === 'new' ? newCustomer.phone : undefined
  const customerAddress =
    saved ? saved.customer_address :
    customerMode === 'existing' ? selectedCustomer?.address :
    customerMode === 'new' ? newCustomer.address : undefined

  const previewData = useMemo(() => ({
    invoice_number: saved?.invoice_number || 'সেভ করার পর দেওয়া হবে',
    doc_type: docType,
    date_label: new Date(saved?.created_at || Date.now()).toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    customer_name: customerName || 'নগদ কাস্টমার',
    customer_phone: customerPhone,
    customer_address: customerAddress,
    items,
    gst_enabled: gstEnabled,
    gst_rate: gstRate,
    discount_type: discountType,
    discount_value: discountValue,
    paid_amount: Number(paidAmount || 0),
  }), [saved, docType, customerName, customerPhone, customerAddress, items, gstEnabled, gstRate, discountType, discountValue, paidAmount])

  const { subtotal, discountAmount, gstAmount, total } = computePreviewTotals(previewData)

  const updateItem = (idx: number, patch: Partial<InvoiceLineItem>) =>
    setItems(list => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const addItem = () => setItems(list => [...list, emptyLine()])
  const removeItem = (idx: number) => setItems(list => (list.length > 1 ? list.filter((_, i) => i !== idx) : list))
  // Searchable customer combobox — what's typed while picking a customer
  // (kept separate from the actual selection so clearing/reselecting is
  // simple: the input is never "the value", just a filter).
  const [customerQuery, setCustomerQuery] = useState('')
  // Quick-add from the catalog search — fills a line straight from a saved
  // product (name + price) instead of typing it from scratch every time.
  // If the form's only line is still empty, replace it rather than stack.
  const addProduct = (p: CatalogProduct) => {
    setItems(list => {
      const line: InvoiceLineItem = { item_name: p.name, hsn_code: '', quantity: 1, unit: 'পিস', unit_price: p.price, line_discount: 0 }
      if (list.length === 1 && !list[0].item_name.trim()) return [line]
      return [...list, line]
    })
    setProductQuery('')
  }
  const matchingProducts = productQuery.trim()
    ? products.filter(p => p.name.toLowerCase().includes(productQuery.trim().toLowerCase())).slice(0, 6)
    : []
  const matchingCustomers = customerQuery.trim()
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerQuery.trim().toLowerCase()) ||
        (c.phone || '').includes(customerQuery.trim())
      ).slice(0, 6)
    : []

  const valid =
    items.every(it => it.item_name.trim() && it.quantity > 0 && it.unit_price > 0) &&
    (customerMode !== 'existing' || !!customerId) &&
    (customerMode !== 'new' || !!newCustomer.name.trim())

  const handleSave = async () => {
    if (!valid) { toast.error('সব পণ্যের নাম, পরিমাণ ও দাম দিন এবং কাস্টমার বেছে নিন'); return }
    setSaving(true)
    try {
      let finalCustomerId: string | null = null
      let finalCustomerAddress = customerAddress || null

      if (customerMode === 'existing') {
        finalCustomerId = customerId
      } else if (customerMode === 'new' && newCustomer.name.trim()) {
        const { data: created, error } = await supabase.from('crm_customers')
          .insert({ user_id: userId, name: newCustomer.name.trim(), phone: newCustomer.phone || null, address: newCustomer.address || null, source: 'invoice' })
          .select('id').single()
        if (error) throw error
        finalCustomerId = created.id
      }

      const invoice = await createInvoice(userId, {
        doc_type: docType,
        category,
        customer_id: finalCustomerId,
        customer_name: customerName || 'নগদ কাস্টমার',
        customer_phone: customerPhone || null,
        customer_address: finalCustomerAddress,
        gst_enabled: gstEnabled,
        gst_rate: gstEnabled ? gstRate : 0,
        discount_type: discountType,
        discount_value: discountValue,
        items,
        paid_amount: docType === 'quotation' ? 0 : Number(paidAmount || total),
        notes: notes.trim() || undefined,
      })

      setSaved(invoice)
      toast.success(`${docType === 'quotation' ? 'কোটেশন' : 'ইনভয়েস'} সেভ হয়েছে — নং ${invoice.invoice_number}`)
      onSaved?.(invoice)
    } catch (e: any) {
      console.error('createInvoice failed:', e)
      // Show the real Supabase/Postgres reason so the problem can be diagnosed
      const reason = [e?.code, e?.message, e?.details, e?.hint].filter(Boolean).join(' | ')
      toast.error(`সেভ করতে সমস্যা হয়েছে${reason ? ': ' + reason : ''}`, { duration: 15000 })
    }
    setSaving(false)
  }

  // Toggle browser speech-to-text (Chrome/Edge). Falls back silently — the
  // text box always works even where SpeechRecognition isn't supported.
  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      toast.error('এই ব্রাউজারে ভয়েস সাপোর্ট নেই — টাইপ করে লিখুন।')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SR()
    rec.lang = 'bn-IN'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (e: any) => {
      const said = e.results?.[0]?.[0]?.transcript || ''
      setAiText(prev => (prev ? `${prev} ${said}` : said))
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    rec.start()
  }

  // Sends the typed/spoken sentence to the AI parser and fills the form —
  // the owner still reviews/edits every field before saving, nothing is
  // auto-saved from this step.
  const handleAiGenerate = async () => {
    if (!aiText.trim()) { toast.error('আগে কিছু লিখুন বা মাইকে বলুন'); return }
    setAiLoading(true)
    try {
      const res = await fetch('/api/invoice/ai-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiText }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'বুঝতে পারলাম না, আবার চেষ্টা করুন'); return }

      const parsed = data.result as {
        customer_name: string | null; customer_phone: string | null
        paid_amount: number | null; items: InvoiceLineItem[]
      }

      setItems(parsed.items.map(it => ({ ...it, hsn_code: '', line_discount: 0 })))

      if (parsed.customer_name) {
        const match = customers.find(c => c.name.trim().toLowerCase() === parsed.customer_name!.trim().toLowerCase())
        if (match) {
          setCustomerMode('existing')
          setCustomerId(match.id)
        } else {
          setCustomerMode('new')
          setNewCustomer({ name: parsed.customer_name, phone: parsed.customer_phone || '', address: '' })
        }
      }
      if (parsed.paid_amount != null) setPaidAmount(String(parsed.paid_amount))

      toast.success('ইনভয়েস ভরে দিয়েছি — নিচে দেখে ঠিক করে নিন')
      setAiText('')
    } catch (e) {
      console.error('ai-parse failed:', e)
      toast.error('AI থেকে উত্তর পাওয়া যায়নি')
    }
    setAiLoading(false)
  }

  // Debounced-ish save of text fields (shop name / address) to profiles.
  const saveBizField = async (patch: Partial<BillingProfile>) => {
    setProfile(p => ({ ...p, ...patch }))
    setSavingBiz(true)
    try {
      const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (error) throw error
    } catch (e: any) {
      toast.error(e.message || 'সেভ করা যায়নি')
    }
    setSavingBiz(false)
  }

  const uploadBrandImage = async (file: File, kind: 'logo' | 'signature') => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingSignature
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${kind}-${uuidv4()}.${ext}`
      const { error: upErr } = await supabase.storage.from('catalog-images').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('catalog-images').getPublicUrl(path)
      const field = kind === 'logo' ? 'logo_url' : 'signature_url'
      const { error: dbErr } = await supabase.from('profiles').update({ [field]: pub.publicUrl }).eq('id', userId)
      if (dbErr) throw dbErr
      setProfile(p => ({ ...p, [field]: pub.publicUrl }))
      toast.success(kind === 'logo' ? 'লোগো আপডেট হয়েছে!' : 'স্বাক্ষর আপডেট হয়েছে!')
    } catch (e: any) {
      toast.error(e.message || 'ছবি আপলোড করা যায়নি')
    }
    setUploading(false)
  }

  const removeBrandImage = async (kind: 'logo' | 'signature') => {
    const field = kind === 'logo' ? 'logo_url' : 'signature_url'
    const { error } = await supabase.from('profiles').update({ [field]: null }).eq('id', userId)
    if (error) { toast.error('মুছে ফেলা যায়নি'); return }
    setProfile(p => ({ ...p, [field]: null }))
    toast.success(kind === 'logo' ? 'লোগো মুছে ফেলা হয়েছে' : 'স্বাক্ষর মুছে ফেলা হয়েছে')
  }

  const filenameBase = saved?.invoice_number || 'invoice-preview'

  // Draft/Template/Excel-import/Barcode-scan aren't backed by real storage
  // yet (no drafts table, no template picker, no product-import parser, no
  // camera scan) — surfaced as real buttons so the page matches the target
  // design, but honest about not being wired up until built.
  const comingSoon = (label: string) => toast(`${label} — এই ফিচারটি শীঘ্রই আসছে`, { icon: '🛠️' })

  const handlePrint = () => {
    if (!previewRef.current) return
    printInvoiceNode(previewRef.current, `${docType === 'quotation' ? 'কোটেশন' : 'ইনভয়েস'} - ${profile.shop_name}`)
  }
  const handleDownload = async (format: 'pdf' | 'png') => {
    if (!previewRef.current) return
    setExporting(format)
    try {
      if (format === 'pdf') await downloadInvoicePdf(previewRef.current, filenameBase)
      else await downloadInvoicePng(previewRef.current, filenameBase)
    } catch (e) {
      console.error('download failed:', e)
      toast.error('ডাউনলোড করতে সমস্যা হয়েছে')
    }
    setExporting(null)
  }
  const handleShare = async (format: 'pdf' | 'png') => {
    if (!previewRef.current) return
    setExporting('share')
    await shareInvoiceNative(previewRef.current, {
      filename: filenameBase,
      format,
      customerPhone,
      message: `🧾 ${profile.shop_name} — ${docType === 'quotation' ? 'কোটেশন' : 'ইনভয়েস'} ${saved?.invoice_number || ''}, মোট ₹${total.toFixed(0)}`,
    })
    setExporting(null)
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm bengali">{tr('লোড হচ্ছে...')}</div>

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6 max-sm:gap-4 min-w-0">
      {/* ── Form ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 max-sm:p-3 space-y-4 max-sm:space-y-3 min-w-0 max-w-full">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-bold text-gray-900 bengali flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" />
            {invoiceId ? tr('ইনভয়েস দেখুন') : tr('ইনভয়েস তৈরি করুন')}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {!readOnly && (
              <>
                <button onClick={() => comingSoon('ড্রাফট সেভ')}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11.5px] font-bold bengali">
                  {tr('ড্রাফট সেভ')}
                </button>
                <button onClick={() => comingSoon('টেমপ্লেট')}
                  className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11.5px] font-bold bengali">
                  {tr('টেমপ্লেট')}
                </button>
                <button onClick={() => comingSoon('Excel/CSV ইমপোর্ট')}
                  className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 text-[11.5px] font-bold">
                  {tr('Excel/CSV ইমপোর্ট')}
                </button>
              </>
            )}
            {onClose && <button onClick={onClose}><X size={18} className="text-gray-400" /></button>}
          </div>
        </div>

        {/* ── AI / voice quick-fill ──────────────────────────── */}
        {!readOnly && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 bengali">
              <Sparkles size={14} /> {tr('AI দিয়ে লিখুন — টাইপ করুন বা মাইকে বলুন')}
            </div>
            <textarea
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              placeholder={tr('যেমন: রাহুলকে ৫ কেজি চাল ৬০ টাকা করে আর ২ লিটার তেল ১৪৫ টাকা, ২০০ টাকা পেয়েছি')}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-indigo-200 text-[13px] bengali bg-white resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={toggleMic}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold bengali ${listening ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-white text-indigo-600 border border-indigo-200'}`}
              >
                {listening ? <MicOff size={14} /> : <Mic size={14} />}
                {listening ? tr('শুনছি...') : tr('বলুন')}
              </button>
              <button
                onClick={handleAiGenerate}
                disabled={aiLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 text-white font-bold text-[12px] bengali disabled:opacity-60"
              >
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiLoading ? tr('বানাচ্ছি...') : tr('ইনভয়েস বানান')}
              </button>
            </div>
          </div>
        )}

        {/* ── Business info (logo / name / address / signature) ── */}
        {!readOnly && (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setBizOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50"
            >
              <span className="flex items-center gap-1.5 text-[12px] font-bold text-gray-700 bengali">
                <Store size={14} className="text-indigo-600" /> {tr('ব্যবসার তথ্য (লোগো, নাম, ঠিকানা, স্বাক্ষর)')}
              </span>
              {bizOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {bizOpen && (
              <div className="p-3 space-y-3 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  {/* Logo upload */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1.5">{tr('লোগো')}</label>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {profile.logo_url
                          ? <img src={profile.logo_url} alt={tr('লোগো')} className="w-full h-full object-cover" />
                          : <span className="text-xl">🏪</span>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-bold bengali cursor-pointer text-center">
                          {uploadingLogo ? '...' : profile.logo_url ? tr('পরিবর্তন') : tr('আপলোড')}
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandImage(f, 'logo'); e.target.value = '' }} />
                        </label>
                        {profile.logo_url && (
                          <button onClick={() => removeBrandImage('logo')} className="text-[10px] text-red-500 font-semibold bengali text-left">{tr('মুছে ফেলুন')}</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Signature upload */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1.5">{tr('স্বাক্ষর')}</label>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {profile.signature_url
                          ? <img src={profile.signature_url} alt={tr('স্বাক্ষর')} className="w-full h-full object-contain" />
                          : <PenLine size={16} className="text-gray-300" />}
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 text-[11px] font-bold bengali cursor-pointer text-center">
                          {uploadingSignature ? '...' : profile.signature_url ? tr('পরিবর্তন') : tr('আপলোড')}
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingSignature}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadBrandImage(f, 'signature'); e.target.value = '' }} />
                        </label>
                        {profile.signature_url && (
                          <button onClick={() => removeBrandImage('signature')} className="text-[10px] text-red-500 font-semibold bengali text-left">{tr('মুছে ফেলুন')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <input
                  placeholder={tr('ব্যবসার নাম')}
                  defaultValue={profile.shop_name}
                  onBlur={e => { if (e.target.value.trim() && e.target.value !== profile.shop_name) saveBizField({ shop_name: e.target.value.trim() }) }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali"
                />
                <input
                  placeholder={tr('ঠিকানা')}
                  defaultValue={profile.address || ''}
                  onBlur={e => { if (e.target.value !== (profile.address || '')) saveBizField({ address: e.target.value }) }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali"
                />
                {savingBiz && <p className="text-[10px] text-gray-400 bengali">{tr('সেভ হচ্ছে...')}</p>}
              </div>
            )}
          </div>
        )}

        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={() => setDocType('invoice')}
              className={`flex-1 py-2 rounded-lg text-[13px] font-bold bengali ${docType === 'invoice' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {tr('ট্যাক্স ইনভয়েস')}
            </button>
            <button onClick={() => setDocType('quotation')}
              className={`flex-1 py-2 rounded-lg text-[13px] font-bold bengali ${docType === 'quotation' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {tr('কোটেশন / এস্টিমেট')}
            </button>
          </div>
        )}

        {!readOnly && (
          <div>
            <label className="text-[11px] font-semibold text-gray-500 bengali">{tr('ক্যাটাগরি')}</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali bg-white">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Customer picker + invoice info */}
        {!readOnly && (
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Customer */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 bengali mb-1 block">{tr('কাস্টমার নির্বাচন')} <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                    placeholder={tr('কাস্টমার নাম, ফোন লিখুন...')}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali"
                  />
                  {matchingCustomers.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {matchingCustomers.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setCustomerMode('existing'); setCustomerId(c.id); setCustomerQuery('') }}
                          className="w-full flex items-center justify-between px-3 py-2 text-[13px] hover:bg-indigo-50 text-left">
                          <span className="bengali">{c.name}</span>
                          {c.phone && <span className="text-gray-400 text-[11px]">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => { setCustomerMode('new'); setCustomerQuery('') }}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-[12px] font-bold bengali whitespace-nowrap">
                  <Plus size={13} /> {tr('নতুন কাস্টমার')}
                </button>
              </div>

              {customerMode === 'new' && (
                <div className="mt-2 space-y-2 border border-indigo-100 rounded-lg p-2.5 bg-indigo-50/40">
                  <input placeholder={tr('নাম *')} value={newCustomer.name} onChange={e => setNewCustomer(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali bg-white" />
                  <input placeholder={tr('ফোন নম্বর')} value={newCustomer.phone} onChange={e => setNewCustomer(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bg-white" />
                  <input placeholder={tr('ঠিকানা')} value={newCustomer.address} onChange={e => setNewCustomer(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali bg-white" />
                </div>
              )}

              {/* Selected customer card */}
              {((customerMode === 'existing' && selectedCustomer) || (customerMode === 'new' && newCustomer.name.trim())) && (
                <div className="mt-2 flex items-center gap-3 border border-gray-100 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {(customerName || '?').trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-gray-900 text-[13px] bengali truncate">{customerName}</div>
                    {customerPhone && <div className="text-[12px] text-gray-500">📞 {customerPhone}</div>}
                    {customerAddress && <div className="text-[11px] text-gray-400 bengali truncate">📍 {customerAddress}</div>}
                  </div>
                  <button type="button"
                    onClick={() => { setCustomerMode('cash'); setCustomerId(''); setNewCustomer({ name: '', phone: '', address: '' }) }}
                    className="text-[11px] font-bold text-indigo-600 bengali flex-shrink-0">{tr('সম্পাদনা')}</button>
                </div>
              )}
              {customerMode === 'cash' && (
                <p className="text-[11px] text-gray-400 bengali mt-1">{tr('কাস্টমার বেছে না নিলে &ldquo;নগদ কাস্টমার&rdquo; হিসেবে সেভ হবে।')}</p>
              )}
            </div>

            {/* Invoice info */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 bengali mb-1 block">{tr('ইনভয়েস তথ্য')}</label>
              <div className="border border-gray-100 rounded-xl p-3 space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 bengali">{tr('ইনভয়েস নম্বর')}</span>
                  <span className="font-semibold text-gray-700">{tr('সেভ করার পর দেওয়া হবে')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 bengali">{tr('তারিখ')}</span>
                  <span className="font-semibold text-gray-700">{new Date().toLocaleDateString('bn-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 bengali">{tr('ধরন')}</span>
                  <span className="font-semibold text-gray-700 bengali">{docType === 'quotation' ? tr('কোটেশন') : tr('ইনভয়েস')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Line items */}
        <div>
          <label className="text-[11px] font-semibold text-gray-500 bengali mb-2 block">{tr('পণ্য যোগ করুন')}</label>

          {!readOnly && (
            <div className="flex gap-2 mb-3">
              {/* Quick-add from saved catalog products, so repeat items don't
                  need retyping name/price every time. */}
              <div className="relative flex-1">
                <input
                  value={productQuery}
                  onChange={e => setProductQuery(e.target.value)}
                  placeholder={tr('পণ্যের নাম লিখুন বা বারকোড স্ক্যান করুন...')}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali"
                />
                {matchingProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {matchingProducts.map(p => (
                      <button key={p.id} onClick={() => addProduct(p)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[13px] hover:bg-indigo-50 text-left">
                        <span className="bengali">{p.name}</span>
                        <span className="text-gray-400 text-[12px]">₹{p.price}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={addItem} className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 text-white text-[12px] font-bold bengali whitespace-nowrap">
                <Plus size={13} /> {tr('নতুন পণ্য')}
              </button>
            </div>
          )}

          {readOnly ? (
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="border border-gray-100 rounded-xl p-3 flex items-center justify-between text-[13px]">
                  <span className="bengali">{it.item_name}</span>
                  <span className="text-gray-500">{it.quantity} {it.unit} × ₹{it.unit_price}</span>
                </div>
              ))}
            </div>
          ) : (
            <>
            <div className="sm:hidden space-y-2">
              {items.map((it, idx) => {
                const lineTotal = it.quantity * it.unit_price - (it.line_discount || 0)
                return (
                  <div key={idx} className="border border-gray-100 rounded-xl p-2.5 bg-white space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-gray-400 w-4 flex-shrink-0">{idx + 1}</span>
                      <input placeholder={tr('পণ্য/সেবার নাম')} value={it.item_name}
                        onChange={e => updateItem(idx, { item_name: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 text-[13px] bengali" />
                      {items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-lg bg-red-50 text-red-500 inline-flex items-center justify-center flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      <label className="min-w-0 text-[10px] text-gray-400 bengali">{tr('পরিমাণ')}
                        <input type="number" value={it.quantity} onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                          className="w-full mt-0.5 px-1.5 py-1.5 rounded-lg border border-gray-200 text-[12.5px] text-gray-800" />
                      </label>
                      <label className="min-w-0 text-[10px] text-gray-400 bengali">{tr('ইউনিট')}
                        <input value={it.unit} onChange={e => updateItem(idx, { unit: e.target.value })}
                          className="w-full mt-0.5 px-1.5 py-1.5 rounded-lg border border-gray-200 text-[12.5px] text-gray-800 bengali" />
                      </label>
                      <label className="min-w-0 text-[10px] text-gray-400 bengali">{tr('দর (₹)')}
                        <input type="number" value={it.unit_price} onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })}
                          className="w-full mt-0.5 px-1.5 py-1.5 rounded-lg border border-gray-200 text-[12.5px] text-gray-800" />
                      </label>
                      <label className="min-w-0 text-[10px] text-gray-400 bengali">{tr('ছাড় (₹)')}
                        <input type="number" value={it.line_discount} onChange={e => updateItem(idx, { line_discount: Number(e.target.value) })}
                          className="w-full mt-0.5 px-1.5 py-1.5 rounded-lg border border-gray-200 text-[12.5px] text-gray-800" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between text-[12px] pt-1 border-t border-gray-50">
                      <span className="text-gray-400 bengali">{tr('মোট')}</span>
                      <span className="font-bold text-gray-800">{tr('₹')}{lineTotal.toFixed(0)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="max-sm:hidden overflow-x-auto -mx-1">
              <table className="w-full text-[12.5px] min-w-[560px]">
                <thead>
                  <tr className="text-gray-400 text-[11px] bengali">
                    <th className="w-8"></th>
                    <th className="text-left font-semibold px-1 py-1.5 w-8">#</th>
                    <th className="text-left font-semibold px-1 py-1.5">{tr('পণ্যের নাম')}</th>
                    <th className="text-left font-semibold px-1 py-1.5 w-20">{tr('পরিমাণ')}</th>
                    <th className="text-left font-semibold px-1 py-1.5 w-20">{tr('ইউনিট')}</th>
                    <th className="text-left font-semibold px-1 py-1.5 w-24">{tr('দর (₹)')}</th>
                    <th className="text-left font-semibold px-1 py-1.5 w-20">{tr('ছাড় (₹)')}</th>
                    <th className="text-right font-semibold px-1 py-1.5 w-24">{tr('মোট (₹)')}</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lineTotal = it.quantity * it.unit_price - (it.line_discount || 0)
                    return (
                      <tr key={idx} className="border-t border-gray-100">
                        <td className="px-1 py-1.5 text-gray-300"><GripVertical size={13} /></td>
                        <td className="px-1 py-1.5 text-gray-400">{idx + 1}</td>
                        <td className="px-1 py-1.5">
                          <input placeholder={tr('পণ্য/সেবার নাম')} value={it.item_name}
                            onChange={e => updateItem(idx, { item_name: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[12.5px] bengali" />
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" value={it.quantity}
                            onChange={e => updateItem(idx, { quantity: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[12.5px]" />
                        </td>
                        <td className="px-1 py-1.5">
                          <input value={it.unit}
                            onChange={e => updateItem(idx, { unit: e.target.value })}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[12.5px] bengali" />
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" value={it.unit_price}
                            onChange={e => updateItem(idx, { unit_price: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[12.5px]" />
                        </td>
                        <td className="px-1 py-1.5">
                          <input type="number" value={it.line_discount}
                            onChange={e => updateItem(idx, { line_discount: Number(e.target.value) })}
                            className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-[12.5px]" />
                        </td>
                        <td className="px-1 py-1.5 text-right font-semibold text-gray-700">{lineTotal.toFixed(0)}</td>
                        <td className="px-1 py-1.5">
                          {items.length > 1 && (
                            <button onClick={() => removeItem(idx)} className="w-7 h-7 rounded-lg bg-red-50 text-red-500 inline-flex items-center justify-center">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
          {!readOnly && (
            <button onClick={() => comingSoon('বারকোড স্ক্যান')}
              className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-gray-400 bengali">
              <ScanLine size={14} /> Scan Barcode
            </button>
          )}
        </div>

        {/* Totals + notes footer */}
        {!readOnly && (
          <div className="grid sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-gray-500 bengali block mb-1">{tr('নোট (ইচ্ছা করলে)')}</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={tr('যেমন: ধন্যবাদ আমাদের সাথে থাকার জন্য...')}
                rows={4}
                maxLength={300}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] bengali resize-none"
              />
            </div>
            <div className="rounded-xl border border-gray-100 p-3 space-y-2 text-[13px] h-fit">
              <div className="flex items-center justify-between text-gray-600">
                <span className="bengali">{tr('সাবটোটাল')}</span><span>{tr('₹')}{subtotal.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="bengali text-gray-600">{tr('ছাড়')}</span>
                <div className="flex items-center gap-1.5">
                  <select value={discountType} onChange={e => setDiscountType(e.target.value as DiscountType)}
                    className="px-1.5 py-1 rounded-md border border-gray-200 text-[11px] bg-white">
                    <option value="none">{tr('নেই')}</option>
                    <option value="flat">{tr('₹ ফ্ল্যাট')}</option>
                    <option value="percent">{tr('% শতাংশ')}</option>
                  </select>
                  {discountType !== 'none' && (
                    <input type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded-md border border-gray-200 text-[12px]" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span className="bengali">{tr('ছাড়ের পরিমাণ')}</span><span>{tr('-₹')}{discountAmount.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
                <label className="flex items-center gap-1.5 bengali text-gray-600">
                  <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)} className="rounded" />
                  GST / VAT
                </label>
                {gstEnabled && (
                  <select value={gstRate} onChange={e => setGstRate(Number(e.target.value))}
                    className="px-1.5 py-1 rounded-md border border-gray-200 text-[11px] bg-white">
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                )}
              </div>
              {gstEnabled && (
                <div className="flex items-center justify-between text-gray-600">
                  <span>GST ({gstRate}%)</span><span>{tr('₹')}{gstAmount.toFixed(0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between font-bold text-gray-900 text-[15px] pt-1 border-t border-gray-100">
                <span className="bengali">{tr('সর্বমোট')}</span><span>{tr('₹')}{total.toFixed(0)}</span>
              </div>
            </div>
          </div>
        )}

        {!readOnly && docType === 'invoice' && (
          <input placeholder={`পরিশোধ (ডিফল্ট: পুরো ₹${total.toFixed(0)})`} type="number" value={paidAmount}
            onChange={e => setPaidAmount(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-[13px]" />
        )}

        {!readOnly ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11.5px] bengali">
              <Printer size={16} /> {tr('প্রিভিউ দেখুন')}
            </button>
            <button onClick={() => handleShare('pdf')} disabled={exporting !== null || !valid}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-[11.5px] bengali disabled:opacity-50">
              {exporting === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} {tr('WhatsApp এ পাঠান')}
            </button>
            <button onClick={() => handleDownload('pdf')} disabled={exporting !== null || !valid}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11.5px] bengali disabled:opacity-50">
              {exporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {tr('PDF সেভ')}
            </button>
            <button onClick={handleSave} disabled={saving || !valid}
              className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-[11.5px] bengali disabled:opacity-50">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {saving ? tr('সেভ হচ্ছে...') : tr('ইনভয়েস তৈরি করুন')}
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 text-emerald-700 rounded-lg p-3 text-[13px] font-semibold bengali">
            {tr('✅ সেভ হয়েছে —')} {docType === 'quotation' ? tr('কোটেশন') : tr('ইনভয়েস')} {tr('নং')} {saved!.invoice_number}
          </div>
        )}

        {saved && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button onClick={handlePrint} className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-[11.5px] bengali">
              <Printer size={16} /> {tr('প্রিন্ট')}
            </button>
            <div className="relative group">
              <button onClick={() => handleDownload('pdf')} disabled={exporting !== null}
                className="w-full h-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11.5px] bengali">
                {exporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PDF
              </button>
            </div>
            <div className="relative group">
              <button onClick={() => handleDownload('png')} disabled={exporting !== null}
                className="w-full h-full flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg bg-gray-100 text-gray-700 font-bold text-[11.5px] bengali">
                {exporting === 'png' ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} PNG
              </button>
            </div>
            <button onClick={() => handleShare('pdf')} disabled={exporting !== null}
              className="col-span-3 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-[13px] bengali">
              {exporting === 'share' ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />} {tr('কাস্টমারকে পাঠান (WhatsApp)')}
            </button>
          </div>
        )}
      </div>

      {/* ── Live preview ─────────────────────────────────────── */}
      <div className="lg:sticky lg:top-4 self-start min-w-0 max-w-full">
        <p className="text-[11px] font-semibold text-gray-400 bengali mb-2 text-center">{tr('লাইভ প্রিভিউ')}<span className="sm:hidden"> {tr('(ডানে-বামে সরান)')}</span></p>
        <div className="max-sm:overflow-x-auto max-sm:pb-1">
          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden mx-auto" style={{ width: 380 }}>
            <InvoicePrintable ref={previewRef} profile={profile} data={previewData} />
          </div>
        </div>
      </div>
    </div>
  )
}
