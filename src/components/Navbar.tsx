'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { Menu, X, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { clearAllCache } from '@/lib/swrCache'
import { isFullScreenAppRoute } from '@/lib/fullScreenRoutes'

const navLinks = [
  { href: '/',           label: 'Home',        labelBn: 'হোম',          protected: false },
  { href: '/library',    label: 'Library',     labelBn: 'লাইব্রেরি',    protected: true  },
  { href: '/agents/new', label: 'Build Agent', labelBn: 'এজেন্ট তৈরি', protected: true  },
  { href: '/dashboard',  label: 'Dashboard',   labelBn: 'ড্যাশবোর্ড',  protected: true  },
  { href: '/blog',       label: 'Blog',        labelBn: 'ব্লগ',         protected: false },
  { href: '/contact',    label: 'Contact',     labelBn: 'যোগাযোগ',     protected: false },
]

export default function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [user, setUser]         = useState<any>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [isAdmin, setIsAdmin]   = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setAuthLoaded(true)
      if (data.user) {
        supabase.from('profiles').select('is_admin').eq('id', data.user.id).single()
          .then(({ data: p }) => setIsAdmin(!!p?.is_admin))
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      setAuthLoaded(true)
      if (session?.user) {
        supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
          .then(({ data: p }) => setIsAdmin(!!p?.is_admin))
      } else {
        setIsAdmin(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const links = isAdmin
    ? [...navLinks, { href: '/admin', label: 'Admin', labelBn: 'অ্যাডমিন', protected: true }]
    : navLinks

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearAllCache()
    setUser(null)
    router.push('/')
  }

  // For protected links: if not logged in, go to /login?next=<href>
  const handleProtectedNav = (e: React.MouseEvent, href: string, isProtected: boolean) => {
    if (isProtected && authLoaded && !user) {
      e.preventDefault()
      router.push(`/login?next=${encodeURIComponent(href)}`)
    }
    setMenuOpen(false)
  }

  // On full-screen app pages (dashboard, team, branches, ...), the page's
  // own sidebar handles all navigation - hide the global navbar completely.
  if (isFullScreenAppRoute(pathname)) return null

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 h-[60px] flex items-center">
      <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <Image src="/brand-mark.png" alt="Sahayak AI" width={36} height={36} className="w-9 h-9 flex-shrink-0" priority />
          <div>
            <div className="font-bold text-[15px] text-gray-900 leading-none">Sahayak AI</div>
            <div className="text-[10px] text-indigo-600 font-semibold leading-none mt-0.5">সহায়ক AI · বাংলার ব্যবসার বিশ্বস্ত সঙ্গী</div>
          </div>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(link => {
            const isActive   = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
            const isLocked   = link.protected && authLoaded && !user
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={e => handleProtectedNav(e, link.href, link.protected)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-1.5',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                {link.label}
                {isLocked && <Lock size={10} className="text-gray-300" />}
              </Link>
            )
          })}
        </div>

        {/* Auth buttons */}
        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-600 max-w-[120px] truncate">{user.email?.split('@')[0]}</span>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-[13px] font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 text-[13px] font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 text-[13px] font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors bengali"
              >
                শুরু করুন বিনামূল্যে
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-[60px] left-0 right-0 bg-white border-b border-gray-200 p-4 md:hidden z-50 flex flex-col gap-2 shadow-lg">
          {links.map(link => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
            const isLocked = link.protected && authLoaded && !user
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={e => handleProtectedNav(e, link.href, link.protected)}
                className={cn(
                  'px-4 py-3 rounded-lg text-[14px] font-medium flex items-center justify-between',
                  isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                <span>
                  {link.label}
                  <span className="text-gray-400 ml-1 bengali text-xs">· {link.labelBn}</span>
                </span>
                {isLocked && (
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Lock size={9} /> Login
                  </span>
                )}
              </Link>
            )
          })}

          <div className="border-t border-gray-100 pt-3 mt-1 flex flex-col gap-2">
            {user ? (
              <button
                onClick={handleLogout}
                className="px-4 py-3 text-center text-[14px] font-medium text-red-600 border border-red-200 rounded-lg"
              >
                Logout ({user.email?.split('@')[0]})
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-center text-[14px] font-medium border border-gray-200 rounded-lg"
                >
                  Sign in
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-center text-[14px] font-semibold text-white bg-indigo-600 rounded-lg bengali"
                >
                  শুরু করুন বিনামূল্যে
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
