'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, ShieldAlert, Search, Bell, Menu, X, LogOut, ArrowLeft, LayoutDashboard, Users, Bot, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { clearAllCache } from '@/lib/swrCache'
import { ADMIN_NAV } from './_components/nav'

interface Summary { users: number; agents: number; publicAgents: number; admins: number }

// Phones: every admin table becomes a list of cards (label : value rows).
// Labels are copied from each table's <th> by the effect below, so no table needs changes.
const CARD_TABLE_CSS = `
@media (max-width: 639px) {
  .admin-rt table, .admin-rt tbody, .admin-rt tr, .admin-rt td { display: block; width: 100%; }
  .admin-rt thead { display: none; }
  .admin-rt tr { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; }
  .admin-rt tbody tr:last-child { border-bottom: 0; }
  .admin-rt td { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 5px 0 !important; border: 0 !important; text-align: right !important; font-size: 13px; }
  .admin-rt td::before { content: attr(data-label); flex-shrink: 0; font-size: 11px; font-weight: 600; color: #9ca3af; text-align: left; }
  .admin-rt td[data-label=""]::before { display: none; }
  .admin-rt td[data-label=""] { justify-content: flex-end; flex-wrap: wrap; }
  .admin-rt td:first-child { justify-content: flex-start; text-align: left !important; padding-top: 0 !important; }
  .admin-rt td:first-child::before { display: none; }
  .admin-rt td[colspan] { justify-content: center; text-align: center !important; }
  .admin-rt td[colspan]::before { display: none; }
}
`

const BOTTOM_TABS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/agents', label: 'Agents', icon: Bot },
  { href: '/admin/subscriptions', label: 'Subs', icon: CreditCard },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checking, setChecking] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [me, setMe] = useState<{ email: string; full_name: string | null } | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [query, setQuery] = useState('')
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.replace('/login?next=/admin')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, email, full_name')
        .eq('id', data.user.id)
        .single()
      if (!profile?.is_admin) {
        setChecking(false)
        setAuthorized(false)
        return
      }
      setMe({ email: profile.email, full_name: profile.full_name })
      setAuthorized(true)
      setChecking(false)

      fetch('/api/admin/summary').then((r) => r.json()).then(setSummary).catch(() => {})
    }
    init()
  }, [router])

  // close the drawer whenever the page changes
  useEffect(() => { setDrawer(false) }, [pathname])

  // copy every <th> label onto its column's <td>s (used by the phone card layout)
  useEffect(() => {
    const root = mainRef.current
    if (!root) return
    const label = () => {
      root.querySelectorAll('table').forEach((t) => {
        const heads = Array.from(t.querySelectorAll('thead th') as NodeListOf<HTMLElement>).map((th) => (th.textContent || '').trim())
        t.querySelectorAll('tbody tr').forEach((tr) => {
          Array.from(tr.children as HTMLCollectionOf<Element>).forEach((td, i) => {
            if (td.tagName === 'TD' && !td.hasAttribute('data-label')) td.setAttribute('data-label', heads[i] || '')
          })
        })
      })
    }
    label()
    let timer: any
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(label, 30) })
    mo.observe(root, { childList: true, subtree: true })
    return () => { mo.disconnect(); clearTimeout(timer) }
  }, [authorized, pathname])

  const signOut = async () => {
    await supabase.auth.signOut()
    clearAllCache()
    router.replace('/login')
  }

  const submitSearch = () => {
    const q = query.trim()
    router.push(q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users')
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-violet-600" size={28} />
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4 bg-gray-50">
        <ShieldAlert className="text-red-400" size={32} />
        <p className="text-gray-700 font-semibold">You don't have access to this page.</p>
        <p className="text-gray-400 text-sm">Admin access is restricted.</p>
        <Link href="/dashboard" className="mt-2 text-sm font-semibold text-violet-600">← Back to app</Link>
      </div>
    )
  }

  const badgeFor = (href: string) => {
    if (!summary) return null
    if (href === '/admin/users') return summary.users
    if (href === '/admin/agents') return summary.agents
    if (href === '/admin/agent-library') return summary.publicAgents
    if (href === '/admin/admin-users') return summary.admins
    return null
  }
  const isActive = (href: string) => (href === '/admin' ? pathname === '/admin' : !!pathname?.startsWith(href))

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <style>{CARD_TABLE_CSS}</style>

      {/* Drawer backdrop (phones / tablets) */}
      {drawer && <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setDrawer(false)} />}

      {/* Sidebar — fixed column on desktop, slide-in drawer below lg */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-white border-r border-gray-100 flex flex-col transition-transform duration-200
          lg:sticky lg:top-0 lg:h-screen lg:z-20 lg:translate-x-0 lg:shrink-0 ${drawer ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold">স</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 leading-tight text-sm">Sahayak AI</p>
            <p className="text-[11px] text-gray-400 leading-tight">Super Admin Panel</p>
          </div>
          <button onClick={() => setDrawer(false)} className="lg:hidden p-1.5 -mr-2 text-gray-400" aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            const badge = badgeFor(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-violet-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-gray-400'} />
                <span className="flex-1">{item.label}</span>
                {badge !== null && badge !== undefined && (
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {badge}
                  </span>
                )}
                {!item.live && (
                  <span className={`text-[9px] uppercase tracking-wide font-bold ${active ? 'text-white/70' : 'text-gray-300'}`}>soon</span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* The admin panel has its own shell, so the way back and log out live here */}
        <div className="border-t border-gray-100 p-3 space-y-0.5 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
            <ArrowLeft size={16} className="text-gray-400" /> Back to app
          </Link>
          <button onClick={signOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 lg:h-16 border-b border-gray-100 bg-white flex items-center gap-2 sm:gap-4 px-3 sm:px-6 sticky top-0 z-30">
          <button onClick={() => setDrawer(true)} className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-50" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="relative flex-1 max-w-md min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch() }}
              enterKeyHint="search"
              placeholder="ব্যবহারকারী খুঁজুন..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:border-violet-300"
            />
          </div>
          <div className="flex-1 hidden sm:block" />
          <button className="relative text-gray-400 hover:text-gray-600 p-1.5" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <div className="flex items-center gap-2 pl-2 sm:pl-3 sm:border-l border-gray-100">
            <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">
              {(me?.full_name || me?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block">
              <p className="text-xs font-semibold text-gray-800 leading-tight">{me?.full_name || me?.email}</p>
              <p className="text-[10px] text-gray-400 leading-tight">Super Admin</p>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="admin-rt flex-1 min-w-0 p-3 sm:p-6 lg:p-8 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* App-style bottom bar (phones / tablets) */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {BOTTOM_TABS.map((t) => {
          const Icon = t.icon
          const active = isActive(t.href)
          return (
            <Link key={t.href} href={t.href} className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold ${active ? 'text-violet-600' : 'text-gray-400'}`}>
              <Icon size={19} />
              {t.label}
            </Link>
          )
        })}
        <button onClick={() => setDrawer(true)} className="flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold text-gray-400">
          <Menu size={19} />
          More
        </button>
      </nav>
    </div>
  )
}
