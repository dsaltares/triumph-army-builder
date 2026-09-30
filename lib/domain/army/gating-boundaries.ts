import type { SubFactionGroup } from '../../data/sub-factions.ts';
import {
  type ArmyList,
  type ContingentGroup,
  type DateRange,
  offeredContingentGroups,
  type TroopOption,
} from './army-list.ts';
import {
  type Gating,
  isContingentGroupAvailable,
  isTroopOptionAvailable,
} from './availability.ts';

export type BoundaryChange =
  | { kind: 'troopOption'; troopOption: TroopOption }
  | { kind: 'contingentGroup'; group: ContingentGroup };

export type GatingBoundary = {
  year: number;
  offered: readonly BoundaryChange[];
  withheld: readonly BoundaryChange[];
};

const changeYears = ({ startDate, endDate }: DateRange): readonly number[] => [
  startDate,
  endDate + 1,
];

const clauseChangeYears = (
  group: SubFactionGroup | null,
): readonly number[] => {
  if (!group) {
    return [];
  }
  return Object.values(group.rules).flatMap((rule) =>
    'only' in rule
      ? rule.only.flatMap((clause) =>
          typeof clause === 'string'
            ? []
            : [
                ...(clause.from === undefined ? [] : [clause.from]),
                ...(clause.to === undefined ? [] : [clause.to + 1]),
              ],
        )
      : [],
  );
};

const candidateYears = (armyList: ArmyList): readonly number[] => [
  ...armyList.main.troopOptions.flatMap(({ dateRanges }) =>
    dateRanges.flatMap(changeYears),
  ),
  ...offeredContingentGroups(armyList).flatMap(({ dateRange }) =>
    dateRange ? changeYears(dateRange) : [],
  ),
  ...clauseChangeYears(armyList.subFactions),
];

const availableAt = (
  armyList: ArmyList,
  gating: Gating,
): readonly BoundaryChange[] => [
  ...armyList.main.troopOptions
    .filter((troopOption) =>
      isTroopOptionAvailable(troopOption, armyList.subFactions, gating),
    )
    .map((troopOption) => ({ kind: 'troopOption' as const, troopOption })),
  ...offeredContingentGroups(armyList)
    .filter((group) => isContingentGroupAvailable(group, gating))
    .map((group) => ({ kind: 'contingentGroup' as const, group })),
];

const changeId = (change: BoundaryChange) =>
  change.kind === 'troopOption' ? change.troopOption.id : change.group.id;

const missingFrom = (
  changes: readonly BoundaryChange[],
  others: readonly BoundaryChange[],
): readonly BoundaryChange[] => {
  const present = new Set(others.map(changeId));
  return changes.filter((change) => !present.has(changeId(change)));
};

const boundaryAt = (
  armyList: ArmyList,
  variant: string | null,
  year: number,
): GatingBoundary => {
  const before = availableAt(armyList, { year: year - 1, variant });
  const after = availableAt(armyList, { year, variant });
  return {
    year,
    offered: missingFrom(after, before),
    withheld: missingFrom(before, after),
  };
};

export const gatingBoundaries = (
  armyList: ArmyList,
  variant: string | null,
): readonly GatingBoundary[] => {
  const { startDate, endDate } = armyList.dateRange;
  const inside = new Set(
    candidateYears(armyList).filter(
      (year) => year > startDate && year <= endDate,
    ),
  );
  return [...inside]
    .sort((left, right) => left - right)
    .map((year) => boundaryAt(armyList, variant, year))
    .filter(({ offered, withheld }) => offered.length + withheld.length > 0);
};

const pageJumpsAcrossSpan = 20;
const smallestLargeStep = 5;

export const largeYearStep = ({ startDate, endDate }: DateRange) =>
  Math.max(
    smallestLargeStep,
    Math.round((endDate - startDate) / pageJumpsAcrossSpan),
  );

export type YearPeriod = DateRange & { boundary: GatingBoundary | null };

export const yearPeriods = (
  { startDate, endDate }: DateRange,
  boundaries: readonly GatingBoundary[],
): readonly YearPeriod[] => {
  const starts = [
    { year: startDate, boundary: null },
    ...boundaries.map((boundary) => ({ year: boundary.year, boundary })),
  ];
  return starts.map(({ year, boundary }, index) => ({
    startDate: year,
    endDate: (starts[index + 1]?.year ?? endDate + 1) - 1,
    boundary,
  }));
};

export const periodIndexAt = (periods: readonly YearPeriod[], year: number) =>
  Math.max(
    0,
    periods.findLastIndex(({ startDate }) => startDate <= year),
  );

export type AvailabilityLane = {
  change: BoundaryChange;
  spans: readonly DateRange[];
};

const everyChange = (armyList: ArmyList): readonly BoundaryChange[] => [
  ...armyList.main.troopOptions.map((troopOption) => ({
    kind: 'troopOption' as const,
    troopOption,
  })),
  ...offeredContingentGroups(armyList).map((group) => ({
    kind: 'contingentGroup' as const,
    group,
  })),
];

const spansIn = (
  periods: readonly YearPeriod[],
  offeredIn: readonly ReadonlySet<string>[],
  id: string,
): readonly DateRange[] => {
  const spans: DateRange[] = [];
  periods.forEach(({ startDate, endDate }, index) => {
    if (!offeredIn[index]?.has(id)) {
      return;
    }
    const last = spans.at(-1);
    if (last && last.endDate === startDate - 1) {
      last.endDate = endDate;
    } else {
      spans.push({ startDate, endDate });
    }
  });
  return spans;
};

export const availabilityLanes = (
  armyList: ArmyList,
  variant: string | null,
): readonly AvailabilityLane[] => {
  const boundaries = gatingBoundaries(armyList, variant);
  const changing = new Set(
    boundaries.flatMap(({ offered, withheld }) =>
      [...offered, ...withheld].map(changeId),
    ),
  );
  const periods = yearPeriods(armyList.dateRange, boundaries);
  const offeredIn = periods.map(
    ({ startDate }) =>
      new Set(
        availableAt(armyList, { year: startDate, variant }).map(changeId),
      ),
  );
  return everyChange(armyList)
    .filter((change) => changing.has(changeId(change)))
    .map((change) => ({
      change,
      spans: spansIn(periods, offeredIn, changeId(change)),
    }))
    .sort(
      (left, right) =>
        (left.spans[0]?.startDate ?? 0) - (right.spans[0]?.startDate ?? 0),
    );
};

const distanceTo = ({ startDate, endDate }: DateRange, year: number) =>
  Math.max(startDate - year, year - endDate, 0);

export const nearestOfferedYear = (
  { spans }: Pick<AvailabilityLane, 'spans'>,
  year: number,
) => {
  const nearest = spans.reduce<DateRange | undefined>(
    (best, span) =>
      best === undefined || distanceTo(span, year) < distanceTo(best, year)
        ? span
        : best,
    undefined,
  );
  return nearest
    ? Math.min(Math.max(year, nearest.startDate), nearest.endDate)
    : year;
};
