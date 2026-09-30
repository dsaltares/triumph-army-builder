import { defineRouting } from 'next-intl/routing';
import {
  defaultLocale,
  localeCookieMaxAge,
  localeCookieName,
  locales,
} from './locales.ts';

export * from './locales.ts';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'never',
  localeCookie: {
    name: localeCookieName,
    maxAge: localeCookieMaxAge,
    sameSite: 'lax',
  },
});
