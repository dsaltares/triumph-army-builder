import type { BattleCardCode, TroopTypeCode } from '../../data/schema.ts';
import type { BattleCardCosts } from '../battle-cards/costs.ts';
import type { BattleCardNames } from '../battle-cards/listing.ts';
import { sum } from '../numbers.ts';
import type { BattleLine } from '../troop-options.ts';
import type {
  CombatFactors,
  TroopTypeFactors,
  TroopTypeMovements,
  TroopTypeNames,
} from '../troop-types.ts';
import {
  type ArmyList,
  type Contingent,
  type ContingentId,
  type DateRange,
  findTroopOption,
  type TroopOptionId,
} from './army-list.ts';
import { subFactionChoice } from './builder.ts';
import { generalChoice } from './general-selection.ts';
import { armyPoints, type PointCosts, type StandLine } from './points.ts';
import {
  type ArmySelection,
  isGeneral,
  selectedContingents,
} from './selection.ts';

export type SheetStandLine = {
  troopType: TroopTypeCode;
  name: string;
  stands: number;
  pointsPerStand: number;
  points: number;
  general: boolean;
  movement: number | null;
  factors: CombatFactors;
};

export type SheetTroopOption = {
  id: TroopOptionId;
  description: string;
  note: string;
  battleLine: BattleLine;
  lines: readonly SheetStandLine[];
  stands: number;
  points: number;
};

export type SheetContingent = {
  id: ContingentId;
  kind: Contingent['kind'];
  name: string;
  options: readonly SheetTroopOption[];
  stands: number;
  points: number;
};

export type SheetBattleCard = {
  code: BattleCardCode;
  name: string;
  purchases: number;
  stands: number;
  points: number;
  attachedTo: readonly string[];
};

export type SheetGeneral = {
  troopType: TroopTypeCode;
  name: string;
  contingent: string;
  option: string;
};

export type SheetSubFaction = {
  label: string;
  name: string | null;
};

export type SheetTotals = {
  stands: number;
  standPoints: number;
  allyStandPoints: number;
  battleCardPoints: number;
  total: number;
};

export type ArmySheet = {
  listName: string;
  armyId: string;
  armyName: string;
  extendedName: string;
  key: string;
  dataVersion: string;
  year: number;
  dateRange: DateRange;
  subFaction: SheetSubFaction | null;
  invasionRatings: ArmyList['invasionRatings'];
  maneuverRatings: ArmyList['maneuverRatings'];
  homeTopographies: ArmyList['homeTopographies'];
  camp: readonly CampCode[];
  general: SheetGeneral | null;
  contingents: readonly SheetContingent[];
  battleCards: readonly SheetBattleCard[];
  totals: SheetTotals;
};

export type ArmySheetInput = {
  listName: string;
  armyList: ArmyList;
  selection: ArmySelection;
  costs: PointCosts;
  names: TroopTypeNames;
  factors: TroopTypeFactors;
  movement: TroopTypeMovements;
  cardNames: BattleCardNames;
};

export const campCodes = ['FC', 'NC', 'SW', 'PT'] as const;

export type CampCode = (typeof campCodes)[number];

export const campOf = (selection: ArmySelection): readonly CampCode[] =>
  campCodes.filter((code) => (selection.armyBattleCards[code] ?? 0) > 0);

const sheetContingents = (
  contingents: readonly Contingent[],
  standLines: readonly StandLine[],
  selection: ArmySelection,
  names: TroopTypeNames,
  factors: TroopTypeFactors,
  movement: TroopTypeMovements,
): readonly SheetContingent[] =>
  contingents.flatMap((contingent) => {
    const options = contingent.troopOptions.flatMap((option) => {
      const lines = standLines.filter((line) => line.option === option.id);
      if (lines.length === 0) {
        return [];
      }
      return [
        {
          id: option.id,
          description: option.description,
          note: option.note,
          battleLine: option.battleLine,
          lines: lines.map((line) => ({
            troopType: line.troopType,
            name: names[line.troopType],
            stands: line.stands,
            pointsPerStand: line.pointsPerStand,
            points: line.points,
            general: isGeneral(selection, line.option, line.troopType),
            movement: movement[line.troopType] ?? null,
            factors: factors[line.troopType],
          })),
          stands: sum(lines.map(({ stands }) => stands)),
          points: sum(lines.map(({ points }) => points)),
        },
      ];
    });
    return options.length === 0
      ? []
      : [
          {
            id: contingent.id,
            kind: contingent.kind,
            name: contingent.name,
            options,
            stands: sum(options.map(({ stands }) => stands)),
            points: sum(options.map(({ points }) => points)),
          },
        ];
  });

