import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Clock } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Blog — বাংলা ব্যবসার AI গাইড | Sahayak AI',
  description: 'Sahayak AI Blog — বাংলায় ব্যবসার টিপস, AI গাইড, দোকান ম্যানেজমেন্ট, ফার্মেসি, হোটেল — সব ধরনের Bengali business tips।',
  keywords: ['Bengali business blog', 'বাংলা ব্যবসার টিপস', 'দোকান AI গাইড', 'ফার্মেসি AI', 'হোটেল AI', 'Bengali AI tips', 'Sahayak AI blog'],
  alternates: { canonical: 'https://sahayakai.tech/blog' },
  openGraph: { title: 'Sahayak AI Blog — বাংলা ব্যবসার AI গাইড', description: 'Bengali business tips, AI guides, product updates — সম্পূর্ণ বাংলায়।', url: 'https://sahayakai.tech/blog', type: 'website' },
}

const POSTS = [
  {
    slug: '/blog/dokaner-baki-hisab-rakhar-sohoj-upay',
    category: 'ডিজিটাল খাতা', categoryColor: 'bg-emerald-50 text-emerald-700',
    date: 'সেপ্টেম্বর ২০২৬', readTime: '৬ মিনিট', icon: '📒',
    accent: '#059669',
    title: 'দোকানের বাকি হিসাব রাখার সহজ উপায়',
    excerpt: 'খাতায় বাকি হিসাব রাখার ঝামেলা থেকে মুক্তি — বাংলায় বলেই AI দিয়ে বাকির হিসাব নির্ভুলভাবে রাখুন, সম্পূর্ণ বিনামূল্যে।',
  },
  {
    slug: '/blog/bengali-ai-business-assistant-guide',
    category: 'English Guide', categoryColor: 'bg-indigo-50 text-indigo-700',
    date: 'September 2026', readTime: '6 min', icon: '🤖',
    accent: '#4F46E5',
    title: 'Bengali AI Business Assistant for Small Businesses',
    excerpt: 'What a Bengali-first AI assistant actually does, and how shop owners across Bengal and Bangladesh use it every day.',
  },
  {
    slug: '/blog/digital-khata-vs-traditional-khata',
    category: 'Comparison', categoryColor: 'bg-sky-50 text-sky-700',
    date: 'September 2026', readTime: '7 min', icon: '📊',
    accent: '#0369A1',
    title: 'Digital Khata vs Traditional Khata: Which Is Better in 2026?',
    excerpt: 'An honest, detailed comparison of paper khata and digital khata for small shop owners — with a clear recommendation.',
  },
  {
    slug: '/blog/how-ai-helps-small-retail-businesses',
    category: 'English Guide', categoryColor: 'bg-orange-50 text-orange-700',
    date: 'September 2026', readTime: '5 min', icon: '💡',
    accent: '#EA580C',
    title: 'How AI Can Help Small Retail Businesses Save Time and Money',
    excerpt: 'Real, practical ways small shop owners use AI daily — inventory, credit tracking, and reports, explained simply.',
  },
  {
    slug: '/blog/dokan-manager-ai-guide',
    category: 'গাইড', categoryColor: 'bg-indigo-50 text-indigo-700',
    date: 'এপ্রিল ২০২৬', readTime: '৫ মিনিট', icon: '🏪',
    accent: '#4F46E5',
    title: 'আপনার মুদি দোকানের হিসাব AI দিয়ে কীভাবে রাখবেন',
    excerpt: 'Dokan Manager AI দিয়ে রোজের বিক্রি, স্টক এবং বাকির হিসাব মাত্র ৫ মিনিটে রাখুন — সম্পূর্ণ বাংলায়।',
  },
  {
    slug: '/blog/pharmacy-expiry-tracking',
    category: 'Tips', categoryColor: 'bg-sky-50 text-sky-700',
    date: 'এপ্রিল ২০২৬', readTime: '৪ মিনিট', icon: '💊',
    accent: '#0284C7',
    title: 'ফার্মেসিতে ওষুধের মেয়াদ track করার সহজ উপায়',
    excerpt: 'Pharmacy Assistant AI কীভাবে expiry alert দেয়, supplier reorder remind করে — একটি ফার্মেসি মালিকের real experience।',
  },
  {
    slug: '/blog/voice-input-bangla',
    category: 'Product Update', categoryColor: 'bg-violet-50 text-violet-700',
    date: 'এপ্রিল ২০২৬', readTime: '৩ মিনিট', icon: '🎤',
    accent: '#7C3AED',
    title: 'নতুন feature: বাংলায় voice input এখন available',
    excerpt: 'টাইপ না করেও AI-এর সাথে কথা বলতে পারবেন — বাংলায় বা ইংরেজিতে। Hands-free দোকান ম্যানেজমেন্ট।',
  },
  {
    slug: '/blog/hotel-dhaba-ai-guide',
    category: 'গাইড', categoryColor: 'bg-orange-50 text-orange-700',
    date: 'মে ২০২৬', readTime: '৫ মিনিট', icon: '🍽️',
    accent: '#EA580C',
    title: 'হোটেল ও ধাবার সব হিসাব AI দিয়ে রাখুন বাংলায়',
    excerpt: 'টেবিল অর্ডার, মেনু খরচ, রান্নাঘরের স্টক, দৈনিক বিক্রি — সব এক জায়গায় বাংলায়।',
  },
  {
    slug: '/blog/mishti-dokan-puja-stock',
    category: 'ব্যবসা', categoryColor: 'bg-fuchsia-50 text-fuchsia-700',
    date: 'মে ২০২৬', readTime: '৬ মিনিট', icon: '🍬',
    accent: '#C026D3',
    title: 'পূজার আগে মিষ্টির দোকানের স্টক AI দিয়ে প্ল্যান করুন',
    excerpt: 'Mishti Dokan AI দিয়ে পূজার স্টক পরিকল্পনা, ছানার হিসাব, মেয়াদ সতর্কতা — সব বাংলায় স্বয়ংক্রিয়ভাবে।',
  },
  {
    slug: '/blog/kapor-dokan-ai-guide',
    category: 'গাইড', categoryColor: 'bg-purple-50 text-purple-700',
    date: 'মে ২০২৬', readTime: '৫ মিনিট', icon: '👗',
    accent: '#7C3AED',
    title: 'কাপড়ের দোকানের স্টক ও বিক্রি AI দিয়ে ট্র্যাক করুন',
    excerpt: 'শাড়ি, সালোয়ার, পাঞ্জাবি — সব stock বাংলায় AI দিয়ে। পূজার season planning থেকে supplier payment।',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'Sahayak AI Blog',
  description: 'Bengali business tips, AI guides for small businesses in West Bengal and Bangladesh',
  url: 'https://sahayakai.tech/blog',
  inLanguage: 'bn',
  publisher: { '@type': 'Organization', name: 'Sahayak AI', url: 'https://sahayakai.tech' },
  blogPost: POSTS.map(p => ({
    '@type': 'BlogPosting',
    headline: p.title,
    description: p.excerpt,
    url: `https://sahayakai.tech${p.slug}`,
    inLanguage: 'bn',
    author: { '@type': 'Organization', name: 'Sahayak AI' },
  })),
}

export default function BlogPage() {
  return (
    <div className="min-h-screen" style={{ background: '#fafaf8' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="bg-white border-b border-gray-100 py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-indigo-700 text-xs font-bold px-4 py-2 rounded-full border border-indigo-200 bg-indigo-50 mb-6 bengali">
            ✍️ বাংলা ব্যবসার AI গাইড
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-3 bengali">Blog & Updates</h1>
          <p className="text-gray-400 bengali text-lg">Bengali ব্যবসার টিপস, AI গাইড, এবং product আপডেট</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-14">

        <Link href={POSTS[0].slug} className="block group mb-10">
          <div className="rounded-2xl overflow-hidden border border-gray-100 hover:border-indigo-200 hover:shadow-lg transition-all bg-white">
            <div className="h-2 w-full" style={{ background: `linear-gradient(135deg, ${POSTS[0].accent}, #7C3AED)` }} />
            <div className="p-8 flex items-start gap-6">
              <div className="text-5xl flex-shrink-0">{POSTS[0].icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${POSTS[0].categoryColor}`}>{POSTS[0].category}</span>
                  <span className="text-gray-400 text-xs bengali">{POSTS[0].date}</span>
                  <span className="flex items-center gap-1 text-gray-400 text-xs bengali"><Clock size={10}/> {POSTS[0].readTime}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-gray-900 mb-3 bengali group-hover:text-indigo-600 transition-colors">{POSTS[0].title}</h2>
                <p className="text-gray-500 bengali text-sm leading-relaxed mb-4">{POSTS[0].excerpt}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 bengali">পড়ুন <ArrowRight size={14}/></span>
              </div>
            </div>
          </div>
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {POSTS.slice(1).map((post, i) => (
            <Link key={i} href={post.slug}
              className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:border-gray-200 hover:shadow-md transition-all">
              <div className="h-1.5 w-full" style={{ background: post.accent }} />
              <div className="p-6">
                <div className="text-3xl mb-4">{post.icon}</div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${post.categoryColor}`}>{post.category}</span>
                  <span className="text-gray-400 text-xs bengali">{post.date}</span>
                </div>
                <h3 className="font-bold text-gray-900 text-[15px] mb-2 bengali leading-snug group-hover:text-indigo-600 transition-colors">{post.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed bengali mb-4 line-clamp-2">{post.excerpt}</p>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-400 text-xs bengali"><Clock size={10}/> {post.readTime}</span>
                  <span className="text-indigo-600 text-xs font-bold flex items-center gap-1 group-hover:gap-2 transition-all bengali">পড়ুন <ArrowRight size={11}/></span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-8 text-center">
          <p className="text-white font-bold text-lg bengali mb-2">আরো blog post আসছে শীঘ্রই</p>
          <p className="text-indigo-200 bengali text-sm mb-5">নতুন post-এর notification পেতে আমাদের follow করুন।</p>
          <a href="https://x.com/sahayakai_tech" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">
            @sahayakai_tech follow করুন →
          </a>
        </div>

      </div>
    </div>
  )
}
