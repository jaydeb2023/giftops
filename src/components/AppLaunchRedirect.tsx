'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

const FLAG = 'sahayak_app_launched'

/**
 * When the installed app (PWA / Play Store TWA) is opened and the user is already
 * logged in, skip the marketing home page and go straight to the dashboard.
 *
 * - Runs only inside the installed app, never for normal browser visitors.
 * - Runs only once per app launch (sessionStorage flag), so tapping "Home" in the
 *   dashboard menu afterwards still opens the home page as expected.
 * - Logged-out users are left on the home page.
 */
export default function AppLaunchRedirect() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let inApp = false
    try {
      inApp =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as any).standalone === true ||
        document.referrer.startsWith('android-app://')
    } catch {}
    if (!inApp) return

    try {
      if (sessionStorage.getItem(FLAG)) return
      sessionStorage.setItem(FLAG, '1')
    } catch {}

    setBusy(true)
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) router.replace('/dashboard')
        else setBusy(false)
      })
      .catch(() => setBusy(false))
  }, [router])

  if (!busy) return null
  return (
    <div className="fixed inset-0 z-[100] bg-white flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
    </div>
  )
}
