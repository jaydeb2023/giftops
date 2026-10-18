import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'বাংলায় voice দিয়ে AI ব্যবহার করুন — মাইক্রোফোনে বলুন | Sahayak AI Blog',
  description: 'Sahayak AI-তে এখন Bengali voice input available। মাইক্রোফোনে বাংলায় বলুন — AI স্টক আপডেট করবে, বিক্রি রেকর্ড করবে। Hands-free ব্যবসা ম্যানেজমেন্ট।',
  keywords: ['Bengali voice AI', 'বাংলায় voice input', 'AI voice Bengali', 'বাংলা voice assistant', 'hands-free shop management', 'Bengali speech recognition', 'বাংলায় কথা বলুন AI'],
  openGraph: { title: 'বাংলায় voice দিয়ে AI ব্যবহার করুন — Sahayak AI', description: 'মাইক্রোফোনে বাংলায় বলুন, AI স্টক আপডেট করবে।', url: 'https://sahayakai.tech/blog/voice-input-bangla', type: 'article' },
  alternates: { canonical: 'https://sahayakai.tech/blog/voice-input-bangla' },
}

const jsonLd = {
  '@context': 'https://schema.org', '@type': 'Article',
  headline: 'বাংলায় voice input দিয়ে AI ব্যবহার করুন',
  description: 'Sahayak AI-তে Bengali voice input — মাইক্রোফোনে বলুন, AI কাজ করবে।',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-04-25', dateModified: '2026-05-27', inLanguage: 'bn',
  url: 'https://sahayakai.tech/blog/voice-input-bangla',
  keywords: 'Bengali voice AI, বাংলায় voice input, Bengali speech recognition',
}

export default function VoiceBlog() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-violet-200 hover:text-white text-sm mb-8 transition-colors"><ArrowLeft size={14} /> সব Blog</Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">Product Update</span>
            <span className="flex items-center gap-1.5 text-violet-200 text-xs"><Calendar size={12}/> এপ্রিল ২০২৬</span>
            <span className="flex items-center gap-1.5 text-violet-200 text-xs"><Clock size={12}/> ৩ মিনিট</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5 bengali">নতুন feature: বাংলায় voice input এখন available</h1>
          <p className="text-violet-200 text-lg bengali leading-relaxed">টাইপ করার দরকার নেই। মাইক্রোফোনে বাংলায় বলুন — AI শুনবে এবং হিসাব রাখবে। দোকানে ব্যস্ত থাকলে সবচেয়ে কাজের।</p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 py-12">
        <article>
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-6 mb-10">
            <p className="text-violet-800 font-semibold bengali text-base mb-2">🎤 নতুন কী এলো:</p>
            <ul className="space-y-1.5 text-violet-700 bengali text-sm list-none p-0 m-0">
              <li>✅ Bengali (bn-IN) voice input সব device-এ</li>
              <li>✅ English (en-IN) ও Banglish সাপোর্ট</li>
              <li>✅ Hands-free — দোকানে কাজ করতে করতে বলুন</li>
              <li>✅ সব ৫টি Library-তে কাজ করে</li>
            </ul>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কীভাবে ব্যবহার করবেন?</h2>
          <div className="space-y-4 mb-8">
            {[
              { n: '১', t: 'মাইক্রোফোন আইকনে ট্যাপ করুন', d: 'Chat-এর নিচে বাঁদিকে মাইক্রোফোন আইকন আছে। একবার ট্যাপ করুন।' },
              { n: '২', t: 'বাংলায় বলুন', d: '"আজ ৫ কেজি চাল বিক্রি হয়েছে" বা "Paracetamol স্টক কত আছে?" — যা খুশি বলুন।' },
              { n: '৩', t: 'AI কাজ করবে', d: 'আপনার কথা text-এ convert হবে এবং AI স্বয়ংক্রিয়ভাবে হিসাব রাখবে।' },
            ].map(s => (
              <div key={s.n} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 bengali">{s.n}</div>
                <div><div className="font-bold text-gray-900 bengali mb-1">{s.t}</div><div className="text-gray-500 text-sm bengali">{s.d}</div></div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4 bengali">কোন কোন ভাষায় বলতে পারবেন?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { lang: 'বাংলা', ex: '"আজ রামবাবুকে ৫ কেজি চাল বিক্রি হয়েছে ৩২৫ টাকায়"', color: '#4F46E5' },
              { lang: 'English', ex: '"Add paracetamol 100 strips to stock, expiry December 2026"', color: '#0284C7' },
              { lang: 'Banglish', ex: '"table 3 te 2 dal makhni order diye gese, 360 taka"', color: '#059669' },
            ].map(l => (
              <div key={l.lang} className="p-5 rounded-xl border border-gray-100 bg-white">
                <div className="text-sm font-bold mb-2" style={{ color: l.color }}>{l.lang}</div>
                <div className="text-gray-500 text-xs leading-relaxed bengali italic">"{l.ex}"</div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-8">
            <p className="text-amber-800 font-bold bengali text-base mb-2">⚡ সবচেয়ে কাজের situation</p>
            <ul className="space-y-2 text-amber-700 bengali text-sm">
              <li>• দোকানে ব্যস্ত থাকলে — হাত না দিয়েই record করুন</li>
              <li>• গরমে phone type করতে না চাইলে</li>
              <li>• রাতে দ্রুত summary নিতে চাইলে</li>
              <li>• বয়স্ক দোকানদার যারা type করতে সমস্যা পান</li>
            </ul>
          </div>

          <div className="border-t border-gray-100 pt-10 mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 bengali">সাধারণ প্রশ্ন</h2>
            <div className="space-y-5">
              {[
                { q: 'Voice input কি সব phone-এ কাজ করে?', a: 'Android ও iPhone উভয়ে কাজ করে। Browser-এ microphone permission দিতে হবে।' },
                { q: 'বাংলা dialect বোঝে?', a: 'হ্যাঁ। Kolkata Bengali, Bangladeshi Bengali, Sylheti — সব বোঝার চেষ্টা করে।' },
                { q: 'Internet না থাকলে voice কাজ করবে?', a: 'Voice recognition-এ internet লাগে। ভালো connection থাকলে ভালো কাজ করে।' },
              ].map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-5">
                  <p className="font-bold text-gray-900 bengali mb-2">{faq.q}</p>
                  <p className="text-gray-600 bengali text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
        <div className="bg-violet-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3 bengali">এখনই চেষ্টা করুন</h3>
          <p className="text-violet-200 bengali mb-6">মাইক্রোফোনে বাংলায় বলুন — AI কাজ করবে।</p>
          <Link href="/library" className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-violet-600 font-bold rounded-xl hover:bg-gray-50 transition-colors bengali">Library খুলুন →</Link>
        </div>
        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog/pharmacy-expiry-tracking" className="text-violet-600 hover:underline text-sm bengali flex items-center gap-1"><ArrowLeft size={14}/> আগের পোস্ট</Link>
          <Link href="/blog/hotel-dhaba-ai-guide" className="text-violet-600 hover:underline text-sm bengali">পরের পোস্ট →</Link>
        </div>
      </div>
    </div>
  )
}
