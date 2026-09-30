import type { ArmyDetail } from '../../data/bundle.ts';
import type {
  BattleCardCode,
  MeshweshBattleCardEntry,
  MeshweshHomeTopography,
  MeshweshRating,
  MeshweshTroopEntry,
  MeshweshTroopOption,
  TroopTypeCode,
} from '../../data/schema.ts';
import type { SubFactionGroup } from '../../data/sub-factions.ts';
import {
  type AllyOptionKind,
  allyOptionKind,
  contingentKind,
} from '../ally-options.ts';
import {
  type BattleLine,
  battleLine,
  type TroopTypeMix,
  troopTypeMix,
} from '../troop-options.ts';

declare const identifierKind: unique symbol;

type Identifier<Kind extends string> = string & {
  readonly [identifierKind]: Kind;
};

export type ContingentId = Identifier<'contingent'>;
export type ContingentGroupId = Identifier<'contingentGroup'>;
export type TroopOptionId = Identifier<'troopOption'>;

export type NonEmpty<Item> = readonly [Item, ...Item[]];

export type DateRange = { startDate: number; endDate: number };

export type TroopEntry = {
  troopType: TroopTypeCode;
  note: string | null;
};

export type BattleCardAllowance = {
  code: BattleCardCode;
  min: number | null;
  max: number | null;
  note: string | null;
};

export type TroopOption = {
  id: TroopOptionId;
  contingent: ContingentId;
  min: number;
  max: number;
  battleLine: BattleLine;
  mix: TroopTypeMix;
  description: string;
  note: string;
  troopEntries: NonEmpty<TroopEntry>;
  dateRanges: readonly DateRange[];
  battleCards: readonly BattleCardAllowance[];
};

export type MainContingent = {
  kind: 'main';
  id: ContingentId;
  name: string;
  troopOptions: readonly TroopOption[];
};

export type OptionalContingent = {
  kind: 'optional';
  id: ContingentId;
  name: string;
  dateRange: DateRange | null;
  troopOptions: readonly TroopOption[];
};

export type AlliedContingent = {
  kind: 'allied';
  id: ContingentId;
  name: string;
  dateRange: DateRange | null;
  troopOptions: readonly TroopOption[];
};

export type Contingent = MainContingent | OptionalContingent | AlliedContingent;

export type ContingentGroup = {
  id: ContingentGroupId;
  kind: AllyOptionKind;
  name: string;
  note: string | null;
  dateRange: DateRange | null;
  contingents: NonEmpty<OptionalContingent | AlliedContingent>;
};

export type ArmyList = {
  id: string;
  key: string;
  name: string;
  extendedName: string;
  dateRange: DateRange;
  invasionRatings: readonly MeshweshRating[];
  maneuverRatings: readonly MeshweshRating[];
  homeTopographies: readonly MeshweshHomeTopography[];
  subFactions: SubFactionGroup | null;
  main: MainContingent;
  contingentGroups: readonly ContingentGroup[];
  generalTroopTypes: NonEmpty<TroopTypeCode>;
  battleCards: readonly BattleCardAllowance[];
};

export const mainContingentId = 'main' as ContingentId;

const troopOptionIdPattern = /^(.+)\/(\d+)$/;
const contingentGroupIdPattern = /^group\/(\d+)$/;

export const troopOptionId = (contingent: ContingentId, index: number) =>
  `${contingent}/${index}` as TroopOptionId;

export const contingentGroupId = (index: number) =>
  `group/${index}` as ContingentGroupId;

export const parseTroopOptionId = (id: TroopOptionId) => {
  const [, contingent, index] = troopOptionIdPattern.exec(id) ?? [];
  return contingent && index
    ? { contingent: contingent as ContingentId, index: Number(index) }
    : null;
};

export const parseContingentGroupId = (id: ContingentGroupId) => {
  const [, index] = contingentGroupIdPattern.exec(id) ?? [];
  return index ? Number(index) : null;
};

const nonEmpty = <Item>(
  items: readonly Item[],
  missing: string,
): NonEmpty<Item> => {
  const [first, ...rest] = items;
  if (first === undefined) {
    throw new Error(missing);
  }
  return [first, ...rest];
};

const troopEntry = ({
  troopTypeCode,
  note,
}: MeshweshTroopEntry): TroopEntry => ({
  troopType: troopTypeCode,
  note,
});

const battleCardAllowance = ({
  battleCardCode,
  min,
  max,
  note,
}: MeshweshBattleCardEntry): BattleCardAllowance => ({
  code: battleCardCode,
  min,
  max,
  note,
});

