import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { TroopTypeTable } from '@/components/reference/troop-type-table';
import { servedReference } from '@/lib/data/served-bundle';
import { routes } from '@/lib/navigation';

const describe = async (count: number) =>
  (await getTranslations('pages'))('fantasyTroopTypesDescription', { count });

export const generateMetadata = async (): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const troopTypes = await reference?.bundle.readFantasyTroopTypes();
  const title = (await getTranslations('pages'))('fantasyTroopTypes');
  const description = troopTypes && (await describe(troopTypes.length));
  return {
    title,
    description,
    openGraph: { title, description: description ?? undefined },
    twitter: { card: 'summary_large_image', title },
  };
};

export default async function FantasyTroopTypesPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const troopTypes = await reference.bundle.readFantasyTroopTypes();
  if (!troopTypes) {
    notFound();
  }
  const t = await getTranslations('pages');
  return (
    <>
      <PageHeader
        back={{ href: routes.reference, label: t('reference') }}
        title={t('fantasyTroopTypes')}
        description={await describe(troopTypes.length)}
      />
      <TroopTypeTable troopTypes={troopTypes} />
    </>
  );
}
