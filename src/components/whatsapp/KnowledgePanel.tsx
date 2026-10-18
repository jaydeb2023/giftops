'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, BookOpen, Loader2, Sparkles, X, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import type { KnowledgeEntry } from '@/types/whatsapp'

const CATEGORIES: [string, string][] = [
  ['general', 'সাধারণ'], ['pricing', 'দাম'], ['hours', 'সময়'],
  ['delivery', 'ডেলিভারি'], ['products', 'পণ্য'], ['policy', 'নিয়ম'],
]

/** One-tap starters so a shop owner isn't staring at an empty box. */
const STARTERS = [
  { title: 'দোকানের সময়', category: 'hours', keywords: 'সময়, কখন, খোলা, বন্ধ, timing, open',
    content: 'আমাদের দোকান প্রতিদিন সকাল ৯টা থেকে রাত ৯টা পর্যন্ত খোলা থাকে। রবিবার দুপুর ২টা পর্যন্ত।' },
  { title: 'ডেলিভারি', category: 'delivery', keywords: 'ডেলিভারি, delivery, পৌঁছে, home',
    content: '৫ কিমির মধ্যে ফ্রি হোম ডেলিভারি। ₹৩০০-এর কম অর্ডারে ₹২০ চার্জ। সাধারণত ১-২ ঘণ্টায় পৌঁছে যায়।' },
  { title: 'পেমেন্ট', category: 'policy', keywords: 'পেমেন্ট, payment, UPI, cash, টাকা',
    content: 'আমরা নগদ, UPI (GPay/PhonePe/Paytm) এবং কার্ড — সবই নিই। বাকির ব্যবস্থাও আছে পুরনো খদ্দেরদের জন্য।' },
  { title: 'ফেরত ও বদল', category: 'policy', keywords: 'ফেরত, return, বদল, exchange',
    content: 'কেনার ৭ দিনের মধ্যে বিল সহ আনলে বদলে দেওয়া হয়। খাবার ও মিষ্টি জাতীয় পণ্য ফেরত নেওয়া হয় না।' },
]

export default function KnowledgePanel() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', category: 'general', keywords: '' })

  const load = async () => {
    const res = await fetch('/api/whatsapp/knowledge')
    const json = await res.json()
    setEntries(json.entries || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const reset = () => {
    setForm({ title: '', content: '', category: 'general', keywords: '' })
    setEditing(null); setShowForm(false)
  }

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) { toast.error('শিরোনাম ও বিবরণ দিন'); return }
    setSaving(true)
    const res = await fetch('/api/whatsapp/knowledge', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
    })
    setSaving(false)
    if (!res.ok) { toast.error('সেভ করা যায়নি'); return }
    toast.success(editing ? 'আপডেট হয়েছে' : 'যোগ হয়েছে')
    reset(); load()
  }

  const remove = async (id: string) => {
    if (!confirm('মুছে ফেলবেন?')) return
    await fetch(`/api/whatsapp/knowledge?id=${id}`, { method: 'DELETE' })
    load()
  }

  const toggle = async (e: KnowledgeEntry) => {
    await fetch('/api/whatsapp/knowledge', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: e.id, is_active: !e.is_active }),
    })
    load()
  }

  const addStarters = async () => {
    setSaving(true)
    await fetch('/api/whatsapp/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(STARTERS),
    })
    setSaving(false)
    toast.success('৪টি নমুনা তথ্য যোগ হয়েছে — নিজের মতো বদলে নিন')
    load()
  }

  const startEdit = (e: KnowledgeEntry) => {
    setEditing(e)
    setForm({ title: e.title, content: e.content, category: e.category, keywords: (e.keywords || []).join(', ') })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-extrabold text-gray-900 bengali">Knowledge Base</h2>
          <p className="text-[12px] text-gray-400 bengali max-w-lg">
            এখানে যা লিখবেন শুধু সেটুকু থেকেই AI কাস্টমারকে উত্তর দেবে। দাম, সময়, ডেলিভারি, অফার — যত বেশি লিখবেন তত ভালো উত্তর দেবে।
          </p>
        </div>
        <button onClick={() => { reset(); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[12px] bengali flex-shrink-0 transition-colors">
          <Plus size={13} /> তথ্য যোগ করুন
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-extrabold text-gray-900 bengali">
              {editing ? 'তথ্য সম্পাদনা' : 'নতুন তথ্য'}
            </h3>
            <button onClick={reset} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="শিরোনাম — যেমন: চালের দাম"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />

            <textarea rows={3} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="বিস্তারিত — যেমন: মিনিকেট ₹৫২/কেজি, বাসমতী ₹৯৫/কেজি। ১০ কেজির বেশি নিলে ₹২ ছাড়।"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-500/25">
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))}
                placeholder="কীওয়ার্ড: চাল, rice, দাম"
                className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-[13px] bengali transition-colors">
            {saving && <Loader2 size={13} className="animate-spin" />} সেভ করুন
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-[13px] text-gray-400 bengali">লোড হচ্ছে...</div>
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <BookOpen size={26} className="text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-500 bengali mb-4 max-w-sm mx-auto">
            Knowledge Base খালি — তাই AI এখন কোনো প্রশ্নের উত্তর দিতে পারবে না। শুরু করতে নমুনা তথ্য যোগ করুন।
          </p>
          <button onClick={addStarters} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-[12px] bengali transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} নমুনা তথ্য যোগ করুন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.map(e => (
            <div key={e.id} className={`bg-white rounded-2xl border p-4 transition-opacity ${
              e.is_active ? 'border-gray-100' : 'border-gray-100 opacity-50'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold text-gray-900 bengali truncate">{e.title}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold bengali">
                      {CATEGORIES.find(c => c[0] === e.category)?.[1] || e.category}
                    </span>
                    {e.hit_count > 0 && (
                      <span className="text-[10px] text-emerald-600 font-bold">{e.hit_count}× ব্যবহৃত</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(e)} className="p-1.5 rounded-lg hover:bg-gray-100">
                    <Pencil size={12} className="text-gray-400" />
                  </button>
                  <button onClick={() => remove(e.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>

              <p className="text-[12px] text-gray-600 bengali line-clamp-3 whitespace-pre-wrap">{e.content}</p>

              <button onClick={() => toggle(e)}
                className={`mt-3 text-[11px] font-bold bengali ${e.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                {e.is_active ? '● সক্রিয়' : '○ বন্ধ'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
