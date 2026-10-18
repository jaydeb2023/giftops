import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'দোকানের বাকি হিসাব রাখার সহজ উপায় (২০২৬) | Sahayak AI',
  description: 'খাতায় বাকি হিসাব রাখতে গিয়ে ঝামেলায় পড়েন? জানুন কীভাবে বাংলায় কথা বলে AI দিয়ে দোকানের বাকির হিসাব সহজে, নির্ভুলভাবে রাখবেন — সম্পূর্ণ বিনামূল্যে।',
  keywords: ['দোকানের বাকি হিসাব রাখার সহজ উপায়', 'বাকি হিসাব সফটওয়্যার', 'বাংলা ডিজিটাল খাতা', 'দোকানের হিসাব রাখার অ্যাপ', 'digital khata for small business', 'khata app Bengali', 'customer credit tracking app India'],
  openGraph: {
    title: 'দোকানের বাকি হিসাব রাখার সহজ উপায় — Sahayak AI',
    description: 'খাতায় নয়, বাংলায় বলুন — AI বাকির হিসাব রাখবে। কোনো ভুল হবে না, কিছু ভুলে যাবেন না।',
    url: 'https://sahayakai.tech/blog/dokaner-baki-hisab-rakhar-sohoj-upay',
    type: 'article',
  },
  alternates: { canonical: 'https://sahayakai.tech/blog/dokaner-baki-hisab-rakhar-sohoj-upay' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'দোকানের বাকি হিসাব রাখার সহজ উপায়',
  description: 'খাতায় বাকি হিসাব রাখার ঝামেলা থেকে মুক্তি — AI দিয়ে বাংলায় বলে বাকির হিসাব রাখার সম্পূর্ণ গাইড।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-09-14',
  dateModified: '2026-09-14',
  inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/dokaner-baki-hisab-rakhar-sohoj-upay',
  image: 'https://sahayakai.tech/og-image.png',
  keywords: 'দোকানের বাকি হিসাব, ডিজিটাল খাতা, বাকি হিসাব সফটওয়্যার, digital khata',
  articleSection: 'গাইড',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'বাকি হিসাব রাখার জন্য কি টাকা লাগে?', acceptedAnswer: { '@type': 'Answer', text: 'না, Sahayak AI দিয়ে বাকি হিসাব রাখা সম্পূর্ণ বিনামূল্যে। কোনো credit card বা subscription লাগবে না।' } },
    { '@type': 'Question', name: 'পুরনো খাতার হিসাব কি নতুন করে লিখতে হবে?', acceptedAnswer: { '@type': 'Answer', text: 'হ্যাঁ, একবার আপনার বর্তমান বাকির লিস্ট AI-কে বাংলায় বলে দিলেই যথেষ্ট। এরপর থেকে সব নতুন হিসাব automatic ভাবে যোগ হবে।' } },
    { '@type': 'Question', name: 'কাস্টমার বাকি শোধ করলে কীভাবে আপডেট করব?', acceptedAnswer: { '@type': 'Answer', text: 'শুধু বলুন "রামবাবু ২০০ টাকা বাকি দিয়েছে" — AI নিজে থেকে বাকির হিসাব কমিয়ে দেবে এবং payment history-তে রেখে দেবে।' } },
    { '@type': 'Question', name: 'ইন্টারনেট ছাড়া কি বাকি হিসাব দেখা যাবে?', acceptedAnswer: { '@type': 'Answer', text: 'হিসাব যোগ করতে internet লাগে, তবে আগের সব হিসাব যেকোনো সময় দেখা যায় — Sahayak AI cloud-এ সব data নিরাপদে জমা থাকে, খাতা হারানোর ভয় নেই।' } },
  ],
}

