import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'
import Image from 'next/image'

const POINTS = [
  'আজকের বিক্রি ও লাভ',
  'কম স্টক ও কাস্টমার রিমাইন্ডার',
  'বাকি ও কাস্টমার হিসাব',
  'দিন ও বিস্তারিত রিপোর্ট',
  'সহজে সব প্রয়োজনীয় তথ্য',
]

export default function DashboardShowcase() {
  return (
    <section className="relative overflow-hidden">

      {/* ===== DESKTOP: full-bleed banner ===== */}
      <div className="hidden md:flex relative min-h-[380px] items-center">
        <div className="absolute inset-0">
          <Image
            src="/images/hero-bg.png"
            alt="Sahayak AI dashboard overview"
            fill
            className="object-cover object-right"
          />
        </div>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 38%, rgba(255,255,255,0.85) 50%, rgba(255,255,255,0.2) 65%, transparent 80%)' }} />

        <div className="max-w-6xl mx-auto px-4 py-12 relative z-10 w-full">
          <div className="max-w-md">
            <DashboardCopy />
          </div>
        </div>
      </div>

      {/* ===== MOBILE: stacked, image shown in full ===== */}
      <div className="md:hidden bg-white px-4 pt-10 pb-8">
        <div className="max-w-md mx-auto mb-6">
          <DashboardCopy />
        </div>
        <div className="relative w-full max-w-[420px] mx-auto">
          <Image
            src="/images/hero-bg.png"
            alt="Sahayak AI dashboard overview"
            width={1600}
            height={1000}
            className="w-full h-auto"
            sizes="90vw"
          />
        </div>
      </div>
    </section>
  )
}

function DashboardCopy() {
  return (
    <>
      <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 text-[12px] font-bold rounded-full bengali mb-4">
        রিয়েল-টাইম ড্যাশবোর্ড
      </span>
      <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 bengali">ড্যাশবোর্ড এক নজরে</h2>
      <p className="text-gray-500 text-sm mb-5 bengali">আপনার ব্যবসার সব তথ্য এখন হাতের মুঠোয়</p>

      <ul className="space-y-2 mb-6">
        {POINTS.map((p, i) => (
          <li key={i} className="flex items-center gap-2.5 text-gray-700 text-[13px] bengali">
            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <Check size={11} />
            </span>
            {p}
          </li>
        ))}
      </ul>

      <Link href="/library"
        className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors bengali">
        চেষ্টা করুন <ArrowRight size={16} />
      </Link>
    </>
  )
}
