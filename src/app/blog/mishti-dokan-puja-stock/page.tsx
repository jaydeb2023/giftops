import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'পূজার আগে মিষ্টির দোকানের স্টক প্ল্যান করুন AI দিয়ে | Sahayak AI Blog',
  description: 'Mishti Dokan AI দিয়ে পূজা ও ঈদের স্টক পরিকল্পনা, রোজের উৎপাদন, মেয়াদ সতর্কতা — বাংলায়। West Bengal মিষ্টির দোকানের জন্য।',
  keywords: ['মিষ্টির দোকান AI', 'mishti dokan AI', 'পূজা স্টক পরিকল্পনা', 'sweet shop AI Bengali', 'mishti AI West Bengal', 'রসগোল্লা স্টক AI', 'Bengali sweet shop management'],
  openGraph: { title: 'মিষ্টির দোকানের পূজা স্টক AI দিয়ে প্ল্যান করুন — Sahayak AI', description: 'Mishti Dokan AI — পূজার আগে স্টক প্ল্যান, উৎপাদন, মেয়াদ সব বাংলায়।', url: 'https://sahayakai.tech/blog/mishti-dokan-puja-stock', type: 'article' },
  alternates: { canonical: 'https://sahayakai.tech/blog/mishti-dokan-puja-stock' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article',
  headline: 'পূজার আগে মিষ্টির দোকানের স্টক প্ল্যান করুন AI দিয়ে',
  description: 'Mishti Dokan AI দিয়ে পূজা স্টক, উৎপাদন পরিকল্পনা, মেয়াদ সতর্কতা বাংলায়।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-05-10', dateModified: '2026-05-27', inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/mishti-dokan-puja-stock',
  keywords: 'মিষ্টির দোকান AI, mishti dokan AI, পূজা স্টক, sweet shop AI Bengali',
}

export default function MishtiBlog() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ background: 'linear-gradient(135deg, #C026D3, #9333EA)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-fuchsia-200 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft size={14} /> সব Blog</Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">ব্যবসা</span>
            <span className="flex items-center gap-1.5 text-fuchsia-200 text-xs"><Calendar size={12}/> মে ২০২৬</span>
            <span className="flex items-center gap-1.5 text-fuchsia-200 text-xs"><Clock size={12}/> ৬ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">পূজার আগে মিষ্টির দোকানের স্টক AI দিয়ে প্ল্যান করুন</h1>
          <p className="text-fuchsia-200 text-lg bengali leading-relaxed">Mishti Dokan Manager AI দিয়ে পূজা ও ঈদের স্টক পরিকল্পনা, রোজের উৎপাদন, ছানার হিসাব — সব বাংলায় স্বয়ংক্রিয়ভাবে।</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article>
          <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-2xl p-6 mb-10">
            <p className="text-fuchsia-800 font-semibold bengali text-base mb-2">📌 এই গাইডে শিখবেন:</p>
            <ul className="space-y-1.5 text-fuchsia-700 bengali text-sm list-none p-0 m-0">
              <li>✅ পূজার কতদিন আগে কতটা মিষ্টি বানাতে হবে</li>
              <li>✅ ছানা, চিনি, ময়দার হিসাব AI-কে দিয়ে করানো</li>
              <li>✅ মেয়াদ শেষের আগে alert পাওয়া</li>
              <li>✅ রোজের production record রাখা</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">পূজার আগে কেন এত চাপ?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">দুর্গাপূজা ও ঈদে West Bengal ও Bangladesh-এর মিষ্টির দোকানে ১০ গুণ বেশি চাহিদা। কিন্তু বেশি বানালে মেয়াদ পেরোয়, কম বানালে বিক্রি মিস। Mishti Dokan AI এই সমস্যার সমাধান করে।</p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — পূজার পরিকল্পনা</p>
            <div className="space-y-3">
              <div className="flex justify-end"><div className="bg-fuchsia-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">আজ কত রসগোল্লা বানাতে হবে? পূজা ৩ দিন বাকি।</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">গতকাল ৮০টি বিক্রি। এখন ৪৫টি আছে।<br/>পূজা ৩ দিন — আজ ১৫০টি বানানো উচিত ✓<br/>ছানা লাগবে ৯ কেজি। এখন আছে ৬ কেজি।<br/>⚠️ আরও ৩ কেজি ছানা order করুন আজই!</div></div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">Mishti Dokan AI যা যা করে</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'Production Planning', d: 'গতকালের বিক্রি দেখে আজকের production suggest করে। পূজার দিন গুনে extra recommend করে।' },
              { n: '২', t: 'কাঁচামাল হিসাব', d: 'ছানা, চিনি, ময়দা — কতটুকু লাগবে AI হিসাব করে দেয়। কম পড়লে বলে।' },
              { n: '৩', t: 'মেয়াদ Alert', d: 'মিষ্টির মেয়াদ সাধারণত কম। AI জানাবে কোনটা আগে বিক্রি করতে হবে।' },
              { n: '৪', t: 'Item-wise Sales', d: 'রসগোল্লা vs সন্দেশ vs চমচম — কোনটা বেশি বিকোচ্ছে, trend দেখুন।' },
              { n: '৫', t: 'Order Management', d: 'bulk order নিলে record করুন — কে, কতটা, কবে নেবে।' },
            ].map(f => (
              <div key={f.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-fuchsia-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{f.n}</div>
                <div><div className="font-bold text-gray-900 bengali mb-1">{f.t}</div><div className="text-gray-500 text-sm bengali">{f.d}</div></div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-10">
            <p className="text-amber-800 font-bold bengali text-base mb-2">💡 Real Experience</p>
            <p className="text-amber-700 bengali text-sm leading-relaxed">"পূজার আগে AI বলে দিয়েছিল কত ছানা লাগবে। সময়মতো order করেছিলাম। এই বছর কোনো জিনিস শেষ হয়নি, waste-ও হয়নি।" — বিকাশ মণ্ডল, মিষ্টির দোকান, দুর্গাপুর</p>
          </div>
        </article>
        <div className="bg-fuchsia-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">পূজার আগেই শুরু করুন</h3>
          <p className="text-fuchsia-200 bengali mb-6">আপনার মিষ্টির দোকানের AI সহায়ক বিনামূল্যে তৈরি করুন।</p>
          <Link href="/library/mishti-dokan-manager" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-fuchsia-600 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">Mishti Dokan Manager শুরু করুন →</Link>
        </div>
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog/hotel-dhaba-ai-guide" className="text-fuchsia-600 hover:underline text-sm bengali flex items-center gap-1"><ArrowLeft size={14}/> আগের পোস্ট</Link>
          <Link href="/blog/kapor-dokan-ai-guide" className="text-fuchsia-600 hover:underline text-sm bengali">পরের পোস্ট →</Link>
        </div>
      </div>
    </div>
  )
}
