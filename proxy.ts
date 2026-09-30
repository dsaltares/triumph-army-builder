import type { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/lib/i18n/routing';

const negotiate = createMiddleware(routing);

const uncacheable = (response: NextResponse) => {
  response.headers.append('Vary', 'Cookie, Accept-Language');
  response.headers.set('Cache-Control', 'private, no-cache');
  return response;
};

export default function proxy(request: NextRequest) {
  return uncacheable(negotiate(request));
}

export const config = {
  matcher: ['/((?!api|_next|brand|icons|fonts|.*\\..*).*)'],
};
