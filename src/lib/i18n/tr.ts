import type { Lang } from '@/lib/i18n/dictionary'
import { uiStrings } from '@/lib/i18n/uiStrings'

// ── tr('বাংলা লেখা') ─────────────────────────────────────────────
// Display-text translator for screens that were written in Bengali first.
// The Bengali sentence itself is the key; uiStrings.ts holds { en, hi }.
//   • Bengali selected, or a sentence with no entry yet → returns the Bengali as-is
//     (so a missing translation can never break a screen).
//   • English / Hindi selected → returns the translation.
// LanguageProvider calls setCurrentLang() on every render, and the dashboard
// re-renders its children when the language changes, so screens update at once.
let currentLang: Lang = 'bn'
export function setCurrentLang(l: Lang) { currentLang = l }
export function getCurrentLang(): Lang { return currentLang }

export function tr(bn: string): string {
  if (currentLang === 'bn') return bn
  const e = (uiStrings as Record<string, { en?: string; hi?: string }>)[bn]
  return (e && e[currentLang]) || bn
}
