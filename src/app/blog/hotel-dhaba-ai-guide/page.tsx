import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'হোটেল ও ধাবা ম্যানেজমেন্ট AI দিয়ে করুন বাংলায় | Sahayak AI Blog',
  description: 'Hotel & Dhaba Manager AI দিয়ে টেবিল অর্ডার, মেনু ম্যানেজমেন্ট, দৈনিক বিক্রি — সব বাংলায় ট্র্যাক করুন। West Bengal ও Bangladesh-এর রেস্তোরাঁর জন্য।',
  keywords: ['hotel management AI Bengali', 'হোটেল AI', 'ধাবা ম্যানেজমেন্ট AI', 'restaurant AI Bengali', 'Bengali hotel manager', 'free restaurant AI India', 'West Bengal restaurant AI', 'dhaba AI'],
  openGraph: { title: 'হোটেল ও ধাবার সব হিসাব AI দিয়ে — Sahayak AI', description: 'টেবিল অর্ডার থেকে দৈনিক রিপোর্ট — সব বাংলায় AI দিয়ে।', url: 'https://sahayakai.tech/blog/hotel-dhaba-ai-guide', type: 'article' },
  alternates: { canonical: 'https://sahayakai.tech/blog/hotel-dhaba-ai-guide' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article',
  headline: 'হোটেল ও ধাবা ম্যানেজমেন্ট AI দিয়ে করুন বাংলায়',
  description: 'Hotel & Dhaba Manager AI — টেবিল অর্ডার, মেনু, স্টক, দৈনিক রিপোর্ট সব বাংলায়।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-05-01', dateModified: '2026-05-27', inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/hotel-dhaba-ai-guide',
  keywords: 'hotel AI Bengali, হোটেল AI, ধাবা AI, restaurant AI Bengali, West Bengal hotel management',
}

export default function HotelBlog() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ background: 'linear-gradient(135deg, #EA580C, #DC2626)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-orange-200 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft size={14} /> সব Blog</Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">গাইড</span>
            <span className="flex items-center gap-1.5 text-orange-200 text-xs"><Calendar size={12}/> মে ২০২৬</span>
            <span className="flex items-center gap-1.5 text-orange-200 text-xs"><Clock size={12}/> ৫ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">হোটেল ও ধাবার সব হিসাব AI দিয়ে রাখুন বাংলায়</h1>
          <p className="text-orange-200 text-lg bengali leading-relaxed">টেবিল অর্ডার, মেনু খরচ, রান্নাঘরের স্টক, দৈনিক বিক্রি — সব এক জায়গায় বাংলায়। কোনো cashier লাগবে না।</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article>
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-6 mb-10">
            <p className="text-orange-800 font-semibold bengali text-base mb-2">📌 এই গাইডে শিখবেন:</p>
            <ul className="space-y-1.5 text-orange-700 bengali text-sm list-none p-0 m-0">
              <li>✅ বাংলায় table order নেওয়া ও update করা</li>
              <li>✅ মেনুতে নতুন পদ যোগ করা</li>
              <li>✅ রান্নাঘরের কাঁচামাল track করা</li>
              <li>✅ দৈনিক বিক্রির হিসাব এক মিনিটে</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">হোটেল-ধাবার সবচেয়ে বড় সমস্যা</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">West Bengal ও Bangladesh-এর ছোট হোটেল-ধাবায় প্রতিদিন কত বিক্রি হলো, কোন টেবিল কত বাকি দিলো, রান্নাঘরে কী শেষ হয়ে গেছে — এই হিসাব রাখা খুবই কঠিন। Hotel & Dhaba Manager AI এটা সহজ করেছে।</p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — table order</p>
            <div className="space-y-3">
              <div className="flex justify-end"><div className="bg-orange-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">table 3 te 2 plate dal makhni 180 taka ar 3 roti 15 taka order diye gese</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">টেবিল ৩ — অর্ডার যোগ হয়েছে ✓<br/>• ডাল মাখনি × ২ = ₹৩৬০<br/>• রুটি × ৩ = ₹৪৫<br/>মোট: ₹৪০৫ · Status: pending</div></div>
              <div className="flex justify-end"><div className="bg-orange-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">table 3 paid kore dilo 405 taka</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">টেবিল ৩ — ₹৪০৫ পরিশোধ ✓<br/>Status: paid · টেবিল clear করুন।</div></div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">Hotel Manager যা যা করে</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'Table Order Management', d: 'কোন টেবিলে কী order আছে, কত বাকি — real-time দেখুন।' },
              { n: '২', t: 'মেনু ম্যানেজমেন্ট', d: 'বাংলায় বলুন "menu te chicken curry add koro 180 taka" — যোগ হয়ে যাবে।' },
              { n: '৩', t: 'রান্নাঘর স্টক', d: 'চাল, তেল, আটা — কী শেষ হয়ে আসছে AI জানাবে।' },
              { n: '৪', t: 'দৈনিক রিপোর্ট', d: 'আজকের মোট বিক্রি, কতটি order, সবচেয়ে বেশি বিকোনো পদ।' },
              { n: '৫', t: 'Staff খাবার track', d: 'Staff কতটুকু খেয়েছে — আলাদা record রাখুন।' },
            ].map(f => (
              <div key={f.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{f.n}</div>
                <div><div className="font-bold text-gray-900 bengali mb-1">{f.t}</div><div className="text-gray-500 text-sm bengali">{f.d}</div></div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-10 mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 bengali">সাধারণ প্রশ্ন</h2>
            <div className="space-y-5">
              {[
                { q: 'Hotel Manager কি free?', a: 'হ্যাঁ, সম্পূর্ণ বিনামূল্যে।' },
                { q: 'কতটি টেবিল রাখা যাবে?', a: 'সীমাহীন। যেকোনো সংখ্যক টেবিল manage করুন।' },
                { q: 'Bangladesh-এর হোটেলে কাজ করবে?', a: 'হ্যাঁ। ₹ এবং ৳ উভয় currency সাপোর্ট করে।' },
              ].map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-5">
                  <p className="font-bold text-gray-900 bengali mb-2">{faq.q}</p>
                  <p className="text-gray-600 bengali text-sm">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
        <div className="bg-orange-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">আজই শুরু করুন — বিনামূল্যে</h3>
          <p className="text-orange-200 bengali mb-6">আপনার হোটেলের AI সহায়ক ২ মিনিটে তৈরি করুন।</p>
          <Link href="/library/hotel-and-dhaba-manager" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-orange-600 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">Hotel Manager শুরু করুন →</Link>
        </div>
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog/voice-input-bangla" className="text-orange-600 hover:underline text-sm bengali flex items-center gap-1"><ArrowLeft size={14}/> আগের পোস্ট</Link>
          <Link href="/blog/mishti-dokan-puja-stock" className="text-orange-600 hover:underline text-sm bengali">পরের পোস্ট →</Link>
        </div>
      </div>
    </div>
  )
}
