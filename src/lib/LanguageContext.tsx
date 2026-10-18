'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { dictionary, type Lang, type DictionaryKey } from '@/lib/i18n/dictionary'
import { setCurrentLang } from '@/lib/i18n/tr'

const STORAGE_KEY = 'kaaj_lang'

type LanguageContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: DictionaryKey) => string
  loading: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Instant paint from cache (or 'bn' default) — avoids a flash before the
  // DB value loads. Overwritten below once the user's profile is fetched.
  const [lang, setLangState] = useState<Lang>('bn')
  const [loading, setLoading] = useState(true)
  setCurrentLang(lang) // keep tr() in step with the selected language on every render

  useEffect(() => {
    // 1) Local cache first (fast, works logged-out too)
    try {
      const cached = window.localStorage.getItem(STORAGE_KEY) as Lang | null
      if (cached === 'bn' || cached === 'en' || cached === 'hi') setLangState(cached)
    } catch {}

    // 2) DB is the source of truth once we know who's logged in
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('profiles').select('language').eq('id', data.user.id).single()
      // Language picked during onboarding (before the account existed) wins once, then is saved
      let pending: string | null = null
      try { pending = window.localStorage.getItem('kaaj_lang_pending') } catch {}
      if (pending === 'bn' || pending === 'en' || pending === 'hi') {
        setLangState(pending)
        try { window.localStorage.setItem(STORAGE_KEY, pending); window.localStorage.removeItem('kaaj_lang_pending') } catch {}
        await supabase.from('profiles').update({ language: pending }).eq('id', data.user.id)
        setLoading(false)
        return
      }
      const dbLang = profile?.language
      if (dbLang === 'bn' || dbLang === 'en' || dbLang === 'hi') {
        setLangState(dbLang)
        try { window.localStorage.setItem(STORAGE_KEY, dbLang) } catch {}
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch {}
    // Persist per-user in the background; fire-and-forget, no need to block UI.
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return
      supabase.from('profiles').update({ language: next }).eq('id', data.user.id)
        .then(({ error }) => { if (error) console.error('language save:', error) })
    })
  }, [])

  const t = useCallback((key: DictionaryKey) => {
    const entry = dictionary[key]
    if (!entry) return key
    return entry[lang] ?? entry.bn ?? key
  }, [lang])

  const value = useMemo(() => ({ lang, setLang, t, loading }), [lang, setLang, t, loading])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
