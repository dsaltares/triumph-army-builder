import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { FantasyCardReference } from '@/components/reference/fantasy-card-reference';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { readFantasyCardCatalogue } from '@/lib/data/fantasy-reference';
import { servedReference } from '@/lib/data/served-bundle';
import { routes } from '@/lib/navigation';

const describe = async (count: number) =>
  (await getTranslations('pages'))('fantasyBattleCardsDescription', { count });

export const generateMetadata = async (): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const catalogue =
    reference && (await readFantasyCardCatalogue(reference.bundle));
  const title = (await getTranslations('pages'))('fantasyBattleCards');
  const description =
    catalogue && (await describe(catalogue.naming.cards.length));
  return {
    title,
    description,
    openGraph: { title, description: description ?? undefined },
    twitter: { card: 'summary_large_image', title },
  };
};

export default async function FantasyBattleCardsPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const catalogue = await readFantasyCardCatalogue(reference.bundle);
  if (!catalogue) {
    notFound();
  }
  const t = await getTranslations('pages');
  return (
    <>
      <PageHeader
        back={{ href: routes.reference, label: t('reference') }}
        title={t('fantasyBattleCards')}
        description={await describe(catalogue.naming.cards.length)}
      />
      <FantasyCardReference {...catalogue} />
    </>
  );
}
