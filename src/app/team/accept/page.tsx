'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

function AcceptInviteForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!token) { setError('এই লিংকটা অবৈধ — মালিকের কাছ থেকে সঠিক লিংক নিন।'); return }
    if (password.length < 6) { setError('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।'); return }
    if (password !== confirm) { setError('দুটো পাসওয়ার্ড এক নয়।'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/team/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'সমস্যা হয়েছে।'); setLoading(false); return }

      // Now actually sign them in with the password they just set.
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: data.email, password })
      if (signInErr) {
        setError('একাউন্ট তৈরি হয়েছে — এখন লগইন পেজ থেকে সাইন ইন করুন।')
        setLoading(false)
        return
      }
      router.push('/dashboard')
    } catch (e) {
      setError('সমস্যা হয়েছে, আবার চেষ্টা করুন।')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-6">
      <h1 className="text-xl font-extrabold text-gray-900 bengali mb-1">টিমে যোগ দিন</h1>
      <p className="text-gray-500 text-sm bengali mb-6">নিজের একাউন্টের জন্য একটা পাসওয়ার্ড ঠিক করুন</p>

      {!token && <p className="text-red-600 text-sm bengali mb-4">এই লিংকটা অবৈধ — মালিকের কাছ থেকে সঠিক লিংক নিন।</p>}

      <label className="block text-xs font-semibold text-gray-500 bengali mb-1">পাসওয়ার্ড</label>
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} disabled={loading || !token}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 outline-none focus:border-indigo-400" />

      <label className="block text-xs font-semibold text-gray-500 bengali mb-1">আবার লিখুন</label>
      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading || !token}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-indigo-400" />

      {error && <p className="text-red-600 text-xs bengali mb-3">{error}</p>}

      <button onClick={submit} disabled={loading || !token}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg py-2.5 text-sm bengali">
        {loading ? 'একটু অপেক্ষা করুন…' : 'একাউন্ট তৈরি করুন'}
      </button>
    </div>
  )
}

// useSearchParams() requires a Suspense boundary at build time, or Next.js
// fails static generation for this page — the actual form is split into
// its own component so the Suspense fallback has something to show while
// the search params resolve on the client.
export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Suspense fallback={<div className="text-gray-400 bengali">লোড হচ্ছে…</div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  )
}
