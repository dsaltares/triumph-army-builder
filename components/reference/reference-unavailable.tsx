import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/layout/page-header';
import { buttonVariants } from '@/components/ui/button';
import { routes } from '@/lib/navigation';

export function ReferenceUnavailable() {
  const t = useTranslations('pages');
  const nav = useTranslations('nav');
  return (
    <>
      <PageHeader
        title={t('referenceUnavailable')}
        description={t('referenceUnavailableText')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={routes.myArmies}
          className={buttonVariants({ size: 'touch' })}
        >
          {nav('myArmies')}
        </Link>
      </div>
    </>
  );
}
