import { BRAND } from '@/lib/rv/brand'

/** GiftOps mark (gift box with a ribbon) + wordmark. `light` = for dark backgrounds. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label={BRAND.name}>
      <rect width="64" height="64" rx="15" fill="#74203d" />
      <rect x="16" y="29" width="32" height="22" rx="3" fill="#fff" />
      <rect x="12" y="23" width="40" height="9" rx="2.5" fill="#f6dce4" />
      <rect x="29" y="23" width="6" height="28" fill="#d6a63c" />
      <path d="M32 23c-2-8-11-9-11-3.5 0 3.2 6.5 3.5 11 3.5zM32 23c2-8 11-9 11-3.5 0 3.2-6.5 3.5-11 3.5z" fill="none" stroke="#d6a63c" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  )
}

export default function Logo({ light = false, size = 36, tagline = true }: { light?: boolean; size?: number; tagline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={light ? 'rounded-[15px] ring-1 ring-white/20' : ''}><LogoMark size={size} /></span>
      <div className="leading-tight">
        <div className={`text-xl font-extrabold tracking-tight ${light ? 'text-white' : 'text-rv-800'}`}>{BRAND.name}</div>
        {tagline && <div className={`text-[10px] uppercase tracking-[0.18em] ${light ? 'text-rv-300' : 'text-gray-400'}`}>by {BRAND.maker}</div>}
      </div>
    </div>
  )
}
