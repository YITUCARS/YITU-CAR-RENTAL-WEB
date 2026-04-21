const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage — deal/banner images uploaded via admin
      { protocol: 'https', hostname: 'ytcdxpqfhnstgeqdzckv.supabase.co' },
      // Fallback / hardcoded deal images
      { protocol: 'https', hostname: 'www.arentalscar.com' },
      // External image URLs pasted in admin
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/rcm/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 's-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
    ]
  },
}

module.exports = withNextIntl(nextConfig)
