import { createTranslator } from 'next-intl';
import type { ReactNode } from 'react';
import type { Locale } from './locales.ts';
import { messagesFor } from './messages.ts';

export type Words = ((
  key: string,
  values?: Record<string, string | number>,
) => string) & {
  rich: (
    key: string,
    tags: Record<string, (chunks: ReactNode) => ReactNode>,
  ) => ReactNode;
};

const made = new Map<string, Words>();

export const wordsFor = (locale: Locale, namespace: string): Words => {
  const cacheKey = `${locale}.${namespace}`;
  const existing = made.get(cacheKey);
  if (existing) {
    return existing;
  }
  const created = createTranslator({
    locale,
    messages: messagesFor(locale),
    namespace: namespace as never,
  }) as unknown as Words;
  made.set(cacheKey, created);
  return created;
};
