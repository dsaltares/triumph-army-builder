import { getLocale, getTranslations } from 'next-intl/server';
import { ogCardImage, ogContentType, ogSize } from '@/components/og/og-card';
import { readFantasyCardCatalogue } from '@/lib/data/fantasy-reference';
import { servedReference } from '@/lib/data/served-bundle';
import { fantasyGameName } from '@/lib/domain/games/fantasy';

export const size = ogSize;

export const contentType = ogContentType;

export const alt = 'The Fantasy Triumph battle cards';

export default async function FantasyBattleCardsImage() {
  const t = await getTranslations('pages');
  const reference = await servedReference(await getLocale());
  const catalogue =
    reference && (await readFantasyCardCatalogue(reference.bundle));
  return ogCardImage({
    title: t('fantasyBattleCards'),
    subtitle: fantasyGameName,
    stats: catalogue
      ? [
          {
            value: `${catalogue.naming.cards.length}`,
            label: t('ogBattleCards'),
          },
        ]
      : [],
  });
}
