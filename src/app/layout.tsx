import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import AnnouncementBar from '@/components/AnnouncementBar'
import { LanguageProvider } from '@/lib/LanguageContext'

const inter = Inter({ subsets: ['latin'] })

const APP_URL = 'https://sahayakai.tech'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Sahayak AI — সহায়ক AI | বাংলার ব্যবসার বিশ্বস্ত AI সঙ্গী',
    template: '%s | Sahayak AI',
  },
  description:
    'বাংলায় কথা বলুন, AI কাজ করবে। দোকান, ফার্মেসি, কোচিং সেন্টার, হোটেল — সব ধরনের বাংলা ব্যবসার জন্য AI এজেন্ট। Sahayak AI is the #1 Bengali AI assistant for small businesses in West Bengal and Bangladesh.',
  keywords: [
    // existing
    'Bengali AI', 'বাংলা AI', 'Sahayak AI', 'সহায়ক AI',
    'Bengali chatbot', 'বাংলা chatbot', 'shop management AI',
    'দোকান ম্যানেজার AI', 'pharmacy AI Bengali', 'ফার্মেসি AI',
    'coaching management AI', 'AI for small business India',
    'West Bengal AI', 'Bangladesh AI assistant',
    'Bengali business assistant', 'AI agent Bengali',
    // primary
    'Bengali AI business assistant', 'Bengali AI business management',
    'AI business management software', 'AI for small businesses',
    // feature
    'AI stock management', 'inventory management software', 'business billing software',
    'GST invoice software', 'customer management software',
    'WhatsApp automation for business', 'AI business agents',
    // general
    'AI business assistant', 'business management software', 'business automation',
    'stock management', 'inventory management', 'billing software', 'GST invoice',
    'customer management', 'sales management', 'payment management',
    'WhatsApp automation', 'AI agents', 'Bengali SaaS',
    'small business software', 'business software India',
  ],
  authors: [{ name: 'Sahayak AI', url: APP_URL }],
  creator: 'Sahayak AI',
  publisher: 'Sahayak AI',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'bn_IN',
    alternateLocale: ['en_IN', 'bn_BD'],
    url: APP_URL,
    siteName: 'Sahayak AI',
    title: 'Sahayak AI — সহায়ক AI | বাংলার ব্যবসার বিশ্বস্ত AI সঙ্গী',
    description: 'বাংলায় কথা বলুন, AI কাজ করবে। দোকান, ফার্মেসি, কোচিং — সব ব্যবসার জন্য AI এজেন্ট।',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Sahayak AI — Bengali AI Assistant for Business' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@sahayakai_tech',
    creator: '@sahayakai_tech',
    title: 'Sahayak AI — সহায়ক AI | বাংলায় বলুন, AI কাজ করবে',
    description: 'বাংলার দোকান, ফার্মেসি, হোটেল — সব বাংলায় AI দিয়ে ম্যানেজ করুন। সম্পূর্ণ বিনামূল্যে।',
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
  verification: {
    google: '_olLK_pNN_2pUXFIxUYX3Pqf0OpEodMXC0LSyAbOwDw',
  },
  category: 'technology',
}

export const viewport = {
  themeColor: '#4F46E5',
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Sahayak AI',
    alternateName: ['সহায়ক AI', 'Sahayak AI Bengali', 'Bengali AI Business Assistant'],
    url: APP_URL,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    description: 'Sahayak AI is the first Bengali-language AI assistant for small business owners in West Bengal and Bangladesh. Manage stock, sales, credit, and reports by speaking Bengali. Completely free.',
    inLanguage: ['bn', 'en'],
    availableLanguage: [{ '@type': 'Language', name: 'Bengali', alternateName: 'bn' }, { '@type': 'Language', name: 'English', alternateName: 'en' }],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
    provider: { '@type': 'Organization', name: 'Sahayak AI', url: APP_URL, sameAs: ['https://x.com/sahayakai_tech'] },
    featureList: ['Bengali voice input', 'Real-time stock tracking', 'Sales recording', 'Credit ledger', 'Business reports', 'Free forever'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Sahayak AI',
    alternateName: 'সহায়ক AI',
    url: APP_URL,
    logo: `${APP_URL}/logo.png`,
    sameAs: ['https://x.com/sahayakai_tech'],
    description: 'Bengali AI assistant for small businesses in West Bengal and Bangladesh.',
    areaServed: [{ '@type': 'State', name: 'West Bengal', containedIn: 'India' }, { '@type': 'Country', name: 'Bangladesh' }],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Sahayak AI',
    url: APP_URL,
    inLanguage: 'bn',
    potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${APP_URL}/library?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Sahayak AI Bengali Business Libraries',
    description: '5 specialized AI libraries for Bengali small businesses',
    numberOfItems: 5,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Dokan Manager — দোকান ম্যানেজার', url: `${APP_URL}/library/dokan-manager`, description: 'AI stock and sales manager for grocery and general shops in Bengali' },
      { '@type': 'ListItem', position: 2, name: 'Hotel & Dhaba Manager — হোটেল ম্যানেজার', url: `${APP_URL}/library/hotel-and-dhaba-manager`, description: 'Bengali AI for restaurant and dhaba table orders and daily sales' },
      { '@type': 'ListItem', position: 3, name: 'Mishti Dokan Manager — মিষ্টির দোকান', url: `${APP_URL}/library/mishti-dokan-manager`, description: 'Bengali AI for sweet shop production planning and festival stock' },
      { '@type': 'ListItem', position: 4, name: 'Kaporer Dokan Tracker — কাপড়ের দোকান', url: `${APP_URL}/library/kaporer-dokan-tracker`, description: 'Bengali AI for clothing store stock tracking and season planning' },
      { '@type': 'ListItem', position: 5, name: 'Pharmacy Assistant — ফার্মেসি সহায়ক', url: `${APP_URL}/library/pharmacy-assistant`, description: 'Bengali AI for medicine stock, expiry alerts, and patient records' },
    ],
  },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap" rel="stylesheet" />
        {Array.isArray(jsonLd) ? jsonLd.map((item, i) => (<script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }} />)) : (<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />)}
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
