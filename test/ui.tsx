import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import {
  type OnUrlUpdateFunction,
  withNuqsTestingAdapter,
} from 'nuqs/adapters/testing';
import type { ReactElement, ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { messagesFor } from '@/lib/i18n/messages';
import { defaultLocale, type Locale } from '@/lib/i18n/routing';
export type UiOptions = {
  searchParams?: string;
  onUrlUpdate?: OnUrlUpdateFunction;
  wrap?: (children: ReactNode, locale: Locale) => ReactNode;
  locale?: Locale;
};

export const renderUi = (
  ui: ReactElement,
  {
    searchParams = '',
    onUrlUpdate,
    wrap,
    locale = defaultLocale,
  }: UiOptions = {},
) => {
  const NuqsAdapter = withNuqsTestingAdapter({
    searchParams,
    hasMemory: true,
    ...(onUrlUpdate ? { onUrlUpdate } : {}),
  });
  let spoken = locale;
  const rendered = render(ui, {
    wrapper: ({ children }) => (
      <NextIntlClientProvider locale={spoken} messages={messagesFor(spoken)}>
        <NuqsAdapter>
          <TooltipProvider>
            {wrap ? wrap(children, spoken) : children}
          </TooltipProvider>
        </NuqsAdapter>
      </NextIntlClientProvider>
    ),
  });
  return {
    user: userEvent.setup(),
    ...rendered,
    changeLocale: (next: Locale) => {
      spoken = next;
      rendered.rerender(ui);
    },
  };
};
