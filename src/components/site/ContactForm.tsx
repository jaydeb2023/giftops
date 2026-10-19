'use client'
import { useState } from 'react'

export default function ContactForm() {
  const [v, setV] = useState({ name: '', mobile: '', email: '', company: '', message: '', hp: '' })
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [err, setErr] = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV(s => ({ ...s, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('')
    if (!v.name.trim() || (!v.mobile.trim() && !v.email.trim())) return setErr('Please enter your name and a mobile number or email.')
    setState('busy')
    try {
      const r = await fetch('/api/rv/public/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.')
      setState('done')
    } catch (e: any) { setErr(e.message); setState('idle') }
  }

  if (state === 'done') return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <div className="text-xl font-bold text-emerald-800">Thank you!</div>
      <p className="mt-2 text-emerald-700">We have your details and will get back to you soon.</p>
    </div>
  )
  const input = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] outline-none transition focus:border-rv-600 focus:ring-2 focus:ring-rv-100'
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-rv-100 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} placeholder="Your name *" value={v.name} onChange={set('name')} autoComplete="name" />
        <input className={input} placeholder="Mobile number" value={v.mobile} onChange={set('mobile')} inputMode="tel" autoComplete="tel" />
        <input className={input} placeholder="Email" type="email" value={v.email} onChange={set('email')} autoComplete="email" />
        <input className={input} placeholder="Company" value={v.company} onChange={set('company')} autoComplete="organization" />
      </div>
      <textarea className={input} rows={4} placeholder="Tell us about your gifting business (how many orders, how many recipients...)" value={v.message} onChange={set('message')} />
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={v.hp} onChange={set('hp')} />
      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <button disabled={state === 'busy'} className="w-full rounded-xl bg-rv-700 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-rv-800 disabled:opacity-60">{state === 'busy' ? 'Sending...' : 'Book a free demo'}</button>
    </form>
  )
}
