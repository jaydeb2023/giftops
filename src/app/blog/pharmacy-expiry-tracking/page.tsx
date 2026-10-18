import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'ফার্মেসিতে ওষুধের মেয়াদ track করুন AI দিয়ে | Sahayak AI Blog',
  description: 'Pharmacy Assistant AI দিয়ে ওষুধের মেয়াদ, স্টক, এবং supplier order বাংলায় ম্যানেজ করুন। Loss কমান, সময় বাঁচান।',
  keywords: ['pharmacy AI Bengali', 'ফার্মেসি AI', 'ওষুধের মেয়াদ track', 'medicine expiry alert Bengali', 'free pharmacy management India', 'Bengali pharmacy assistant', 'ফার্মেসি ম্যানেজমেন্ট AI'],
  openGraph: { title: 'ফার্মেসিতে ওষুধের মেয়াদ AI দিয়ে track করুন — Sahayak AI', description: 'Pharmacy AI দিয়ে expiry alert, stock tracking, supplier order — সব বাংলায়।', url: 'https://sahayakai.tech/blog/pharmacy-expiry-tracking', type: 'article' },
  alternates: { canonical: 'https://sahayakai.tech/blog/pharmacy-expiry-tracking' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article',
  headline: 'ফার্মেসিতে ওষুধের মেয়াদ track করার সহজ উপায়',
  description: 'Pharmacy Assistant AI দিয়ে ওষুধের মেয়াদ, স্টক, এবং supplier order বাংলায় ম্যানেজ করুন।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-04-20', dateModified: '2026-05-27', inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/pharmacy-expiry-tracking',
  keywords: 'pharmacy AI Bengali, ফার্মেসি AI, ওষুধের মেয়াদ, medicine expiry alert',
}

