'use client'

import { useState } from 'react'
import { Link2, CheckCircle2, AlertTriangle, Loader2, Trash2, Copy, ExternalLink, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import type { WhatsAppAccount } from '@/types/whatsapp'

export default function ConnectPanel({
  account, onChange,
}: { account: WhatsAppAccount | null; onChange: () => void }) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [wabaId, setWabaId]               = useState('')
  const [token, setToken]                 = useState('')
  const [busy, setBusy]                   = useState(false)
  const [savingSettings, setSaving]       = useState(false)

  interface Settings {
    auto_reply: boolean
    ai_tone: string
    language: string
    business_hours_start: number
    business_hours_end: number
    greeting_message: string
    away_message: string
  }

  const [settings, setSettings] = useState<Settings>({
    auto_reply:           account?.auto_reply ?? true,
    ai_tone:              account?.ai_tone ?? 'friendly',
    language:             account?.language ?? 'bn',
    business_hours_start: account?.business_hours_start ?? 9,
    business_hours_end:   account?.business_hours_end ?? 21,
    greeting_message:     account?.greeting_message ?? '',
    away_message:         account?.away_message ?? '',
  })

  const webhookUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : ''

  const connect = async () => {
    if (!phoneNumberId.trim() || !token.trim()) {
      toast.error('Phone Number ID এবং Access Token দিন')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone_number_id: phoneNumberId, access_token: token, waba_id: wabaId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success('কানেক্ট হয়ে গেছে! 🎉')
      setToken('')
      onChange()
    } catch (e: any) {
      toast.error(e.message || 'কানেক্ট করা যায়নি')
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('কানেকশন মুছে ফেলবেন? সব মেসেজ হিস্ট্রিও চলে যাবে।')) return
    setBusy(true)
    await fetch('/api/whatsapp/connect', { method: 'DELETE' })
    toast.success('ডিসকানেক্ট হয়েছে')
    onChange()
    setBusy(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    const res = await fetch('/api/whatsapp/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    if (res.ok) { toast.success('সেটিংস সেভ হয়েছে'); onChange() }
    else toast.error('সেভ করা যায়নি')
  }

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('কপি হয়েছে') }

  // ── Not connected yet ─────────────────────────────────────
  if (!account) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Link2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="font-extrabold text-gray-900 bengali">হোয়াটসঅ্যাপ কানেক্ট করুন</h2>
              <p className="text-[12px] text-gray-400 bengali">Meta WhatsApp Business Cloud API</p>
            </div>
          </div>

          <div className="space-y-3">
            <Field label="Phone Number ID" hint="Meta Dashboard → WhatsApp → API Setup"
              value={phoneNumberId} onChange={setPhoneNumberId} placeholder="109876543210987" />
            <Field label="WhatsApp Business Account ID" hint="ঐচ্ছিক"
              value={wabaId} onChange={setWabaId} placeholder="102233445566778" />
            <Field label="Permanent Access Token" hint="System User token — ৬০ দিনের temporary token নয়"
              value={token} onChange={setToken} placeholder="EAAG..." type="password" />
          </div>

          <button onClick={connect} disabled={busy}
            className="w-full mt-5 flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm bengali transition-colors">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
            কানেক্ট করুন
          </button>
        </div>

        <SetupGuide webhookUrl={webhookUrl} onCopy={copy} />
      </div>
    )
  }

  // ── Connected ─────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-600" />
            </div>
            <div>
              <div className="font-extrabold text-gray-900">{account.display_phone || '—'}</div>
              <div className="text-[12px] text-gray-400">{account.verified_name || 'WhatsApp Business'}</div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[11px] font-bold">
            {account.status === 'connected' ? 'Connected' : account.status}
          </span>
        </div>

        {account.last_error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-[12px] mb-4">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span className="break-words">{account.last_error}</span>
          </div>
        )}

        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 text-[12px] gap-2">
          <div className="min-w-0">
            <div className="font-bold text-gray-700 mb-0.5">Webhook URL</div>
            <code className="text-gray-500 break-all">{webhookUrl}</code>
          </div>
          <button onClick={() => copy(webhookUrl)} className="p-2 rounded-lg hover:bg-gray-200 flex-shrink-0">
            <Copy size={13} className="text-gray-500" />
          </button>
        </div>

        <button onClick={disconnect} disabled={busy}
          className="mt-4 flex items-center gap-1.5 text-[12px] font-bold text-red-500 hover:text-red-600 bengali">
          <Trash2 size={13} /> ডিসকানেক্ট করুন
        </button>
      </div>

      {/* Behaviour settings */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-extrabold text-gray-900 bengali mb-4">অটো-রিপ্লাই সেটিংস</h3>

        <Toggle
          label="অটো-রিপ্লাই চালু"
          desc="কাস্টমার মেসেজ করলে AI নিজে থেকে Knowledge Base থেকে উত্তর দেবে"
          checked={settings.auto_reply}
          onChange={(v: boolean) => setSettings(s => ({ ...s, auto_reply: v }))}
        />

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Select label="উত্তরের ধরন" value={settings.ai_tone}
            onChange={(v: string) => setSettings(s => ({ ...s, ai_tone: v }))}
            options={[['friendly', 'বন্ধুত্বপূর্ণ'], ['formal', 'পেশাদার'], ['short', 'খুব সংক্ষিপ্ত']]} />
          <Select label="ভাষা" value={settings.language}
            onChange={(v: string) => setSettings(s => ({ ...s, language: v }))}
            options={[['bn', 'বাংলা'], ['en', 'English'], ['auto', 'অটো']]} />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <NumField label="দোকান খোলে (ঘণ্টা)" value={settings.business_hours_start}
            onChange={(v: number) => setSettings(s => ({ ...s, business_hours_start: v }))} />
          <NumField label="দোকান বন্ধ হয় (ঘণ্টা)" value={settings.business_hours_end}
            onChange={(v: number) => setSettings(s => ({ ...s, business_hours_end: v }))} />
        </div>

        <TextArea label="স্বাগত মেসেজ (প্রথমবার)" value={settings.greeting_message}
          onChange={(v: string) => setSettings(s => ({ ...s, greeting_message: v }))} />
        <TextArea label="বন্ধের সময়ের মেসেজ" value={settings.away_message}
          onChange={(v: string) => setSettings(s => ({ ...s, away_message: v }))} />

        <button onClick={saveSettings} disabled={savingSettings}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-[13px] bengali transition-colors">
          {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          সেভ করুন
        </button>
      </div>
    </div>
  )
}

