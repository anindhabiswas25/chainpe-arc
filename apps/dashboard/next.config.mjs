// Docs live in the landing app (fumadocs, apps/landing/content/docs). The old
// built Docusaurus bundle that used to be served from public/docs is gone, so
// /docs redirects there.
const DOCS_URL = (process.env.DOCS_URL ?? 'https://chainpe.xyz/docs').replace(/\/$/, '')

// The browser talks only to the Arc Testnet RPC (balances, logs, receipts).
// Indexer + facilitator are fetched server-side, so they don't need to be here.
const ARC_RPC_ORIGIN = new URL(process.env.NEXT_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.io').origin

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval required by Next.js dev
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              `connect-src 'self' ${ARC_RPC_ORIGIN}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
  async redirects() {
    return [
      { source: '/docs', destination: DOCS_URL, permanent: false },
      { source: '/docs/:path*', destination: `${DOCS_URL}/:path*`, permanent: false },
    ]
  },
}

export default nextConfig
