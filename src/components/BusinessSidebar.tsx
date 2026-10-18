'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Home, LayoutDashboard, Bot, BookOpen, Plus, Package, TrendingUp, IndianRupee,
  Users, FileText, Truck, Zap, MessageCircle, Megaphone, BarChart2, Building2,
  UserCog, Settings, LogOut, Lock, ChevronDown, ChevronUp, Menu, X, Search, Bell, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { clearAllCache } from '@/lib/swrCache'
import LanguageToggle from '@/components/LanguageToggle'
import { hasFeature, lockedMessageBn } from '@/lib/planFeatures'
import toast from 'react-hot-toast'

import { tr } from '@/lib/i18n/tr'
// ── Nav primitives — visually identical to the dashboard's own sidebar
// (see src/app/dashboard/page.tsx), reimplemented standalone here so
// this shell can wrap standalone routes like /team without touching that
// 1800-line file's tightly-coupled internal `view` state. ──────────────

function NavItem({ icon, label, active, onClick, badge, collapsed, locked }: {
  icon: ReactNode; label: string; active?: boolean; onClick: () => void; badge?: number; collapsed?: boolean; locked?: boolean
}) {
  return (
    <button
      onClick={locked ? () => toast.error(lockedMessageBn('employees')) : onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 text-left bengali active:scale-[0.98] ${
        active
          ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-300/50'
          : locked
          ? 'text-gray-400 hover:bg-gray-50'
          : 'text-gray-500 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-fuchsia-50 hover:text-indigo-700'
      } ${collapsed ? 'justify-center' : ''}`}>
      <span className={`flex-shrink-0 transition-colors ${active ? 'text-white' : locked ? 'text-gray-300' : 'text-gray-400'}`}>{icon}</span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {!collapsed && locked && <Lock size={12} className="text-gray-300 flex-shrink-0" />}
      {!collapsed && !locked && badge ? <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-fuchsia-100 text-fuchsia-600'}`}>{badge}</span> : null}
    </button>
  )
}

