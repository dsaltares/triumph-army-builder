import type {
  SubFactionClause,
  SubFactionGroup,
  SubFactionRule,
} from '../../data/sub-factions.ts';
import {
  type AlliedContingent,
  type ArmyList,
  allTroopOptions,
  type BattleCardAllowance,
  type ContingentGroup,
  type DateRange,
  type OptionalContingent,
  type TroopOption,
  type TroopOptionId,
} from './army-list.ts';

export type Gating = {
  year: number;
  variant: string | null;
};

export type DatedTroopOption = {
  dateRanges: readonly DateRange[];
};

export type GatedTroopOption = DatedTroopOption & {
  note: string;
};

export type Withholding = 'year' | 'subFaction';

export type BattleCardAvailability =
  | ({ scope: 'army' } & BattleCardAllowance)
  | ({ scope: 'troopOption'; option: TroopOptionId } & BattleCardAllowance);

const clauseVariant = (clause: SubFactionClause) =>
  typeof clause === 'string' ? clause : clause.variant;

const clauseCoversYear = (clause: SubFactionClause, year: number) =>
  typeof clause === 'string' ||
  ((clause.from === undefined || year >= clause.from) &&
    (clause.to === undefined || year <= clause.to));

export const ruleAllows = (
  rule: SubFactionRule,
  variant: string,
  year: number,
) =>
  'only' in rule
    ? rule.only.some(
        (clause) =>
          clauseVariant(clause) === variant && clauseCoversYear(clause, year),
      )
    : !rule.except.includes(variant);

export const coversYear = (dateRanges: readonly DateRange[], year: number) =>
  dateRanges.length === 0 ||
  dateRanges.some(
    ({ startDate, endDate }) => year >= startDate && year <= endDate,
  );

export const dateRangeCoversYear = (
  dateRange: DateRange | null,
  year: number,
) => dateRange === null || coversYear([dateRange], year);

const declares = (
  group: SubFactionGroup,
  variant: string | null,
): variant is string =>
  variant !== null && group.variants.some(({ id }) => id === variant);

export const subFactionAllows = (
  group: SubFactionGroup | null,
  note: string,
  { year, variant }: Gating,
) => {
  const rule = group?.rules[note];
  if (!group || !rule) {
    return true;
  }
  return declares(group, variant) && ruleAllows(rule, variant, year);
};

export const troopOptionWithholding = (
  { dateRanges, note }: GatedTroopOption,
  group: SubFactionGroup | null,
  gating: Gating,
): Withholding | null => {
  if (!coversYear(dateRanges, gating.year)) {
    return 'year';
  }
  return subFactionAllows(group, note, gating) ? null : 'subFaction';
};

export const isTroopOptionAvailable = (
  troopOption: GatedTroopOption,
  group: SubFactionGroup | null,
  gating: Gating,
) => troopOptionWithholding(troopOption, group, gating) === null;

export const availableTroopOptions = <Option extends GatedTroopOption>(
  troopOptions: readonly Option[],
  group: SubFactionGroup | null,
  gating: Gating,
): readonly Option[] =>
  troopOptions.filter((troopOption) =>
    isTroopOptionAvailable(troopOption, group, gating),
  );

export const datedTroopOptions = <Option extends DatedTroopOption>(
  troopOptions: readonly Option[],
  year: number,
): readonly Option[] =>
  troopOptions.filter(({ dateRanges }) => coversYear(dateRanges, year));

export const isContingentGroupAvailable = (
  { dateRange }: ContingentGroup,
  { year }: Gating,
) => dateRangeCoversYear(dateRange, year);

const resolvedContingent = <
  Contingent extends OptionalContingent | AlliedContingent,
>(
  contingent: Contingent,
  { year }: Gating,
): Contingent => ({
  ...contingent,
  troopOptions: datedTroopOptions(contingent.troopOptions, year),
});

const resolvedContingentGroup = (
  group: ContingentGroup,
  gating: Gating,
): ContingentGroup => {
  const [first, ...rest] = group.contingents;
  return {
    ...group,
    contingents: [
      resolvedContingent(first, gating),
      ...rest.map((contingent) => resolvedContingent(contingent, gating)),
    ],
  };
};

export const availableContingentGroups = (
  armyList: ArmyList,
  gating: Gating,
): readonly ContingentGroup[] =>
  armyList.contingentGroups
    .filter((group) => isContingentGroupAvailable(group, gating))
    .map((group) => resolvedContingentGroup(group, gating));

export const resolveArmyList = (
  armyList: ArmyList,
  gating: Gating,
): ArmyList => ({
  ...armyList,
  main: {
    ...armyList.main,
    troopOptions: availableTroopOptions(
      armyList.main.troopOptions,
      armyList.subFactions,
      gating,
    ),
  },
  contingentGroups: availableContingentGroups(armyList, gating),
});

const troopOptionBattleCards = (
  troopOption: TroopOption,
): readonly BattleCardAvailability[] =>
  troopOption.battleCards.map((allowance) => ({
    scope: 'troopOption',
    option: troopOption.id,
    ...allowance,
  }));

export const availableBattleCards = (
  armyList: ArmyList,
  gating: Gating,
): readonly BattleCardAvailability[] => {
  const resolved = resolveArmyList(armyList, gating);
  return [
    ...resolved.battleCards.map((allowance) => ({
      scope: 'army' as const,
      ...allowance,
    })),
    ...allTroopOptions(resolved).flatMap(troopOptionBattleCards),
  ];
};
