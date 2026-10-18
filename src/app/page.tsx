'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Twitter, MessageCircle } from 'lucide-react'
import HomeHero from '@/components/home/HomeHero'
import MascotWelcomeSection from '@/components/home/MascotWelcomeSection'
import HomeBannerCarousel from '@/components/home/HomeBannerCarousel'
import FeatureIconGrid from '@/components/home/FeatureIconGrid'
import BusinessTypeGallery from '@/components/home/BusinessTypeGallery'
import HowItWorksSteps from '@/components/home/HowItWorksSteps'
import DashboardShowcase from '@/components/home/DashboardShowcase'
import WhatsAppShowcase from '@/components/home/WhatsAppShowcase'
import PricingSection from '@/components/home/PricingSection'
import WhySahayak from '@/components/home/WhySahayak'
import HomeSeoLinks from '@/components/home/HomeSeoLinks'
import AppLaunchRedirect from '@/components/AppLaunchRedirect'

const FAQS = [
  { qBn: 'Sahayak AI কী?', qEn: 'What is Sahayak AI?',
    aBn: 'Sahayak AI হলো বাংলা ভাষার AI business assistant ও business management software। দোকান, ফার্মেসি, হোটেল, মিষ্টির দোকান ও কাপড়ের দোকানের stock, sales, billing, বাকি ও রিপোর্ট বাংলায় বললেই AI আপডেট করে দেয়। পশ্চিমবঙ্গ ও বাংলাদেশের ছোট ব্যবসার জন্য তৈরি।',
    aEn: 'Sahayak AI is a Bengali AI business assistant and business management software. Shop owners speak or type in Bengali, Banglish or English, and the AI updates stock, sales, billing, customer credit (baki) and reports for shops, pharmacies, hotels, sweet shops and clothing stores in West Bengal and Bangladesh.' },
  { qBn: 'Bengali AI business assistant কীভাবে কাজ করে?', qEn: 'How does a Bengali AI business assistant work?',
    aBn: 'আপনি বাংলা, Banglish বা voice-এ বলেন, যেমন "রিতা মণ্ডলকে ২ কেজি আলু দিলাম, ৬০ টাকা জমা"। AI কথাটি বুঝে stock কমায়, বিক্রি লেখে ও বাকি হিসাব করে। কোনো ফর্ম পূরণ করতে হয় না।',
    aEn: 'You tell the AI what happened in Bengali, Banglish or by voice, for example "gave Rita Mondal 2 kg potatoes, ₹60 paid". The AI understands it, reduces stock, records the sale and calculates baki. There are no forms to fill.' },
  { qBn: 'Sahayak AI-তে কি ফ্রি ট্রায়াল আছে?', qEn: 'Does Sahayak AI have a free trial?',
    aBn: 'হ্যাঁ, ৭ দিনের ফ্রি ট্রায়াল, কোনো credit card লাগে না। ট্রায়ালে ১টি এজেন্ট ব্যবহার করা যায়। পরে Starter, Growth বা Business প্ল্যানে upgrade করতে পারেন।',
    aEn: 'Yes. There is a 7-day free trial with no credit card required, and you can use 1 agent during the trial. After that you can upgrade to the Starter, Growth or Business plan.' },
  { qBn: 'কোন ধরনের ব্যবসার জন্য Sahayak AI ব্যবহার করা যায়?', qEn: 'Which businesses can use Sahayak AI?',
    aBn: 'মুদি ও জেনারেল স্টোর (দোকান), ফার্মেসি, হোটেল ও ঢাবা, মিষ্টির দোকান এবং কাপড়ের দোকানের জন্য ready-made AI agent আছে। অন্য যেকোনো ছোট ব্যবসার জন্য custom AI agent বানানোর সুবিধাও আছে।',
    aEn: 'Ready-made AI agents are available for grocery and general stores, pharmacies, hotels and dhabas, sweet shops and clothing stores. You can also build a custom AI agent for any other small business.' },
  { qBn: 'AI দিয়ে stock management বা inventory management কীভাবে করব?', qEn: 'How do I do AI stock management and inventory management?',
    aBn: 'বলুন "৫ কেজি চাল বিক্রি হয়েছে" বা "২০ প্যাকেট বিস্কুট এসেছে", AI নিজেই stock কমায় বা বাড়ায়। কোনো পণ্য কমে গেলে dashboard-এ low-stock সতর্কতা দেখায়। category ও search দিয়ে সব পণ্য সহজে খুঁজে পাবেন।',
    aEn: 'Say "sold 5 kg rice" or "20 packets of biscuits arrived" and the AI reduces or increases stock automatically. Low-stock items are flagged on your dashboard, and you can browse and search all products by category.' },
  { qBn: 'Billing software ও GST invoice সুবিধা আছে কি?', qEn: 'Does Sahayak AI have billing software and GST invoicing?',
    aBn: 'হ্যাঁ, বিক্রির কথা বললে AI বিল বানাতে সাহায্য করে এবং সব invoice history-তে জমা থাকে। ভারতীয় ব্যবসার জন্য GST invoice পেইড প্ল্যানে পাওয়া যায়। বিল করলে stock ও গ্রাহকের বাকি নিজে থেকে আপডেট হয়।',
    aEn: 'Yes. Describe the sale and the AI helps prepare the bill, and every invoice is kept in your invoice history. GST invoicing for Indian businesses is available on paid plans. Billing also updates stock and customer baki automatically.' },
  { qBn: 'গ্রাহকের বাকি ও customer management কীভাবে হয়?', qEn: 'How do I manage customers and baki (credit)?',
    aBn: 'গ্রাহকের নাম, ঠিকানা ও ফোন বললেই AI customer যোগ করে। প্রতিটি বিক্রির সঙ্গে জমা ও বাকি লেখা হয়, ফলে কার কত বাকি এক নজরে দেখা যায়। follow-up-এর তালিকাও একই জায়গায় থাকে।',
    aEn: 'Tell the AI a customer\'s name, area and phone and it adds the customer. Each sale records the amount paid and the baki, so you can see who owes what at a glance. Follow-ups are kept in the same place.' },
  { qBn: 'ব্যবসার জন্য WhatsApp automation পাওয়া যায় কি?', qEn: 'Is WhatsApp automation available for business?',
    aBn: 'হ্যাঁ, গ্রাহকদের broadcast message, বাকির follow-up reminder ও automatic reply পাঠানো যায়, আপনার customer data থেকেই। কোন প্ল্যানে কী পাবেন তা Pricing অংশে দেখুন।',
    aEn: 'Yes. You can send broadcast messages, baki follow-up reminders and automatic replies to customers using your own customer data. See the Pricing section for what each plan includes.' },
  { qBn: 'AI কি সত্যিই বাংলায় কথা বোঝে?', qEn: 'Does the AI really understand Bengali?',
    aBn: 'হ্যাঁ। Kolkata slang, সাধু বাংলা, চলিত বাংলা — সব বোঝে। Banglish (বাংলা-English মিশিয়ে) লিখলেও কাজ হয়। Voice input-ও সাপোর্ট করে।',
    aEn: 'Yes. It understands Kolkata slang, formal (sadhu) Bengali, everyday (cholito) Bengali and Banglish (Bengali mixed with English). Voice input is supported too.' },
  { qBn: 'AI বললে কি সত্যিই DB আপডেট হয়?', qEn: 'When I tell the AI something, is the database really updated?',
    aBn: 'হ্যাঁ! আপনি বলুন "আজ ৫ কেজি চাল বিক্রি হয়েছে ৬৫ টাকায়" — AI স্বয়ংক্রিয়ভাবে স্টক কমাবে, বিক্রির রেকর্ড রাখবে, বাকি হিসাব করবে। সব real-time।',
    aEn: 'Yes. Say "sold 5 kg rice today for ₹65" and the AI reduces stock, records the sale and calculates baki, all in real time.' },
  { qBn: 'Sahayak AI কি বাংলাদেশেও কাজ করে?', qEn: 'Does Sahayak AI work in Bangladesh too?',
    aBn: 'হ্যাঁ! পশ্চিমবঙ্গ এবং বাংলাদেশ — দুই জায়গার জন্যই তৈরি। ₹ (ভারতীয় রুপি) এবং ৳ (বাংলাদেশী টাকা) দুটোই সাপোর্ট করে।',
    aEn: 'Yes. It is built for both West Bengal and Bangladesh and supports ₹ (Indian rupee) and ৳ (Bangladeshi taka).' },
  { qBn: 'সাধারণ billing software থেকে Sahayak AI কীভাবে আলাদা?', qEn: 'How is Sahayak AI different from ordinary billing software?',
    aBn: 'সাধারণ software-এ প্রতিটি এন্ট্রির জন্য ফর্ম ও মেনু চালাতে হয়। Sahayak AI-তে আপনি শুধু বাংলায় বলেন বা লেখেন, আর AI stock, বিক্রি ও বাকি একসঙ্গে আপডেট করে। তাই সময় কম লাগে এবং ভুলও কম হয়।',
    aEn: 'Ordinary software makes you fill forms and navigate menus for every entry. With Sahayak AI you just speak or type in Bengali and the AI updates stock, sales and baki together, which saves time and reduces mistakes.' },
  { qBn: 'Sahayak AI ব্যবহার করতে কোনো technical জ্ঞান লাগে?', qEn: 'Do I need technical knowledge to use Sahayak AI?',
    aBn: 'না। কোনো coding বা technical জ্ঞান দরকার নেই। শুধু বাংলায় লিখুন বা বলুন — AI বাকি সব করবে।',
    aEn: 'No. No coding or technical knowledge is needed. Just type or speak in Bengali and the AI does the rest.' },
]

