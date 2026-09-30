import { matchesAllTerms, searchTerms } from '../text-search.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import type { ArmyList } from './army-list.ts';
import { type PointsMeter, pointsMeter } from './builder.ts';
import { armyPoints, type PointCosts } from './points.ts';
import type { SavedArmy } from './saved-army.ts';
import type { ArmySelection } from './selection.ts';
import { validationReport } from './validation-report.ts';

export type SavedArmyStanding = {
  meter: PointsMeter;
  legal: boolean;
  errors: number;
  warnings: number;
};

export type SavedArmyEntry = {
  army: SavedArmy;
  listName: string | null;
  standing: SavedArmyStanding | null;
};

export const savedArmyStanding = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  names: TroopTypeNames,
): SavedArmyStanding => {
  const { legal, errors, warnings } = validationReport(
    armyList,
    selection,
    costs,
    names,
  );
  return {
    meter: pointsMeter(armyPoints(armyList, selection, costs)),
    legal,
    errors,
    warnings,
  };
};

export const searchSavedArmies = (
  entries: readonly SavedArmyEntry[],
  search: string,
): SavedArmyEntry[] => {
  const terms = searchTerms(search);
  return entries.filter(({ army, listName }) =>
    matchesAllTerms([army.name, listName], terms),
  );
};
