'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { ONBOARDED_KEY } from '@/lib/i18n/onboarding'

// First launch on a phone (browser or the Play Store app) -> show onboarding once.
// Desktop is never redirected. Signed-in users are marked as onboarded and skipped.
export default function OnboardingGate() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname !== '/') return
    if (window.innerWidth >= 768) return
    try { if (localStorage.getItem(ONBOARDED_KEY)) return } catch { return }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) { try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {} return }
      router.replace('/welcome')
    })
  }, [pathname, router])

  return null
}