function FaqItem({ faq }: { faq: typeof FAQS[0] }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="rounded-xl border border-gray-100 bg-white overflow-hidden cursor-pointer"
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div>
          <h3 lang="bn" className="font-semibold text-gray-900 text-[13.5px] bengali">{faq.qBn}</h3>
          <p lang="en" className="text-gray-500 text-[12.5px] mt-0.5">{faq.qEn}</p>
        </div>
        <span className="text-gray-400 text-base flex-shrink-0 transition-transform duration-200"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </div>
      <div
        className="px-5 overflow-hidden transition-all duration-200"
        style={{ maxHeight: open ? '700px' : '0px', paddingBottom: open ? '14px' : '0px' }}
      >
        <p lang="bn" className="text-gray-600 text-[13px] leading-relaxed bengali">{faq.aBn}</p>
        <p lang="en" className="text-gray-500 text-[13px] leading-relaxed mt-2">{faq.aEn}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <AppLaunchRedirect />
      <MascotWelcomeSection />
      <HomeHero />
      <HomeBannerCarousel />

      {/* ── STATS BAR ─────────────────────────────────────────────── */}
      <section style={{ background: '#0f172a' }} className="mt-16">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          {[
            { n: '৫টি', l: 'AI Library', sub: 'সম্পূর্ণ DB সহ' },
            { n: '১০০%', l: 'বাংলায়', sub: 'Voice + Text' },
            { n: '৭ দিন', l: 'ফ্রি ট্রায়াল', sub: 'কোনো card লাগবে না' },
            { n: 'Live', l: 'Real-time', sub: 'AI লিখলে DB আপডেট' },
          ].map(s => (
            <div key={s.l} className="py-8 px-6 text-center">
              <div className="text-3xl font-extrabold text-white bengali">{s.n}</div>
              <div className="text-white/50 text-sm mt-1 bengali">{s.l}</div>
              <div className="text-white/25 text-[11px] mt-0.5 bengali">{s.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <FeatureIconGrid />
      <BusinessTypeGallery />
      <HowItWorksSteps />
      <DashboardShowcase />
      <WhatsAppShowcase />
      <PricingSection />
      <WhySahayak />
      <HomeSeoLinks />

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-white">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.flatMap(faq => [
            { '@type': 'Question', name: faq.qBn, inLanguage: 'bn', acceptedAnswer: { '@type': 'Answer', text: faq.aBn } },
            { '@type': 'Question', name: faq.qEn, inLanguage: 'en', acceptedAnswer: { '@type': 'Answer', text: faq.aEn } },
          ]),
        }) }} />
        <div className="max-w-5xl mx-auto grid md:grid-cols-[0.85fr_1.15fr] gap-10 items-start">

          {/* LEFT — intro + contact card */}
          <div className="md:sticky md:top-24">
            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 text-[12px] font-bold rounded-full bengali mb-4">
              সহায়তা কেন্দ্র
            </span>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3 bengali leading-snug">
              সাধারণ প্রশ্ন
            </h2>
            <p className="text-gray-500 text-sm bengali mb-6 max-w-xs">
              Sahayak AI সম্পর্কে সবচেয়ে বেশি জিজ্ঞাসিত প্রশ্নের উত্তর এখানে পাবেন
            </p>
            <div className="rounded-2xl p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-100">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center mb-3">
                <MessageCircle size={18} />
              </div>
              <p className="text-gray-900 font-bold text-sm bengali mb-1">আরও প্রশ্ন আছে?</p>
              <p className="text-gray-500 text-[13px] bengali mb-4">সরাসরি WhatsApp-এ আমাদের টিমের সাথে কথা বলুন</p>
              <a href="https://wa.me/919477581817?text=%E0%A6%86%E0%A6%AE%E0%A6%BF%20Sahayak%20AI%20%E0%A6%B8%E0%A6%AE%E0%A7%8D%E0%A6%AA%E0%A6%B0%E0%A7%8D%E0%A6%95%E0%A7%87%20%E0%A6%9C%E0%A6%BE%E0%A6%A8%E0%A6%A4%E0%A7%87%20%E0%A6%9A%E0%A6%BE%E0%A6%87" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-[13px] bengali">
                যোগাযোগ করুন →
              </a>
            </div>
          </div>

          {/* RIGHT — compact accordion */}
          <div className="space-y-2">
            {FAQS.map((faq, i) => <FaqItem key={i} faq={faq} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-5xl mx-auto rounded-3xl overflow-hidden relative"
          style={{ background: 'linear-gradient(120deg, #4338CA 0%, #6D28D9 55%, #059669 100%)' }}>
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />

          <div className="relative z-10 px-7 py-9 md:py-11 md:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left">
              <h2 className="text-xl md:text-2xl font-extrabold text-white mb-1.5 bengali">আজই শুরু করুন</h2>
              <p className="text-white/70 text-[13px] bengali">৭ দিনের ফ্রি ট্রায়াল। কোনো credit card লাগবে না।</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0 w-full sm:w-auto">
              <Link href="/library"
                className="px-6 py-3 rounded-xl font-bold text-sm bg-white text-indigo-700 hover:bg-gray-50 transition-colors bengali text-center">
                Library দেখুন
              </Link>
              <Link href="/agents/new"
                className="px-6 py-3 rounded-xl font-bold text-sm border-2 border-white/40 text-white hover:bg-white/10 transition-colors bengali text-center">
                নিজের Agent বানান
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="https://x.com/sahayakai_tech" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-600 text-sm transition-colors">
            <Twitter size={14} /> @sahayakai_tech follow করুন
          </a>
          <p className="mt-2 text-gray-300 text-xs">A product of Evynta</p>
        </div>
      </section>

    </div>
  )
}
