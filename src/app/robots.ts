import { MetadataRoute } from 'next'

// Old Sahayak AI sections and the private app are kept out of search results.
const PRIVATE = ['/app', '/api/', '/auth/', '/admin', '/dashboard', '/team', '/welcome', '/subscribe', '/login',
  '/blog', '/solutions', '/library', '/agents', '/catalog', '/branches', '/about', '/contact']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: PRIVATE }],
    sitemap: 'https://giftops.evynta.in/sitemap.xml',
    host: 'https://giftops.evynta.in',
  }
}
