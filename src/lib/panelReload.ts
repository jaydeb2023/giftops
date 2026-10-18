// src/lib/panelReload.ts
// Every Library dashboard panel (Dokan, Hotel, Mishti, Kapor, Pharmacy) registers
// a reload function on `window` while it is on screen. The chat panel calls this
// after it saves something, so the numbers/stock list on the left update
// immediately — no browser refresh needed.
const PANEL_RELOAD_KEYS = ['__dokanReload', '__hotelReload', '__mishtiReload', '__kaporReload', '__pharmReload'] as const

export function reloadLibraryPanels(): number {
  if (typeof window === 'undefined') return 0
  let called = 0
  for (const key of PANEL_RELOAD_KEYS) {
    const fn = (window as any)[key]
    if (typeof fn === 'function') {
      try { const r = fn(); if (r && typeof r.catch === 'function') r.catch(() => {}); called++ } catch { /* one panel failing must not stop the others */ }
    }
  }
  return called
}
