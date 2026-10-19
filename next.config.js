/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raahvia is the product home; the original Kaaj pages remain reachable at their own URLs
  async redirects() {
    return [
      { source: '/raahvia', destination: '/app', permanent: false },        // old bookmarks
      { source: '/raahvia/:path*', destination: '/app/:path*', permanent: false },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

module.exports = nextConfig
