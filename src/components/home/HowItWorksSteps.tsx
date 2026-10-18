import { Mic, Brain, FileCheck, CheckCircle2, ArrowRight } from 'lucide-react'

const STEPS = [
  { icon: <Mic size={20} />, title: 'বলুন', sub: '"২ কেজি চাল বিক্রি হয়েছে ১০০ টাকায়"', color: '#4F46E5', bg: '#EEF2FF', ring: '#C7D2FE' },
  { icon: <Brain size={20} />, title: 'AI বুঝবে', sub: 'বাংলায় বুঝে, ঠিক তথ্য নেয়', color: '#7C3AED', bg: '#F5F3FF', ring: '#DDD6FE' },
  { icon: <FileCheck size={20} />, title: 'সেটা সংরক্ষণ করে', sub: 'স্টক, বিক্রি, বাকি সব রেকর্ড হয়', color: '#D97706', bg: '#FFFBEB', ring: '#FDE68A' },
  { icon: <CheckCircle2 size={20} />, title: 'কাজ সম্পন্ন হয়', sub: 'বিল WhatsApp-এ, রিপোর্ট রেডি', color: '#059669', bg: '#ECFDF5', ring: '#A7F3D0' },
]

export default function HowItWorksSteps() {
  return (
    <section className="py-12 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 bengali">কীভাবে কাজ করে?</h2>
          <p className="text-gray-500 text-sm bengali">চারটি সহজ স্টেপে, কোনো টেকনিকাল জ্ঞান লাগবে না</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2.5">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2.5 flex-1">
              <div className="relative flex-1 rounded-xl border p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-md"
                style={{ backgroundColor: s.bg, borderColor: s.ring }}>
                <div className="absolute top-2.5 left-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: s.color }}>
                  {i + 1}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2.5 bg-white shadow-sm" style={{ color: s.color }}>
                  {s.icon}
                </div>
                <div className="font-bold text-[12.5px] bengali mb-1" style={{ color: s.color }}>{s.title}</div>
                <p className="text-gray-500 text-[10.5px] bengali leading-snug">{s.sub}</p>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight size={16} className="hidden sm:block text-gray-300 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
