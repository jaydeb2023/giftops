export default function MiniWhatsAppPreview() {
  return (
    <div className="h-full flex flex-col text-[9px]" style={{ background: '#E5DDD5' }}>
      <div className="bg-emerald-600 text-white px-2.5 py-2 flex items-center gap-1.5 flex-shrink-0">
        <div className="w-4 h-4 rounded-full bg-white/30" />
        <div style={{ fontSize: 8 }} className="font-semibold bengali">আমার দোকান</div>
      </div>
      <div className="flex-1 p-2 space-y-1.5 overflow-hidden">
        <div className="bg-white rounded-lg rounded-tl-none px-2 py-1.5 w-[80%] shadow-sm bengali" style={{ fontSize: 7.5 }}>
          আপনার অর্ডার কনফার্ম হয়েছে। মোট: ₹১৮০ (২ টি রাইস বেগ + ১ টি তেল বোতল)
        </div>
        <div className="bg-emerald-100 rounded-lg rounded-tr-none px-2 py-1.5 w-[70%] ml-auto shadow-sm bengali" style={{ fontSize: 7.5 }}>
          ধন্যবাদ! WhatsApp-এ বিল পাঠান
        </div>
        <div className="bg-white rounded-lg rounded-tl-none px-2 py-1.5 w-[75%] shadow-sm flex items-center gap-1" style={{ fontSize: 7.5 }}>
          📄 <span>Bill_12345.pdf</span>
        </div>
      </div>
    </div>
  )
}
