'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, LibraryBig, PlusCircle, LayoutDashboard, User } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { useLanguage } from '@/lib/LanguageContext'

// App-style bottom navigation. Renders only on phones (md:hidden), and only on
// top-level pages. Full-screen screens (dashboard, agent workspaces, login,
// admin) have their own navigation, so the bar is hidden there.
const SHOW_ON = ['/', '/library', '/agents/new', '/blog', '/contact', '/about', '/subscribe', '/solutions']

const TABS = [
  { href: '/', en: 'Home', hi: 'होम', bn: 'হোম', icon: Home, protected: false },
  { href: '/library', en: 'Library', hi: 'लाइब्रेरी', bn: 'লাইব্রেরি', icon: LibraryBig, protected: true },
  { href: '/agents/new', en: 'Build', hi: 'बनाएं', bn: 'তৈরি', icon: PlusCircle, protected: true },
  { href: '/dashboard', en: 'Dashboard', hi: 'डैशबोर्ड', bn: 'ড্যাশবোর্ড', icon: LayoutDashboard, protected: true },
  { href: '/login', en: 'Account', hi: 'अकाउंट', bn: 'অ্যাকাউন্ট', icon: User, protected: false },
]

export default function MobileTabBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { lang } = useLanguage()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user))
    const { data: l } = supabase.auth.onAuthStateChange((_e, s) => setLoggedIn(!!s?.user))
    return () => l.subscription.unsubscribe()
  }, [])

  if (!pathname || !SHOW_ON.includes(pathname)) return null

  return (
    <>
    <div className="md:hidden" style={{ height: 'calc(64px + env(safe-area-inset-bottom))' }} />
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-100 flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        // "Account" goes to the dashboard when signed in, login otherwise
        const href = tab.href === '/login' && loggedIn ? '/dashboard' : tab.href
        const active = pathname === tab.href
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={href}
            onClick={(e) => {
              if (tab.protected && loggedIn === false) {
                e.preventDefault()
                router.push(`/login?next=${encodeURIComponent(tab.href)}`)
              }
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold active:scale-95 transition-transform ${
              active ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
            <span>{lang === 'bn' ? tab.bn : lang === 'hi' ? tab.hi : tab.en}</span>
          </Link>
        )
      })}
    </nav>
    </>
  )
}
