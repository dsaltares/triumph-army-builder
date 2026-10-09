import type { BattleCardNames } from '../battle-cards/listing.ts';
import { triumphRules } from '../games/triumph-rules.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import type { ArmyList } from './army-list.ts';
import type { PointCosts } from './points.ts';
import type { ArmySelection } from './selection.ts';
import {
  type Finding,
  type FindingSeverity,
  isLegal,
  type ValidationRules,
  validateArmy,
} from './validation.ts';

export type ValidationReport = {
  findings: readonly Finding[];
  errors: number;
  warnings: number;
  notes: number;
  legal: boolean;
};

const severityOrder: Readonly<Record<FindingSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
};

const countOf = (findings: readonly Finding[], severity: FindingSeverity) =>
  findings.filter((finding) => finding.severity === severity).length;

export const validationReport = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  names: TroopTypeNames,
  rules: ValidationRules = triumphRules,
  cardNames: BattleCardNames = {},
): ValidationReport => {
  const findings = [
    ...validateArmy(armyList, selection, costs, names, rules, cardNames),
  ].sort(
    (left, right) =>
      severityOrder[left.severity] - severityOrder[right.severity],
  );
  return {
    findings,
    errors: countOf(findings, 'error'),
    warnings: countOf(findings, 'warning'),
    notes: countOf(findings, 'info'),
    legal: isLegal(findings),
  };
};