export default function BakiHisabGuide() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #059669, #0D9488)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-emerald-100 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> সব Blog
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">ডিজিটাল খাতা</span>
            <span className="flex items-center gap-1.5 text-emerald-100 text-xs"><Calendar size={12}/> সেপ্টেম্বর ২০২৬</span>
            <span className="flex items-center gap-1.5 text-emerald-100 text-xs"><Clock size={12}/> ৬ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">
            দোকানের বাকি হিসাব রাখার সহজ উপায়
          </h1>
          <p className="text-emerald-100 text-lg bengali leading-relaxed">
            খাতায় কার কাছে কত টাকা পাওনা লিখে রাখা ঝামেলার। জানুন কীভাবে বাংলায় বলেই AI দিয়ে বাকির পুরো হিসাব নির্ভুলভাবে রাখবেন।
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <article className="prose prose-lg max-w-none">

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-10">
            <p className="text-emerald-800 font-semibold bengali text-base mb-2">📌 এই গাইডে আপনি শিখবেন:</p>
            <ul className="space-y-1.5 text-emerald-700 bengali text-sm list-none p-0 m-0">
              <li>✅ খাতার বাকি হিসাবে সবচেয়ে বেশি ভুল কেন হয়</li>
              <li>✅ বাংলায় বলে বাকি হিসাব যোগ করার পদ্ধতি</li>
              <li>✅ কাস্টমার পেমেন্ট দিলে হিসাব আপডেট করা</li>
              <li>✅ কার কাছে কত দিন ধরে বাকি — সহজে দেখার উপায়</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">সমস্যাটা কী?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">
            পশ্চিমবঙ্গ ও বাংলাদেশের প্রায় প্রতিটা ছোট দোকানে বাকির খাতা আছে। কেউ চাল বাকিতে নেয়, কেউ মাসের শেষে শোধ করার কথা বলে জিনিস নিয়ে যায়। সমস্যা হলো — খাতায় হাতে লেখা হিসাবে ভুল হওয়া, পাতা হারিয়ে যাওয়া, বা কে কবে কত দিয়েছে সেটা মনে না থাকা। মাস শেষে হিসাব মেলাতে গিয়ে দেখা যায় হাজার টাকার গরমিল — অথচ কারণটা কেউ বলতে পারে না।
          </p>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">খাতার হিসাবে সবচেয়ে বেশি ভুল হয় কোথায়?</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'হাতের লেখা পড়া যায় না', d: 'তাড়াহুড়োয় লেখা সংখ্যা পরে নিজেই বুঝতে পারা যায় না — ৩ নাকি ৮, ০ নাকি ৬।' },
              { n: '২', t: 'পুরনো পাতা খুঁজে পাওয়া কঠিন', d: 'কে কবে বাকি নিয়েছিল তা মাসের পর মাস পাতা উল্টে খুঁজতে হয়।' },
              { n: '৩', t: 'আংশিক পেমেন্ট ট্র্যাক করা মুশকিল', d: 'কেউ ৫০০ টাকার বাকিতে ২০০ টাকা দিলে সেটা আলাদা করে না লিখলে ভুল হয়ে যায়।' },
              { n: '৪', t: 'খাতা হারিয়ে গেলে সব শেষ', d: 'আগুন, জল, বা হারিয়ে গেলে মাসের পর মাসের হিসাব একসাথে চলে যায়।' },
            ].map(f => (
              <div key={f.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{f.n}</div>
                <div>
                  <div className="font-bold text-gray-900 bengali mb-1">{f.t}</div>
                  <div className="text-gray-500 text-sm bengali">{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">ডিজিটাল খাতা কীভাবে সমাধান দেয়?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-4">
            Sahayak AI-এর বাকি হিসাব ফিচার আপনার পুরনো খাতাকে ডিজিটাল খাতায় বদলে দেয় — কোনো নতুন সফটওয়্যার শেখার দরকার নেই, কোনো ফর্ম fill করতে হয় না। আপনি শুধু বাংলায় বলুন বা লিখুন যা করতে চান, AI বাকি সব করে দেবে।
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — বাকি যোগ করা</p>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">
                  করিম সাহেব ৫০০ টাকার চাল বাকিতে নিয়েছে
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">
                  করিম সাহেব — ৳৫০০ বাকি যোগ হয়েছে ✓<br/>
                  মোট বাকি এখন: ৳৫০০
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — বাকি শোধ হওয়া</p>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-emerald-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">
                  করিম সাহেব ২০০ টাকা দিয়েছে
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">
                  ৳২০০ payment রেকর্ড করা হলো ✓<br/>
                  করিম সাহেবের বাকি এখন: ৳৩০০
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">খাতায় হিসাব নাকি ডিজিটাল হিসাব?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">
            খাতা চেনা-জানা পদ্ধতি, তাই অনেকে বদলাতে ভয় পান। কিন্তু বাস্তবতা হলো — ডিজিটাল খাতায় লেখা হারায় না, হিসাব ভুল হয় না, আর যেকোনো ফোন থেকে যেকোনো সময় পুরনো হিসাব দেখা যায়। সবচেয়ে বড় কথা, Sahayak AI-এ আপনাকে <strong>টাইপও করতে হয় না</strong> — খাতায় যেভাবে বলে বলে লেখাতেন, ঠিক সেভাবেই বাংলায় বলুন।
          </p>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">সব বাকির হিসাব এক জায়গায়</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">
            শুধু হিসাব যোগ করাই না — কার কাছে কত বাকি, কতদিন ধরে বাকি, কে নিয়মিত পেমেন্ট দেয় — সব একটা তালিকায় দেখা যায়। মাস শেষে কাউকে মনে করিয়ে দিতে ভুলবেন না, কারণ AI নিজেই পুরনো বাকির জন্য reminder পাঠাতে পারে।
          </p>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-10">
            <p className="text-indigo-800 font-bold bengali text-base mb-2">💡 Pro Tip</p>
            <p className="text-indigo-700 bengali text-sm leading-relaxed">
              সপ্তাহে একবার জিজ্ঞেস করুন: "সবচেয়ে বেশি বাকি কার আছে?" — AI তালিকা করে দেখাবে, যাতে সময়মতো মনে করিয়ে দিতে পারেন।
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কীভাবে শুরু করবেন?</h2>
          <div className="space-y-3 mb-10">
            {[
              'sahayakai.tech-এ বিনামূল্যে account তৈরি করুন',
              'Library থেকে আপনার ব্যবসার ধরন বেছে নিন (দোকান, ফার্মেসি, হোটেল ইত্যাদি)',
              'পুরনো বাকির তালিকা একবার বাংলায় বলে দিন',
              'এরপর থেকে প্রতিটা নতুন বাকি ও পেমেন্ট বাংলায় বলেই আপডেট করুন',
            ].map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-gray-700 bengali text-[15px] leading-relaxed">{s}</p>
              </div>
            ))}
          </div>

          {/* FAQ for AEO */}
          <div className="border-t border-gray-100 pt-10 mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 bengali">সাধারণ প্রশ্ন</h2>
            <div className="space-y-5">
              {[
                { q: 'বাকি হিসাব রাখার জন্য কি টাকা লাগে?', a: 'না, Sahayak AI দিয়ে বাকি হিসাব রাখা সম্পূর্ণ বিনামূল্যে। কোনো credit card বা subscription লাগবে না।' },
                { q: 'পুরনো খাতার হিসাব কি নতুন করে লিখতে হবে?', a: 'হ্যাঁ, একবার আপনার বর্তমান বাকির লিস্ট AI-কে বাংলায় বলে দিলেই যথেষ্ট। এরপর থেকে সব নতুন হিসাব automatic ভাবে যোগ হবে।' },
                { q: 'কাস্টমার বাকি শোধ করলে কীভাবে আপডেট করব?', a: 'শুধু বলুন "রামবাবু ২০০ টাকা বাকি দিয়েছে" — AI নিজে থেকে বাকির হিসাব কমিয়ে দেবে এবং payment history-তে রেখে দেবে।' },
                { q: 'ইন্টারনেট ছাড়া কি বাকি হিসাব দেখা যাবে?', a: 'হিসাব যোগ করতে internet লাগে, তবে আগের সব হিসাব যেকোনো সময় দেখা যায় — cloud-এ সব data নিরাপদে জমা থাকে, খাতা হারানোর ভয় নেই।' },
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
        <div className="bg-emerald-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">আজই বাকির হিসাব ডিজিটাল করুন</h3>
          <p className="text-emerald-100 bengali mb-6">সম্পূর্ণ বিনামূল্যে, ২ মিনিটে শুরু করুন।</p>
          <Link href="/library/dokan-manager"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-emerald-700 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">
            বিনামূল্যে শুরু করুন →
          </Link>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog" className="text-emerald-600 hover:underline text-sm bengali flex items-center gap-1">
            <ArrowLeft size={14}/> সব Blog
          </Link>
          <Link href="/blog/dokan-manager-ai-guide" className="text-emerald-600 hover:underline text-sm bengali">
            পরের পোস্ট →
          </Link>
        </div>
      </div>
    </div>
  )
}