const troopOptionsOf = (
  contingent: ContingentId,
  troopOptions: readonly MeshweshTroopOption[],
): readonly TroopOption[] =>
  troopOptions.map((troopOption, index) => ({
    id: troopOptionId(contingent, index),
    contingent,
    min: troopOption.min,
    max: troopOption.max,
    battleLine: battleLine(troopOption),
    mix: troopTypeMix(troopOption),
    description: troopOption.description,
    note: troopOption.note,
    troopEntries: nonEmpty(
      troopOption.troopEntries.map(troopEntry),
      `troop option ${contingent}/${index} has no troop entries`,
    ),
    dateRanges: troopOption.dateRanges,
    battleCards: troopOption.battleCardEntries.map(battleCardAllowance),
  }));

type BundledContingent = ArmyDetail['allyContingents'][number];

const contingentOf = (
  contingent: BundledContingent,
): OptionalContingent | AlliedContingent => {
  const id = contingent.id as ContingentId;
  return {
    kind: contingentKind(contingent),
    id,
    name: contingent.name,
    dateRange: contingent.dateRange,
    troopOptions: troopOptionsOf(id, contingent.troopOptions),
  };
};

const contingentGroups = (detail: ArmyDetail): readonly ContingentGroup[] => {
  const contingents = new Map(
    detail.allyContingents.map((contingent) => [contingent.id, contingent]),
  );
  return detail.allyOptions.map((allyOption, index) => {
    const allyEntries = allyOption.allyEntries.map(({ allyArmyList }) => {
      const contingent = contingents.get(allyArmyList);
      if (!contingent) {
        throw new Error(
          `${detail.name} references an ally contingent ${allyArmyList} it does not carry`,
        );
      }
      return contingent;
    });
    return {
      id: contingentGroupId(index),
      kind: allyOptionKind({ allyEntries }),
      name: allyOption.allyEntries.map(({ name }) => name).join(' and '),
      note: allyOption.note,
      dateRange: allyOption.dateRange,
      contingents: nonEmpty(
        allyEntries.map(contingentOf),
        `${detail.name} has an ally option with no contingents`,
      ),
    };
  });
};

export const buildArmyList = (detail: ArmyDetail): ArmyList => ({
  id: detail.id,
  key: detail.key,
  name: detail.name,
  extendedName: detail.extendedName,
  dateRange: { startDate: detail.startDate, endDate: detail.endDate },
  invasionRatings: detail.invasionRatings,
  maneuverRatings: detail.maneuverRatings,
  homeTopographies: detail.homeTopographies,
  subFactions: detail.subFactions,
  main: {
    kind: 'main',
    id: mainContingentId,
    name: detail.name,
    troopOptions: troopOptionsOf(mainContingentId, detail.troopOptions),
  },
  contingentGroups: contingentGroups(detail),
  generalTroopTypes: nonEmpty(
    [
      ...new Set(
        detail.troopEntriesForGeneral.flatMap(({ troopEntries }) =>
          troopEntries.map(({ troopTypeCode }) => troopTypeCode),
        ),
      ),
    ],
    `${detail.name} has no troop types its general can be drawn from`,
  ),
  battleCards: detail.battleCardEntries.map(battleCardAllowance),
});

export const contingentsOf = (armyList: ArmyList): readonly Contingent[] => [
  armyList.main,
  ...new Map(
    armyList.contingentGroups.flatMap(({ contingents }) =>
      contingents.map((contingent) => [contingent.id, contingent] as const),
    ),
  ).values(),
];

export const allTroopOptions = (armyList: ArmyList): readonly TroopOption[] =>
  contingentsOf(armyList).flatMap(({ troopOptions }) => troopOptions);

export const findTroopOption = (armyList: ArmyList, id: TroopOptionId) =>
  allTroopOptions(armyList).find((troopOption) => troopOption.id === id) ??
  null;

export const findContingent = (armyList: ArmyList, id: ContingentId) =>
  contingentsOf(armyList).find((contingent) => contingent.id === id) ?? null;

export const findContingentGroup = (
  armyList: ArmyList,
  id: ContingentGroupId,
) => armyList.contingentGroups.find((group) => group.id === id) ?? null;

const mixesContingentKinds = ({ contingents }: ContingentGroup) =>
  contingents.some(({ kind }) => kind === 'optional') &&
  contingents.some(({ kind }) => kind === 'allied');

export const offeredContingentGroups = (
  armyList: ArmyList,
): readonly ContingentGroup[] =>
  armyList.contingentGroups.filter((group) => !mixesContingentKinds(group));

export const optionalContingentGroups = (armyList: ArmyList) =>
  offeredContingentGroups(armyList).filter(
    ({ kind }) => kind === 'optionalContingent',
  );

export const allyTroopOptionGroups = (armyList: ArmyList) =>
  offeredContingentGroups(armyList).filter(
    ({ kind }) => kind === 'allyTroopOption',
  );