export default function PharmacyBlog() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sky-200 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft size={14} /> সব Blog</Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">Tips</span>
            <span className="flex items-center gap-1.5 text-sky-200 text-xs"><Calendar size={12}/> এপ্রিল ২০২৬</span>
            <span className="flex items-center gap-1.5 text-sky-200 text-xs"><Clock size={12}/> ৪ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">ফার্মেসিতে ওষুধের মেয়াদ track করার সহজ উপায়</h1>
          <p className="text-sky-200 text-lg bengali leading-relaxed">Pharmacy Assistant AI দিয়ে expiry alert, stock tracking, supplier reorder — সব বাংলায়। একজন ফার্মেসি মালিকের real experience।</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article>
          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-6 mb-10">
            <p className="text-sky-800 font-semibold bengali text-base mb-2">📌 এই গাইডে আপনি শিখবেন:</p>
            <ul className="space-y-1.5 text-sky-700 bengali text-sm list-none p-0 m-0">
              <li>✅ মেয়াদ শেষের আগেই AI কীভাবে alert দেয়</li>
              <li>✅ বাংলায় স্টক চেক ও আপডেট করা</li>
              <li>✅ Supplier reorder বাংলায় ম্যানেজ করা</li>
              <li>✅ রোগীর রেকর্ড ও prescription ট্র্যাকিং</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">ফার্মেসির সবচেয়ে বড় সমস্যা কী?</h2>
          <p className="text-gray-600 bengali leading-relaxed mb-6">পশ্চিমবঙ্গ ও বাংলাদেশের ছোট ফার্মেসিতে প্রতি মাসে গড়ে ৫-১০ হাজার টাকার ওষুধ মেয়াদ পেরিয়ে waste হয়। খাতায় হাজারো ওষুধের মেয়াদ track করা অসম্ভব। Sahayak AI-এর <strong>Pharmacy Assistant</strong> এটা স্বয়ংক্রিয়ভাবে করে।</p>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">AI কীভাবে মেয়াদ track করে?</h2>

          <div className="bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — স্টকে ওষুধ যোগ</p>
            <div className="space-y-3">
              <div className="flex justify-end"><div className="bg-sky-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">Paracetamol 500mg 200 strip add koro, expiry 12/2026, MRP 18</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">Paracetamol 500mg ২০০ strip স্টকে যোগ হয়েছে ✓<br/>MRP: ₹১৮ · মেয়াদ: ডিসেম্বর ২০২৬<br/>৩০ দিন আগে আমি alert দেব।</div></div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">উদাহরণ — expiry check</p>
            <div className="space-y-3">
              <div className="flex justify-end"><div className="bg-sky-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">কোন ওষুধের মেয়াদ শেষ হচ্ছে?</div></div>
              <div className="flex justify-start"><div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%] bengali">⚠️ ৩০ দিনের মধ্যে মেয়াদ শেষ:<br/>• Cough Syrup (15 bottle) — Nov 2026<br/>• Vitamin C 500mg (40 strip) — Nov 2026<br/>• Antacid Tablet (25 strip) — Nov 2026<br/>এখনই আলাদা করুন ও return করুন।</div></div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">Pharmacy Assistant যা যা করে</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'Expiry Alert', d: 'মেয়াদ শেষের ৩০ দিন আগে AI নিজে থেকে জানায়। কোনো ওষুধ waste হবে না।' },
              { n: '২', t: 'Stock Tracking', d: 'বিক্রি হলেই stock কমে। নতুন batch এলে যোগ হয়। সব real-time।' },
              { n: '৩', t: 'Supplier Reorder', d: '"Paracetamol কম হয়ে গেছে, order দাও" — AI বলবে। Supplier এর নাম ও contact রাখুন।' },
              { n: '৪', t: 'রোগীর রেকর্ড', d: 'কোন রোগী কোন ওষুধ কিনেছেন, কবে আসবেন — ট্র্যাক রাখুন।' },
              { n: '৫', t: 'হালখাতা', d: 'কোন রোগী বাকিতে ওষুধ নিয়েছেন, কত বাকি — সব হিসাব।' },
            ].map(f => (
              <div key={f.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{f.n}</div>
                <div><div className="font-bold text-gray-900 bengali mb-1">{f.t}</div><div className="text-gray-500 text-sm bengali">{f.d}</div></div>
              </div>
            ))}
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-10">
            <p className="text-emerald-800 font-bold bengali text-base mb-2">💡 Real Experience</p>
            <p className="text-emerald-700 bengali text-sm leading-relaxed">"আগে মাসে মাসে ৫-৭ হাজার টাকার ওষুধ মেয়াদ পার হয়ে যেত। এখন AI আগে থেকেই বলে দেয় — return করে দিই। গত ৩ মাসে কোনো loss হয়নি।" — রেহানা বেগম, ফার্মেসি মালিক, ঢাকা</p>
          </div>

          <div className="border-t border-gray-100 pt-10 mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 bengali">সাধারণ প্রশ্ন</h2>
            <div className="space-y-5">
              {[
                { q: 'Pharmacy Assistant কি বিনামূল্যে?', a: 'হ্যাঁ, সম্পূর্ণ বিনামূল্যে। কোনো subscription লাগবে না।' },
                { q: 'কতটা ওষুধ রাখা যাবে?', a: 'সীমাহীন। যত খুশি ওষুধ add করুন।' },
                { q: 'Bangladesh-এ কাজ করে?', a: 'হ্যাঁ। ₹ এবং ৳ দুটো currency সাপোর্ট করে।' },
                { q: 'কতদিন আগে expiry alert আসে?', a: 'মেয়াদ শেষের ৩০ দিন আগে। আপনি চাইলে এটা পরিবর্তন করতে পারবেন।' },
              ].map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-5">
                  <p className="font-bold text-gray-900 bengali mb-2">{faq.q}</p>
                  <p className="text-gray-600 bengali text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </article>

        <div className="bg-sky-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">আজই শুরু করুন — বিনামূল্যে</h3>
          <p className="text-sky-200 bengali mb-6">আপনার ফার্মেসির AI সহায়ক ২ মিনিটে তৈরি করুন।</p>
          <Link href="/library/pharmacy-assistant" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-sky-600 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">Pharmacy Assistant শুরু করুন →</Link>
        </div>
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog/dokan-manager-ai-guide" className="text-sky-600 hover:underline text-sm bengali flex items-center gap-1"><ArrowLeft size={14}/> আগের পোস্ট</Link>
          <Link href="/blog/voice-input-bangla" className="text-sky-600 hover:underline text-sm bengali">পরের পোস্ট →</Link>
        </div>
      </div>
    </div>
  )
}
