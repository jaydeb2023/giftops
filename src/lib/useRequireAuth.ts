'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

/**
 * Reusable auth guard hook.
 * - Returns { user, loading }
 * - If no session, redirects to /login with a `next` param so the user
 *   lands back on the protected page after signing in.
 */
export function useRequireAuth() {
  const router = useRouter()
  const [user, setUser]       = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        const next = typeof window !== 'undefined' ? window.location.pathname : ''
        router.replace(`/login?next=${encodeURIComponent(next)}`)
      } else {
        setUser(data.user)
        setLoading(false)
      }
    })

    // Keep in sync with Supabase session changes (logout from another tab etc.)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const next = typeof window !== 'undefined' ? window.location.pathname : ''
        router.replace(`/login?next=${encodeURIComponent(next)}`)
      } else {
        setUser(session.user)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [router])

  return { user, loading }
}
