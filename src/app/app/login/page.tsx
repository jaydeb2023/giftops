'use client'
import Logo from '@/components/rv/Logo'
import Link from 'next/link'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { Button, Field, Input } from '@/components/rv/ui'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function Form() {
  const router = useRouter()
  const sp = useSearchParams()
  const next = sp.get('next') || '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [gBusy, setGBusy] = useState(false)
  const [company, setCompany] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>(sp.get('mode') === 'signup' ? 'signup' : 'login')

  // show errors that come back from Google sign-in
  useEffect(() => {
    const e = sp.get('error')
    if (e) toast.error(e)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const google = async () => {
    setGBusy(true)
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/app'
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
    })
    if (error) { toast.error(error.message || 'Could not start Google sign-in'); setGBusy(false) }
    // on success the browser is redirected to Google
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return toast.error('Enter email and password')
    if (mode === 'signup' && company.trim().length < 2) return toast.error('Enter your company name')
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { company_name: company.trim() } } })
        if (error) throw error
        if (!data.session) { toast.success('Account created. Check your email to confirm, then sign in.'); setMode('login') }
        else router.push(next)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(next)
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not sign in')
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-rv-900 via-rv-800 to-rv-700 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-7 shadow-2xl">
        <div className="text-center">
          <Link href="/" title="Back to GiftOps home page" className="inline-flex justify-center"><Logo size={48} /></Link>
        </div>

        <button type="button" onClick={google} disabled={gBusy}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60">
          <GoogleIcon />{gBusy ? 'Opening Google...' : mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
        </button>

        <div className="flex items-center gap-3 text-xs text-gray-400"><span className="h-px flex-1 bg-gray-200" />or use email<span className="h-px flex-1 bg-gray-200" /></div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && <Field label="Company name"><Input value={company} onChange={e => setCompany(e.target.value)} placeholder="Your gift business name" /></Field>}
          <Field label="Email"><Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" /></Field>
          <Field label="Password"><Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} /></Field>
          <Button type="submit" variant="primary" className="w-full" loading={busy}>{mode === 'login' ? 'Sign in' : 'Start free trial'}</Button>
        </form>

        <p className="text-center text-xs text-gray-500">
          {mode === 'login' ? 'New company? ' : 'Already have an account? '}
          <button type="button" className="font-medium text-rv-700 hover:underline" onClick={() => setMode(m => (m === 'login' ? 'signup' : 'login'))}>
            {mode === 'login' ? 'Start a 14-day free trial' : 'Sign in'}
          </button>
        </p>
        <p className="text-center text-[11px] leading-snug text-gray-400">Creating an account sets up your own private company workspace. You become its admin and add your team under Settings.</p>
        <p className="text-center text-xs"><Link href="/" className="text-gray-500 hover:text-rv-700 hover:underline">&larr; Back to home page</Link></p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return <Suspense><Form /></Suspense>
}
