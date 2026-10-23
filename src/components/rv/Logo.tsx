import { BRAND } from "@/lib/rv/brand"

/** Small square gift-box mark (used where only an icon fits, e.g. footers). */
export function LogoMark({ size = 36 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/giftops-mark.png" width={size} height={size} alt={BRAND.name} className="rounded-xl" style={{ width: size, height: size }} />
}

/**
 * Full GiftOps logo (gift box + wordmark + tagline).
 * `light` = the logo sits on a dark background (sidebar), so it is placed on a white card
 * because the wordmark is dark navy.
 * `size` = base height in px.
 */
export default function Logo({ light = false, size = 36, tagline = true }: { light?: boolean; size?: number; tagline?: boolean }) {
  const h = tagline ? Math.round(size * 1.35) : size
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/giftops-logo.png" alt={`${BRAND.name} by ${BRAND.maker}`} style={{ height: h, width: "auto" }} className="block max-w-full object-contain" />
  )
  if (light) return <span className="inline-block rounded-xl bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-white/20">{img}</span>
  return img
}
