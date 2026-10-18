import Link from 'next/link'
import { Mic, Send, Bot, Package, IndianRupee, Users, BarChart2, ArrowRight, Check } from 'lucide-react'

const LEFT_CARDS = [
  { icon: Package, title: 'স্টক ম্যানেজমেন্ট', sub: 'কখনো স্টক শেষ হবে না' },
  { icon: IndianRupee, title: 'হিসাব রাখা', sub: 'বিক্রি, খরচ, লাভ — সব সহজে' },
  { icon: Users, title: 'কাস্টমার ম্যানেজমেন্ট', sub: 'গ্রাহকের তথ্য ও বকেয়া' },
  { icon: BarChart2, title: 'রিপোর্ট ও বিশ্লেষণ', sub: 'দিন, সপ্তাহ, মাসের রিপোর্ট' },
]

const RIGHT_CARDS = [
  { icon: Package, title: 'স্টক আপডেট' },
  { icon: IndianRupee, title: 'হিসাব রাখুন' },
  { icon: Users, title: 'গ্রাহক যুক্ত করুন' },
  { icon: BarChart2, title: 'রিপোর্ট দেখুন' },
]

const BULLETS = [
  'ভয়েস বা টেক্সটে স্টক চেক ও আপডেট',
  'বিক্রি, খরচ ও লাভের হিসাব রাখা',
  'গ্রাহকের তালিকা, বকেয়া ও অর্ডার ম্যানেজ করুন',
  'দৈনিক, সাপ্তাহিক ও মাসিক রিপোর্ট পান',
  'বাংলায় কথা বললেই কাজ হয়ে যাবে',
]

function SideCard({ icon: Icon, title, sub }: { icon: any, title: string, sub?: string }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl px-3.5 py-2.5 shadow-sm border border-emerald-100">
      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
        <Icon size={16} />
      </div>
      <div>
        <div className="font-bold text-gray-900 text-[12px] bengali leading-tight">{title}</div>
        {sub && <div className="text-gray-400 text-[10.5px] bengali leading-snug">{sub}</div>}
      </div>
    </div>
  )
}

export default function WhatsAppShowcase() {
  return (
    <section className="py-16 px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 100%)' }}>
      <div className="max-w-6xl mx-auto relative z-10 grid lg:grid-cols-[1fr_auto_1fr] gap-8 items-center">

        {/* LEFT feature cards (desktop only) */}
        <div className="hidden lg:flex flex-col gap-3">
          {LEFT_CARDS.map((c, i) => <SideCard key={i} {...c} />)}
        </div>

        {/* CENTER: phone chat mockup */}
        <div className="mx-auto" style={{ width: 250 }}>
          <div className="rounded-[2rem] border-[8px] overflow-hidden shadow-2xl" style={{ borderColor: '#1F2328', background: '#1F2328' }}>
            <div className="relative bg-white">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-black rounded-full z-10" />
              {/* chat header */}
              <div className="flex items-center gap-2 px-3 pt-6 pb-2.5 border-b border-gray-100">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">স</div>
                <div>
                  <div className="font-bold text-gray-900 text-[11px] leading-none">Sahayak AI</div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-emerald-600 text-[9px]">Online</span>
                  </div>
                </div>
              </div>
              {/* chat body */}
              <div className="px-2.5 py-3 space-y-2 bg-gray-50" style={{ minHeight: 340 }}>
                <div className="flex justify-end">
                  <div className="bg-white border border-gray-100 rounded-xl rounded-tr-sm px-2.5 py-1.5 max-w-[80%]">
                    <p className="text-gray-800 text-[10.5px] bengali">আজ কতটা চাল আছে?</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={11} />
                  </div>
                  <div className="bg-emerald-50 rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[85%]">
                    <p className="text-gray-800 text-[10.5px] bengali leading-snug">
                      আপনার দোকানে বর্তমানে চাল আছে <b>৮৯ কেজি</b>। আগামী ৩ দিনে ২০ কেজি কমে যেতে পারে। নতুন স্টক অর্ডার করব?
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 pl-6">
                  <span className="text-[9px] bg-white border border-emerald-200 text-emerald-700 rounded-full px-2 py-1 bengali">স্টক আপডেট করুন</span>
                  <span className="text-[9px] bg-white border border-emerald-200 text-emerald-700 rounded-full px-2 py-1 bengali">অর্ডার দিন</span>
                </div>
                <div className="flex justify-end pt-1">
                  <div className="bg-white border border-gray-100 rounded-xl rounded-tr-sm px-2.5 py-1.5 max-w-[80%]">
                    <p className="text-gray-800 text-[10.5px] bengali">এ মাসের লাভ কত?</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot size={11} />
                  </div>
                  <div className="bg-emerald-50 rounded-xl rounded-tl-sm px-2.5 py-2 max-w-[85%]">
                    <p className="text-gray-500 text-[10px] bengali">এই মাসের মোট বিক্রি ₹৪৮,২৫০</p>
                    <p className="text-gray-500 text-[10px] bengali">মোট খরচ ₹৩২,১০০</p>
                    <p className="text-emerald-700 font-bold text-[11px] bengali mt-0.5">লাভ: ₹১৬,১৫০</p>
                  </div>
                </div>
              </div>
              {/* input bar */}
              <div className="flex items-center gap-2 px-2.5 py-2 border-t border-gray-100 bg-white">
                <Mic size={14} className="text-gray-400" />
                <div className="flex-1 bg-gray-50 rounded-full px-3 py-1.5 text-[9.5px] text-gray-400 bengali">বলুন বা টাইপ করুন...</div>
                <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center flex-shrink-0">
                  <Send size={11} className="text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT feature cards (desktop only) */}
        <div className="hidden lg:flex flex-col gap-3">
          {RIGHT_CARDS.map((c, i) => <SideCard key={i} {...c} />)}
        </div>
      </div>

      {/* text content below on all sizes */}
      <div className="max-w-2xl mx-auto text-center relative z-10 mt-10">
        <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Mic size={20} />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 bengali leading-snug">
          ভয়েস বা টেক্সটে আপনার ব্যবসার সব কাজ
        </h2>
        <p className="text-gray-500 text-sm bengali mb-6">
          স্টক, হিসাব, গ্রাহক — সব এখন AI এর সাথে, আরও সহজে
        </p>
        <ul className="text-left inline-block space-y-2 mb-7">
          {BULLETS.map((b, i) => (
            <li key={i} className="flex items-center gap-2.5 text-gray-700 text-[13px] bengali">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <Check size={11} />
              </span>
              {b}
            </li>
          ))}
        </ul>
        <div>
          <Link href="/library"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors bengali">
            শুরু করুন <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  )
}
