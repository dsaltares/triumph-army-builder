import type {
  SubFactionGroup,
  SubFactionVariant,
} from '../../data/sub-factions.ts';
import { triumphRules } from '../games/triumph-rules.ts';
import {
  type ArmyList,
  type DateRange,
  offeredContingentGroups,
} from './army-list.ts';
import {
  dateRangeCoversYear,
  type Gating,
  resolveArmyList,
} from './availability.ts';
import type { ArmyPoints } from './points.ts';
import { type ArmySelection, emptySelection } from './selection.ts';
import type { ValidationRules } from './validation.ts';

export type PointsStatus = 'under' | 'exact' | 'over';

export type PointsMeter = {
  total: number;
  cap: number;
  remaining: number;
  status: PointsStatus;
  standPoints: number;
  allyStandPoints: number;
  battleCardPoints: number;
  filled: number;
};

export type AvailabilityCount = {
  available: number;
  total: number;
  withheld: number;
};

export type GatingEffect = {
  yearInRange: boolean;
  troopOptions: AvailabilityCount;
  contingentGroups: AvailabilityCount;
};

export type SubFactionChoice = {
  label: string;
  variants: readonly SubFactionVariant[];
  chosen: string | null;
  answered: boolean;
};

export const clampYear = (
  { startDate, endDate }: DateRange,
  year: number,
): number => Math.min(Math.max(Math.trunc(year), startDate), endDate);

export const startingYear = (armyList: Pick<ArmyList, 'dateRange'>) =>
  armyList.dateRange.startDate;

export const declaredVariant = (
  subFactions: SubFactionGroup | null,
  variant: string | null,
): string | null =>
  subFactions &&
  variant &&
  subFactions.variants.some(({ id }) => id === variant)
    ? variant
    : null;

export const subFactionChoice = (
  armyList: ArmyList,
  variant: string | null,
): SubFactionChoice | null => {
  const { subFactions } = armyList;
  if (!subFactions) {
    return null;
  }
  const chosen = declaredVariant(subFactions, variant);
  return {
    label: subFactions.label,
    variants: subFactions.variants,
    chosen,
    answered: chosen !== null,
  };
};

export const startBuilding = (
  armyList: Pick<ArmyList, 'id' | 'dateRange'>,
  dataVersion: string,
  { year, variant }: Partial<Gating> = {},
): ArmySelection =>
  emptySelection({
    army: armyList.id,
    dataVersion,
    year: year ?? startingYear(armyList),
    variant: variant ?? null,
  });

export const withGating = (
  selection: ArmySelection,
  { year, variant }: Gating,
): ArmySelection => ({ ...selection, year, variant });

const counted = (available: number, total: number): AvailabilityCount => ({
  available,
  total,
  withheld: total - available,
});

export const gatingEffect = (
  armyList: ArmyList,
  gating: Gating,
): GatingEffect => {
  const resolved = resolveArmyList(armyList, gating);
  return {
    yearInRange: dateRangeCoversYear(armyList.dateRange, gating.year),
    troopOptions: counted(
      resolved.main.troopOptions.length,
      armyList.main.troopOptions.length,
    ),
    contingentGroups: counted(
      offeredContingentGroups(resolved).length,
      offeredContingentGroups(armyList).length,
    ),
  };
};

const statusOf = (total: number, cap: number): PointsStatus => {
  if (total > cap) {
    return 'over';
  }
  return total === cap ? 'exact' : 'under';
};

export type MeteredPoints = Pick<
  ArmyPoints,
  'total' | 'standPoints' | 'allyStandPoints' | 'battleCardPoints'
>;

export const pointsMeter = (
  { total, standPoints, allyStandPoints, battleCardPoints }: MeteredPoints,
  { pointsCap }: ValidationRules = triumphRules,
): PointsMeter => ({
  total,
  cap: pointsCap,
  remaining: pointsCap - total,
  status: statusOf(total, pointsCap),
  standPoints,
  allyStandPoints,
  battleCardPoints,
  filled: Math.min(1, Math.max(0, total / pointsCap)),
});
