const BUSINESS_TYPES = [
  { emoji: '🏪', label: 'মুদি দোকান', sub: 'দোকানের যেকোনো পণ্য', bg: '#EEF2FF', ring: '#C7D2FE', icon: '#4F46E5' },
  { emoji: '💊', label: 'ফার্মেসি', sub: 'ওষুধ ও মেয়াদ ট্র্যাকিং', bg: '#ECFDF5', ring: '#A7F3D0', icon: '#059669' },
  { emoji: '🍽️', label: 'হোটেল / দাবা', sub: 'মেনু ও টেবিল অর্ডার', bg: '#FFFBEB', ring: '#FDE68A', icon: '#B45309' },
  { emoji: '🍬', label: 'মিষ্টির দোকান', sub: 'উৎপাদন ও উৎসব স্টক', bg: '#FDF2F8', ring: '#FBCFE8', icon: '#BE185D' },
  { emoji: '👗', label: 'কাপড়ের দোকান', sub: 'সাইজ ও সিজন প্ল্যানিং', bg: '#F5F3FF', ring: '#DDD6FE', icon: '#7C3AED' },
  { emoji: '🛠️', label: 'নিজের ব্যবসা', sub: 'কাস্টম AI এজেন্ট বানান', bg: '#FEF2F2', ring: '#FECACA', icon: '#DC2626' },
]

export default function BusinessTypeGallery() {
  return (
    <section className="py-12 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2 bengali">কারা ব্যবহার করতে পারেন?</h2>
          <p className="text-gray-500 text-sm bengali">যে কোনো বাংলা ব্যবসা ও বিভিন্ন ফিল্ডের জন্য পারফেক্ট</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {BUSINESS_TYPES.map((b, i) => (
            <div key={i}
              className="rounded-xl px-3 py-4 text-center border transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
              style={{ backgroundColor: b.bg, borderColor: b.ring }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg mx-auto mb-2 bg-white shadow-sm">
                {b.emoji}
              </div>
              <div className="font-bold text-[12px] bengali" style={{ color: b.icon }}>{b.label}</div>
              <div className="text-gray-500 text-[10px] bengali mt-0.5 leading-snug">{b.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
