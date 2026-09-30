import { countOf } from '../domain/plural.ts';
import { withOverflow } from '../overflow.ts';
import type { Curation } from './curation-schema.ts';
import {
  battleCardCodes,
  type MeshweshAllyArmyList,
  type MeshweshArmyList,
  type MeshweshBattleCard,
} from './schema.ts';
import { subFactionProblems } from './sub-factions.ts';

type BattleCardCurations = Curation['battleCardCosts'];

const battleCardProblems = (
  costs: BattleCardCurations,
  battleCard: MeshweshBattleCard,
) => {
  const curated = costs[battleCard.permanentCode];
  const named =
    curated.name === battleCard.displayName
      ? []
      : [
          `battle card ${battleCard.permanentCode} is curated as ${curated.name} but upstream now calls it ${battleCard.displayName}`,
        ];
  const filed =
    curated.category === battleCard.category
      ? []
      : [
          `battle card ${battleCard.permanentCode} ${curated.name} is curated as ${curated.category} but upstream now files it under ${battleCard.category}`,
        ];
  const uncited = curated.sources
    .filter((source) => !battleCard.mdText.includes(source))
    .map(
      (source) =>
        `battle card ${battleCard.permanentCode} ${curated.name} prices "${source}", which upstream no longer says`,
    );
  return [...named, ...filed, ...uncited];
};

const orphanedBattleCards = (
  costs: BattleCardCurations,
  battleCards: readonly MeshweshBattleCard[],
) => {
  const codes = new Set(battleCards.map(({ permanentCode }) => permanentCode));
  return battleCardCodes
    .filter((code) => !codes.has(code))
    .map(
      (code) =>
        `battle card ${code} ${costs[code].name} is curated but no longer exists upstream`,
    );
};

type OverlaidSnapshot = {
  armyLists: readonly MeshweshArmyList[];
  allyArmyLists: readonly MeshweshAllyArmyList[];
  battleCards: readonly MeshweshBattleCard[];
};

const maxReportedProblems = 10;

export const curatedOverlayProblems = (
  { subFactions, battleCardCosts }: Curation,
  { armyLists, allyArmyLists, battleCards }: OverlaidSnapshot,
) => [
  ...subFactionProblems(subFactions, { armyLists, allyArmyLists }),
  ...battleCards.flatMap((battleCard) =>
    battleCardProblems(battleCardCosts, battleCard),
  ),
  ...orphanedBattleCards(battleCardCosts, battleCards),
];

export const assertCuratedOverlaysMatch = (
  curation: Curation,
  snapshot: OverlaidSnapshot,
) => {
  const problems = curatedOverlayProblems(curation, snapshot);
  if (problems.length === 0) {
    return;
  }
  throw new Error(
    [
      `The curated overlays no longer match the snapshot (${countOf(problems.length, 'problem')}):`,
      ...withOverflow(
        problems.map((problem) => `  ${problem}`),
        maxReportedProblems,
        (remaining) => `  and ${remaining} more`,
      ),
    ].join('\n'),
  );
};
