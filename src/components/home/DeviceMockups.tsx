// Pure-CSS device frames for showcasing the dashboard/WhatsApp UI on the
// homepage — no screenshot images needed, so nothing to keep in sync with
// the real product UI, and no third-party image licensing concerns.

export function LaptopMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: '100%', maxWidth: 480 }}>
      {/* Screen */}
      <div className="rounded-t-2xl border-[10px] border-b-0 bg-gray-900 overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)]"
        style={{ borderColor: '#1F2328' }}>
        {/* camera dot */}
        <div className="flex justify-center pt-0.5 pb-1 bg-gray-900">
          <div className="w-1 h-1 rounded-full bg-gray-700" />
        </div>
        <div className="bg-white aspect-[16/10] overflow-hidden">{children}</div>
      </div>
      {/* Hinge + base */}
      <div className="h-[7px]" style={{ background: 'linear-gradient(to bottom, #3A3F47, #16181B)' }} />
      <div className="relative h-3 mx-[-14px] rounded-b-[10px] shadow-lg"
        style={{ background: 'linear-gradient(to bottom, #E2E4E7, #B8BCC2)' }}>
        <div className="absolute left-1/2 top-0 -translate-x-1/2 h-1.5 w-16 rounded-b-md" style={{ background: '#9CA1A8' }} />
      </div>
    </div>
  )
}

export function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto" style={{ width: 190 }}>
      <div className="relative rounded-[2.25rem] border-[8px] overflow-hidden shadow-[0_16px_40px_-8px_rgba(0,0,0,0.4)]"
        style={{ borderColor: '#1F2328', background: '#1F2328' }}>
        {/* dynamic-island style notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-4 bg-black rounded-full z-10" />
        <div className="bg-white overflow-hidden" style={{ aspectRatio: '9/19' }}>{children}</div>
      </div>
      {/* side buttons */}
      <div className="absolute -left-[9px] top-16 w-[3px] h-6 rounded-l-sm" style={{ background: '#1F2328' }} />
      <div className="absolute -left-[9px] top-24 w-[3px] h-9 rounded-l-sm" style={{ background: '#1F2328' }} />
      <div className="absolute -right-[9px] top-20 w-[3px] h-10 rounded-r-sm" style={{ background: '#1F2328' }} />
    </div>
  )
}
