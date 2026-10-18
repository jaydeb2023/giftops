'use client'

import { useEffect, useState } from 'react'
import { useRequireAuth } from '@/lib/useRequireAuth'
import { computeAccess, fetchSubscription, Subscription } from '@/lib/subscription'

/**
 * Combines auth + subscription/trial status.
 * Use this anywhere you need to know: is this user logged in AND
 * allowed to use paid features (agents/library) right now.
 */
export function useAccess() {
  const { user, loading: authLoading } = useRequireAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [subLoading, setSubLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      fetchSubscription(user.id),
      import('@/lib/supabaseClient').then(({ supabase }) =>
        supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      ),
    ]).then(([sub, profileRes]) => {
      if (!cancelled) {
        setSubscription(sub)
        setIsAdmin(!!profileRes.data?.is_admin)
        setSubLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const access = computeAccess(subscription)
  const loading = authLoading || (!!user && subLoading)

  return {
    user,
    subscription,
    loading,
    isAdmin,
    // Super admins always have access, regardless of trial/subscription state.
    ...access,
    hasAccess: isAdmin || access.hasAccess,
  }
}
