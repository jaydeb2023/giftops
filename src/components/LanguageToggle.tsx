'use client'

import { useEffect, useRef, useState } from 'react'
import { Globe, ChevronDown, Check } from 'lucide-react'
import { useLanguage } from '@/lib/LanguageContext'
import type { Lang } from '@/lib/i18n/dictionary'

const OPTIONS: { code: Lang; short: string; label: string }[] = [
  { code: 'bn', short: 'বাং', label: 'বাংলা' },
  { code: 'hi', short: 'हिं', label: 'हिन्दी' },
  { code: 'en', short: 'EN', label: 'English' },
]

/**
 * Language chooser used across the whole dashboard.
 * Default = dropdown: one small button showing the current language; tapping it
 * lists বাংলা / हिन्दी / English. Saves header space on phones.
 * variant="segmented" keeps the old three-button pill if ever needed.
 */
export default function LanguageToggle({
  compact = false,
  variant = 'dropdown',
  align = 'right',
}: {
  compact?: boolean
  variant?: 'dropdown' | 'segmented'
  align?: 'left' | 'right'
}) {
  const { lang, setLang } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // close on outside tap / Escape (no fixed overlay: the dashboard header uses backdrop-blur,
  // which would trap a fixed overlay inside the header)
  useEffect(() => {
    if (!open) return
    const onDown = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (variant === 'segmented') {
    return (
      <div className={`flex items-center gap-1 bg-gray-100 rounded-lg ${compact ? 'px-1.5 py-1' : 'px-2 py-1'}`}>
        {OPTIONS.map(o => (
          <button
            key={o.code}
            onClick={() => setLang(o.code)}
            aria-label={o.label}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-md transition-colors ${
              lang === o.code ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {o.short}
          </button>
        ))}
      </div>
    )
  }

  const current = OPTIONS.find(o => o.code === lang) || OPTIONS[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Language"
        className={`flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200/70 active:scale-95 text-gray-700 rounded-lg font-bold transition ${
          compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[13px]'
        }`}
      >
        <Globe size={compact ? 13 : 14} className="text-indigo-500 flex-shrink-0" />
        <span className="bengali">{current.short}</span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute top-full mt-2 w-40 bg-white rounded-xl border border-gray-100 shadow-lg shadow-gray-300/40 p-1.5 z-50 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {OPTIONS.map(o => {
            const selected = o.code === lang
            return (
              <button
                key={o.code}
                role="option"
                aria-selected={selected}
                onClick={() => { setLang(o.code); setOpen(false) }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold bengali text-left transition-colors ${
                  selected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{o.label}</span>
                {selected && <Check size={14} className="text-indigo-600 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
