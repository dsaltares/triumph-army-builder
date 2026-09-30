import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ArmyRowsSkeleton } from '@/components/army/army-index-skeleton';
import { MyArmies } from '@/components/army/my-armies';
import { NewListAction } from '@/components/army/new-list-action';
import { SavedArmyCount } from '@/components/army/saved-army-count';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('myArmies'),
});

export default async function MyArmiesPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const { armies } = await reference.bundle.readArmyIndex();
  return (
    <>
      <PageHeader
        title={t('myArmies')}
        meta={<SavedArmyCount />}
        action={<NewListAction />}
      />
      <Suspense fallback={<ArmyRowsSkeleton />}>
        <MyArmies armyCount={armies.length} />
      </Suspense>
    </>
  );
}
