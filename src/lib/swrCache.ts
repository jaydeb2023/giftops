// "Show the last known data instantly, refresh quietly in the background".
// Every section keeps a copy of its last data on this device, so opening it
// again paints immediately instead of showing a spinner while the network
// round-trips finish. Cleared on logout (it holds business data).
import { useEffect, useLayoutEffect } from 'react'

const PREFIX = 'sahayak:swr:v1:'
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

/** useLayoutEffect in the browser (runs before first paint), plain useEffect on the server. */
export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export function readCache<T = any>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { t, v } = JSON.parse(raw)
    if (Date.now() - t > MAX_AGE_MS) return null
    return v as T
  } catch {
    return null
  }
}

export function writeCache(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    /* storage full / private mode — just skip caching */
  }
}

export function clearAllCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch { /* ignore */ }
}
