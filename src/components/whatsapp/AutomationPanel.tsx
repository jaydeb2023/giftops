'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Zap, Loader2, X, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { TRIGGER_LABELS, type Automation, type TriggerType } from '@/types/whatsapp'

const TRIGGER_KEYS = Object.keys(TRIGGER_LABELS) as TriggerType[]

const PRESETS: { name: string; trigger_type: TriggerType; trigger_value: string; message_body: string; delay_minutes: number }[] = [
  { name: 'দামের প্রশ্নে তাৎক্ষণিক উত্তর', trigger_type: 'keyword', trigger_value: 'দাম, price, rate, কত',
    message_body: 'দামের তালিকা পাঠাচ্ছি 👇 কোন জিনিসটার দাম জানতে চান একটু বলবেন?', delay_minutes: 0 },
  { name: 'নতুন কাস্টমারকে স্বাগত', trigger_type: 'first_message', trigger_value: '',
    message_body: 'নমস্কার! 🙏 আমাদের দোকানে মেসেজ করার জন্য ধন্যবাদ। কীভাবে সাহায্য করতে পারি?', delay_minutes: 0 },
  { name: '২৪ ঘণ্টা উত্তর না দিলে ফলোআপ', trigger_type: 'no_reply', trigger_value: '24',
    message_body: 'নমস্কার {name} 🙂 আপনার কি আর কিছু জানার আছে? আমরা সাহায্য করতে প্রস্তুত।', delay_minutes: 0 },
  { name: 'বাকি বকেয়া মনে করানো', trigger_type: 'due_payment', trigger_value: '1',
    message_body: 'নমস্কার {name} 🙏 আপনার ₹{amount} বাকি আছে। সুবিধা মতো দিয়ে দেবেন। ধন্যবাদ!', delay_minutes: 0 },
]

export default function AutomationPanel() {
  const [rules, setRules]     = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShow]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm] = useState({
    name: '', trigger_type: 'keyword' as TriggerType, trigger_value: '',
    message_body: '', delay_minutes: 0,
  })

  const load = async () => {
    const res = await fetch('/api/whatsapp/automations')
    const json = await res.json()
    setRules(json.automations || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.name.trim()) { toast.error('একটি নাম দিন'); return }
    if (!form.message_body.trim()) { toast.error('মেসেজ লিখুন'); return }
    setSaving(true)
    const res = await fetch('/api/whatsapp/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, action_type: 'send_message' }),
    })
    setSaving(false)
    if (!res.ok) { toast.error('সেভ করা যায়নি'); return }
    toast.success('নিয়ম চালু হয়েছে')
    setForm({ name: '', trigger_type: 'keyword', trigger_value: '', message_body: '', delay_minutes: 0 })
    setShow(false); load()
  }

  const usePreset = (p: typeof PRESETS[number]) => { setForm({ ...p }); setShow(true) }

  const toggle = async (r: Automation) => {
    await fetch('/api/whatsapp/automations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.id, is_active: !r.is_active }),
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('নিয়মটি মুছে ফেলবেন?')) return
    await fetch(`/api/whatsapp/automations?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-extrabold text-gray-900 bengali">অটোমেশন নিয়ম</h2>
          <p className="text-[12px] text-gray-400 bengali max-w-lg">
            কোন পরিস্থিতিতে কী মেসেজ যাবে সেটা ঠিক করুন। কীওয়ার্ড নিয়মগুলো AI-এর আগে চলে, তাই দাম বা সময়ের মতো নির্দিষ্ট উত্তর সবসময় একই থাকবে।
          </p>
        </div>
        <button onClick={() => setShow(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-[12px] bengali flex-shrink-0 transition-colors">
          <Plus size={13} /> নতুন নিয়ম
        </button>
      </div>

      {/* Presets */}
      {!showForm && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {PRESETS.map(p => (
            <button key={p.name} onClick={() => usePreset(p)}
              className="text-left bg-white rounded-2xl border border-gray-100 hover:border-indigo-200 p-3.5 transition-colors group">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={13} className="text-amber-500" />
                <span className="text-[12px] font-extrabold text-gray-800 bengali">{p.name}</span>
              </div>
              <p className="text-[11px] text-gray-400 bengali line-clamp-2">{p.message_body}</p>
              <span className="text-[10px] font-bold text-indigo-500 bengali mt-2 inline-block opacity-0 group-hover:opacity-100 transition-opacity">
                ব্যবহার করুন →
              </span>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-indigo-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-extrabold text-gray-900 bengali">নতুন অটোমেশন</h3>
            <button onClick={() => setShow(false)} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={14} className="text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="নিয়মের নাম"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1 bengali">কখন চলবে</label>
                <select value={form.trigger_type}
                  onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value as TriggerType }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-500/25">
                  {TRIGGER_KEYS.map(k => <option key={k} value={k}>{TRIGGER_LABELS[k].bn}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1 bengali">মান</label>
                <input value={form.trigger_value} onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                  placeholder={TRIGGER_LABELS[form.trigger_type].hint_bn}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 bengali">
                যে মেসেজ যাবে — {'{name}'} ও {'{amount}'} বসালে কাস্টমারের নাম ও বকেয়া টাকা নিজে থেকে বসে যাবে
              </label>
              <textarea rows={3} value={form.message_body}
                onChange={e => setForm(f => ({ ...f, message_body: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-600 mb-1 bengali">দেরি (মিনিট)</label>
              <input type="number" min={0} value={form.delay_minutes}
                onChange={e => setForm(f => ({ ...f, delay_minutes: Number(e.target.value) }))}
                className="w-32 px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/25" />
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-[13px] bengali transition-colors">
            {saving && <Loader2 size={13} className="animate-spin" />} চালু করুন
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-[13px] text-gray-400 bengali">লোড হচ্ছে...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Zap size={26} className="text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-500 bengali">
            এখনও কোনো নিয়ম নেই। উপরের নমুনাগুলো থেকে একটা বেছে নিলেই শুরু হয়ে যাবে।
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rules.map(r => (
            <div key={r.id} className={`bg-white rounded-2xl border border-gray-100 p-4 ${r.is_active ? '' : 'opacity-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-extrabold text-gray-900 bengali">{r.name}</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-bold bengali">
                      {TRIGGER_LABELS[r.trigger_type]?.bn || r.trigger_type}
                    </span>
                    {r.trigger_value && (
                      <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold truncate max-w-[180px]">
                        {r.trigger_value}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-500 bengali mt-1.5 line-clamp-2">{r.message_body}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span className="font-bold">{r.run_count}× চলেছে</span>
                    {r.delay_minutes > 0 && (
                      <span className="flex items-center gap-1"><Clock size={9} /> {r.delay_minutes} মি দেরি</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => toggle(r)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${r.is_active ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${r.is_active ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
