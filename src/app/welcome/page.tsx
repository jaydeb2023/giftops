'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Globe, Check, User, Mail, Lock, Eye, EyeOff, Loader2,
  BarChart3, Package, Users, IndianRupee, FileText, Sparkles, Store, MessageCircle, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/LanguageContext'
import type { Lang } from '@/lib/i18n/dictionary'
import { ONBOARDING, ONBOARDED_KEY, PENDING_LANG_KEY } from '@/lib/i18n/onboarding'

type Step = 'splash' | 'slide2' | 'slide3' | 'language' | 'account' | 'ready'
const CAROUSEL: Step[] = ['splash', 'slide2', 'slide3']
const LANGS: { code: Lang; name: string; badge: string }[] = [
  { code: 'bn', name: 'বাংলা', badge: 'অ' },
  { code: 'hi', name: 'हिन्दी', badge: 'अ' },
  { code: 'en', name: 'English', badge: 'A' },
]
const PRIMARY = '#5B3DF5'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
      <path d="M43.611 20.083H42V20H24v8h11.303C33.953 32.417 29.373 35 24 35c-6.075 0-11-4.925-11-11s4.925-11 11-11c2.797 0 5.352 1.054 7.293 2.773l5.657-5.657C33.268 7.454 28.842 6 24 6 13.523 6 5 14.523 5 25s8.523 19 19 19c9.852 0 18.336-7.167 19.776-16.571.12-.792.224-1.599.224-2.429 0-.822-.088-1.624-.389-2.917z" fill="#FFC107"/>
      <path d="M6.306 14.691l6.571 4.819C14.655 16.108 19.002 13 24 13c2.797 0 5.352 1.054 7.293 2.773l5.657-5.657C33.268 7.454 28.842 6 24 6 16.318 6 9.656 9.337 6.306 14.691z" fill="#FF3D00"/>
      <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.355 0-9.928-3.562-11.307-8.381l-6.526 5.026C9.505 39.556 16.227 44 24 44z" fill="#4CAF50"/>
      <path d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.368 45 30 45 25c0-.822-.088-1.624-.389-2.917z" fill="#1976D2"/>
    </svg>
  )
}

