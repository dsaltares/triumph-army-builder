import type { TroopTypeCode } from '../../data/schema.ts';
import { sum } from '../numbers.ts';
import type { ArmyList, TroopOption } from './army-list.ts';
import { troopOptionWithholding, type Withholding } from './availability.ts';
import { type Bounds, boundsOf } from './bounds.ts';
import type { PointCosts } from './points.ts';
import {
  type ArmySelection,
  gatingOf,
  standCount,
  troopOptionStandCount,
} from './selection.ts';

export type TroopStepper = {
  troopType: TroopTypeCode;
  stands: number;
  pointsPerStand: number;
  points: number;
  canAdd: boolean;
  canRemove: boolean;
};

export type TroopOptionSelection = {
  option: TroopOption;
  stands: number;
  points: number;
  fill: Bounds;
  withheldBy: Withholding | null;
  mixedTypes: boolean;
  steppers: readonly TroopStepper[];
};

export type TroopOptionAvailability = {
  withheldBy: Withholding | null;
  fillable: boolean;
};

export type RequiredTroops = {
  options: readonly TroopOptionSelection[];
  stands: number;
  points: number;
  withheld: number;
};

export const troopOptionSelection = (
  option: TroopOption,
  selection: ArmySelection,
  costs: PointCosts,
  { withheldBy, fillable }: TroopOptionAvailability,
): TroopOptionSelection => {
  const stands = troopOptionStandCount(selection, option.id);
  const steppers = option.troopEntries.map(({ troopType }) => {
    const taken = standCount(selection, option.id, troopType);
    const pointsPerStand = costs.troopTypes[troopType];
    return {
      troopType,
      stands: taken,
      pointsPerStand,
      points: taken * pointsPerStand,
      canAdd: fillable && stands < option.max,
      canRemove: taken > 0,
    };
  });
  return {
    option,
    stands,
    points: sum(steppers.map((stepper) => stepper.points)),
    fill: boundsOf(stands, option.min, option.max),
    withheldBy,
    mixedTypes:
      option.mix === 'singleType' &&
      steppers.filter((stepper) => stepper.stands > 0).length > 1,
    steppers,
  };
};

export const requiredTroops = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
): RequiredTroops => {
  const gating = gatingOf(selection);
  const options = armyList.main.troopOptions
    .map((option) => ({
      option,
      withheldBy: troopOptionWithholding(option, armyList.subFactions, gating),
    }))
    .filter(
      ({ option, withheldBy }) =>
        withheldBy === null || troopOptionStandCount(selection, option.id) > 0,
    )
    .map(({ option, withheldBy }) =>
      troopOptionSelection(option, selection, costs, {
        withheldBy,
        fillable: withheldBy === null,
      }),
    );
  return {
    options,
    stands: sum(options.map(({ stands }) => stands)),
    points: sum(options.map(({ points }) => points)),
    withheld: armyList.main.troopOptions.length - options.length,
  };
};
