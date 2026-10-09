import { fileURLToPath } from 'node:url';
import type { BundledBattleCard } from '@/lib/data/bundle.ts';
import {
  type ArmyDetail,
  type BundleFile,
  buildBundle,
} from '@/lib/data/bundle.ts';
import { parseCuration } from '@/lib/data/curation.ts';
import {
  battleCardSchema,
  type TroopTypeCode,
  troopTypeSchema,
} from '@/lib/data/schema.ts';
import { loadSnapshot } from '@/lib/data/snapshot.ts';
import { type ArmyList, buildArmyList } from '@/lib/domain/army/army-list.ts';
import {
  type BattleCardCosts,
  battleCardCosts,
} from '@/lib/domain/battle-cards/costs.ts';
import basing from '@/test/fixtures/reference/curation/basing.json';
import battleCardCostCuration from '@/test/fixtures/reference/curation/battle-card-costs.json';
import fantasyCards from '@/test/fixtures/reference/curation/games/fantasy/cards.json';
import fantasyFormat from '@/test/fixtures/reference/curation/games/fantasy/format.json';
import fantasyText from '@/test/fixtures/reference/curation/games/fantasy/text.json';
import fantasyTroopTypeNames from '@/test/fixtures/reference/curation/games/fantasy/troop-type-names.json';
import movement from '@/test/fixtures/reference/curation/movement.json';
import subFactions from '@/test/fixtures/reference/curation/sub-factions.json';
import snapshotBattleCards from '@/test/fixtures/reference/snapshot/battleCards.json';
import snapshotTroopTypes from '@/test/fixtures/reference/snapshot/troopTypes.json';

const sampleFile = (path: string) =>
  fileURLToPath(new URL(`./fixtures/reference/${path}`, import.meta.url));

export const sampleSnapshotDirectory = sampleFile('snapshot/');

export const sampleCurationDirectory = sampleFile('curation/');

export const sampleTranslationsDirectory = sampleFile('translations/');

export const samplePackPath = sampleFile('sample-pack.json');

export const sampleCuration = parseCuration({
  movement,
  basing,
  battleCardCosts: battleCardCostCuration,
  subFactions,
  games: {
    fantasy: {
      troopTypeNames: fantasyTroopTypeNames,
      cards: fantasyCards,
      text: fantasyText,
      format: fantasyFormat,
    },
  },
});

export const sampleTroopTypes = troopTypeSchema
  .array()
  .parse(snapshotTroopTypes);

export const sampleSnapshotBattleCards = battleCardSchema
  .array()
  .parse(snapshotBattleCards);

export const sampleBattleCards: readonly BundledBattleCard[] =
  sampleSnapshotBattleCards.map(({ id, importName, mdText, ...card }) => {
    const { purchasedPer, rule } =
      sampleCuration.battleCardCosts[card.permanentCode];
    return { ...card, purchasedPer, rule };
  });

export const sampleBattleCardCosts: BattleCardCosts =
  battleCardCosts(sampleBattleCards);

export const withRulebookValues = <
  TroopType extends { permanentCode: TroopTypeCode },
>(
  troopType: TroopType,
) => {
  const movementOf = sampleCuration.movement[troopType.permanentCode];
  const basingOf = sampleCuration.basing[troopType.permanentCode];
  return {
    ...troopType,
    ...(movementOf === undefined ? {} : { movement: movementOf }),
    ...(basingOf === undefined ? {} : { basing: basingOf }),
  };
};

export const sampleBundledTroopTypes = sampleTroopTypes.map(
  ({ id, importName, ...bundled }) => withRulebookValues(bundled),
);

export const sampleSnapshot = () => loadSnapshot(sampleSnapshotDirectory);

export const sampleBundle = async (): Promise<BundleFile[]> =>
  buildBundle(await sampleSnapshot(), sampleCuration);

export const sampleArmyDetails = async (): Promise<ArmyDetail[]> =>
  (await sampleBundle())
    .filter(({ path }) => path.startsWith('armies/'))
    .map(({ contents }) => contents as ArmyDetail);

export const sampleArmyLists = async (): Promise<ArmyList[]> =>
  (await sampleArmyDetails()).map(buildArmyList);

export const sampleArmyList = async (name: string): Promise<ArmyList> => {
  const found = (await sampleArmyLists()).find((list) => list.name === name);
  if (!found) {
    throw new Error(`${name} is not in the sample pack`);
  }
  return found;
};
