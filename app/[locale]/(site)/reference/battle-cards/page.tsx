import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/layout/page-header';
import { BattleCardReference } from '@/components/reference/battle-card-reference';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';
import { routes } from '@/lib/navigation';

const describe = async (count: number) =>
  (await getTranslations('pages'))('battleCardsDescription', { count });

export const generateMetadata = async (): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const cards = await reference?.bundle.readBattleCards();
  return {
    title: (await getTranslations('pages'))('battleCards'),
    description: cards && (await describe(cards.length)),
  };
};

export default async function BattleCardsPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const [cards, text] = await Promise.all([
    reference.bundle.readBattleCards(),
    reference.bundle.readBattleCardText(),
  ]);
  return (
    <>
      <PageHeader
        back={{ href: routes.reference, label: t('reference') }}
        title={t('battleCards')}
        description={await describe(cards.length)}
      />
      <BattleCardReference cards={cards} text={text} />
    </>
  );
}
