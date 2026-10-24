import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AnnouncementBar from '@/components/AnnouncementBar'
import { LanguageProvider } from '@/lib/LanguageContext'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = 'https://giftops.evynta.in'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'GiftOps by Evynta | Gift delivery business management software',
    template: '%s | GiftOps',
  },
  description:
    'GiftOps is gift delivery business management software for India: leads, orders, bulk recipient upload, automatic address follow-up, packing, delivery with photo proof, GST invoices and profit reports. Built by Evynta.',
  keywords: [
    'gift delivery software', 'gift business management software', 'corporate gifting software',
    'bulk gift delivery management', 'festival hamper order management', 'gift order management system',
    'gifting CRM India', 'bulk recipient upload Excel', 'delivery proof of delivery photo',
    'GST invoice software for gift business', 'GiftOps', 'Evynta',
  ],
  authors: [{ name: 'Evynta', url: APP_URL }],
  creator: 'Evynta',
  publisher: 'Evynta',
  applicationName: 'GiftOps',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: APP_URL,
    siteName: 'GiftOps',
    title: 'GiftOps by Evynta | Gift delivery business management software',
    description: 'From first enquiry to final payment. One system for your entire gift business.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'GiftOps - Gift Delivery Business Management Software' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GiftOps by Evynta | Gift delivery business management software',
    description: 'Leads, orders, bulk recipients, delivery with photo proof, GST invoices and profit reports in one system.',
    images: ['/og-image.png'],
  },
  alternates: { canonical: APP_URL },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
  // Google Search Console HTML-tag verification: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in Vercel (optional if you verify by DNS)
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } : undefined,
  category: 'technology',
}

export const viewport = {
  themeColor: '#74203d',
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${APP_URL}/#organization`,
    name: 'Evynta',
    url: 'https://evynta.in',
    sameAs: ['https://evynta.in'],
    logo: `${APP_URL}/evynta-logo-dark.png`,
    description: 'Evynta is an Indian AI, web and data solutions company. It builds GiftOps, gift delivery business management software.',
    areaServed: { '@type': 'Country', name: 'India' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${APP_URL}/#website`,
    name: 'GiftOps',
    alternateName: 'GiftOps by Evynta',
    url: APP_URL,
    inLanguage: 'en-IN',
    publisher: { '@id': `${APP_URL}/#organization` },
  },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {jsonLd.map((item, i) => (<script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item).replace(/</g, '\\u003c') }} />))}
      </head>
<body className={inter.className}>
  <LanguageProvider>
    <AnnouncementBar />
    <Navbar />
    <main>{children}</main>
    <Footer />
    <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
  </LanguageProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function () {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