function NavGroup({ label, icon, children, collapsed, defaultOpen = true }: {
  label: string; icon: ReactNode; children: ReactNode; collapsed?: boolean; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (collapsed) return <>{children}</>
  return (
    <div className="mb-1">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider hover:text-gray-600 active:scale-[0.98] transition-all">
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 text-left bengali">{label}</span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  )
}

export type BusinessNavKey =
  | 'dashboard' | 'my-agents' | 'library' | 'build-agent'
  | 'team' | 'branches'

interface BusinessSidebarProps {
  active: BusinessNavKey
  children: ReactNode
  /** Right-aligned page title shown in the topbar on mobile, and used for the <title>-style header. */
  pageTitle?: string
  /** Wires the topbar's search input into the page's own filtering (e.g. Team & Employees' member search). */
  searchValue?: string
  onSearchChange?: (v: string) => void
  searchPlaceholder?: string
  /** Badge count on the topbar bell. Omit or 0 to hide the badge. */
  notificationCount?: number
  /** Shows a small refresh icon next to the bell; calls this (and spins briefly) when clicked. */
  onRefresh?: () => void
}

/**
 * Shared chrome (sidebar + topbar) for standalone business-app pages that
 * live outside /dashboard's internal view-switcher, e.g. /team, /branches.
 * Mirrors the dashboard sidebar's look/nav-tree so navigating between
 * /dashboard and these pages feels like one continuous app.
 */
export default function BusinessSidebar({ active, children, searchValue, onSearchChange, searchPlaceholder, notificationCount = 0, onRefresh }: BusinessSidebarProps) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [plan, setPlan] = useState<string | null>(null)
  const [agentCount, setAgentCount] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    const check = () => setSidebarOpen(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const u = data.user
      if (!u) return
      setUser(u)
      const [{ data: profile }, { data: sub }, { count }] = await Promise.all([
        supabase.from('profiles').select('full_name, is_admin').eq('id', u.id).maybeSingle(),
        supabase.from('subscriptions').select('plan').eq('user_id', u.id).maybeSingle(),
        supabase.from('agents').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      ])
      setUserName(profile?.full_name || u.email?.split('@')[0] || 'User')
      setIsAdmin(!!profile?.is_admin)
      setPlan(sub?.plan || null)
      setAgentCount(count || 0)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    clearAllCache()
    router.push('/login')
  }

  const handleRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    onRefresh?.()
    setTimeout(() => setRefreshing(false), 600)
  }

  const goTo = (path: string) => {
    router.push(path)
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false)
  }

  const mainPad = sidebarOpen ? 'lg:pl-60' : 'lg:pl-16'
  const userInitial = (userName || user?.email || '?').charAt(0).toUpperCase()
  const employeesLocked = !isAdmin && !hasFeature(plan, 'employees')
  const branchesLocked = !isAdmin && !hasFeature(plan, 'branches')

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed left-0 top-0 z-40 transition-all duration-300 bg-white border-r border-gray-100 flex flex-col h-screen
        ${sidebarOpen ? 'w-60 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'}`}>
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 flex-shrink-0 ${!sidebarOpen ? 'justify-center' : ''}`}
          style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold flex-shrink-0">{tr('স')}</div>
          {sidebarOpen && <span className="font-extrabold text-gray-900 text-[15px] bengali">Sahayak AI</span>}
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="ml-auto w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center lg:hidden">
              <X size={16} />
            </button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overscroll-contain">
          {sidebarOpen && <p className="text-[10px] font-bold bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-transparent uppercase tracking-wider px-3 mb-2">{tr('মেনু')}</p>}

          <NavItem icon={<Home size={16} />} label={tr('হোম')} onClick={() => goTo('/')} collapsed={!sidebarOpen} />
          <NavItem icon={<LayoutDashboard size={16} />} label="Dashboard" active={active === 'dashboard'} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
          <NavItem icon={<Bot size={16} />} label="My Agents" active={active === 'my-agents'} onClick={() => goTo('/dashboard')} badge={agentCount || undefined} collapsed={!sidebarOpen} />
          <NavItem icon={<BookOpen size={16} />} label="Library Agents" active={active === 'library'} onClick={() => goTo('/library')} collapsed={!sidebarOpen} />
          <NavItem icon={<Plus size={16} />} label="Build Agent" active={active === 'build-agent'} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />

          <NavGroup label="Business Modules" icon={<Package size={13} />} collapsed={!sidebarOpen}>
            <NavItem icon={<Package size={16} />} label={tr('স্টক')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<TrendingUp size={16} />} label={tr('বিক্রি')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<IndianRupee size={16} />} label={tr('বাকি')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<Truck size={16} />} label={tr('সরবরাহ')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<Users size={16} />} label={tr('CRM ও বেতন')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<FileText size={16} />} label={tr('ইনভয়েস তৈরী করুন')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<FileText size={16} />} label={tr('ইনভয়েস ইতিহাস')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<BarChart2 size={16} />} label={tr('রিপোর্ট')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
          </NavGroup>

          <NavGroup label="AI Tools" icon={<Zap size={13} />} collapsed={!sidebarOpen}>
            <NavItem icon={<Zap size={16} />} label="AI Assistant" onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<MessageCircle size={16} />} label={tr('হোয়াটসঅ্যাপ অটোমেশন')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<Megaphone size={16} />} label={tr('প্রমোশন ক্যাম্পেইন')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
            <NavItem icon={<BarChart2 size={16} />} label={tr('রিপোর্ট')} onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
          </NavGroup>

          <NavGroup label={tr('টিম ও ব্যবসা')} icon={<Building2 size={13} />} collapsed={!sidebarOpen}>
            <NavItem icon={<UserCog size={16} />} label={tr('টিম / Employees')} active={active === 'team'} locked={employeesLocked} onClick={() => goTo('/team')} collapsed={!sidebarOpen} />
            <NavItem icon={<Building2 size={16} />} label="Branch / Outlet" active={active === 'branches'} locked={branchesLocked} onClick={() => goTo('/branches')} collapsed={!sidebarOpen} />
            <NavItem icon={<BookOpen size={16} />} label="Library" onClick={() => goTo('/library')} collapsed={!sidebarOpen} />
          </NavGroup>
        </nav>

        <div className="p-3 border-t border-gray-100 space-y-1 flex-shrink-0" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <NavItem icon={<Settings size={16} />} label="Settings" onClick={() => goTo('/dashboard')} collapsed={!sidebarOpen} />
          <NavItem icon={<LogOut size={16} />} label="Logout" onClick={handleLogout} collapsed={!sidebarOpen} />
          <div className={`mt-3 ${sidebarOpen ? 'px-3 py-3 bg-gray-50 rounded-xl' : 'flex justify-center'}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm shadow-violet-200">{userInitial}</div>
              {sidebarOpen && user && (
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-gray-800 truncate bengali">{userName}</div>
                  <div className="text-[10px] text-gray-400 truncate">{isAdmin ? 'Admin' : 'Owner'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className={`transition-all duration-300 ${mainPad}`}>
        <header className="sticky top-0 z-20 bg-white border-b border-gray-100 flex items-center gap-3 px-4 sm:px-6 h-16">
          <button onClick={() => setSidebarOpen(s => !s)} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors flex-shrink-0">
            <Menu size={18} className="text-gray-500" />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchValue ?? ''}
              onChange={e => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder || tr('খুঁজুন...')}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm bengali focus:outline-none focus:border-indigo-300"
            />
          </div>
          <div className="flex-1" />
          <button className="relative w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0">
            <Bell size={17} />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </button>
          <button onClick={handleRefresh} title={tr('রিফ্রেশ করুন')} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 flex-shrink-0">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <LanguageToggle compact />
          <div className="flex items-center gap-2 pl-2 border-l border-gray-100 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">{userInitial}</div>
            <div className="hidden sm:block">
              <p className="text-[12px] font-bold text-gray-800 leading-tight truncate max-w-[120px] bengali">{userName}</p>
              <p className="text-[10px] text-gray-400 leading-tight">{isAdmin ? 'Admin' : 'Owner'}</p>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
