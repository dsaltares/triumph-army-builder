import english from '../../messages/en.json' with { type: 'json' };
import spanish from '../../messages/es.json' with { type: 'json' };
import { defaultLocale, type Locale } from './locales.ts';

export type Catalogue = typeof english;

const catalogues: Readonly<Record<Locale, unknown>> = {
  en: english,
  es: spanish,
};

const isBranch = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const overlay = (base: unknown, over: unknown): unknown => {
  if (!isBranch(base) || !isBranch(over)) {
    return over ?? base;
  }
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      key in over ? overlay(value, over[key]) : value,
    ]),
  );
};

export const messagesFor = (locale: Locale): Catalogue =>
  locale === defaultLocale
    ? english
    : (overlay(english, catalogues[locale]) as Catalogue);
