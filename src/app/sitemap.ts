import { MetadataRoute } from 'next'
import { SEO_PAGES } from '@/lib/seoPages'

const APP_URL = 'https://sahayakai.tech'

const pages: { path: string; lastModified: string }[] = [
  { path: '', lastModified: '2026-09-25' },
  { path: '/solutions', lastModified: '2026-09-25' },
  ...SEO_PAGES.map(p => ({ path: `/solutions/${p.slug}`, lastModified: '2026-09-25' })),
  { path: '/library', lastModified: '2026-09-25' },
  { path: '/library/dokan-manager', lastModified: '2026-09-25' },
  { path: '/library/pharmacy-assistant', lastModified: '2026-09-25' },
  { path: '/library/hotel-and-dhaba-manager', lastModified: '2026-09-25' },
  { path: '/library/mishti-dokan-manager', lastModified: '2026-09-25' },
  { path: '/library/kaporer-dokan-tracker', lastModified: '2026-09-25' },
  { path: '/blog', lastModified: '2026-09-14' },
  { path: '/blog/dokaner-baki-hisab-rakhar-sohoj-upay', lastModified: '2026-09-14' },
  { path: '/blog/bengali-ai-business-assistant-guide', lastModified: '2026-09-14' },
  { path: '/blog/digital-khata-vs-traditional-khata', lastModified: '2026-09-14' },
  { path: '/blog/how-ai-helps-small-retail-businesses', lastModified: '2026-09-14' },
  { path: '/blog/dokan-manager-ai-guide', lastModified: '2026-05-27' },
  { path: '/blog/pharmacy-expiry-tracking', lastModified: '2026-05-27' },
  { path: '/blog/voice-input-bangla', lastModified: '2026-05-27' },
  { path: '/blog/hotel-dhaba-ai-guide', lastModified: '2026-05-27' },
  { path: '/blog/mishti-dokan-puja-stock', lastModified: '2026-05-27' },
  { path: '/blog/kapor-dokan-ai-guide', lastModified: '2026-05-27' },
  { path: '/about', lastModified: '2026-09-14' },
  { path: '/contact', lastModified: '2026-09-14' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map(p => ({ url: `${APP_URL}${p.path}`, lastModified: p.lastModified }))
}
