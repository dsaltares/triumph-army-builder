import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { TroopTypeTable } from '@/components/reference/troop-type-table';
import { servedReference } from '@/lib/data/served-bundle';
import { routes } from '@/lib/navigation';

const describe = async (count: number) =>
  (await getTranslations('pages'))('troopTypesDescription', { count });

export const generateMetadata = async (): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const troopTypes = await reference?.bundle.readTroopTypes();
  return {
    title: (await getTranslations('pages'))('troopTypes'),
    description: troopTypes && (await describe(troopTypes.length)),
  };
};

export default async function TroopTypesPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const troopTypes = await reference.bundle.readTroopTypes();
  return (
    <>
      <PageHeader
        back={{ href: routes.reference, label: t('reference') }}
        title={t('troopTypes')}
        description={await describe(troopTypes.length)}
      />
      <TroopTypeTable troopTypes={troopTypes} />
    </>
  );
}
