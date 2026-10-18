'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, Sparkles, ShieldCheck } from 'lucide-react'
import { useAccess } from '@/lib/useAccess'
import { PLAN_AMOUNTS_PAISE } from '@/lib/planLimits'

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '919477581817' // TODO: replace with your real support number

type PlanId = 'basic' | 'starter'

const PLAN_DETAILS: Record<PlanId, { name: string; price: number; features: string[] }> = {
  basic: {
    name: 'Basic',
    price: 99,
    features: [
      '১টি এজেন্ট',
      'চ্যাট ও রিপোর্ট',
      'প্রতিদিনের বিক্রি, স্টক ও বাকির হিসাব',
      'যেকোনো সময় বাতিল করুন',
    ],
  },
  starter: {
    name: 'Starter',
    price: 199,
    features: [
      'সর্বোচ্চ ৩টি এজেন্ট',
      'GST ইনভয়েস ও বিলিং',
      'WhatsApp ইন্টিগ্রেশন',
      'সরবরাহকারী ট্র্যাকিং',
      'সম্পূর্ণ রিপোর্ট',
      'যেকোনো সময় বাতিল করুন',
    ],
  },
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    }>
      <SubscribePageInner />
    </Suspense>
  )
}

function SubscribePageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, subscription, hasAccess, isTrialing, isActive, isExpired, daysLeftInTrial, loading } = useAccess()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const requestedPlan = searchParams.get('plan')
  const plan: PlanId = requestedPlan === 'starter' ? 'starter' : 'basic'
  const details = PLAN_DETAILS[plan]

  // Business isn't sold here — bounce straight to WhatsApp if someone lands
  // on this URL directly (e.g. old link, typed manually).
  useEffect(() => {
    if (requestedPlan === 'business') {
      window.location.href = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('আমি SahayakAI Business প্ল্যান সম্পর্কে জানতে চাই')}`
    }
  }, [requestedPlan])

  async function handleSubscribe() {
    setError('')
    setCreating(true)
    try {
      const res = await fetch('/api/razorpay/create-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      window.location.href = data.short_url
    } catch (e: any) {
      setError(e.message || 'পেমেন্ট লিংক তৈরি করা যায়নি। আবার চেষ্টা করুন।')
      setCreating(false)
    }
  }

  if (loading || requestedPlan === 'business') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-24 pb-16 px-4">
      <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Sparkles size={26} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 bengali">Kaaj AI — {details.name} সাবস্ক্রিপশন</h1>
            <p className="text-gray-500 text-sm mt-1 bengali">
              {isActive && 'আপনার সাবস্ক্রিপশন সক্রিয় আছে ✅'}
              {isTrialing && `আপনার ফ্রি ট্রায়াল বাকি আছে ${daysLeftInTrial} দিন`}
              {isExpired && !isActive && !isTrialing && 'আপনার ট্রায়াল শেষ হয়ে গেছে — এখন সাবস্ক্রাইব করুন'}
            </p>
          </div>

          {/* Plan switcher */}
          <div className="flex gap-2 mb-4">
            {(['basic', 'starter'] as PlanId[]).map(p => (
              <button key={p} onClick={() => router.replace(`/subscribe?plan=${p}`)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold bengali border transition-colors ${
                  plan === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'
                }`}>
                {PLAN_DETAILS[p].name} · ₹{PLAN_DETAILS[p].price}
              </button>
            ))}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-extrabold text-gray-900">₹{details.price}</span>
              <span className="text-gray-400 text-sm mb-1 bengali">/ মাস</span>
            </div>
            <p className="text-xs text-gray-400 mb-5 bengali">প্রথম ৭ দিন ফ্রি, তারপর প্রতি মাসে ₹{details.price}</p>

            <ul className="space-y-2.5 mb-6">
              {details.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700 bengali">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>

            {error && <p className="text-red-500 text-xs mb-3 bengali">{error}</p>}

            {isActive ? (
              <div className="w-full bg-emerald-50 text-emerald-700 font-semibold text-sm rounded-xl py-3 text-center bengali">
                আপনি ইতিমধ্যে সাবস্ক্রাইব করেছেন
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={creating}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl py-3 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {creating ? <Loader2 className="animate-spin" size={16} /> : null}
                <span className="bengali">{isTrialing ? 'এখনই সাবস্ক্রাইব করুন' : 'UPI দিয়ে পেমেন্ট করুন'}</span>
              </button>
            )}

            <div className="flex items-center justify-center gap-1.5 text-gray-400 text-[11px] mt-4">
              <ShieldCheck size={12} />
              <span className="bengali">Razorpay দিয়ে নিরাপদ পেমেন্ট</span>
            </div>
          </div>

          <p className="text-center text-[12px] text-gray-400 bengali mt-4">
            আনলিমিটেড এজেন্ট বা টিম সাপোর্ট দরকার?{' '}
            <a href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent('আমি SahayakAI Business প্ল্যান সম্পর্কে জানতে চাই')}`}
              target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold">
              Business প্ল্যানের জন্য যোগাযোগ করুন
            </a>
          </p>
        </div>
      </div>
  )
}
