'use client'
import Logo from './Logo'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { api, ApiError } from '@/lib/rv/client'
import { NAV, ROLE_LABEL, defaultPath, canSee } from '@/lib/rv/constants'
import { StaffContext, OrgContext, StaffMe, OrgMe } from './StaffContext'
import { Spinner, cx } from './ui'

export default function RvShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || '/app'
  const [me, setMe] = useState<StaffMe | null>(null)
  const [org, setOrg] = useState<OrgMe | null>(null)
  const [isSuper, setIsSuper] = useState(false)
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [deniedMsg, setDeniedMsg] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api<{ staff: StaffMe | null; org: OrgMe | null; is_super: boolean }>('/api/rv/me')
      .then(r => {
        setMe(r.staff); setOrg(r.org); setIsSuper(!!r.is_super); setState('ok')
        // platform owner with no company of their own goes straight to the Platform console
        if (!r.staff && r.is_super && !pathname.startsWith('/app/platform')) router.replace('/app/platform')
      })
      .catch((e: ApiError) => {
        if (e.status === 401) router.replace(`/app/login?next=${encodeURIComponent(pathname)}`)
        else { setDeniedMsg(e.message); setState('denied') }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // role-based route guard (server checks are the real protection; this only keeps the UI tidy)
  useEffect(() => {
    if (!me || pathname.startsWith('/app/platform')) return
    const sub = pathname.replace(/^\/app/, '') || ''
    const first = sub === '' ? '' : '/' + sub.split('/')[1]
    if (first === '' && !canSee(me.role, '')) router.replace(defaultPath(me.role))
    else if (first !== '' && NAV.some(n => n.href === first) && !canSee(me.role, first)) router.replace(defaultPath(me.role))
  }, [me, pathname, router])

  useEffect(() => { setOpen(false) }, [pathname])

  const signOut = async () => { await supabase.auth.signOut(); router.replace('/app/login') }

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>
  const onPlatform = pathname.startsWith('/app/platform')
  if (state === 'denied' || (!me && !(isSuper && onPlatform))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <h1 className="text-lg font-semibold text-gray-900">{deniedMsg.includes('suspended') ? 'Account suspended' : 'No access yet'}</h1>
          <p className="mt-2 text-sm text-gray-600">{deniedMsg || 'Your account is not set up for GiftOps.'}</p>
          <button onClick={signOut} className="mt-4 rounded-lg bg-rv-700 px-4 py-2 text-sm font-medium text-white hover:bg-rv-800">Sign out</button>
        </div>
      </div>
    )
  }

  const items = me ? NAV.filter(n => n.roles.includes(me.role) || me.role === 'admin') : []
  const groups = Array.from(new Set(items.map(i => i.group)))
  const isActive = (href: string) => (href === '' ? pathname === '/app' : pathname.startsWith('/app' + href))

  const sidebar = (
    <nav className="flex h-full flex-col bg-rv-900 text-rv-100">
      <div className="px-5 py-5">
        <Logo light />
        {org && <div className="mt-3 truncate rounded-md bg-rv-800 px-2.5 py-1.5 text-xs font-medium text-rv-100">{org.name}</div>}
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map(g => (
          <div key={g}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rv-300/70">{g}</div>
            {items.filter(i => i.group === g).map(i => (
              <Link key={i.href} href={`/app${i.href}`}
                className={cx('block rounded-lg px-3 py-2 text-sm transition', isActive(i.href) ? 'bg-rv-700 font-semibold text-white' : 'text-rv-100 hover:bg-rv-800')}>
                {i.label}
              </Link>
            ))}
          </div>
        ))}
        {isSuper && (
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rv-300/70">Evynta</div>
            <Link href="/app/platform" className={cx('block rounded-lg px-3 py-2 text-sm transition', onPlatform ? 'bg-rv-700 font-semibold text-white' : 'text-rv-100 hover:bg-rv-800')}>Platform (all companies)</Link>
          </div>
        )}
      </div>
      <div className="border-t border-rv-800 p-3">
        <div className="truncate px-2 text-sm font-medium text-white">{me ? (me.full_name || me.email) : 'Platform owner'}</div>
        <div className="px-2 pb-2 text-xs text-rv-300">{me ? ROLE_LABEL[me.role] : 'Super admin'}</div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-rv-100 hover:bg-rv-800"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </nav>
  )

  return (
    <OrgContext.Provider value={org}><StaffContext.Provider value={me as StaffMe}>
      <div className="min-h-screen bg-gray-50 text-gray-900 print:bg-white">
        <aside className="fixed inset-y-0 left-0 hidden w-60 lg:block print:hidden">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden print:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
          </div>
        )}
        <div className="lg:pl-60 print:pl-0">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 lg:hidden print:hidden">
            <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="rounded-md p-1.5 hover:bg-gray-100">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            <Logo size={28} tagline={false} />
          </header>
          {org?.status === 'trial' && org.trial_ends_at && (() => {
            const d = Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 864e5)
            return <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 print:hidden">Free trial: {d > 0 ? `${d} day${d === 1 ? '' : 's'} left` : 'ended'}. To continue after the trial, contact Evynta.</div>
          })()}
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6 print:p-0">{children}</main>
        </div>
      </div>
    </StaffContext.Provider></OrgContext.Provider>
  )
}
