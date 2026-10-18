import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'কাপড়ের দোকানের স্টক ও বিক্রি AI দিয়ে ট্র্যাক করুন | Sahayak AI Blog',
  description: 'Kaporer Dokan AI দিয়ে শাড়ি, সালোয়ার, পাঞ্জাবির স্টক track, পূজার season planning, supplier payment — সব বাংলায়। West Bengal কাপড়ের দোকানের জন্য।',
  keywords: ['কাপড়ের দোকান AI', 'kapor dokan AI', 'শাড়ি স্টক ট্র্যাকিং', 'clothing store AI Bengali', 'Bengali garment shop AI', 'kaporer dokan Bengali AI', 'West Bengal clothing AI'],
  openGraph: { title: 'কাপড়ের দোকানের স্টক AI দিয়ে ট্র্যাক করুন — Sahayak AI', description: 'শাড়ি, সালোয়ার, পাঞ্জাবি — সব স্টক বাংলায় AI দিয়ে।', url: 'https://sahayakai.tech/blog/kapor-dokan-ai-guide', type: 'article' },
  alternates: { canonical: 'https://sahayakai.tech/blog/kapor-dokan-ai-guide' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article',
  headline: 'কাপড়ের দোকানের স্টক ও বিক্রি AI দিয়ে ট্র্যাক করুন বাংলায়',
  description: 'Kaporer Dokan AI — শাড়ি, কাপড়, supplier payment সব বাংলায় track করুন।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-05-15', dateModified: '2026-05-27', inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/kapor-dokan-ai-guide',
  keywords: 'কাপড়ের দোকান AI, kapor dokan AI, শাড়ি স্টক, clothing store AI Bengali',
}

export default function KaporBlog() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ background: 'linear-gradient(135deg, #7C3AED, #5B21B6)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-violet-200 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft size={14} /> সব Blog</Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">গাইড</span>
            <span className="flex items-center gap-1.5 text-violet-200 text-xs"><Calendar size={12}/> মে ২০২৬</span>
            <span className="flex items-center gap-1.5 text-violet-200 text-xs"><Clock size={12}/> ৫ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">কাপড়ের দোকানের স্টক ও বিক্রি AI দিয়ে ট্র্যাক করুন</h1>
          <p className="text-violet-200 text-lg bengali leading-relaxed">শাড়ি, সালোয়ার কামিজ, পাঞ্জাবি, কার্গো প্যান্ট — সব stock বাংলায় AI দিয়ে। পূজার season planning থেকে supplier payment — সব এক জায়গায়।</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article>
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6 mb-10">
            <p className="text-violet-800 font-semibold bengali text-base mb-2">📌 এই গাইডে শিখবেন:</p>
            <ul className="space-y-1.5 text-violet-700 bengali text-sm list-none p-0 m-0">
              <li>✅ বাংলায় বলে নতুন কাপড় stock-এ যোগ করা</li>
              <li>✅ বিক্রি record করা ও margin দেখা</li>
              <li>✅ পূজার আগে season planning</li>
              <li>✅ Supplier-এর payment track করা</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কাপড়ের দোকানের হিসাব কেন কঠিন?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">শাড়ি, সালোয়ার, জিন্স — এত ধরনের কাপড়ের stock manually রাখা কঠিন। কোন size-এ কতটা আছে, কোন supplier-কে কত দেনা — হিসাব মেলানো সময়সাপেক্ষ। Kaporer Dokan Tracker AI এটা সহজ করেছে।</p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — stock add ও sale</p>
            <div className="space-y-3">
              <div className="flex justify-end"><div className="bg-violet-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">cargo pant M size 40 pic add koro, MRP 299</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">কার্গো প্যান্ট (M সাইজ) ৪০ পিস স্টকে যোগ ✓<br/>MRP: ₹২৯৯/পিস</div></div>
              <div className="flex justify-end"><div className="bg-violet-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">cargo pant 2 pic sell hoyeche 299 kore rambabu ke</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">রামবাবু — কার্গো প্যান্ট ২ পিস বিক্রি ✓<br/>মোট: ₹৫৯৮ · স্টক: ৪০ → ৩৮ পিস</div></div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">Kaporer Dokan Tracker যা যা করে</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'Stock Tracking by Category', d: 'শাড়ি, সালোয়ার, পাঞ্জাবি, জিন্স — category ও size অনুযায়ী stock দেখুন।' },
              { n: '২', t: 'Sale Recording', d: 'বাংলায় বলুন কে কিনলো, কতটা, কত দামে — AI সব record করবে।' },
              { n: '৩', t: 'Season Planning', d: 'পূজার আগে AI suggest করে কোন কাপড় বেশি আনতে হবে।' },
              { n: '৪', t: 'Supplier Tracking', d: 'কোন supplier-কে কত দেনা, কবে দিতে হবে — ট্র্যাক করুন।' },
              { n: '৫', t: 'Margin Calculator', d: 'প্রতিটি পণ্যে কত লাভ হচ্ছে — real-time দেখুন।' },
            ].map(f => (
              <div key={f.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{f.n}</div>
                <div><div className="font-bold text-gray-900 bengali mb-1">{f.t}</div><div className="text-gray-500 text-sm bengali">{f.d}</div></div>
              </div>
            ))}
          </div>
        </article>
        <div className="bg-violet-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">আজই শুরু করুন — বিনামূল্যে</h3>
          <p className="text-violet-200 bengali mb-6">আপনার কাপড়ের দোকানের AI সহায়ক ২ মিনিটে তৈরি করুন।</p>
          <Link href="/library/kaporer-dokan-tracker" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-violet-600 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">Kaporer Dokan Tracker শুরু করুন →</Link>
        </div>
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog/mishti-dokan-puja-stock" className="text-violet-600 hover:underline text-sm bengali flex items-center gap-1"><ArrowLeft size={14}/> আগের পোস্ট</Link>
          <Link href="/blog" className="text-violet-600 hover:underline text-sm bengali">সব Blog →</Link>
        </div>
      </div>
    </div>
  )
}
