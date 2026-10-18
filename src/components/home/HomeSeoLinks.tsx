import Link from 'next/link'
import { SEO_PAGES } from '@/lib/seoPages'

export default function HomeSeoLinks() {
  return (
    <section className="py-14 px-4 bg-gray-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-3">
          Bengali AI business assistant for stock, billing, GST invoice and customers
        </h2>
        <p className="text-gray-600 mb-6 max-w-3xl">
          Sahayak AI is a Bengali AI business management software for small businesses in West Bengal and Bangladesh.
          Manage inventory, billing, GST invoices, customer credit and WhatsApp automation by chat or voice.
        </p>
        <div className="flex flex-wrap gap-2">
          {SEO_PAGES.map(p => (
            <Link key={p.slug} href={`/solutions/${p.slug}`}
              className="text-sm bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 text-gray-700 px-3.5 py-2 rounded-full transition-colors">
              {p.h1}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
