import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Raahvia CRM', template: '%s | Raahvia CRM' },
  description: 'Raahvia gift fulfilment platform: leads, orders with many recipients, delivery, proof of delivery, invoices and collections.',
  robots: { index: false, follow: false },
  manifest: undefined,
}

export default function RaahviaLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>
}
