import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production'
const isDev  = !isProd

/** @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP */
const scriptSrc = [
  `'self'`,
  `'unsafe-inline'`,
  ...(isDev ? [`'unsafe-eval'`] : []),
  `https://*.firebaseio.com`,
  `https://*.googleapis.com`,
  `https://*.gstatic.com`,
  `https://apis.google.com`,
].join(' ')
const frameSrc = [
  `'self'`,
  `https://*.firebaseapp.com`,
  `https://apis.google.com`,
].join(' ')
const CSP = [
  `default-src 'self'`,
  `script-src ${scriptSrc}`,
  // Tailwind uses inline styles; style-src 'unsafe-inline' is required
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `connect-src 'self' https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com https://apis.google.com wss://*.firebaseio.com`,
  `frame-src ${frameSrc}`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ')

const nextConfig: NextConfig = {
  serverExternalPackages: ['firebase-admin'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control',    value: 'off' },
          ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
          { key: 'Content-Security-Policy',   value: CSP },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
};

export default nextConfig;
