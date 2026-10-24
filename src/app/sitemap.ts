import { MetadataRoute } from 'next'

const SITE = 'https://giftops.evynta.in'

// Only GiftOps pages belong here. (The old Sahayak AI pages are not part of this site.)
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: SITE, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
