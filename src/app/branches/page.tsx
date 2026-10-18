'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { hasFeature } from '@/lib/planFeatures'
import toast from 'react-hot-toast'
import { Building2, Plus, Trash2, Phone, MapPin } from 'lucide-react'

interface Branch {
  id: string
  name: string
  address: string
  phone: string
  is_active: boolean
  created_at: string
}

export default function BranchesPage() {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const res = await fetch('/api/branches')
    const data = await res.json()
    if (res.ok) setBranches(data.branches || [])
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid) { setLoading(false); return }

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', uid).single()
      let ok = !!profile?.is_admin
      if (!ok) {
        const { data: sub } = await supabase.from('subscriptions').select('plan,status').eq('user_id', uid).maybeSingle()
        ok = !!sub && sub.status === 'active' && hasFeature(sub.plan, 'branches')
      }
      setAllowed(ok)
      if (ok) await load()
      setLoading(false)
    })
  }, [])

  const addBranch = async () => {
    if (!name.trim()) { toast.error('ব্রাঞ্চের নাম দিন।'); return }
    setBusy(true)
    const res = await fetch('/api/branches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, phone }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { toast.error(data.error || 'সমস্যা হয়েছে।'); return }
    setName(''); setAddress(''); setPhone('')
    toast.success('ব্রাঞ্চ যোগ হয়েছে।')
    await load()
  }

  const toggleActive = async (b: Branch) => {
    await fetch(`/api/branches/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !b.is_active }),
    })
    await load()
  }

  const remove = async (id: string) => {
    if (!confirm('এই ব্রাঞ্চ ডিলিট করবেন?')) return
    await fetch(`/api/branches/${id}`, { method: 'DELETE' })
    toast.success('ব্রাঞ্চ ডিলিট হয়েছে।')
    await load()
  }

  if (loading) return <div className="p-8 text-center text-gray-400 bengali">লোড হচ্ছে...</div>

  if (!allowed) {
    return (
      <div className="max-w-lg mx-auto mt-16 p-8 bg-white border border-gray-200 rounded-2xl text-center">
        <Building2 className="mx-auto mb-3 text-gray-300" size={40} />
        <h1 className="font-extrabold text-gray-900 text-lg bengali mb-2">ব্রাঞ্চ ম্যানেজমেন্ট</h1>
        <p className="text-gray-500 text-sm bengali">এই ফিচারটি শুধু Business প্ল্যানে পাওয়া যায়। আপগ্রেড করতে WhatsApp-এ যোগাযোগ করুন।</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="font-extrabold text-gray-900 text-xl bengali mb-5 flex items-center gap-2">
        <Building2 size={20} className="text-indigo-600" /> ব্রাঞ্চসমূহ
      </h1>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ব্রাঞ্চের নাম *"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bengali" />
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="ঠিকানা"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bengali" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="ফোন নম্বর"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bengali" />
        <button onClick={addBranch} disabled={busy}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm bengali">
          <Plus size={15} /> ব্রাঞ্চ যোগ করুন
        </button>
      </div>

      <div className="space-y-3">
        {branches.length === 0 && <p className="text-gray-400 text-sm bengali text-center py-6">এখনো কোনো ব্রাঞ্চ যোগ করা হয়নি।</p>}
        {branches.map(b => (
          <div key={b.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 bengali">{b.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${b.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                  {b.is_active ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                </span>
              </div>
              {b.address && <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-1 bengali"><MapPin size={11} />{b.address}</div>}
              {b.phone && <div className="flex items-center gap-1.5 text-gray-500 text-xs mt-0.5"><Phone size={11} />{b.phone}</div>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => toggleActive(b)} className="text-xs font-semibold text-indigo-600 hover:underline bengali">
                {b.is_active ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}
              </button>
              <button onClick={() => remove(b.id)} className="text-gray-300 hover:text-red-500">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