// ── Small form primitives ───────────────────────────────────
interface FieldProps {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}
function Field({ label, hint, value, onChange, placeholder, type = 'text' }: FieldProps) {
  return (
    <div>
      <label className="block text-[12px] font-bold text-gray-700 mb-1 bengali">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
      {hint && <p className="text-[11px] text-gray-400 mt-1 bengali">{hint}</p>}
    </div>
  )
}

interface NumFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
}
function NumField({ label, value, onChange }: NumFieldProps) {
  return (
    <div>
      <label className="block text-[12px] font-bold text-gray-700 mb-1 bengali">{label}</label>
      <input type="number" min={0} max={23} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
    </div>
  )
}

interface SelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: [string, string][]
}
function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div>
      <label className="block text-[12px] font-bold text-gray-700 mb-1 bengali">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

interface TextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
}
function TextArea({ label, value, onChange }: TextAreaProps) {
  return (
    <div className="mt-3">
      <label className="block text-[12px] font-bold text-gray-700 mb-1 bengali">{label}</label>
      <textarea rows={2} value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[13px] bengali resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
    </div>
  )
}

interface ToggleProps {
  label: string
  desc: string
  checked: boolean
  onChange: (checked: boolean) => void
}
function Toggle({ label, desc, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[13px] font-bold text-gray-800 bengali">{label}</div>
        <div className="text-[11px] text-gray-400 bengali">{desc}</div>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${checked ? 'bg-emerald-500' : 'bg-gray-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function SetupGuide({ webhookUrl, onCopy }: { webhookUrl: string; onCopy: (t: string) => void }) {
  const steps: [string, string][] = [
    ['Meta for Developers-এ একটি App তৈরি করুন', 'developers.facebook.com → Create App → Business → WhatsApp product যোগ করুন।'],
    ['Phone Number ID কপি করুন', 'WhatsApp → API Setup পেজে "Phone number ID" দেখাবে। সেটাই উপরে বসান।'],
    ['Permanent Access Token বানান', 'Business Settings → System Users → Add → Generate token (whatsapp_business_messaging + whatsapp_business_management)।'],
    ['Webhook সেট করুন', `WhatsApp → Configuration → Edit. Callback URL: ${webhookUrl} , Verify token: আপনার WHATSAPP_VERIFY_TOKEN env ভ্যালু।`],
    ['messages ফিল্ডে Subscribe করুন', 'Webhook fields তালিকা থেকে "messages" টিক দিন — এটা না দিলে কোনো মেসেজ আসবে না।'],
  ]
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h3 className="font-extrabold text-gray-900 bengali mb-4">কীভাবে সেটআপ করবেন</h3>
      <ol className="space-y-3">
        {steps.map(([title, body], i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 text-[11px] font-extrabold flex items-center justify-center flex-shrink-0">{i + 1}</span>
            <div>
              <div className="text-[13px] font-bold text-gray-800 bengali">{title}</div>
              <div className="text-[12px] text-gray-500 bengali break-words">{body}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
        <button onClick={() => onCopy(webhookUrl)}
          className="flex items-center gap-1.5 text-[12px] font-bold text-gray-600 hover:text-gray-900">
          <Copy size={12} /> Webhook URL কপি
        </button>
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 hover:text-emerald-700 ml-auto">
          Meta Dashboard <ExternalLink size={12} />
        </a>
      </div>
    </div>
  )
}
