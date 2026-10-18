/** @type {import('next').NextConfig} */
const nextConfig = {
  // Raahvia is the product home; the original Kaaj pages remain reachable at their own URLs
  async redirects() {
    return [{ source: '/', destination: '/raahvia', permanent: false }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

module.exports = nextConfig
