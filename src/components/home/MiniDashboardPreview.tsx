export default function MiniDashboardPreview() {
  const stats = [
    { label: 'আজকের বিক্রি', value: '₹১২,৪৫০', color: '#4F46E5' },
    { label: 'রেকর্ড', value: '১৮', color: '#059669' },
    { label: 'কম স্টক', value: '৪২', color: '#DC2626' },
  ]
  const bars = [40, 65, 45, 80, 55, 90, 70]

  return (
    <div className="flex h-full text-[9px]">
      {/* Sidebar */}
      <div className="w-8 bg-gray-900 flex flex-col items-center gap-2.5 py-3 flex-shrink-0">
        <div className="w-4 h-4 rounded bg-indigo-500" />
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-3.5 h-3.5 rounded bg-white/10" />)}
      </div>
      {/* Content */}
      <div className="flex-1 p-2.5 bg-gray-50 overflow-hidden">
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded p-1.5 shadow-sm">
              <div className="font-extrabold" style={{ color: s.color, fontSize: 10 }}>{s.value}</div>
              <div className="text-gray-400 bengali" style={{ fontSize: 6 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded p-2 shadow-sm mb-1.5">
          <div className="flex items-end gap-1 h-10">
            {bars.map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-indigo-400" style={{ height: `${h}%`, opacity: 0.4 + i * 0.08 }} />
            ))}
          </div>
        </div>
        <div className="bg-white rounded p-1.5 shadow-sm space-y-1">
          {[1, 2].map(i => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-1.5 bg-gray-200 rounded-full" style={{ width: '40%' }} />
              <div className="h-1.5 bg-emerald-200 rounded-full" style={{ width: '20%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
