import type { FantasyCardNaming } from '../domain/fantasy/card-reference.ts';
import { fantasyTroopTypeNames } from '../domain/fantasy/naming.ts';
import type { FantasyCardText } from './bundle.ts';
import type { BundleSource } from './bundle-source.ts';

export type FantasyCardCatalogue = {
  naming: FantasyCardNaming;
  text: FantasyCardText;
};

export const readFantasyCardCatalogue = async (
  bundle: Pick<
    BundleSource,
    | 'readFantasyTroopTypes'
    | 'readFantasyBattleCards'
    | 'readFantasyBattleCardText'
    | 'readFantasyFormat'
  >,
): Promise<FantasyCardCatalogue | null> => {
  const [troopTypes, cards, text, format] = await Promise.all([
    bundle.readFantasyTroopTypes(),
    bundle.readFantasyBattleCards(),
    bundle.readFantasyBattleCardText(),
    bundle.readFantasyFormat(),
  ]);
  if (!troopTypes || !cards || !text || !format) {
    return null;
  }
  return {
    naming: {
      troopTypeNames: fantasyTroopTypeNames({ troopTypes }),
      cards,
      denseTopographies: format.denseTopographies,
    },
    text,
  };
};
