import { Shield, Smartphone, Lock, MessageCircle } from 'lucide-react'

const REASONS = [
  { icon: <Shield size={18} />, label: '১০০% বাংলা সাপোর্ট', color: '#4F46E5' },
  { icon: <Smartphone size={18} />, label: 'মোবাইল সহজে ব্যবহার', color: '#059669' },
  { icon: <Lock size={18} />, label: 'নিরাপদ ও এনক্রিপ্টেড', color: '#7C3AED' },
  { icon: <MessageCircle size={18} />, label: 'দ্রুত সাপোর্ট', color: '#D97706' },
]

export default function WhySahayak() {
  return (
    <section className="py-14 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-center text-2xl font-extrabold text-gray-900 mb-8 bengali">কেন SahayakAI?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          {REASONS.map((r, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center" style={{ color: r.color }}>
                {r.icon}
              </div>
              <span className="text-gray-500 text-[12px] font-semibold bengali">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
