import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar, Share2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'মুদি দোকানের হিসাব AI দিয়ে রাখুন | Sahayak AI Blog',
  description: 'Dokan Manager AI দিয়ে রোজের বিক্রি, স্টক এবং বাকির হিসাব মাত্র ৫ মিনিটে রাখুন। সম্পূর্ণ বাংলায় — কোনো technical জ্ঞান লাগবে না।',
  keywords: ['দোকান AI', 'বাংলায় দোকান ম্যানেজার', 'AI for Bengali shop', 'dokan manager Bengali', 'মুদিখানা AI', 'free AI shop manager India', 'West Bengal dokan AI'],
  openGraph: {
    title: 'মুদি দোকানের হিসাব AI দিয়ে রাখুন — Sahayak AI',
    description: 'বাংলায় বলুন, AI স্টক আপডেট করবে। কোনো খাতা লাগবে না।',
    url: 'https://sahayakai.tech/blog/dokan-manager-ai-guide',
    type: 'article',
  },
  alternates: { canonical: 'https://sahayakai.tech/blog/dokan-manager-ai-guide' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'আপনার মুদি দোকানের হিসাব AI দিয়ে কীভাবে রাখবেন',
  description: 'Dokan Manager AI দিয়ে রোজের বিক্রি, স্টক এবং বাকির হিসাব মাত্র ৫ মিনিটে রাখুন।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-04-15',
  dateModified: '2026-05-27',
  inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/dokan-manager-ai-guide',
  image: 'https://sahayakai.tech/og-image.png',
  keywords: 'দোকান AI, Bengali shop AI, AI dokan manager, মুদিখানা AI, free shop AI West Bengal',
  articleSection: 'গাইড',
}

