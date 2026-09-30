export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeCookieName = 'locale';

export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export const formattingLocales: Readonly<Record<Locale, string>> = {
  en: 'en-GB',
  es: 'es-ES',
};

export const localeNames: Readonly<Record<Locale, string>> = {
  en: 'English',
  es: 'Español',
};

export const localeFlags: Readonly<Record<Locale, string>> = {
  en: '\u{1F1EC}\u{1F1E7}',
  es: '\u{1F1EA}\u{1F1F8}',
};

export const isLocale = (value: unknown): value is Locale =>
  locales.includes(value as Locale);
