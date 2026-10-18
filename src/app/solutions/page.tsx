import type { Metadata } from 'next'
import Link from 'next/link'
import { SEO_PAGES } from '@/lib/seoPages'

export const metadata: Metadata = {
  title: 'Solutions: Bengali AI for Business Management',
  description: 'Bengali AI business assistant, stock management, billing, GST invoice, customer management and WhatsApp automation for small businesses.',
  alternates: { canonical: 'https://sahayakai.tech/solutions' },
}

export default function SolutionsIndex() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">Sahayak AI Solutions</h1>
        <p className="text-gray-600 mb-8">Everything a small business needs, managed in Bengali with AI.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {SEO_PAGES.map(p => (
            <Link key={p.slug} href={`/solutions/${p.slug}`} className="border border-gray-200 hover:border-indigo-300 rounded-2xl p-5 block transition-colors">
              <h2 className="font-bold text-gray-900 mb-1">{p.h1}</h2>
              <p className="text-gray-500 text-sm">{p.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
