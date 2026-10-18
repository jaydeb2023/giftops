import { Mic, MessageCircle, Package, Receipt, Users, Bell, BarChart2 } from 'lucide-react'

const FEATURES = [
  { icon: <Mic size={20} />, title: 'বাংলা Voice Assistant', sub: 'কথা বলুন, AI বুঝবে এবং কাজ করবে', color: '#4F46E5', bg: '#EEF2FF', ring: '#C7D2FE' },
  { icon: <MessageCircle size={20} />, title: 'WhatsApp Integration', sub: 'অর্ডার, বিল, রিমাইন্ডার সব WhatsApp-এ', color: '#059669', bg: '#ECFDF5', ring: '#A7F3D0' },
  { icon: <Package size={20} />, title: 'Stock Management', sub: 'রিয়েল টাইমে স্টক দেখুন ও আপডেট করুন', color: '#7C3AED', bg: '#F5F3FF', ring: '#DDD6FE' },
  { icon: <Receipt size={20} />, title: 'Billing ও GST ইনভয়েস', sub: 'এক ক্লিকে প্রফেশনাল বিল তৈরি', color: '#D97706', bg: '#FFFBEB', ring: '#FDE68A' },
  { icon: <Users size={20} />, title: 'Customer Management', sub: 'বাকি হিসাব ও কাস্টমার তথ্য এক জায়গায়', color: '#DB2777', bg: '#FDF2F8', ring: '#FBCFE8' },
  { icon: <Bell size={20} />, title: 'Automatic Reminders', sub: 'বাকি ও রিফিলের কথা মনে করিয়ে দেয়', color: '#DC2626', bg: '#FEF2F2', ring: '#FECACA' },
  { icon: <BarChart2 size={20} />, title: 'Business Dashboard', sub: 'বিক্রি, খরচ, লাভ-ক্ষতি বিস্তারিত রিপোর্ট', color: '#0891B2', bg: '#ECFEFF', ring: '#A5F3FC' },
]

export default function FeatureIconGrid() {
  return (
    <section className="py-12 px-4" style={{ backgroundColor: '#F8F7FB' }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 bengali">SahayakAI কী করতে পারে?</h2>
          <p className="text-gray-500 text-sm bengali">আপনার ব্যবসার প্রতিটি ধাপে পাশে থাকে আপনার AI সহকারী</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => (
            <div key={i}
              className="rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
              style={{ backgroundColor: f.bg, borderColor: f.ring }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-2.5 bg-white shadow-sm" style={{ color: f.color }}>
                {f.icon}
              </div>
              <h3 className="font-bold text-[12.5px] bengali mb-1" style={{ color: f.color }}>{f.title}</h3>
              <p className="text-gray-500 text-[11px] bengali leading-snug">{f.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
