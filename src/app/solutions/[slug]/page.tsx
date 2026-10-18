import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SEO_PAGES, getSeoPage } from '@/lib/seoPages'

const APP_URL = 'https://sahayakai.tech'

export function generateStaticParams() {
  return SEO_PAGES.map(p => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const page = getSeoPage(params.slug)
  if (!page) return {}
  const url = `${APP_URL}/solutions/${page.slug}`
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { title: `${page.title} | Sahayak AI`, description: page.description, url, type: 'website' },
  }
}

export default function SolutionPage({ params }: { params: { slug: string } }) {
  const page = getSeoPage(params.slug)
  if (!page) notFound()
  const url = `${APP_URL}/solutions/${page.slug}`

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url,
      inLanguage: ['en', 'bn'],
      isPartOf: { '@type': 'WebSite', name: 'Sahayak AI', url: APP_URL },
      about: { '@type': 'SoftwareApplication', name: 'Sahayak AI', url: APP_URL, applicationCategory: 'BusinessApplication' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: page.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
        { '@type': 'ListItem', position: 2, name: 'Solutions', item: `${APP_URL}/solutions` },
        { '@type': 'ListItem', position: 3, name: page.h1, item: url },
      ],
    },
  ]

  const related = page.related.map(getSeoPage).filter(Boolean) as typeof SEO_PAGES

  return (
    <div className="min-h-screen bg-white">
      {jsonLd.map((j, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />
      ))}

      <section className="px-4 pt-12 pb-14" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
        <div className="max-w-3xl mx-auto">
          <nav className="text-indigo-200 text-sm mb-6">
            <Link href="/" className="hover:text-white">Home</Link> / <Link href="/solutions" className="hover:text-white">Solutions</Link>
          </nav>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight mb-3">{page.h1}</h1>
          <p className="text-indigo-100 text-lg bengali">{page.bn}</p>
        </div>
      </section>

      <article className="max-w-3xl mx-auto px-4 py-10">
        <p className="text-gray-800 text-lg leading-relaxed mb-10">{page.answer}</p>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-4">What you can do</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {page.features.map(f => (
            <div key={f.title} className="border border-gray-200 rounded-2xl p-5">
              <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-4">How it works</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700 mb-10">
          {page.steps.map(s => <li key={s}>{s}</li>)}
        </ol>

        <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Frequently asked questions</h2>
        <div className="space-y-4 mb-10">
          {page.faqs.map(f => (
            <div key={f.q}>
              <h3 className="font-semibold text-gray-900">{f.q}</h3>
              <p className="text-gray-600 text-sm leading-relaxed mt-1">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-indigo-50 border border-indigo-100 p-6 text-center mb-10">
          <p className="font-bold text-indigo-900 mb-3 bengali">৭ দিনের ফ্রি ট্রায়াল শুরু করুন — কোনো কার্ড লাগবে না</p>
          <Link href="/subscribe" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm">Start free trial</Link>
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-3">Related</h2>
        <ul className="space-y-1.5">
          {related.map(r => (
            <li key={r.slug}><Link href={`/solutions/${r.slug}`} className="text-indigo-600 hover:underline">{r.h1}</Link></li>
          ))}
          <li><Link href="/library" className="text-indigo-600 hover:underline">Browse all AI business agents</Link></li>
        </ul>
      </article>
    </div>
  )
}
