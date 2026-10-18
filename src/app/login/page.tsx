'use client'

import { useState, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
      <path d="M43.611 20.083H42V20H24v8h11.303C33.953 32.417 29.373 35 24 35c-6.075 0-11-4.925-11-11s4.925-11 11-11c2.797 0 5.352 1.054 7.293 2.773l5.657-5.657C33.268 7.454 28.842 6 24 6 13.523 6 5 14.523 5 25s8.523 19 19 19c9.852 0 18.336-7.167 19.776-16.571.12-.792.224-1.599.224-2.429 0-.822-.088-1.624-.389-2.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 16.108 19.002 13 24 13c2.797 0 5.352 1.054 7.293 2.773l5.657-5.657C33.268 7.454 28.842 6 24 6 16.318 6 9.656 9.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.355 0-9.928-3.562-11.307-8.381l-6.526 5.026C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.368 45 30 45 25c0-.822-.088-1.624-.389-2.917z" fill="#1976D2"/>
    </svg>
  )
}

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const nextPath     = searchParams.get('next') || '/dashboard'

  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [loading, setLoading]         = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [mode, setMode]               = useState<'login' | 'signup'>('login')

  const handleGoogle = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${nextPath}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) {
      toast.error('Google login-এ সমস্যা হয়েছে। আবার চেষ্টা করুন।')
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!email || !password) { toast.error('Email ও password দিন'); return }
    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        toast.success('নিবন্ধন সম্পন্ন! Email verify করুন।')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('স্বাগতম! সহায়ক AI-তে আপনাকে স্বাগত।')
        router.push(nextPath)
      }
    } catch (err: any) {
      const msg = err.message || ''
      if (msg.includes('Invalid login credentials')) toast.error('Email বা password ভুল।')
      else if (msg.includes('Email not confirmed'))  toast.error('আগে email verify করুন।')
      else if (msg.includes('already registered'))   toast.error('এই email দিয়ে আগেই account আছে।')
      else toast.error('সমস্যা হয়েছে। আবার চেষ্টা করুন।')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-200">স</div>
            <div className="text-left">
              <div className="font-extrabold text-gray-900 text-lg leading-none">Sahayak AI</div>
              <div className="text-[11px] text-indigo-500 font-semibold leading-none mt-0.5 bengali">সহায়ক AI</div>
            </div>
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900 bengali">
            {mode === 'login' ? 'আবার স্বাগতম! 👋' : ' শুরু করুন'}
          </h1>
          <p className="text-gray-500 text-sm mt-1 bengali">
            {mode === 'login' ? 'আপনার অ্যাকাউন্টে প্রবেশ করুন' : 'আপনার AI সহায়ক তৈরি করুন'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">

          {/* Google button */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-semibold text-gray-700 text-[14px] transition-all mb-5"
          >
            {googleLoading ? <Loader2 size={18} className="animate-spin text-gray-400" /> : <GoogleIcon />}
            {googleLoading ? 'Redirecting...' : 'Google দিয়ে প্রবেশ করুন'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">অথবা email দিয়ে</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Email + Password */}
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={loading || googleLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 disabled:opacity-50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading || googleLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 disabled:opacity-50 transition-colors"
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>
            </div>

            {mode === 'login' && (
              <div className="text-right">
                <button
                  onClick={async () => {
                    if (!email) return toast.error('আগে email দিন')
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/login`,
                    })
                    if (error) toast.error('সমস্যা হয়েছে')
                    else toast.success('Password reset email পাঠানো হয়েছে!')
                  }}
                  className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline"
                >
                  Password ভুলে গেছেন?
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || googleLoading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span className="bengali">{mode === 'login' ? 'প্রবেশ করুন' : 'নিবন্ধন করুন'}</span>
              {!loading && <ArrowRight size={15} />}
            </button>
          </div>

          {/* Toggle mode */}
          <div className="mt-5 text-center text-sm text-gray-500 bengali">
            {mode === 'login' ? (
              <>অ্যাকাউন্ট নেই?{' '}
                <button onClick={() => setMode('signup')} className="text-indigo-600 font-semibold hover:underline">
                  বিনামূল্যে নিবন্ধন করুন
                </button>
              </>
            ) : (
              <>আগেই অ্যাকাউন্ট আছে?{' '}
                <button onClick={() => setMode('login')} className="text-indigo-600 font-semibold hover:underline">
                  প্রবেশ করুন
                </button>
              </>
            )}
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs text-gray-400">
          <span>🔒 সম্পূর্ণ নিরাপদ</span>
          <span>🇮🇳 WB; IN</span>
        </div>

        <p className="text-center text-xs text-gray-400 mt-3 bengali">
          Google দিয়ে login করলে আমাদের{' '}
          <Link href="/" className="hover:underline text-indigo-400">Terms of Service</Link> মেনে নেওয়া হবে
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="bengali text-sm">লোড হচ্ছে...</span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
