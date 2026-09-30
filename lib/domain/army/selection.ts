import type { BattleCardCode, TroopTypeCode } from '../../data/schema.ts';
import { by, byKey } from '../ordering.ts';
import type { BattleLine } from '../troop-options.ts';
import {
  type ArmyList,
  allyTroopOptionGroups,
  type Contingent,
  type ContingentGroup,
  type ContingentGroupId,
  type ContingentId,
  type TroopOption,
  type TroopOptionId,
} from './army-list.ts';
import type { Gating } from './availability.ts';

export type StandRef = {
  option: TroopOptionId;
  troopType: TroopTypeCode;
};

export type StandCounts = Readonly<Partial<Record<TroopTypeCode, number>>>;

export type BattleCardCopies = Readonly<
  Partial<Record<BattleCardCode, number>>
>;

export type ArmySelection = {
  army: string;
  dataVersion: string;
  year: number;
  variant: string | null;
  contingentGroups: readonly ContingentGroupId[];
  stands: Readonly<Record<TroopOptionId, StandCounts>>;
  general: StandRef | null;
  armyBattleCards: BattleCardCopies;
  troopBattleCards: Readonly<Record<TroopOptionId, BattleCardCopies>>;
};

export type BattleCardSelection =
  | { scope: 'army'; code: BattleCardCode; copies: number }
  | {
      scope: 'troopOption';
      code: BattleCardCode;
      option: TroopOptionId;
      stands: number;
    };

export type Stand = {
  contingent: ContingentId;
  option: TroopOptionId;
  troopType: TroopTypeCode;
  battleLine: BattleLine;
  general: boolean;
};

export const emptySelection = ({
  army,
  dataVersion,
  year,
  variant = null,
}: {
  army: string;
  dataVersion: string;
  year: number;
  variant?: string | null;
}): ArmySelection => ({
  army,
  dataVersion,
  year,
  variant,
  contingentGroups: [],
  stands: {},
  general: null,
  armyBattleCards: {},
  troopBattleCards: {},
});

export const gatingOf = ({ year, variant }: ArmySelection): Gating => ({
  year,
  variant,
});

const counted = (value: number) => Math.max(0, Math.trunc(value));

const withCount = <Code extends string>(
  counts: Readonly<Partial<Record<Code, number>>>,
  code: Code,
  count: number,
): Readonly<Partial<Record<Code, number>>> => {
  const next: Partial<Record<Code, number>> = { ...counts };
  if (count === 0) {
    delete next[code];
  } else {
    next[code] = count;
  }
  return next;
};

const withEntry = <Value extends object>(
  entries: Readonly<Record<TroopOptionId, Value>>,
  option: TroopOptionId,
  value: Value,
): Readonly<Record<TroopOptionId, Value>> => {
  const next: Record<TroopOptionId, Value> = { ...entries };
  if (Object.keys(value).length === 0) {
    delete next[option];
  } else {
    next[option] = value;
  }
  return next;
};

export const standCount = (
  selection: ArmySelection,
  option: TroopOptionId,
  troopType: TroopTypeCode,
) => selection.stands[option]?.[troopType] ?? 0;

export const troopOptionStandCount = (
  selection: ArmySelection,
  option: TroopOptionId,
) =>
  Object.values(selection.stands[option] ?? {}).reduce(
    (total, stands) => total + stands,
    0,
  );

export const totalStandCount = (selection: ArmySelection) =>
  Object.keys(selection.stands).reduce(
    (total, option) =>
      total + troopOptionStandCount(selection, option as TroopOptionId),
    0,
  );

const generalAfter = (
  selection: ArmySelection,
  stands: ArmySelection['stands'],
) => {
  const { general } = selection;
  if (!general) {
    return null;
  }
  return (stands[general.option]?.[general.troopType] ?? 0) > 0
    ? general
    : null;
};

export const withStands = (
  selection: ArmySelection,
  troopOption: TroopOption,
  troopType: TroopTypeCode,
  stands: number,
): ArmySelection => {
  if (
    !troopOption.troopEntries.some((entry) => entry.troopType === troopType)
  ) {
    throw new Error(`${troopOption.id} has no ${troopType} troop entry`);
  }
  const counts = withCount(
    selection.stands[troopOption.id] ?? {},
    troopType,
    counted(stands),
  );
  const next = withEntry(selection.stands, troopOption.id, counts);
  return {
    ...selection,
    stands: next,
    general: generalAfter(selection, next),
  };
};

