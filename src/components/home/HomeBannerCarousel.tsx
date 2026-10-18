'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// Add/remove/edit slides here to change what rotates on the homepage.
const SLIDES = [
  {
    bg: 'linear-gradient(120deg, #4F46E5 0%, #7C3AED 100%)',
    emoji: '🎉',
    title_bn: '৭ দিনের ফ্রি ট্রায়াল',
    sub_bn: 'কোনো কার্ড লাগবে না — এখনই শুরু করুন',
    href: '/subscribe',
    cta_bn: 'ফ্রি ট্রায়াল নিন',
  },
  {
    bg: 'linear-gradient(120deg, #059669 0%, #10B981 100%)',
    emoji: '🏪',
    title_bn: '৫টি রেডি-মেড AI লাইব্রেরি',
    sub_bn: 'দোকান, ফার্মেসি, হোটেল, মিষ্টি, কাপড় — বেছে নিন',
    href: '/library',
    cta_bn: 'লাইব্রেরি দেখুন',
  },
  {
    bg: 'linear-gradient(120deg, #DC2626 0%, #EA580C 100%)',
    emoji: '🧾',
    title_bn: 'GST ইনভয়েস + WhatsApp বিল',
    sub_bn: 'এক ক্লিকে রসিদ প্রিন্ট বা কাস্টমারকে পাঠান',
    href: '/library',
    cta_bn: 'দেখুন কীভাবে',
  },
]

export default function HomeBannerCarousel() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])

  const slide = SLIDES[i]

  return (
    <section className="px-4 -mt-10 relative z-10">
      <div className="max-w-6xl mx-auto">
        <div className="relative rounded-2xl overflow-hidden shadow-xl" style={{ background: slide.bg }}>
          <Link href={slide.href} className="block px-6 sm:px-10 py-7 sm:py-9 flex items-center gap-5">
            <span className="text-4xl sm:text-5xl flex-shrink-0">{slide.emoji}</span>
            <div className="min-w-0">
              <h3 className="text-white font-extrabold text-lg sm:text-xl bengali">{slide.title_bn}</h3>
              <p className="text-white/80 text-[13px] sm:text-sm bengali mt-0.5">{slide.sub_bn}</p>
            </div>
            <span className="hidden sm:inline-flex ml-auto flex-shrink-0 px-4 py-2 bg-white text-gray-900 font-bold text-sm rounded-xl bengali">
              {slide.cta_bn}
            </span>
          </Link>

          <button onClick={() => setI(n => (n - 1 + SLIDES.length) % SLIDES.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
            <ChevronLeft size={14}/>
          </button>
          <button onClick={() => setI(n => (n + 1) % SLIDES.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white">
            <ChevronRight size={14}/>
          </button>

          <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">
            {SLIDES.map((_, idx) => (
              <button key={idx} onClick={() => setI(idx)}
                className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-6 bg-white' : 'w-1.5 bg-white/40'}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
