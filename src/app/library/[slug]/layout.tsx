import type { Metadata } from 'next'

const APP_URL = 'https://sahayakai.tech'

const AGENTS: Record<string, { title: string; description: string }> = {
  'dokan-manager': { title: 'Dokan Manager: AI Stock and Sales for Grocery Stores', description: 'Bengali AI assistant for grocery and general stores: stock, sales, customer baki and reports by chat or voice.' },
  'pharmacy-assistant': { title: 'Pharmacy Assistant: AI Medicine Stock and Expiry Tracking', description: 'Bengali AI for pharmacies: medicine stock, expiry alerts and patient dues in one dashboard.' },
  'hotel-and-dhaba-manager': { title: 'Hotel and Dhaba Manager: AI for Restaurant Orders and Sales', description: 'Bengali AI for hotels and dhabas: table orders, daily sales and stock.' },
  'mishti-dokan-manager': { title: 'Mishti Dokan Manager: AI for Sweet Shops', description: 'Bengali AI for sweet shops: production planning, festival stock and daily sales.' },
  'kaporer-dokan-tracker': { title: 'Kaporer Dokan Tracker: AI for Clothing Stores', description: 'Bengali AI for clothing stores: stock tracking, sales and season planning.' },
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = AGENTS[params.slug]
  if (!a) return {}
  const url = `${APP_URL}/library/${params.slug}`
  return {
    title: a.title,
    description: a.description,
    alternates: { canonical: url },
    openGraph: { title: `${a.title} | Sahayak AI`, description: a.description, url, type: 'website' },
  }
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