const sheetBattleCards = (
  armyList: ArmyList,
  battleCardLines: ReturnType<typeof armyPoints>['battleCardLines'],
  cardNames: BattleCardNames,
  costs: BattleCardCosts,
): readonly SheetBattleCard[] =>
  battleCardLines.map(({ code, purchases, stands, options, points }) => ({
    code,
    name: cardNames[code] ?? costs[code].name,
    purchases,
    stands,
    points,
    attachedTo: [
      ...new Set(
        options.flatMap((option) => {
          const troopOption = findTroopOption(armyList, option);
          return troopOption ? [troopOption.description] : [];
        }),
      ),
    ],
  }));

const sheetGeneral = (
  armyList: ArmyList,
  selection: ArmySelection,
  names: TroopTypeNames,
): SheetGeneral | null => {
  const { chosen } = generalChoice(armyList, selection);
  return chosen
    ? {
        troopType: chosen.troopType,
        name: names[chosen.troopType],
        contingent: chosen.contingent.name,
        option: chosen.option.description,
      }
    : null;
};

const sheetSubFaction = (
  armyList: ArmyList,
  selection: ArmySelection,
): SheetSubFaction | null => {
  const choice = subFactionChoice(armyList, selection.variant);
  if (!choice) {
    return null;
  }
  return {
    label: choice.label,
    name: choice.variants.find(({ id }) => id === choice.chosen)?.name ?? null,
  };
};

export const armySheet = ({
  listName,
  armyList,
  selection,
  costs,
  names,
  factors,
  movement,
  cardNames,
}: ArmySheetInput): ArmySheet => {
  const points = armyPoints(armyList, selection, costs);
  const contingents = sheetContingents(
    selectedContingents(armyList, selection),
    points.standLines,
    selection,
    names,
    factors,
    movement,
  );
  return {
    listName,
    armyId: armyList.id,
    armyName: armyList.name,
    extendedName: armyList.extendedName,
    key: armyList.key,
    dataVersion: selection.dataVersion,
    year: selection.year,
    dateRange: armyList.dateRange,
    subFaction: sheetSubFaction(armyList, selection),
    invasionRatings: armyList.invasionRatings,
    maneuverRatings: armyList.maneuverRatings,
    homeTopographies: armyList.homeTopographies,
    camp: campOf(selection),
    general: sheetGeneral(armyList, selection, names),
    contingents,
    battleCards: sheetBattleCards(
      armyList,
      points.battleCardLines,
      cardNames,
      costs.battleCards,
    ),
    totals: {
      stands: sum(contingents.map(({ stands }) => stands)),
      standPoints: points.standPoints,
      allyStandPoints: points.allyStandPoints,
      battleCardPoints: points.battleCardPoints,
      total: points.total,
    },
  };
};

export type SheetStandColumn = {
  key:
    | 'pointsPerStand'
    | 'total'
    | 'move'
    | 'vFoot'
    | 'vMounted'
    | 'shoot'
    | 'shotAt';
  value: (line: SheetStandLine) => number | null;
  kind: 'points' | 'factor';
};

export const sheetStandColumns: readonly SheetStandColumn[] = [
  {
    key: 'pointsPerStand',
    value: (line) => line.pointsPerStand,
    kind: 'points',
  },
  { key: 'total', value: (line) => line.points, kind: 'points' },
  { key: 'move', value: (line) => line.movement, kind: 'factor' },
  {
    key: 'vFoot',
    value: (line) => line.factors.closeCombat.vsFoot,
    kind: 'factor',
  },
  {
    key: 'vMounted',
    value: (line) => line.factors.closeCombat.vsMounted,
    kind: 'factor',
  },
  {
    key: 'shoot',
    value: (line) => line.factors.rangedCombat.shooting,
    kind: 'factor',
  },
  {
    key: 'shotAt',
    value: (line) => line.factors.rangedCombat.shotAt,
    kind: 'factor',
  },
];

export const sheetTroopHeadings = [
  'troopType',
  ...sheetStandColumns.map(({ key }) => key),
] as const;

export const sheetCardHeadings = [
  'card',
  'copies',
  'stands',
  'points',
] as const;

export const sheetFactKeys = [
  'army',
  'year',
  'subFaction',
  'general',
  'camp',
  'invasionRating',
  'manoeuvreRating',
  'homeTopography',
] as const;

export type SheetFactKey = (typeof sheetFactKeys)[number];
