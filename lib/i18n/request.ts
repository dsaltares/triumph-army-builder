import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { messagesFor } from './messages.ts';
import { routing } from './routing.ts';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return { locale, messages: messagesFor(locale) };
});
