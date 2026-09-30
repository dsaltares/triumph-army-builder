import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ClaimNotice } from '@/components/auth/claim-notice';
import { InstallPrompt } from '@/components/layout/install-prompt';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';

const mainContentId = 'main-content';

export function SiteShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${mainContentId}`}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:ring-2 focus:ring-ring"
      >
        {t('skipToContent')}
      </a>
      <SiteHeader />
      <main
        id={mainContentId}
        className="content-container flex flex-1 flex-col gap-section py-page"
      >
        {children}
      </main>
      <InstallPrompt />
      <SiteFooter />
      <ClaimNotice />
    </div>
  );
}
