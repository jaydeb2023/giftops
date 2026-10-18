import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Clock, Calendar } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Bengali AI Business Assistant for Small Businesses (2026 Guide) | Sahayak AI',
  description: 'What a Bengali-first AI business assistant does, who it is for, and how small shops, pharmacies, and hotels across Bengal and Bangladesh use it to manage stock, sales, and credit.',
  keywords: ['Bengali AI business assistant', 'AI for small business India', 'AI business assistant for small shops', 'Bengali business software', 'small business management software India'],
  openGraph: {
    title: 'Bengali AI Business Assistant for Small Businesses — Sahayak AI',
    description: 'A Bengali-first AI that manages stock, sales, and customer credit for small businesses — explained simply.',
    url: 'https://sahayakai.tech/blog/bengali-ai-business-assistant-guide',
    type: 'article',
  },
  alternates: { canonical: 'https://sahayakai.tech/blog/bengali-ai-business-assistant-guide' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Bengali AI Business Assistant for Small Businesses',
  description: 'An introduction to Bengali-first AI business assistants and how small businesses use them.',
  author: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  datePublished: '2026-09-14',
  dateModified: '2026-09-14',
  inLanguage: 'en',
  url: 'https://sahayakai.tech/blog/bengali-ai-business-assistant-guide',
  image: 'https://sahayakai.tech/og-image.png',
  articleSection: 'Guide',
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is a Bengali AI business assistant?', acceptedAnswer: { '@type': 'Answer', text: 'It is software that understands spoken or typed Bengali and performs real business tasks — updating stock, recording sales, tracking customer credit — instead of requiring forms or English-only interfaces.' } },
    { '@type': 'Question', name: 'Do I need technical knowledge to use one?', acceptedAnswer: { '@type': 'Answer', text: 'No. You interact by speaking or typing in natural Bengali, the same way you would explain something to an employee.' } },
    { '@type': 'Question', name: 'Which businesses can use Sahayak AI?', acceptedAnswer: { '@type': 'Answer', text: 'General stores (dokan), pharmacies, hotels and dhabas, sweet shops, and clothing stores each have a dedicated assistant tailored to their specific workflow.' } },
    { '@type': 'Question', name: 'Does it work in both West Bengal and Bangladesh?', acceptedAnswer: { '@type': 'Answer', text: 'Yes, it supports both Indian Rupee (₹) and Bangladeshi Taka (৳), and understands regional Bengali dialects and Banglish (mixed Bengali-English).' } },
  ],
}

