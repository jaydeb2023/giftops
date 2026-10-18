'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'
import { loadAllStock } from '@/lib/stockSources'
import { slugify, cleanSlugInput, isValidSlug } from '@/lib/catalogSlug'
import {
  ShoppingBag, Palette, Share2, Plus, X, Trash2, Edit2,
  ImagePlus, Loader2, ExternalLink, Copy, Eye, EyeOff, Store, RefreshCw, Link2, Package
} from 'lucide-react'

import { tr } from '@/lib/i18n/tr'
// ─── Types ────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  description: string
  price: number
  image_url: string | null
  category: string
  is_active: boolean
  stock_item_id?: string | null
  source_table?: string | null
}

interface Settings {
  slug?: string | null
  store_name: string
  tagline: string
  whatsapp_number: string
  theme_color: string
  logo_url: string | null
  is_published: boolean
}

const THEME_COLORS = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#0f172a']
const DEFAULT_SETTINGS: Settings = {
  store_name: 'আমার দোকান',
  tagline: '',
  whatsapp_number: '',
  theme_color: '#7c3aed',
  logo_url: null,
  is_published: true,
}

export default function ProductCatalogUI({ userId }: { userId: string }) {
  const [tab, setTab] = useState<'products' | 'design'>('products')
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<Product[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState<Partial<Product>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [slugDraft, setSlugDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [userId])

  const load = async () => {
    setLoading(true)
    const [{ data: prods }, { data: settingsRow }] = await Promise.all([
      supabase.from('catalog_products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('catalog_settings').select('*').eq('user_id', userId).maybeSingle(),
    ])
    let st = settingsRow as Settings | null
    if (!st) {
      // First visit: create the settings row (shop name = the business name) so the public page works immediately
      const { data: u } = await supabase.auth.getUser()
      const meta: any = u?.user?.user_metadata || {}
      const name = meta.business_name || meta.full_name || DEFAULT_SETTINGS.store_name
      const { data } = await supabase.from('catalog_settings').insert({ user_id: userId, ...DEFAULT_SETTINGS, store_name: name }).select().single()
      st = (data as Settings) || null
    }
    if (st && !st.slug) st = await assignSlug(st)
    if (st) { setSettings(st); setSlugDraft(st.slug || '') }
    setProducts((prods as Product[]) || [])
    setLoading(false)
    // Bring every product from Stock into the catalog (new ones only, in the background)
    syncFromStock(false)
  }

  // Pick a free link name from the business name: rahul-meat-shop, rahul-meat-shop-2, ...
  const assignSlug = async (st: Settings): Promise<Settings> => {
    const base = slugify(st.store_name)
    for (let n = 0; n < 8; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`
      const { error } = await supabase.from('catalog_settings').update({ slug: candidate }).eq('user_id', userId)
      if (!error) return { ...st, slug: candidate }
      if ((error as any).code !== '23505') break
    }
    return st
  }

  // ── Stock → catalog ───────────────────────────────────────────
  // New stock items are copied into the catalog. With `updateExisting` (manual
  // button) name / price / category of already-linked products are refreshed too.
  const syncFromStock = async (updateExisting: boolean) => {
    if (updateExisting) setSyncing(true)
    try {
      const [stock, { data: cur }] = await Promise.all([
        loadAllStock(supabase, userId),   // products of every agent (Dokan, built, Kapor, Mishti, Hotel, Pharmacy)
        supabase.from('catalog_products').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      ])
      const current = (cur as Product[]) || []
      const byStock = new Map(current.filter(p => p.stock_item_id).map(p => [p.stock_item_id as string, p]))
      const fresh = (stock || []).filter((x: any) => !byStock.has(x.id))
      let added = 0
      if (fresh.length) {
        const rows = fresh.map((x: any) => {
          const price = Number(x.sell_price || 0)
          return {
            user_id: userId, stock_item_id: x.id, source_table: x.source, name: x.item_name, description: '',
            price, category: x.category || 'অন্যান্য',
            is_active: price > 0, // no selling price yet → keep hidden until the owner sets one
          }
        })
        let { error } = await supabase.from('catalog_products').insert(rows)
        // migration 012 not run yet → insert again without the new column
        if (error && /source_table/i.test(error.message || '')) {
          ;({ error } = await supabase.from('catalog_products').insert(rows.map(({ source_table, ...r }: any) => r)))
        }
        if (!error) added = rows.length
      }
      let updated = 0
      if (updateExisting) {
        for (const x of (stock || []) as any[]) {
          const p = byStock.get(x.id)
          if (!p) continue
          const price = Number(x.sell_price || 0)
          if (p.name !== x.item_name || Number(p.price) !== price || (p.category || '') !== (x.category || p.category || '')) {
            await supabase.from('catalog_products').update({ name: x.item_name, price, category: x.category || p.category }).eq('id', p.id)
            updated++
          }
        }
      }
      if (added || updated) {
        const { data: fresh2 } = await supabase.from('catalog_products').select('*').eq('user_id', userId).order('created_at', { ascending: false })
        if (fresh2) setProducts(fresh2 as Product[])
      }
      if (updateExisting) toast.success(added || updated ? `স্টক থেকে ${added}টি নতুন, ${updated}টি আপডেট হয়েছে` : 'সবকিছু আগেই সিঙ্ক করা আছে ✅')
    } catch (e: any) {
      if (updateExisting) toast.error(e.message || 'সিঙ্ক করা যায়নি')
    } finally {
      if (updateExisting) setSyncing(false)
    }
  }

  // ── Image upload ──────────────────────────────────────────────
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setUploading(true)
      const ext = file.name.split('.').pop()
      const path = `${userId}/${uuidv4()}.${ext}`
      const { error } = await supabase.storage.from('catalog-images').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('catalog-images').getPublicUrl(path)
      return data.publicUrl
    } catch (e: any) {
      toast.error(e.message || 'ছবি আপলোড করা যায়নি')
      return null
    } finally {
      setUploading(false)
    }
  }

  const onPickProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) setForm(f => ({ ...f, image_url: url }))
    e.target.value = ''
  }

  const onPickLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = await uploadImage(file)
    if (url) {
      setSettings(s => ({ ...s, logo_url: url }))
      await supabase.from('catalog_settings').update({ logo_url: url }).eq('user_id', userId)
      toast.success('লোগো আপডেট হয়েছে')
    }
    e.target.value = ''
  }

  // ── Product CRUD ──────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm({ category: 'অন্যান্য', is_active: true }); setShowForm(true) }
  const openEdit = (p: Product) => { setEditing(p); setForm(p); setShowForm(true) }

  const saveProduct = async () => {
    if (!form.name) { toast.error('প্রোডাক্টের নাম দিন'); return }
    setSaving(true)
    try {
      const payload = {
        user_id: userId,
        name: form.name,
        description: form.description || '',
        price: Number(form.price || 0),
        image_url: form.image_url || null,
        category: form.category || 'অন্যান্য',
        is_active: form.is_active ?? true,
      }
      if (editing) {
        const { error } = await supabase.from('catalog_products').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('আপডেট হয়েছে! ✅')
      } else {
        const { error } = await supabase.from('catalog_products').insert(payload)
        if (error) throw error
        toast.success('প্রোডাক্ট যোগ হয়েছে! 🎉')
      }
      setShowForm(false); setForm({}); setEditing(null)
      await load()
    } catch (e: any) {
      toast.error(e.message || 'সেভ করা যায়নি')
    } finally {
      setSaving(false)
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('এই প্রোডাক্টটি মুছবেন?')) return
    await supabase.from('catalog_products').delete().eq('id', id)
    setProducts(products.filter(p => p.id !== id))
    toast.success('মুছে ফেলা হয়েছে')
  }

  const toggleActive = async (p: Product) => {
    await supabase.from('catalog_products').update({ is_active: !p.is_active }).eq('id', p.id)
    setProducts(products.map(x => x.id === p.id ? { ...x, is_active: !x.is_active } : x))
  }

  // ── Settings save (debounced-ish via blur / explicit button) ───
  const saveSettings = async () => {
    const slug = cleanSlugInput(slugDraft)
    if (slug && !isValidSlug(slug)) { toast.error('লিংকের নাম কমপক্ষে ৩ অক্ষরের হতে হবে (a-z, 0-9, -)'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('catalog_settings').update({
        slug: slug || settings.slug || null,
        store_name: settings.store_name || 'আমার দোকান',
        tagline: settings.tagline || '',
        whatsapp_number: settings.whatsapp_number || '',
        theme_color: settings.theme_color || '#7c3aed',
        is_published: settings.is_published,
      }).eq('user_id', userId)
      if (error) throw error
      if (slug) setSettings(s => ({ ...s, slug }))
      toast.success('সেভ হয়েছে! ✅')
    } catch (e: any) {
      toast.error((e as any).code === '23505' ? 'এই লিংকের নামটি অন্য কেউ নিয়ে নিয়েছে, অন্য নাম দিন' : (e.message || 'সেভ করা যায়নি'))
    } finally {
      setSaving(false)
    }
  }

  // ── Share ────────────────────────────────────────────────────
  const linkKey = settings.slug || userId
  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/catalog/${linkKey}`
    : `/catalog/${linkKey}`

  const shareToWhatsApp = () => {
    const msg = `${settings.store_name} — আমাদের প্রোডাক্ট ক্যাটালগ দেখুন:\n${publicUrl}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('লিংক কপি হয়েছে!')
    } catch {
      toast.error('কপি করা যায়নি')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-violet-500" size={28} />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 bengali flex items-center gap-2">
            <ShoppingBag size={22} className="text-violet-600" /> {tr('প্রোডাক্ট ক্যাটালগ')}
          </h1>
          <p className="text-gray-400 text-sm bengali">{tr('আপনার প্রোডাক্টের ক্যাটালগ তৈরি করুন এবং হোয়াটসঅ্যাপে শেয়ার করুন')}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href={publicUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold bengali hover:bg-gray-50">
            <ExternalLink size={14} /> {tr('পাবলিক ক্যাটালগ দেখুন')}
          </a>
          <button onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50">
            <Copy size={14} />
          </button>
          <button onClick={shareToWhatsApp}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-500 text-white text-xs font-bold bengali hover:bg-green-600">
            <Share2 size={14} /> {tr('হোয়াটসঅ্যাপে শেয়ার')}
          </button>
        </div>
      </div>

      {/* Public link (business-name based) */}
      <div className="flex items-center gap-2 mb-4 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 min-w-0">
        <Link2 size={14} className="text-violet-500 flex-shrink-0" />
        <span className="text-[12px] text-violet-700 font-semibold truncate min-w-0">{publicUrl.replace(/^https?:\/\//, '')}</span>
        <button onClick={() => setTab('design')} className="ml-auto text-[11px] font-bold text-violet-600 bengali whitespace-nowrap">{tr('লিংক বদলান')}</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => setTab('products')}
          className={`px-4 py-2 rounded-lg text-sm font-bold bengali transition ${tab === 'products' ? 'bg-white shadow text-violet-600' : 'text-gray-500'}`}>
          {tr('প্রোডাক্ট (')}{products.length})
        </button>
        <button onClick={() => setTab('design')}
          className={`px-4 py-2 rounded-lg text-sm font-bold bengali transition flex items-center gap-1.5 ${tab === 'design' ? 'bg-white shadow text-violet-600' : 'text-gray-500'}`}>
          <Palette size={14} /> {tr('ডিজাইন কাস্টমাইজ')}
        </button>
      </div>

      {/* ═══ PRODUCTS TAB ═══ */}
      {tab === 'products' && (
        <div>
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <button onClick={openAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white font-bold rounded-xl text-sm bengali hover:bg-violet-700">
              <Plus size={16} /> {tr('নতুন প্রোডাক্ট যোগ করুন')}
            </button>
            <button onClick={() => syncFromStock(true)} disabled={syncing}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-violet-200 text-violet-700 font-bold rounded-xl text-sm bengali hover:bg-violet-50 disabled:opacity-50">
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> {tr('স্টক থেকে সিঙ্ক করুন')}
            </button>
          </div>

          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={24} className="text-violet-600" />
              </div>
              <p className="text-gray-400 text-sm bengali">{tr('এখনো কোনো প্রোডাক্ট যোগ করা হয়নি। শুরু করতে উপরের বাটনে ক্লিক করুন।')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(p => (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden group">
                  <div className="aspect-square bg-gray-50 relative">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImagePlus size={28} />
                      </div>
                    )}
                    {p.stock_item_id && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold bg-white/90 text-violet-600 px-1.5 py-0.5 rounded-full shadow-sm bengali">
                        <Package size={10} /> {tr('স্টক')}
                      </span>
                    )}
                    {!p.is_active && (
                      <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                        <span className="text-[11px] font-bold text-gray-500 bengali bg-white px-2 py-1 rounded-full shadow">{tr('লুকানো')}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-bold text-gray-800 bengali truncate">{p.name}</div>
                    {Number(p.price) > 0
                      ? <div className="text-violet-600 font-extrabold text-sm">₹{Number(p.price).toFixed(0)}</div>
                      : <div className="text-amber-600 font-bold text-[11px] bengali">{tr('দাম দিন (এডিট করুন)')}</div>}
                    <div className="flex items-center gap-1 mt-2">
                      <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gray-50 text-gray-600 text-[11px] font-bold hover:bg-gray-100">
                        <Edit2 size={12} /> {tr('এডিট')}
                      </button>
                      <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100" title={p.is_active ? tr('ক্যাটালগ থেকে লুকান') : tr('ক্যাটালগে দেখান')}>
                        {p.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      {!p.stock_item_id && (
                        <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ DESIGN / SETTINGS TAB ═══ */}
      {tab === 'design' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
              {settings.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={settings.logo_url} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <Store size={22} className="text-gray-300" />
              )}
            </div>
            <button onClick={() => logoInputRef.current?.click()} disabled={uploading}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 bengali hover:bg-gray-50">
              {uploading ? tr('আপলোড হচ্ছে...') : tr('লোগো আপলোড করুন')}
            </button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 bengali">{tr('দোকানের নাম')}</label>
            <input value={settings.store_name} onChange={e => setSettings(s => ({ ...s, store_name: e.target.value }))}
              className="w-full mt-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm bengali focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 bengali">{tr('ক্যাটালগ লিংক (ব্যবসার নাম)')}</label>
            <div className="mt-1 flex items-center border-2 border-gray-100 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-violet-300">
              <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 whitespace-nowrap">{(typeof window !== 'undefined' ? window.location.host : 'sahayakai.tech')}/catalog/</span>
              <input value={slugDraft} onChange={e => setSlugDraft(cleanSlugInput(e.target.value))}
                placeholder="rahul-meat-shop" className="flex-1 min-w-0 px-2 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-gray-400 bengali">{tr('ইংরেজি অক্ষর, সংখ্যা ও (-) ব্যবহার করুন')}</span>
              <button type="button" onClick={() => setSlugDraft(slugify(settings.store_name))} className="text-[11px] font-bold text-violet-600 bengali">{tr('দোকানের নাম থেকে বানান')}</button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 bengali">{tr('ট্যাগলাইন (ঐচ্ছিক)')}</label>
            <input value={settings.tagline} onChange={e => setSettings(s => ({ ...s, tagline: e.target.value }))}
              placeholder={tr('যেমন: সেরা মানের প্রোডাক্ট, সাশ্রয়ী দামে')}
              className="w-full mt-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm bengali focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 bengali">{tr('হোয়াটসঅ্যাপ নম্বর (অর্ডার নেওয়ার জন্য)')}</label>
            <input value={settings.whatsapp_number} onChange={e => setSettings(s => ({ ...s, whatsapp_number: e.target.value }))}
              placeholder={tr('৯১XXXXXXXXXX (দেশের কোডসহ)')}
              className="w-full mt-1 border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 bengali mb-2 block">{tr('থিম কালার')}</label>
            <div className="flex gap-2">
              {THEME_COLORS.map(c => (
                <button key={c} onClick={() => setSettings(s => ({ ...s, theme_color: c }))}
                  className={`w-8 h-8 rounded-full border-2 ${settings.theme_color === c ? 'border-gray-800 scale-110' : 'border-transparent'} transition`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <div className="text-sm font-bold text-gray-700 bengali">{tr('ক্যাটালগ পাবলিশ করুন')}</div>
              <div className="text-[11px] text-gray-400 bengali">{tr('বন্ধ করলে পাবলিক লিংক কাজ করবে না')}</div>
            </div>
            <button onClick={() => setSettings(s => ({ ...s, is_published: !s.is_published }))}
              className={`w-11 h-6 rounded-full transition relative ${settings.is_published ? 'bg-violet-600' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${settings.is_published ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <button onClick={saveSettings} disabled={saving}
            className="w-full bg-violet-600 text-white font-bold py-2.5 rounded-xl text-sm bengali hover:bg-violet-700 disabled:opacity-50">
            {saving ? tr('সেভ হচ্ছে...') : tr('সেভ করুন')}
          </button>
        </div>
      )}

      {/* ═══ ADD / EDIT PRODUCT MODAL ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="font-bold text-gray-800 bengali">{editing ? tr('প্রোডাক্ট এডিট করুন') : tr('নতুন প্রোডাক্ট')}</div>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
            </div>

            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="w-full aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-1 overflow-hidden">
              {uploading ? (
                <Loader2 className="animate-spin text-violet-500" size={22} />
              ) : form.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <>
                  <ImagePlus size={22} className="text-gray-300" />
                  <span className="text-[11px] text-gray-400 bengali">{tr('ছবি যোগ করুন')}</span>
                </>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickProductImage} />

            <input placeholder={tr('প্রোডাক্টের নাম *')} value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-sm bengali focus:outline-none focus:ring-2 focus:ring-violet-300" />

            <textarea placeholder={tr('বিবরণ (ঐচ্ছিক)')} rows={2} value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full border-2 border-gray-100 rounded-xl px-3 py-2 text-sm bengali resize-none focus:outline-none focus:ring-2 focus:ring-violet-300" />

            <div className="grid grid-cols-2 gap-2">
              <input type="number" placeholder={tr('দাম (₹)')} value={form.price ?? ''} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                className="border-2 border-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              <input placeholder={tr('ক্যাটাগরি')} value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="border-2 border-gray-100 rounded-xl px-3 py-2 text-sm bengali focus:outline-none focus:ring-2 focus:ring-violet-300" />
            </div>

            <button onClick={saveProduct} disabled={saving}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-bold bengali hover:bg-violet-700 disabled:opacity-50">
              {saving ? tr('সেভ হচ্ছে...') : tr('সেভ করুন')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
