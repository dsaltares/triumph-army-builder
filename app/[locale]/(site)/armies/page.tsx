import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ArmyIndexView } from '@/components/army/army-index';
import { ArmyIndexSkeleton } from '@/components/army/army-index-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('armies'),
});

export default async function ArmiesPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const { armies } = await reference.bundle.readArmyIndex();
  return (
    <>
      <PageHeader
        title={t('armies')}
        description={t('armiesDescription', {
          count: armies.length,
        })}
      />
      <Suspense fallback={<ArmyIndexSkeleton />}>
        <ArmyIndexView />
      </Suspense>
    </>
  );
}
