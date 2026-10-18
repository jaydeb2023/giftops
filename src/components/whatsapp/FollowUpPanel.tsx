'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, X, Loader2, RefreshCw, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import type { FollowUp } from '@/types/whatsapp'

const TABS: [string, string][] = [
  ['pending', 'অপেক্ষায়'], ['sent', 'পাঠানো হয়েছে'], ['failed', 'ব্যর্থ'], ['canceled', 'বাতিল'],
]

function relative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  const unit = mins < 60 ? `${mins} মিনিট` : mins < 1440 ? `${Math.round(mins / 60)} ঘণ্টা` : `${Math.round(mins / 1440)} দিন`
  return diff > 0 ? `${unit} পরে` : `${unit} আগে`
}

export default function FollowUpPanel() {
  const [tab, setTab]         = useState('pending')
  const [items, setItems]     = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = async (status = tab) => {
    setLoading(true)
    const res = await fetch(`/api/whatsapp/followups?status=${status}`)
    const json = await res.json()
    setItems(json.followups || [])
    setLoading(false)
  }
  useEffect(() => { load(tab) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const cancel = async (id: string) => {
    await fetch('/api/whatsapp/followups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'canceled' }),
    })
    toast.success('বাতিল হয়েছে')
    load()
  }

  const sendNow = async (id: string) => {
    setRunning(true)
    // Move it to "due now" — the cron job picks it up on its next pass.
    await fetch('/api/whatsapp/followups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, due_at: new Date().toISOString() }),
    })
    setRunning(false)
    toast.success('পাঠানোর জন্য সারিতে দেওয়া হলো')
    load()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[15px] font-extrabold text-gray-900 bengali">ফলোআপ</h2>
          <p className="text-[12px] text-gray-400 bengali max-w-lg">
            অটোমেশন নিয়ম থেকে তৈরি হওয়া মেসেজ এখানে জমা হয় এবং নির্দিষ্ট সময়ে নিজে থেকে চলে যায়।
          </p>
        </div>
        <button onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-[12px] font-bold text-gray-600 hover:bg-gray-50 bengali flex-shrink-0">
          <RefreshCw size={12} /> রিফ্রেশ
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold bengali transition-colors ${
              tab === v ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-[13px] text-gray-400 bengali">লোড হচ্ছে...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Bell size={26} className="text-gray-300 mx-auto mb-3" />
          <p className="text-[13px] text-gray-500 bengali">এই তালিকায় কিছু নেই।</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-extrabold text-gray-900 bengali">
                      {f.whatsapp_contacts?.name || f.whatsapp_contacts?.wa_id || 'অজানা'}
                    </span>
                    {f.reason && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-bold bengali">
                        {f.reason}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-600 bengali mt-1.5 whitespace-pre-wrap line-clamp-3">
                    {f.message_body}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                    <Clock size={9} /> {relative(f.due_at)}
                  </div>
                </div>

                {f.status === 'pending' && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => sendNow(f.id)} disabled={running}
                      title="এখনই পাঠান"
                      className="p-1.5 rounded-lg hover:bg-emerald-50">
                      {running ? <Loader2 size={12} className="animate-spin text-emerald-500" />
                               : <Check size={12} className="text-emerald-500" />}
                    </button>
                    <button onClick={() => cancel(f.id)} title="বাতিল" className="p-1.5 rounded-lg hover:bg-red-50">
                      <X size={12} className="text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
