import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { routes } from './lib/navigation.ts';

const isDevelopment = process.env.NODE_ENV === 'development';

const servedOverHttps = !!process.env.BETTER_AUTH_URL?.startsWith('https://');

const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDevelopment ? ["'unsafe-eval'"] : []),
];

const connectSrc = ["'self'", ...(isDevelopment ? ['ws:'] : [])];

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc.join(' ')}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const permissionsPolicy = [
  'accelerometer=()',
  'camera=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'usb=()',
].join(', ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: permissionsPolicy },
  ...(servedOverHttps
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  serverExternalPackages: [
    '@react-pdf/renderer',
    'better-sqlite3',
    'pino',
    'pino-pretty',
  ],
  outputFileTracingIncludes: {
    '/api/armies/[id]/sheet': [
      './node_modules/pdfkit/js/data/*.afm',
      './public/fonts/*.ttf',
    ],
    '/s/[id]/opengraph-image': ['./public/fonts/*.ttf'],
  },
  outputFileTracingExcludes: {
    '*': ['./node_modules/@ip-location-db/**'],
  },
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  redirects: async () => [
    { source: routes.home, destination: routes.myArmies, permanent: false },
  ],
};

export default withNextIntl(nextConfig);
