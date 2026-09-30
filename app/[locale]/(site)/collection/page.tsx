import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ArmyRowsSkeleton } from '@/components/army/army-index-skeleton';
import { Collection } from '@/components/collection/collection';
import { PageHeader } from '@/components/layout/page-header';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('collection'),
});

export default async function CollectionPage() {
  const t = await getTranslations('pages');
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title={t('collection')} />
          <ArmyRowsSkeleton />
        </>
      }
    >
      <Collection />
    </Suspense>
  );
}