export default function DokanGuide() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> সব Blog
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">গাইড</span>
            <span className="flex items-center gap-1.5 text-indigo-200 text-xs"><Calendar size={12}/> এপ্রিল ২০২৬</span>
            <span className="flex items-center gap-1.5 text-indigo-200 text-xs"><Clock size={12}/> ৫ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">
            আপনার মুদি দোকানের হিসাব AI দিয়ে কীভাবে রাখবেন
          </h1>
          <p className="text-indigo-200 text-lg bengali leading-relaxed">
            Dokan Manager AI দিয়ে রোজের বিক্রি, স্টক এবং বাকির হিসাব মাত্র ৫ মিনিটে রাখুন — সম্পূর্ণ বাংলায়।
          </p>
        </div>
      </div>

      {/* Article */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article className="prose prose-lg max-w-none">

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-10">
            <p className="text-indigo-800 font-semibold bengali text-base mb-2">📌 এই গাইডে আপনি শিখবেন:</p>
            <ul className="space-y-1.5 text-indigo-700 bengali text-sm list-none p-0 m-0">
              <li>✅ AI দিয়ে স্টক যোগ করার সহজ পদ্ধতি</li>
              <li>✅ বাংলায় বলে বিক্রির রেকর্ড রাখা</li>
              <li>✅ বাকির হিসাব স্বয়ংক্রিয়ভাবে ট্র্যাক করা</li>
              <li>✅ দৈনিক রিপোর্ট দেখার উপায়</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">সমস্যাটা কী?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">
            পশ্চিমবঙ্গ ও বাংলাদেশের বেশিরভাগ ছোট দোকানদার এখনো খাতায় হিসাব রাখেন। প্রতিদিন রাতে খাতা মেলানো, বাকির হিসাব খোঁজা, স্টক গোনা — এই কাজে ঘণ্টার পর ঘণ্টা নষ্ট হয়। ভুল হয়, টাকা ডুবে যায়। Sahayak AI-এর <strong>Dokan Manager</strong> এই সমস্যার সমাধান করেছে।
          </p>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কীভাবে কাজ করে?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-4">
            Dokan Manager-এ আপনাকে কোনো form fill করতে হয় না। শুধু বাংলায় বলুন বা টাইপ করুন — AI বাকি সব করবে।
          </p>

          {/* Example chat boxes */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — স্টক যোগ করা</p>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">
                  dehradun rice 200kg add koro stock a, mrp per kg 65
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">
                  দেহরাদুন চাল ২০০ কেজি স্টকে যোগ করা হয়েছে। প্রতি কেজি দাম ₹৬৫। ✓
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — বিক্রির রেকর্ড</p>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">
                  রামবাবুকে ৫ কেজি চাল বিক্রি হয়েছে ৬৫ টাকায়, বাকিতে দিয়েছি
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">
                  রামবাবু — ৫ কেজি দেহরাদুন চাল বিক্রি ✓<br/>
                  মোট: ₹৩২৫ · বাকি: ₹৩২৫<br/>
                  স্টক আপডেট: ২০০ → ১৯৫ কেজি
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">৫টি কাজ যা AI স্বয়ংক্রিয়ভাবে করে</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'স্টক আপডেট', d: 'বিক্রি হলেই স্টক কমে যায়। নতুন মাল এলে যোগ হয়। সব real-time।' },
              { n: '২', t: 'বাকির হিসাব', d: 'কোন খদ্দের কত বাকি দিয়েছে, কত দিন ধরে — সব এক জায়গায়।' },
              { n: '৩', t: 'কম স্টক সতর্কতা', d: 'যে পণ্য শেষ হয়ে আসছে তার জন্য AI alert দেয়।' },
              { n: '৪', t: 'দৈনিক রিপোর্ট', d: 'আজকের মোট বিক্রি, উঠেছে কত, লাভ কত — সব summary।' },
              { n: '৫', t: 'সরবরাহকারী ট্র্যাকিং', d: 'কোন সরবরাহকারীকে কত দেনা আছে — সহজে দেখুন।' },
            ].map(f => (
              <div key={f.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{f.n}</div>
                <div>
                  <div className="font-bold text-gray-900 bengali mb-1">{f.t}</div>
                  <div className="text-gray-500 text-sm bengali">{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কোন কোন পণ্য ট্র্যাক করা যায়?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-4">
            Dokan Manager সব ধরনের পণ্য সামলাতে পারে। নিচের categories আগে থেকে সেট করা আছে:
          </p>
          <div className="flex flex-wrap gap-2 mb-8">
            {['চাল-ডাল', 'তেল-মশলা', 'আটা-ময়দা', 'চা-চিনি', 'সাবান-শ্যাম্পু', 'বিস্কুট-চকোলেট', 'সবজি', 'অন্যান্য'].map(c => (
              <span key={c} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm rounded-full bengali font-medium">{c}</span>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">Voice দিয়েও ব্যবহার করুন</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">
            টাইপ করতে না চাইলে মাইক্রোফোন আইকনে চাপ দিন। বাংলায় বলুন — AI শুনবে এবং হিসাব রাখবে। দোকানে ব্যস্ত থাকলে এটা সবচেয়ে কাজের।
          </p>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-10">
            <p className="text-emerald-800 font-bold bengali text-base mb-2">💡 Pro Tip</p>
            <p className="text-emerald-700 bengali text-sm leading-relaxed">
              রাতে দোকান বন্ধ করার আগে একবার জিজ্ঞেস করুন: "আজকের মোট বিক্রি কত হলো?" — AI পুরো দিনের summary দেবে। কোনো হিসাব মেলাতে হবে না।
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কীভাবে শুরু করবেন?</h2>
          <div className="space-y-3 mb-10">
            {[
              'sahayakai.tech-এ যান এবং account তৈরি করুন (বিনামূল্যে)',
              'Library থেকে "Dokan Manager" বেছে নিন',
              'আপনার দোকানের নাম ও ঠিকানা সেট করুন',
              'বাংলায় বলুন বা টাইপ করুন — শুরু হয়ে গেল!',
            ].map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-gray-700 bengali text-[15px] leading-relaxed">{s}</p>
              </div>
            ))}
          </div>

          {/* FAQ for AEO */}
          <div className="border-t border-gray-100 pt-10 mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 bengali">সাধারণ প্রশ্ন</h2>
            <div className="space-y-5">
              {[
                { q: 'Dokan Manager কি সম্পূর্ণ বিনামূল্যে?', a: 'হ্যাঁ, সম্পূর্ণ বিনামূল্যে। কোনো credit card বা subscription লাগবে না।' },
                { q: 'বাংলাদেশে কি ব্যবহার করা যাবে?', a: 'হ্যাঁ। ₹ এবং ৳ দুটো currency-ই সাপোর্ট করে। বাংলাদেশের দোকানদারদের জন্যও সমানভাবে কাজ করে।' },
                { q: 'ইন্টারনেট না থাকলে কি কাজ করবে?', a: 'AI কাজ করতে internet লাগে। তবে পরে sync করার ব্যবস্থা আসছে।' },
                { q: 'একসাথে কতটা পণ্য রাখা যাবে?', a: 'সীমাহীন পণ্য রাখা যাবে।' },
              ].map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-5">
                  <p className="font-bold text-gray-900 bengali mb-2">{faq.q}</p>
                  <p className="text-gray-600 bengali text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

        </article>

        {/* CTA */}
        <div className="bg-indigo-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">আজই শুরু করুন — বিনামূল্যে</h3>
          <p className="text-indigo-200 bengali mb-6">২ মিনিটে আপনার দোকানের AI সহায়ক তৈরি করুন।</p>
          <Link href="/library/dokan-manager"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">
            Dokan Manager শুরু করুন →
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog" className="text-indigo-600 hover:underline text-sm bengali flex items-center gap-1">
            <ArrowLeft size={14}/> সব Blog
          </Link>
          <Link href="/blog/pharmacy-expiry-tracking" className="text-indigo-600 hover:underline text-sm bengali">
            পরের পোস্ট →
          </Link>
        </div>
      </div>
    </div>
  )
}
