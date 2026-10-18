'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { isFullScreenAppRoute } from '@/lib/fullScreenRoutes'

// Edit this to change what the sitewide banner says. Bump DISMISS_KEY's
// suffix (e.g. 'v2') whenever the message changes, so people who already
// dismissed the old one see the new one.
const BANNER = {
  text_bn: '🎉 ৭ দিনের ফ্রি ট্রায়াল — কোনো কার্ড লাগবে না!',
  text_en: '🎉 7-day free trial - no card required!',
  href: '/subscribe',
  cta_bn: 'শুরু করুন',
  cta_en: 'Get Started',
}
const DISMISS_KEY = 'sahayak_announcement_dismissed_v1'

export default function AnnouncementBar() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!localStorage.getItem(DISMISS_KEY)) setVisible(true)
  }, [])

  // Hide on full-screen app pages (dashboard, team, branches, ...) and inside library agent workspaces
  if (isFullScreenAppRoute(pathname) || !visible) return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="relative bg-indigo-600 text-white text-[13px] font-semibold">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 text-center">
        <span className="bengali">{BANNER.text_bn}</span>
        <span className="hidden sm:inline text-indigo-200">·</span>
        <span className="hidden sm:inline">{BANNER.text_en}</span>
        <Link href={BANNER.href} className="underline underline-offset-2 hover:text-indigo-100 flex-shrink-0 bengali">
          {BANNER.cta_bn} →
        </Link>
      </div>
      <button onClick={dismiss} aria-label="Dismiss"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-200 hover:text-white">
        <X size={15} />
      </button>
    </div>
  )
}
