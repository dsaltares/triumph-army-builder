import { getLocale, getTranslations } from 'next-intl/server';
import { ogCardImage, ogContentType, ogSize } from '@/components/og/og-card';
import { servedReference } from '@/lib/data/served-bundle';
import { renamedTroopTypes } from '@/lib/domain/fantasy/naming';
import { fantasyGameName } from '@/lib/domain/games/fantasy';

export const size = ogSize;

export const contentType = ogContentType;

export const alt = 'The Fantasy Triumph troop types';

export default async function FantasyTroopTypesImage() {
  const t = await getTranslations('pages');
  const reference = await servedReference(await getLocale());
  const [fantasyTroopTypes, troopTypes] = reference
    ? await Promise.all([
        reference.bundle.readFantasyTroopTypes(),
        reference.bundle.readTroopTypes(),
      ])
    : [null, []];
  const renamed = renamedTroopTypes(troopTypes, fantasyTroopTypes ?? []);
  return ogCardImage({
    title: t('fantasyTroopTypes'),
    subtitle: fantasyGameName,
    stats: fantasyTroopTypes
      ? [
          {
            value: `${fantasyTroopTypes.length}`,
            label: t('ogTroopTypes'),
          },
          { value: `${renamed.length}`, label: t('ogRenamed') },
        ]
      : [],
  });
}
