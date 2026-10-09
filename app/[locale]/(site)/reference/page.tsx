import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  ExternalLinkCard,
  LinkCard,
  LinkCardGrid,
} from '@/components/layout/link-card';
import { PageHeader } from '@/components/layout/page-header';
import { Section } from '@/components/layout/section';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';
import { externalLinks, routes } from '@/lib/navigation';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('reference'),
});

export default async function ReferencePage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const games = await getTranslations('games');
  const [troopTypes, battleCards, fantasyTroopTypes, fantasyBattleCards] =
    await Promise.all([
      reference.bundle.readTroopTypes(),
      reference.bundle.readBattleCards(),
      reference.bundle.readFantasyTroopTypes(),
      reference.bundle.readFantasyBattleCards(),
    ]);
  const sections = [
    {
      href: routes.troopTypes,
      title: t('troopTypes'),
      description: t('troopTypesCard', { count: troopTypes.length }),
    },
    {
      href: routes.battleCards,
      title: t('battleCards'),
      description: t('battleCardsCard', { count: battleCards.length }),
    },
  ];
  const fantasySections =
    fantasyTroopTypes && fantasyBattleCards
      ? [
          {
            href: routes.fantasyTroopTypes,
            title: t('fantasyTroopTypes'),
            description: t('fantasyTroopTypesCard', {
              count: fantasyTroopTypes.length,
            }),
          },
          {
            href: routes.fantasyBattleCards,
            title: t('fantasyBattleCards'),
            description: t('fantasyBattleCardsCard', {
              count: fantasyBattleCards.length,
            }),
          },
        ]
      : [];
  const documents = [
    {
      href: externalLinks.rules,
      title: t('rulesBook'),
      description: t('rulesBookCard'),
    },
    {
      href: externalLinks.fantasyRules,
      title: t('fantasyRulesBook'),
      description: t('fantasyRulesBookCard'),
    },
    {
      href: externalLinks.setupQrs,
      title: t('setupQrs'),
      description: t('setupQrsCard'),
    },
    {
      href: externalLinks.gameplayQrs,
      title: t('gameplayQrs'),
      description: t('gameplayQrsCard'),
    },
  ];
  return (
    <>
      <PageHeader
        title={t('reference')}
        description={t('referenceDescription', {
          troopTypes: troopTypes.length,
          battleCards: battleCards.length,
        })}
      />
      <Section
        title={games('triumph')}
        description={t('triumphReferenceDescription')}
      >
        <LinkCardGrid className="lg:grid-cols-2">
          {sections.map(({ href, title, description }) => (
            <LinkCard key={href} href={href} title={title}>
              {description}
            </LinkCard>
          ))}
        </LinkCardGrid>
      </Section>
      {fantasySections.length > 0 && (
        <Section
          title={games('fantasy')}
          description={t('fantasyReferenceDescription')}
        >
          <LinkCardGrid className="lg:grid-cols-2">
            {fantasySections.map(({ href, title, description }) => (
              <LinkCard key={href} href={href} title={title}>
                {description}
              </LinkCard>
            ))}
          </LinkCardGrid>
        </Section>
      )}
      <Section title={t('rules')} description={t('rulesDescription')}>
        <LinkCardGrid>
          {documents.map(({ href, title, description }) => (
            <ExternalLinkCard key={href} href={href} title={title}>
              {description}
            </ExternalLinkCard>
          ))}
        </LinkCardGrid>
      </Section>
    </>
  );
}
