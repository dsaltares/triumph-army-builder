import type { BattleCardNames } from '../battle-cards/listing.ts';
import { type FindingReport, findingReport } from '../findings.ts';
import { triumphRules } from '../games/triumph-rules.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import type { ArmyList } from './army-list.ts';
import type { PointCosts } from './points.ts';
import type { ArmySelection } from './selection.ts';
import {
  type Finding,
  type ValidationRules,
  validateArmy,
} from './validation.ts';

export type ValidationReport = FindingReport<Finding>;

export const validationReport = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  names: TroopTypeNames,
  rules: ValidationRules = triumphRules,
  cardNames: BattleCardNames = {},
): ValidationReport =>
  findingReport(
    validateArmy(armyList, selection, costs, names, rules, cardNames),
  );
