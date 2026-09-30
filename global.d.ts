import type { Locale } from './lib/i18n/routing.ts';
import type messages from './messages/en.json';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
