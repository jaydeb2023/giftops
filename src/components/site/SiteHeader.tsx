'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { LogoMark } from '@/components/rv/Logo'

const NAV = [
  { href: '#home', label: 'Home' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#about', label: 'About' },
  { href: '#contact', label: 'Contact' },
]

export default function SiteHeader() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-rv-100/70 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="#home" className="flex items-center gap-3">
          <LogoMark size={44} />
          <div className="leading-none">
            <div className="text-[26px] font-extrabold tracking-tight text-rv-700">GiftOps</div>
            <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.22em] text-slate-500">by Evynta</div>
          </div>
          <span className="mx-2 hidden h-10 w-px bg-slate-200 md:block" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/evynta-logo-dark.png" alt="Evynta - AI, Web, Data Solutions" className="hidden h-12 w-auto md:block" />
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((n, i) => (
            <a key={n.href} href={n.href} className={`relative py-1 text-[15px] font-medium transition hover:text-rv-700 ${i === 0 ? 'text-rv-700' : 'text-slate-700'}`}>
              {n.label}
              {i === 0 && <span className="absolute -bottom-3 left-0 right-0 h-0.5 rounded bg-rv-700" />}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/app/login" className="hidden rounded-xl border border-rv-700 px-5 py-2.5 text-[15px] font-semibold text-rv-700 transition hover:bg-rv-50 sm:inline-block">Login</Link>
          <a href="#contact" className="hidden rounded-xl bg-rv-700 px-5 py-2.5 text-[15px] font-semibold text-white shadow-sm transition hover:bg-rv-800 sm:inline-block">Get Started</a>
          <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden">{open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 pb-4 lg:hidden">
          {NAV.map(n => <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-slate-100 py-3 text-base font-medium text-slate-800">{n.label}</a>)}
          <div className="mt-4 flex gap-2">
            <Link href="/app/login" className="flex-1 rounded-xl border border-rv-700 py-2.5 text-center font-semibold text-rv-700">Login</Link>
            <a href="#contact" onClick={() => setOpen(false)} className="flex-1 rounded-xl bg-rv-700 py-2.5 text-center font-semibold text-white">Get Started</a>
          </div>
        </div>
      )}
    </header>
  )
}