function LangPill() {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const current = LANGS.find(l => l.code === lang)!
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 bg-white/90 backdrop-blur border border-violet-100 shadow-sm rounded-full pl-3 pr-2.5 py-2 text-[15px] font-semibold text-gray-800">
        <Globe size={18} className="text-gray-700" /> {current.name} <ChevronDown size={16} className="text-gray-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-violet-100 overflow-hidden z-20">
          {LANGS.map(l => (
            <button key={l.code} onClick={() => { setLang(l.code); setOpen(false) }}
              className="w-full flex items-center justify-between px-4 py-3 text-[15px] font-semibold text-gray-800 hover:bg-violet-50">
              {l.name} {lang === l.code && <Check size={16} style={{ color: PRIMARY }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Chip({ icon, label, tone, className = '' }: { icon: React.ReactNode; label: string; tone: string; className?: string }) {
  return (
    <div className={`absolute flex flex-col items-center justify-center gap-1 rounded-2xl bg-white/85 backdrop-blur shadow-[0_8px_24px_rgba(91,61,245,0.13)] border border-white ${tone} ${className}`}
      style={{ width: 72, height: 74 }}>
      {icon}
      <span className="text-[12px] font-semibold text-gray-800 text-center leading-tight whitespace-pre-line">{label}</span>
    </div>
  )
}

function Dots({ index }: { index: number }) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      {[0, 1, 2].map(i => (
        <span key={i} className="rounded-full transition-all" style={{ width: i === index ? 12 : 10, height: i === index ? 12 : 10, background: i === index ? PRIMARY : '#D9D3F5' }} />
      ))}
    </div>
  )
}

function PrimaryBtn({ children, onClick, disabled, className = '' }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`h-[58px] rounded-full text-white text-[19px] font-semibold flex items-center justify-center gap-2 shadow-[0_10px_24px_rgba(91,61,245,0.35)] active:scale-[0.98] transition disabled:opacity-60 ${className}`}
      style={{ background: PRIMARY }}>
      {children}
    </button>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="back" className="h-[58px] w-[64px] shrink-0 rounded-2xl bg-white border border-violet-100 shadow-sm flex items-center justify-center active:scale-95 transition">
      <ArrowLeft size={24} style={{ color: PRIMARY }} />
    </button>
  )
}

function Heading({ h1, h2, big = true }: { h1: string; h2: string; big?: boolean }) {
  return (
    <h1 className={`text-center font-extrabold leading-[1.25] ${big ? 'text-[32px]' : 'text-[28px]'}`}>
      <span className="block text-[#14123A]">{h1}</span>
      <span className="block" style={{ color: PRIMARY }}>{h2}</span>
    </h1>
  )
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 bg-white rounded-2xl border border-violet-100 shadow-sm px-3 py-2.5">
      <div className="w-11 h-11 rounded-xl bg-[#F1EEFF] flex items-center justify-center shrink-0" style={{ color: PRIMARY }}>{icon}</div>
      <div className="flex-1 min-w-0"><div className="text-[13px] text-gray-500 leading-none mb-1">{label}</div>{children}</div>
    </label>
  )
}

export default function WelcomePage() {
  const router = useRouter()
  const { lang, setLang } = useLanguage()
  const c = ONBOARDING[lang]
  const [step, setStep] = useState<Step>('splash')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [needsVerify, setNeedsVerify] = useState(false)
  const touchX = useRef<number | null>(null)

  const finish = () => { try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {} }
  const goLogin = () => { finish(); router.push('/login') }

  // Already signed in? No onboarding needed.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) { finish(); router.replace('/dashboard') } })
  }, [router])

  const carouselIndex = CAROUSEL.indexOf(step)
  const go = (s: Step) => setStep(s)
  const next = () => { if (carouselIndex >= 0 && carouselIndex < 2) go(CAROUSEL[carouselIndex + 1]) }
  const prev = () => { if (carouselIndex > 0) go(CAROUSEL[carouselIndex - 1]) }

  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null || carouselIndex < 0) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (dx < -60) next()
    else if (dx > 60) prev()
  }

  const signUp = async () => {
    if (!name.trim() || !email.trim() || !password) { toast.error(c.account.errFill); return }
    if (password.length < 6) { toast.error(c.account.errPass); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: name.trim() }, emailRedirectTo: `${window.location.origin}/dashboard` },
      })
      if (error) throw error
      finish()
      if (data.session) {
        // Signed in immediately — save language choice to their profile
        await supabase.from('profiles').update({ language: lang }).eq('id', data.user!.id)
        setNeedsVerify(false)
      } else {
        try { localStorage.setItem(PENDING_LANG_KEY, lang) } catch {}
        setNeedsVerify(true)
      }
      go('ready')
    } catch (err: any) {
      const msg = err?.message || ''
      toast.error(msg.includes('already registered') ? c.account.errExists : c.account.errGeneric)
    } finally { setBusy(false) }
  }

  const google = async () => {
    setGoogleBusy(true)
    try { localStorage.setItem(PENDING_LANG_KEY, lang) } catch {}
    finish()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard`, queryParams: { access_type: 'offline', prompt: 'consent' } },
    })
    if (error) { toast.error(c.account.errGoogle); setGoogleBusy(false) }
  }

  const shell = 'relative mx-auto w-full max-w-[430px] min-h-[100dvh] flex flex-col overflow-hidden ob-in'
  const bg = { background: 'linear-gradient(180deg,#ECE7FF 0%,#F6F3FF 38%,#FFFFFF 100%)', fontFamily: "'Noto Sans Bengali','Noto Sans Devanagari',Inter,system-ui,sans-serif" } as const
  const pad = { paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }

  // ───────── SPLASH ─────────
  if (step === 'splash') return (
    <div style={bg}><div className={shell} style={pad} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} key="splash">
      <div className="px-5 flex justify-end"><LangPill /></div>
      <div className="flex flex-col items-center px-6 mt-1">
        <img src="/brand-mark.png" alt="Sahayak AI" className="w-[84px] h-[84px] rounded-[22px] shadow-[0_12px_28px_rgba(91,61,245,0.35)]" />
        <div className="text-[34px] font-extrabold text-[#14123A] mt-2 leading-none">Sahayak AI</div>
        <div className="text-[19px] font-semibold mt-2" style={{ color: PRIMARY }}>{c.tagline}</div>
        <div className="flex items-center gap-3 mt-3 text-[15px] text-gray-800">
          {c.values.map((v, i) => (<span key={i} className="flex items-center gap-3">{i > 0 && <span className="w-px h-4 bg-gray-300" />}{v}</span>))}
        </div>
      </div>
      <div className="relative flex-1 min-h-[300px] mt-2">
        <img src="/mascot/sahayak-robot-wave.png" alt="" className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[92%] max-h-[330px] object-contain" />
        <Chip className="left-[6%] top-[4%]" tone="" icon={<BarChart3 size={24} color="#3B82F6" />} label={c.chips.sales} />
        <Chip className="left-[1%] top-[36%]" tone="" icon={<Package size={24} color="#10B981" />} label={c.chips.stock} />
        <Chip className="left-[8%] top-[66%]" tone="" icon={<Users size={24} color="#EC4899" />} label={c.chips.customers} />
        <Chip className="right-[6%] top-[2%]" tone="" icon={<FileText size={24} color="#F59E0B" />} label={c.chips.invoice} />
        <Chip className="right-[1%] top-[33%]" tone="" icon={<IndianRupee size={24} color="#EC4899" />} label={c.chips.dues} />
        <Chip className="right-[4%] top-[64%]" tone="" icon={<Sparkles size={24} color={PRIMARY} />} label={c.chips.ai} />
      </div>
      <div className="px-6">
        <Heading h1={c.splash.h1} h2={c.splash.h2} />
        <p className="text-center text-[15px] leading-relaxed text-gray-600 mt-2">{c.splash.sub}</p>
        <div className="mt-4"><Dots index={0} /></div>
        <PrimaryBtn className="w-full mt-4" onClick={() => go('slide2')}>{c.splash.start} <ArrowRight size={22} /></PrimaryBtn>
        <button onClick={goLogin} className="w-full h-[54px] mt-3 rounded-full bg-white border border-violet-100 shadow-sm text-[16px] font-semibold text-[#14123A] active:scale-[0.98] transition">
          {c.splash.returning}
        </button>
      </div>
    </div></div>
  )

  // ───────── SLIDE 2 ─────────
  if (step === 'slide2') return (
    <div style={bg}><div className={shell} style={pad} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} key="s2">
      <div className="px-6 flex justify-end"><button onClick={() => go('language')} className="flex items-center gap-1 text-[16px] font-semibold" style={{ color: PRIMARY }}>{c.skip} <ArrowRight size={18} /></button></div>
      <div className="relative flex-1 min-h-[360px]">
        <img src="/mascot/sahayak-robot-point.png" alt="" className="absolute left-1/2 -translate-x-1/2 top-[22%] h-[64%] max-h-[290px] object-contain" />
        <Chip className="left-1/2 -translate-x-1/2 top-[0%]" tone="" icon={<BarChart3 size={26} color={PRIMARY} />} label={c.chips.sales} />
        <Chip className="left-[8%] top-[12%]" tone="" icon={<Package size={26} color="#10B981" />} label={c.chips.stock} />
        <Chip className="right-[8%] top-[12%]" tone="" icon={<Users size={26} color="#EC4899" />} label={c.chips.customers} />
        <Chip className="left-[2%] top-[44%]" tone="" icon={<FileText size={26} color="#F59E0B" />} label={c.chips.invoice} />
        <Chip className="right-[2%] top-[44%]" tone="" icon={<IndianRupee size={26} color="#3B82F6" />} label={c.chips.dues} />
        <Chip className="left-[6%] top-[76%]" tone="" icon={<Store size={26} color={PRIMARY} />} label={c.chips.supplier} />
        <Chip className="right-[6%] top-[76%]" tone="" icon={<BarChart3 size={26} color="#10B981" />} label={c.chips.reports} />
      </div>
      <div className="px-6">
        <Heading h1={c.slide2.h1} h2={c.slide2.h2} />
        <p className="text-center text-[15px] leading-relaxed text-gray-600 mt-3">{c.slide2.sub}</p>
        <div className="mt-5"><Dots index={1} /></div>
        <div className="flex gap-3 mt-5"><BackBtn onClick={prev} /><PrimaryBtn className="flex-1" onClick={next}>{c.next} <ArrowRight size={22} /></PrimaryBtn></div>
      </div>
    </div></div>
  )

  // ───────── SLIDE 3 ─────────
  if (step === 'slide3') {
    const f = c.slide3.features
    const icons = [
      { i: <MessageCircle size={26} color={PRIMARY} />, bg: '#EDE9FF' }, { i: <Package size={26} color="#10B981" />, bg: '#DFF7EC' },
      { i: <Users size={26} color="#EC4899" />, bg: '#FFE4EF' }, { i: <FileText size={26} color="#3B82F6" />, bg: '#E0EDFF' },
      { i: <BarChart3 size={26} color="#F59E0B" />, bg: '#FFEBD1' },
    ]
    return (
      <div style={bg}><div className={shell} style={pad} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} key="s3">
        <div className="px-6 flex justify-end"><button onClick={() => go('language')} className="flex items-center gap-1 text-[16px] font-semibold" style={{ color: PRIMARY }}>{c.skip} <ArrowRight size={18} /></button></div>
        <div className="px-6 mt-1"><Heading h1={c.slide3.h1} h2={c.slide3.h2} big={false} />
          <p className="text-center text-[15px] text-gray-600 mt-2">{c.slide3.sub}</p></div>
        <div className="relative h-[250px] mt-2">
          <img src="/mascot/sahayak-robot-point.png" alt="" className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[92%] object-contain" />
          {/* Decorative sample figures — illustration only, not real data */}
          <div className="absolute left-3 top-2 w-[128px] rounded-2xl bg-white shadow-[0_8px_24px_rgba(91,61,245,0.13)] p-2.5">
            <div className="text-[11px] text-gray-500">{c.slide3.stats.sales}</div><div className="text-[20px] font-bold text-[#14123A] leading-tight">₹12,480</div><div className="text-[11px] font-semibold text-emerald-500">↑ 12%</div></div>
          <div className="absolute left-3 top-[112px] w-[118px] rounded-2xl bg-white shadow-[0_8px_24px_rgba(91,61,245,0.13)] p-2.5">
            <div className="text-[11px] text-gray-500">{c.slide3.stats.stock}</div><div className="text-[20px] font-bold text-[#14123A] leading-tight">248</div><div className="text-[11px] font-semibold text-emerald-500">↑ 5%</div></div>
          <div className="absolute right-3 top-6 w-[112px] rounded-2xl bg-white shadow-[0_8px_24px_rgba(91,61,245,0.13)] p-2.5">
            <div className="text-[11px] text-gray-500">{c.slide3.stats.customers}</div><div className="text-[20px] font-bold text-[#14123A] leading-tight">23</div><div className="text-[11px] font-semibold text-emerald-500">↑ 4</div></div>
          <div className="absolute right-3 top-[120px] w-[112px] rounded-2xl bg-white shadow-[0_8px_24px_rgba(91,61,245,0.13)] p-2.5">
            <div className="text-[11px] text-gray-500 flex items-center gap-1"><AlertTriangle size={11} color="#F59E0B" />{c.slide3.stats.low}</div><div className="text-[20px] font-bold text-[#14123A] leading-tight">6</div><div className="text-[11px] font-semibold" style={{ color: PRIMARY }}>{c.slide3.stats.view} →</div></div>
        </div>
        <div className="px-5 space-y-2.5">
          {f.map((x, i) => (
            <div key={i} className="flex items-center gap-3 bg-white rounded-2xl border border-violet-50 shadow-sm px-3 py-2.5">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: icons[i].bg }}>{icons[i].i}</div>
              <div className="flex-1 min-w-0"><div className="text-[16px] font-bold text-[#14123A] leading-snug">{x.t}</div><div className="text-[13px] text-gray-500 leading-snug">{x.s}</div></div>
              <ChevronRight size={20} className="text-gray-400 shrink-0" />
            </div>
          ))}
        </div>
        <div className="px-6 mt-4"><Dots index={2} />
          <div className="flex gap-3 mt-4"><BackBtn onClick={prev} /><PrimaryBtn className="flex-1" onClick={() => go('language')}>{ONBOARDING[lang].splash.start} <ArrowRight size={22} /></PrimaryBtn></div></div>
      </div></div>
    )
  }

  // ───────── stepper (language / account / ready) ─────────
  const stepIdx = step === 'language' ? 0 : step === 'account' ? 1 : 2
  const Stepper = (
    <div className="flex items-start justify-center gap-0 flex-1">
      {c.steps.map((label, i) => (
        <div key={i} className="flex items-start">
          <div className="flex flex-col items-center w-[74px]">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-[16px] font-bold"
              style={i <= stepIdx ? { background: PRIMARY, color: '#fff' } : { background: '#ECE8FF', color: '#6B6890' }}>
              {i < stepIdx ? <Check size={18} /> : i + 1}
            </div>
            <span className="text-[13px] mt-1 font-medium" style={{ color: i === stepIdx ? PRIMARY : '#6B6890' }}>{label}</span>
          </div>
          {i < 2 && <div className="w-8 h-[3px] rounded mt-5 -mx-2" style={{ background: i < stepIdx ? PRIMARY : '#E3DEFB' }} />}
        </div>
      ))}
    </div>
  )

  // ───────── LANGUAGE ─────────
  if (step === 'language') return (
    <div style={bg}><div className={shell} style={pad} key="lang">
      <div className="px-5 flex items-start gap-2">
        <button onClick={() => go('slide3')} aria-label="back" className="w-11 h-11 rounded-2xl bg-white border border-violet-100 shadow-sm flex items-center justify-center shrink-0"><ArrowLeft size={22} style={{ color: PRIMARY }} /></button>
        {Stepper}<div className="w-11 shrink-0" />
      </div>
      <div className="px-6 mt-4"><Heading h1={c.language.h1} h2={c.language.h2} big={false} />
        <p className="text-center text-[15px] text-gray-600 mt-2">{c.language.sub}</p></div>
      <div className="relative h-[220px] mt-1">
        <img src="/mascot/sahayak-robot-wave.png" alt="" className="absolute left-1/2 -translate-x-1/2 bottom-0 h-full object-contain" />
        <div className="absolute left-4 top-6 px-4 py-2.5 rounded-2xl bg-white/90 shadow-md text-[17px] font-semibold" style={{ color: PRIMARY }}>নমস্কার!</div>
        <div className="absolute right-4 top-4 px-4 py-2.5 rounded-2xl bg-white/90 shadow-md text-[17px] font-semibold text-gray-800">नमस्ते!</div>
        <div className="absolute left-6 top-[118px] px-4 py-2.5 rounded-2xl bg-white/90 shadow-md text-[17px] font-semibold text-[#14123A]">Hello!</div>
      </div>
      <div className="px-5 space-y-3 mt-2">
        {LANGS.map(l => {
          const sel = lang === l.code
          return (
            <button key={l.code} onClick={() => setLang(l.code)} className="w-full flex items-center gap-4 rounded-2xl bg-white px-4 py-3.5 text-left active:scale-[0.99] transition"
              style={{ border: `2px solid ${sel ? PRIMARY : '#EFEBFF'}`, boxShadow: sel ? '0 6px 20px rgba(91,61,245,0.15)' : 'none' }}>
              <div className="w-14 h-11 rounded-xl flex items-center justify-center text-[22px] font-bold" style={{ background: sel ? '#EDE9FF' : '#F5F3FF', color: PRIMARY }}>{l.badge}</div>
              <div className="flex-1"><div className="text-[19px] font-bold text-[#14123A] leading-tight">{l.name}</div><div className="text-[14px] text-gray-500">{c.language.hint[l.code]}</div></div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `2px solid ${sel ? PRIMARY : '#CFC8F0'}` }}>
                {sel && <div className="w-3.5 h-3.5 rounded-full" style={{ background: PRIMARY }} />}
              </div>
            </button>
          )
        })}
      </div>
      <div className="px-5 mt-auto pt-5"><PrimaryBtn className="w-full" onClick={() => go('account')}>{c.next} <ArrowRight size={22} /></PrimaryBtn></div>
    </div></div>
  )

  // ───────── ACCOUNT ─────────
  if (step === 'account') {
    const inputCls = 'w-full bg-transparent outline-none text-[17px] font-medium text-[#14123A] placeholder:text-gray-400'
    return (
      <div style={bg}><div className={shell} style={pad} key="acct">
        <div className="px-5 flex items-center justify-between">
          <button onClick={() => go('language')} aria-label="back" className="w-11 h-11 rounded-2xl bg-white border border-violet-100 shadow-sm flex items-center justify-center"><ArrowLeft size={22} style={{ color: PRIMARY }} /></button>
          {Stepper}<LangPill />
        </div>
        <div className="px-6 mt-4 flex items-center gap-3">
          <img src="/brand-mark.png" alt="" className="w-14 h-14 rounded-2xl shadow-md" />
          <div><div className="text-[24px] font-extrabold text-[#14123A] leading-none">Sahayak AI</div><div className="text-[14px] font-semibold mt-1" style={{ color: PRIMARY }}>{c.tagline}</div></div>
        </div>
        <div className="px-6 mt-3 flex items-end justify-between gap-2">
          <div className="flex-1">
            <h1 className="text-[28px] font-extrabold leading-[1.25]"><span className="text-[#14123A]">{c.account.h1} </span><span style={{ color: PRIMARY }}>{c.account.h2}</span></h1>
            <p className="text-[14px] leading-relaxed text-gray-600 mt-1.5">{c.account.sub}</p>
          </div>
          <img src="/mascot/sahayak-robot-wave.png" alt="" className="w-[112px] object-contain -mb-2 shrink-0" />
        </div>
        <div className="px-5 mt-3 space-y-3">
          <Field icon={<User size={22} />} label={c.account.name}><input value={name} onChange={e => setName(e.target.value)} autoComplete="name" className={inputCls} /></Field>
          <Field icon={<Mail size={22} />} label={c.account.email}><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="example@gmail.com" className={inputCls} /></Field>
          <Field icon={<Lock size={22} />} label={c.account.password}>
            <div className="flex items-center"><input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={inputCls} />
              <button type="button" onClick={() => setShowPw(!showPw)} className="text-gray-600 pl-2">{showPw ? <EyeOff size={22} /> : <Eye size={22} />}</button></div>
          </Field>
          <PrimaryBtn className="w-full" onClick={signUp} disabled={busy || googleBusy}>{busy ? <Loader2 className="animate-spin" size={22} /> : <>{c.account.create} <ArrowRight size={22} /></>}</PrimaryBtn>
          <div className="flex items-center gap-3 text-[14px] text-gray-500"><span className="flex-1 h-px bg-gray-200" />{c.account.or}<span className="flex-1 h-px bg-gray-200" /></div>
          <button onClick={google} disabled={busy || googleBusy} className="w-full h-[56px] rounded-2xl bg-white border border-violet-100 shadow-sm flex items-center justify-center gap-3 text-[17px] font-semibold text-[#14123A] active:scale-[0.98] transition disabled:opacity-60">
            {googleBusy ? <Loader2 className="animate-spin text-gray-400" size={20} /> : <GoogleIcon />} {c.account.google}
          </button>
          <p className="text-center text-[13px] text-gray-500 pb-2">{c.account.termsPre}<Link href="/privacy" className="font-semibold" style={{ color: PRIMARY }}>{c.account.terms}</Link>{c.account.termsPost}</p>
        </div>
      </div></div>
    )
  }

  // ───────── READY ─────────
  return (
    <div style={bg}><div className={`${shell} items-center justify-center text-center px-8`} style={pad} key="ready">
      <img src="/mascot/sahayak-robot-point.png" alt="" className="h-[300px] object-contain" />
      <h1 className="text-[32px] font-extrabold text-[#14123A] mt-4">{c.ready.h} 🎉</h1>
      <p className="text-[16px] text-gray-600 mt-2 leading-relaxed">{needsVerify ? c.ready.verify : c.ready.sub}</p>
      <PrimaryBtn className="w-full mt-8" onClick={() => router.push(needsVerify ? '/login' : '/dashboard')}>{needsVerify ? c.ready.login : c.ready.go} <ArrowRight size={22} /></PrimaryBtn>
    </div></div>
  )
}
