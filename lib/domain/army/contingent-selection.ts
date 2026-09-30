import { sum } from '../numbers.ts';
import {
  type AlliedContingent,
  type ArmyList,
  allyTroopOptionGroups,
  type ContingentGroup,
  type NonEmpty,
  type OptionalContingent,
  optionalContingentGroups,
} from './army-list.ts';
import { coversYear, isContingentGroupAvailable } from './availability.ts';
import type { PointCosts } from './points.ts';
import {
  type ArmySelection,
  gatingOf,
  hasContingentGroup,
  troopOptionStandCount,
} from './selection.ts';
import {
  type TroopOptionSelection,
  troopOptionSelection,
} from './troop-selection.ts';

export type ContingentSelection = {
  contingent: OptionalContingent | AlliedContingent;
  options: readonly TroopOptionSelection[];
  stands: number;
  points: number;
};

export type ContingentGroupSelection = {
  group: ContingentGroup;
  taken: boolean;
  offeredInYear: boolean;
  contingents: NonEmpty<ContingentSelection>;
  stands: number;
  points: number;
};

export type ContingentSection = {
  groups: readonly ContingentGroupSelection[];
  offered: number;
  taken: number;
  stands: number;
  points: number;
  withheld: number;
};

export type OptionalContingents = ContingentSection;

export type AllyTroopOptions = ContingentSection & {
  chosen: ContingentGroupSelection | null;
};

const contingentSelection = (
  contingent: OptionalContingent | AlliedContingent,
  selection: ArmySelection,
  costs: PointCosts,
  fillable: boolean,
): ContingentSelection => {
  const options = contingent.troopOptions
    .map((option) => ({
      option,
      withheldBy: coversYear(option.dateRanges, selection.year)
        ? null
        : ('year' as const),
    }))
    .filter(
      ({ option, withheldBy }) =>
        withheldBy === null || troopOptionStandCount(selection, option.id) > 0,
    )
    .map(({ option, withheldBy }) =>
      troopOptionSelection(option, selection, costs, {
        withheldBy,
        fillable: fillable && withheldBy === null,
      }),
    );
  return {
    contingent,
    options,
    stands: sum(options.map(({ stands }) => stands)),
    points: sum(options.map(({ points }) => points)),
  };
};

const contingentGroupSelection = (
  group: ContingentGroup,
  selection: ArmySelection,
  costs: PointCosts,
): ContingentGroupSelection => {
  const taken = hasContingentGroup(selection, group);
  const offeredInYear = isContingentGroupAvailable(group, gatingOf(selection));
  const [first, ...rest] = group.contingents;
  const selected = (contingent: OptionalContingent | AlliedContingent) =>
    contingentSelection(contingent, selection, costs, taken && offeredInYear);
  const contingents: NonEmpty<ContingentSelection> = [
    selected(first),
    ...rest.map(selected),
  ];
  return {
    group,
    taken,
    offeredInYear,
    contingents,
    stands: taken ? sum(contingents.map(({ stands }) => stands)) : 0,
    points: taken ? sum(contingents.map(({ points }) => points)) : 0,
  };
};

const contingentSection = (
  offered: readonly ContingentGroup[],
  selection: ArmySelection,
  costs: PointCosts,
): ContingentSection => {
  const groups = offered
    .map((group) => contingentGroupSelection(group, selection, costs))
    .filter(({ taken, offeredInYear }) => taken || offeredInYear);
  return {
    groups,
    offered: offered.length,
    taken: groups.filter(({ taken }) => taken).length,
    stands: sum(groups.map(({ stands }) => stands)),
    points: sum(groups.map(({ points }) => points)),
    withheld: offered.length - groups.length,
  };
};

export const optionalContingents = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
): OptionalContingents =>
  contingentSection(optionalContingentGroups(armyList), selection, costs);

export const allyTroopOptions = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
): AllyTroopOptions => {
  const section = contingentSection(
    allyTroopOptionGroups(armyList),
    selection,
    costs,
  );
  return {
    ...section,
    chosen: section.groups.find(({ taken }) => taken) ?? null,
  };
};
