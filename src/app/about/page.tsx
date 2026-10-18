import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About Us — Sahayak AI',
  description: 'Sahayak AI সম্পর্কে জানুন — বাংলার ব্যবসার বিশ্বস্ত সঙ্গী',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <section className="bg-white border-b border-gray-200 py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl mx-auto mb-6">স</div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-4 bengali">আমাদের সম্পর্কে</h1>
          <p className="text-xl text-gray-500 bengali leading-relaxed">
            বাংলার ব্যবসার বিশ্বস্ত সঙ্গী — Sahayak AI তৈরি হয়েছে বাংলার দোকানদার, ফার্মেসি মালিক, কোচিং সেন্টার এবং সকল ছোট ব্যবসায়ীর জন্য।
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 md:p-12 mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-6 bengali">আমাদের গল্প</h2>
            <div className="space-y-4 text-gray-600 bengali leading-relaxed text-[15px]">
              <p>Sahayak AI-এর জন্ম হয়েছে একটি সহজ পর্যবেক্ষণ থেকে — বাংলার লক্ষ লক্ষ ছোট ব্যবসায়ী প্রতিদিন হিসাব রাখেন নোটবুকে, বাকি মনে রাখেন মাথায়, আর সিদ্ধান্ত নেন অভিজ্ঞতার উপর ভিত্তি করে।</p>
              <p>তাদের জন্য কোনো digital tool নেই যা বাংলায় কথা বলে। সব SaaS product ইংরেজিতে বা হিন্দিতে। একজন বালিগঞ্জের মুদি দোকানদার বা সিলেটের ফার্মেসি মালিক — তাদের ভাষায়, তাদের বাস্তবতায় কোনো AI tool তৈরি হয়নি।</p>
              <p>আমরা সেই শূন্যস্থান পূরণ করতে এসেছি।</p>
            </div>
          </div>

          {/* Mission & Vision */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-indigo-600 rounded-2xl p-8 text-white">
              <div className="text-2xl mb-3">🎯</div>
              <h3 className="text-lg font-bold mb-3 bengali">আমাদের লক্ষ্য</h3>
              <p className="text-indigo-100 bengali text-sm leading-relaxed">বাংলার প্রতিটি ছোট ব্যবসায়ীর হাতে একটি AI সহায়ক পৌঁছে দেওয়া — তাদের নিজের ভাষায়, বিনামূল্যে।</p>
            </div>
            <div className="bg-gray-900 rounded-2xl p-8 text-white">
              <div className="text-2xl mb-3">🔭</div>
              <h3 className="text-lg font-bold mb-3 bengali">আমাদের দৃষ্টিভঙ্গি</h3>
              <p className="text-gray-300 bengali text-sm leading-relaxed">২০৩০ সালের মধ্যে ১০ লক্ষ Bengali SMB-কে AI-powered করা — West Bengal জুড়ে।</p>
            </div>
          </div>

          {/* Values */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-extrabold text-gray-900 mb-6 bengali">আমাদের মূল্যবোধ</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { icon: '🤝', title: 'বিশ্বাসযোগ্যতা', desc: 'কোনো fake data নেই, কোনো hidden charge নেই। সৎভাবে build করি।' },
                { icon: '🌍', title: 'Bengali-first', desc: 'প্রতিটি feature বাংলার মানুষের কথা মাথায় রেখে তৈরি।' },
                { icon: '🚀', title: 'সহজলভ্যতা', desc: 'Technology সবার জন্য — শুধু educated বা tech-savvy মানুষের জন্য নয়।' },
              ].map(v => (
                <div key={v.title} className="text-center">
                  <div className="text-3xl mb-3">{v.icon}</div>
                  <h3 className="font-bold text-gray-900 mb-2 bengali">{v.title}</h3>
                  <p className="text-gray-500 text-sm bengali leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Founder */}
          <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-extrabold text-gray-900 mb-6">Built by</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">D</div>
              <div>
                
                <div className="text-gray-500 text-sm">Founder, Sahayak AI & Evynta CRM</div>
                <div className="text-indigo-600 text-sm bengali mt-1">বাংলার জন্য, বাংলায় তৈরি</div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link href="/agents/new"
              className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-colors">
              <span className="bengali">আজই শুরু করুন</span> <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
