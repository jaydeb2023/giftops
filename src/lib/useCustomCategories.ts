'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

/**
 * Reusable across every shop-type manager UI (Pharmacy, Dokan, Mishti,
 * Kapor, Hotel, ...). Pass a fixed list of built-in defaults for that
 * business — this hook adds the user's own saved custom categories on top
 * and exposes addCategory()/removeCategory() to manage them.
 *
 * Usage:
 *   const { categories, addCategory } = useCustomCategories(userId, 'pharmacy', DEFAULT_CATEGORIES)
 */
export function useCustomCategories(userId: string | undefined, businessType: string, defaults: string[]) {
  const [custom, setCustom] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return }
    const { data, error } = await supabase
      .from('custom_categories')
      .select('name')
      .eq('user_id', userId)
      .eq('business_type', businessType)
      .order('created_at', { ascending: true })
    if (error) console.error('custom_categories fetch:', error)
    setCustom((data || []).map(r => r.name))
    setLoading(false)
  }, [userId, businessType])

  useEffect(() => { load() }, [load])

  const addCategory = useCallback(async (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    if (!userId) { toast.error('লগইন করুন'); return false }
    if (defaults.includes(trimmed) || custom.includes(trimmed)) {
      toast.error('এই ক্যাটাগরি আগে থেকেই আছে')
      return false
    }
    const { error } = await supabase.from('custom_categories')
      .insert({ user_id: userId, business_type: businessType, name: trimmed })
    if (error) { console.error('custom_categories insert:', error); toast.error('যোগ করতে সমস্যা হয়েছে'); return false }
    setCustom(c => [...c, trimmed])
    toast.success('ক্যাটাগরি যোগ হয়েছে')
    return true
  }, [userId, businessType, defaults, custom])

  const removeCategory = useCallback(async (name: string) => {
    if (!userId) return
    const { error } = await supabase.from('custom_categories')
      .delete().eq('user_id', userId).eq('business_type', businessType).eq('name', name)
    if (error) { console.error('custom_categories delete:', error); toast.error('মুছতে সমস্যা হয়েছে'); return }
    setCustom(c => c.filter(n => n !== name))
  }, [userId, businessType])

  // Built-in defaults first, then the user's own — 'সব' (All) stays wherever
  // the caller put it in `defaults` since it's a filter option, not data.
  const categories = [...defaults, ...custom.filter(c => !defaults.includes(c))]

  return { categories, custom, loading, addCategory, removeCategory }
}
