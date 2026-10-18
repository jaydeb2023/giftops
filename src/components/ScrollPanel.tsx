'use client'
import { ReactNode } from 'react'

/**
 * On desktop (lg+), keeps the left "কাজের ড্যাশবোর্ড" panel to the same
 * height as the AI chat (600px) and scrolls its content inside, so lots of
 * customers / stock / sales never stretch the whole page.
 *
 * On phones this is intentionally NOT boxed: a scrollable panel sitting
 * inside a scrollable page means a finger has to land in exactly the right
 * spot to know which one it's scrolling, which feels "stuck"/broken on
 * touch. Below lg, the panel just flows as part of the normal page scroll —
 * one scroll gesture, no nested scroll area.
 */
export default function ScrollPanel({ children }: { children: ReactNode }) {
  return (
    <div className="lg:max-h-[600px] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 rounded-2xl">
      {children}
    </div>
  )
}
