'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { getAgentLimit } from '@/lib/planLimits'
import { Subscription } from '@/lib/subscription'
import { readCache, writeCache, useIsoLayoutEffect } from '@/lib/swrCache'

export interface Activation {
  id: string
  kind: 'library' | 'custom'
  ref: string
}

export function useAgentActivation(userId: string | null, subscription: Subscription | null) {
  const [activations, setActivations] = useState<Activation[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const ck = `act:${userId}`
    const cached = readCache<Activation[]>(ck)
    if (cached) { setActivations(cached); setLoading(false) } else setLoading(true)
    const { data, error } = await supabase.from('user_agent_activations')
      .select('id, kind, ref').eq('user_id', userId)
    if (error) console.error('user_agent_activations fetch:', error)
    setActivations(data || [])
    if (!error) writeCache(ck, data || [])
    setLoading(false)
  }, [userId])

  useIsoLayoutEffect(() => { load() }, [load])

  const limit = getAgentLimit(subscription)
  const activeCount = activations.length
  const canActivateMore = activeCount < limit

  const isActivated = (kind: 'library' | 'custom', ref: string) =>
    activations.some(a => a.kind === kind && a.ref === ref)

  /** Activates a library/custom agent if the plan allows it. Returns false if blocked by the limit. */
  const activate = async (kind: 'library' | 'custom', ref: string): Promise<boolean> => {
    if (!userId) return false
    if (isActivated(kind, ref)) return true
    if (!canActivateMore) return false
    const { error } = await supabase.from('user_agent_activations').insert({ user_id: userId, kind, ref })
    if (error) { console.error('user_agent_activations insert:', error); return false }
    await load()
    return true
  }

  return { activations, activeCount, limit, canActivateMore, isActivated, activate, loading, reload: load }
}
