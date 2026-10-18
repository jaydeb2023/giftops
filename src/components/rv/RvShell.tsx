'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabaseClient'
import { api, ApiError } from '@/lib/rv/client'
import { NAV, ROLE_LABEL, defaultPath, canSee } from '@/lib/rv/constants'
import { StaffContext, StaffMe } from './StaffContext'
import { Spinner, cx } from './ui'

export default function RvShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || '/raahvia'
  const [me, setMe] = useState<StaffMe | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [deniedMsg, setDeniedMsg] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    api<{ staff: StaffMe }>('/api/rv/me')
      .then(r => { setMe(r.staff); setState('ok') })
      .catch((e: ApiError) => {
        if (e.status === 401) router.replace(`/raahvia/login?next=${encodeURIComponent(pathname)}`)
        else { setDeniedMsg(e.message); setState('denied') }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // role-based route guard (server checks are the real protection; this only keeps the UI tidy)
  useEffect(() => {
    if (!me) return
    const sub = pathname.replace(/^\/raahvia/, '') || ''
    const first = sub === '' ? '' : '/' + sub.split('/')[1]
    if (first === '' && !canSee(me.role, '')) router.replace(defaultPath(me.role))
    else if (first !== '' && NAV.some(n => n.href === first) && !canSee(me.role, first)) router.replace(defaultPath(me.role))
  }, [me, pathname, router])

  useEffect(() => { setOpen(false) }, [pathname])

  const signOut = async () => { await supabase.auth.signOut(); router.replace('/raahvia/login') }

  if (state === 'loading') return <div className="flex min-h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>
  if (state === 'denied' || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-2xl bg-white p-6 text-center shadow">
          <h1 className="text-lg font-semibold text-gray-900">No access yet</h1>
          <p className="mt-2 text-sm text-gray-600">{deniedMsg || 'Your account is not set up for Raahvia CRM.'}</p>
          <button onClick={signOut} className="mt-4 rounded-lg bg-rv-700 px-4 py-2 text-sm font-medium text-white hover:bg-rv-800">Sign out</button>
        </div>
      </div>
    )
  }

  const items = NAV.filter(n => n.roles.includes(me.role) || me.role === 'admin')
  const groups = Array.from(new Set(items.map(i => i.group)))
  const isActive = (href: string) => (href === '' ? pathname === '/raahvia' : pathname.startsWith('/raahvia' + href))

  const sidebar = (
    <nav className="flex h-full flex-col bg-rv-900 text-rv-100">
      <div className="px-5 py-5">
        <div className="text-xl font-extrabold tracking-wide text-white">RAAHVIA</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-rv-300">Gift fulfilment CRM</div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map(g => (
          <div key={g}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-rv-300/70">{g}</div>
            {items.filter(i => i.group === g).map(i => (
              <Link key={i.href} href={`/raahvia${i.href}`}
                className={cx('block rounded-lg px-3 py-2 text-sm transition', isActive(i.href) ? 'bg-rv-700 font-semibold text-white' : 'text-rv-100 hover:bg-rv-800')}>
                {i.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-rv-800 p-3">
        <div className="truncate px-2 text-sm font-medium text-white">{me.full_name || me.email}</div>
        <div className="px-2 pb-2 text-xs text-rv-300">{ROLE_LABEL[me.role]}</div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-rv-100 hover:bg-rv-800"><LogOut className="h-4 w-4" />Sign out</button>
      </div>
    </nav>
  )

  return (
    <StaffContext.Provider value={me}>
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
            <span className="font-bold text-rv-800">RAAHVIA</span>
          </header>
          <main className="mx-auto max-w-[1400px] p-4 sm:p-6 print:p-0">{children}</main>
        </div>
      </div>
    </StaffContext.Provider>
  )
}