export default function BengaliAIAssistantGuide() {
  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }} className="px-4 pt-12 pb-16">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-indigo-200 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft size={14} /> All Blog Posts
          </Link>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-white/20 text-white">Guide</span>
            <span className="flex items-center gap-1.5 text-indigo-200 text-xs"><Calendar size={12}/> September 2026</span>
            <span className="flex items-center gap-1.5 text-indigo-200 text-xs"><Clock size={12}/> 6 min read</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-5">
            Bengali AI Business Assistant for Small Businesses
          </h1>
          <p className="text-indigo-200 text-lg leading-relaxed">
            What it actually does, who it's built for, and how shop owners across Bengal and Bangladesh use it every day — explained without the jargon.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <article className="prose prose-lg max-w-none">

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4">The problem most business software has</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            Most business management software is built in English, for English-first users, with forms, dropdowns, and dashboards that assume a certain comfort with typing and navigating menus. For millions of shop owners across West Bengal and Bangladesh whose first language is Bengali, this creates real friction — not because they aren't capable, but because the tool wasn't built with them in mind.
          </p>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4">What "Bengali-first" actually means</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            A Bengali-first AI assistant doesn't just translate an English app's labels into Bengali. It's built so you can speak or type naturally — in Kolkata slang, formal সাধু বাংলা, casual চলিত বাংলা, or even Banglish (Bengali mixed with English) — and the AI still understands the intent and performs the right action.
          </p>

          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Example</p>
            <div className="space-y-3">
              <div className="flex justify-end">
                <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-tr-sm max-w-[85%] bengali">
                  আজ ৫ কেজি চাল বিক্রি হয়েছে ৬৫ টাকায়
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 text-gray-800 text-sm px-4 py-2.5 rounded-2xl rounded-tl-sm max-w-[85%]">
                  Recorded: 5kg rice sold at ₹65/kg. Stock and today's sales total updated automatically.
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4">What it can actually do</h2>
          <div className="space-y-4 mb-8">
            {[
              { t: 'Stock management', d: 'Add, update, and track inventory levels just by describing what came in or went out.' },
              { t: 'Sales recording', d: 'Log each sale in plain Bengali — the AI calculates totals, profit, and updates stock in real time.' },
              { t: 'Customer credit (baki) tracking', d: 'Track who owes what, for how long, and record partial payments accurately.' },
              { t: 'Supplier and dues management', d: 'Keep track of what you owe suppliers and when payments are due.' },
              { t: 'Reports', d: 'Ask for daily, weekly, or monthly summaries in plain language — no spreadsheet needed.' },
            ].map((f, i) => (
              <div key={i} className="flex gap-4 p-5 bg-white border border-gray-100 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">{i + 1}</div>
                <div>
                  <div className="font-bold text-gray-900 mb-1">{f.t}</div>
                  <div className="text-gray-500 text-sm">{f.d}</div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Built for specific business types</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Rather than a one-size-fits-all tool, each business type gets a dedicated assistant tuned to its actual workflow:
          </p>
          <div className="grid grid-cols-2 gap-3 mb-8">
            {[
              ['🏪', 'General Stores (Dokan)'],
              ['💊', 'Pharmacies'],
              ['🍽️', 'Hotels & Dhabas'],
              ['🍬', 'Sweet Shops'],
              ['👗', 'Clothing Stores'],
            ].map(([icon, label], i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-indigo-50 rounded-xl">
                <span className="text-2xl">{icon}</span>
                <span className="font-semibold text-gray-800 text-sm">{label}</span>
              </div>
            ))}
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Why voice matters as much as text</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            During a busy hour in a shop, typing isn't always practical. Voice input lets a shop owner speak an entry while handling a customer, without stopping to type. This single feature is often the difference between a tool that gets used daily and one that gets abandoned after a week.
          </p>

          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 mb-10">
            <p className="text-emerald-800 font-bold text-base mb-2">💡 Who benefits most</p>
            <p className="text-emerald-700 text-sm leading-relaxed">
              Shop owners currently using a paper khata, anyone managing more than a handful of regular credit customers, and businesses that want daily sales/profit visibility without hiring a bookkeeper.
            </p>
          </div>

          <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Getting started</h2>
          <div className="space-y-3 mb-10">
            {[
              'Create a free account at sahayakai.tech',
              'Choose your business type from the Library',
              'Set your shop name and address',
              'Start speaking or typing in Bengali — that\'s it',
            ].map((s, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-gray-700 text-[15px] leading-relaxed">{s}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-10 mb-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Frequently Asked Questions</h2>
            <div className="space-y-5">
              {[
                { q: 'What is a Bengali AI business assistant?', a: 'It is software that understands spoken or typed Bengali and performs real business tasks — updating stock, recording sales, tracking customer credit — instead of requiring forms or English-only interfaces.' },
                { q: 'Do I need technical knowledge to use one?', a: 'No. You interact by speaking or typing in natural Bengali, the same way you would explain something to an employee.' },
                { q: 'Which businesses can use Sahayak AI?', a: 'General stores (dokan), pharmacies, hotels and dhabas, sweet shops, and clothing stores each have a dedicated assistant tailored to their specific workflow.' },
                { q: 'Does it work in both West Bengal and Bangladesh?', a: 'Yes, it supports both Indian Rupee (₹) and Bangladeshi Taka (৳), and understands regional Bengali dialects and Banglish (mixed Bengali-English).' },
              ].map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-5">
                  <p className="font-bold text-gray-900 mb-2">{faq.q}</p>
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>

        </article>

        <div className="bg-indigo-600 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-extrabold text-white mb-3">Try it free — no card required</h3>
          <p className="text-indigo-200 mb-6">Set up your business assistant in under 2 minutes.</p>
          <Link href="/library"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-50 transition-colors">
            Explore the Library →
          </Link>
        </div>

        <div className="flex justify-between mt-10 pt-8 border-t border-gray-100">
          <Link href="/blog" className="text-indigo-600 hover:underline text-sm flex items-center gap-1">
            <ArrowLeft size={14}/> All Blog Posts
          </Link>
          <Link href="/blog/digital-khata-vs-traditional-khata" className="text-indigo-600 hover:underline text-sm">
            Next post →
          </Link>
        </div>
      </div>
    </div>
  )
}