export const isGeneral = (
  selection: ArmySelection,
  option: TroopOptionId,
  troopType: TroopTypeCode,
) =>
  selection.general?.option === option &&
  selection.general?.troopType === troopType;

export const withGeneral = (
  selection: ArmySelection,
  general: StandRef | null,
): ArmySelection => {
  if (
    general &&
    standCount(selection, general.option, general.troopType) === 0
  ) {
    throw new Error(
      `${general.option} has no ${general.troopType} stand to make the general`,
    );
  }
  return { ...selection, general };
};

export const hasContingentGroup = (
  selection: ArmySelection,
  group: ContingentGroup,
) => selection.contingentGroups.includes(group.id);

export const withContingentGroup = (
  selection: ArmySelection,
  group: ContingentGroup,
): ArmySelection =>
  hasContingentGroup(selection, group)
    ? selection
    : {
        ...selection,
        contingentGroups: [...selection.contingentGroups, group.id],
      };

export const withoutContingentGroup = (
  selection: ArmySelection,
  group: ContingentGroup,
): ArmySelection => {
  const dropped = new Set(
    group.contingents.flatMap(({ troopOptions }) =>
      troopOptions.map(({ id }) => id),
    ),
  );
  const keep = <Value>(entries: Readonly<Record<TroopOptionId, Value>>) =>
    Object.fromEntries(
      Object.entries(entries).filter(
        ([option]) => !dropped.has(option as TroopOptionId),
      ),
    ) as Readonly<Record<TroopOptionId, Value>>;
  const stands = keep(selection.stands);
  return {
    ...selection,
    contingentGroups: selection.contingentGroups.filter(
      (id) => id !== group.id,
    ),
    stands,
    general: generalAfter(selection, stands),
    troopBattleCards: keep(selection.troopBattleCards),
  };
};

export const withAllyTroopOption = (
  armyList: ArmyList,
  selection: ArmySelection,
  group: ContingentGroup | null,
): ArmySelection => {
  const dropped = allyTroopOptionGroups(armyList).filter(
    (candidate) =>
      candidate.id !== group?.id && hasContingentGroup(selection, candidate),
  );
  const cleared = dropped.reduce(withoutContingentGroup, selection);
  return group ? withContingentGroup(cleared, group) : cleared;
};

export const withArmyBattleCard = (
  selection: ArmySelection,
  code: BattleCardCode,
  copies: number,
): ArmySelection => ({
  ...selection,
  armyBattleCards: withCount(selection.armyBattleCards, code, counted(copies)),
});

export const withTroopBattleCard = (
  selection: ArmySelection,
  troopOption: TroopOption,
  code: BattleCardCode,
  stands: number,
): ArmySelection => ({
  ...selection,
  troopBattleCards: withEntry(
    selection.troopBattleCards,
    troopOption.id,
    withCount(
      selection.troopBattleCards[troopOption.id] ?? {},
      code,
      counted(stands),
    ),
  ),
});

export const battleCardSelections = (
  selection: ArmySelection,
): readonly BattleCardSelection[] => [
  ...Object.entries(selection.armyBattleCards)
    .map(([code, copies]) => ({
      scope: 'army' as const,
      code: code as BattleCardCode,
      copies,
    }))
    .sort(by((entry) => entry.code)),
  ...Object.entries(selection.troopBattleCards)
    .sort(byKey)
    .flatMap(([option, cards]) =>
      Object.entries(cards)
        .map(([code, stands]) => ({
          scope: 'troopOption' as const,
          code: code as BattleCardCode,
          option: option as TroopOptionId,
          stands,
        }))
        .sort(by((entry) => entry.code)),
    ),
];

export const selectedContingents = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly Contingent[] => [
  armyList.main,
  ...new Map(
    armyList.contingentGroups
      .filter(({ id }) => selection.contingentGroups.includes(id))
      .flatMap(({ contingents }) =>
        contingents.map((contingent) => [contingent.id, contingent] as const),
      ),
  ).values(),
];

export const standsOf = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly Stand[] =>
  selectedContingents(armyList, selection).flatMap((contingent) =>
    contingent.troopOptions.flatMap((troopOption) =>
      troopOption.troopEntries.flatMap(({ troopType }) =>
        Array.from(
          { length: standCount(selection, troopOption.id, troopType) },
          (_stand, index) => ({
            contingent: contingent.id,
            option: troopOption.id,
            troopType,
            battleLine: troopOption.battleLine,
            general:
              index === 0 && isGeneral(selection, troopOption.id, troopType),
          }),
        ),
      ),
    ),
  );
