import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Business Agents Library: Shop, Pharmacy, Hotel, Sweet Shop',
  description: 'Browse ready-made Bengali AI business agents for grocery stores, pharmacies, hotels and dhabas, sweet shops and clothing stores, or build your own.',
  alternates: { canonical: 'https://sahayakai.tech/library' },
}

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
