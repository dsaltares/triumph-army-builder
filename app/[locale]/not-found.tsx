import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { SiteShell } from '@/components/layout/site-shell';
import { buttonVariants } from '@/components/ui/button';
import { defaultLocale, isLocale, localeCookieName } from '@/lib/i18n/routing';
import { routes } from '@/lib/navigation';

// This renders outside the `[locale]` layout, so `setRequestLocale` has not
// run and there is no request locale to ask for. Reading the cookie is what
// the proxy would have done, and getting it wrong here would fall back to
// Next's own bare 404 rather than to English.
const words = async () => {
  const asked = (await cookies()).get(localeCookieName)?.value;
  return getTranslations({
    locale: isLocale(asked) ? asked : defaultLocale,
    namespace: 'pages',
  });
};

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await words())('notFound'),
});

export default async function NotFound() {
  const t = await words();
  return (
    <SiteShell>
      <PageHeader
        title={t('notFound')}
        description={t('notFoundDescription')}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={routes.armies}
          className={buttonVariants({ size: 'touch' })}
        >
          {t('browseArmyLists')}
        </Link>
      </div>
    </SiteShell>
  );
}
