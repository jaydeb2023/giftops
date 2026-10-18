import Link from 'next/link'
import { ArrowRight, Mic, Globe, Sparkles, Image as ImageIcon, FileText } from 'lucide-react'

export default function HomeHero() {
  return (
    <section className="relative overflow-hidden bg-[#F8F7FF] lg:bg-[linear-gradient(180deg,#F1F0FE_0%,#E6E4FC_100%)] lg:flex lg:items-center lg:h-[calc(100svh-110px)] lg:min-h-[540px] lg:max-h-[800px]">
      {/* Hero artwork (no text baked in, so all copy below stays live text).
          Mobile/tablet: cropped robot image sits on top, text below.
          Desktop (lg+): artwork is sized to the hero HEIGHT (so the whole robot,
          icons and platform always fit on a laptop screen), pinned to the right,
          and its left edge fades into the section background. */}
      <picture className="block px-4 pt-6 lg:p-0 lg:absolute lg:inset-y-0 lg:right-0 lg:h-full">
        <source media="(min-width: 1024px)" srcSet="/images/hero-home-desktop.webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-home-mobile.webp"
          alt="Sahayak AI robot assistant with stock, sales, customers, invoice, baki and report icons"
          width={900}
          height={837}
          fetchPriority="high"
          className="w-full h-auto max-w-md mx-auto lg:mx-0 lg:max-w-none lg:w-auto lg:h-full select-none lg:[-webkit-mask-image:linear-gradient(to_right,transparent_0,#000_22%)] lg:[mask-image:linear-gradient(to_right,transparent_0,#000_22%)]"
        />
      </picture>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-6 pb-12 lg:py-12">
        <div className="lg:w-[42%] xl:w-[46%]">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/80 border border-indigo-100 text-indigo-600 text-[12px] font-bold rounded-full bengali mb-5 shadow-sm">
            <Sparkles size={13} className="text-indigo-500" />
            বাংলা আধার নির্ভর ব্যবসার সমাধান
          </span>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight mb-4 bengali">
            আপনার ব্যবসার জন্য<br/>
            <span className="relative inline-block text-indigo-600">
              বাংলা AI সহকারী
              <svg className="absolute left-0 -bottom-1.5 w-full" height="10" viewBox="0 0 240 10" fill="none" preserveAspectRatio="none">
                <path d="M2 7.5C48 2.5 96 2 144 4.5C176 6.2 208 7 238 3.5" stroke="#818CF8" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </span>
          </h1>

          {/* Bilingual slogan callout — the single quotable line that defines the brand */}
          <div className="flex gap-3 mb-5 pl-4 border-l-[3px] border-indigo-200">
            <div>
              <p className="text-gray-900 font-bold text-[15px] bengali leading-snug">বাংলায় বলুন, AI কাজ করবে</p>
              <p className="text-gray-400 text-[12.5px] italic leading-snug">Speak Bengali. Let AI run your business.</p>
            </div>
          </div>

          {/* Clear, quotable definition sentence — helps AI answer engines and
              generative search (AEO/GEO) extract an accurate, standalone
              description of what Sahayak AI is, verbatim. */}
          <p className="text-gray-500 text-[15px] leading-relaxed mb-7 bengali max-w-md">
            <strong className="text-gray-700">Sahayak AI</strong> হলো পশ্চিমবঙ্গের ছোট ও মাঝারি ব্যবসার জন্য বাংলা AI Operating Business Management System। Voice বা Text-এ নির্দেশ দিন—Billing, Stock, Customer, Sales ও Business Management-এর কাজ এক প্ল্যাটফর্ম থেকেই পরিচালনা করুন।
          </p>

          <div className="flex flex-wrap gap-3 mb-7">
            <Link href="/library"
              className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all bengali shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5">
              এজেন্ট লাইব্রেরি দেখুন <ArrowRight size={16} />
            </Link>
            <Link href="/subscribe"
              className="flex items-center gap-2 px-6 py-3.5 border-2 border-indigo-100 bg-white hover:border-indigo-200 text-gray-700 font-bold rounded-xl transition-colors bengali hover:bg-indigo-50/40">
              এখনই শুরু করুন
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {[
              { icon: Mic,       text: 'ভয়েস + Text',    color: 'text-indigo-500' },
              { icon: ImageIcon, text: 'ছবি সাপোর্ট',      color: 'text-violet-500' },
              { icon: FileText,  text: 'File সাপোর্ট',     color: 'text-emerald-500' },
              { icon: Globe,     text: 'বাংলা ও English', color: 'text-blue-500' },
            ].map((item, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[12px] text-gray-600 font-medium bg-white border border-indigo-50 shadow-sm rounded-full px-3 py-1.5 bengali">
                <item.icon size={12} className={item.color} /> {item.text}
              </span>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
