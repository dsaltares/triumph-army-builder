import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';
import { SessionCacheReset } from '@/components/auth/session-cache-reset';
import { HydrationMarker } from '@/components/layout/hydration-marker';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PageViewBeacon } from '@/components/usage/page-view-beacon';
import { serverBaseUrl } from '@/lib/base-url';
import { appBackground, siteName } from '@/lib/brand';
import { routing } from '@/lib/i18n/routing';
import { TRPCReactProvider } from '@/lib/trpc/client';
import '@/app/globals.css';

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ibm-plex-sans',
});

export const generateMetadata = async (): Promise<Metadata> => {
  const description = (await getTranslations('pages'))('siteDescription');
  return {
    metadataBase: new URL(serverBaseUrl()),
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    description,
    openGraph: {
      type: 'website',
      siteName,
      title: siteName,
      description,
    },
  };
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: appBackground.light.css },
    { media: '(prefers-color-scheme: dark)', color: appBackground.dark.css },
  ],
};

export const generateStaticParams = () =>
  routing.locales.map((locale) => ({ locale }));

export default async function RootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={sans.variable} suppressHydrationWarning>
      <body className="min-h-dvh font-sans antialiased">
        <NextIntlClientProvider>
          <TRPCReactProvider>
            <NuqsAdapter>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <TooltipProvider>{children}</TooltipProvider>
                <Toaster />
                <PageViewBeacon />
                <SessionCacheReset />
                <HydrationMarker />
              </ThemeProvider>
            </NuqsAdapter>
          </TRPCReactProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
