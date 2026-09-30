import { describe, expect, it } from 'vitest';
import { armyDetail } from '@/test/fixtures/army.ts';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { troopTypeCosts, troopTypeNames } from '../troop-types.ts';
import { buildArmyList } from './army-list';
import {
  type ArmySelection,
  emptySelection,
  withGeneral,
  withStands,
} from './selection';
import { validationReport } from './validation-report';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);

const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const knights = list.main.troopOptions[2];
const optionalGroup = list.contingentGroups[0];

if (!spearmen || !archers || !knights || !optionalGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const lightFoot = optionalGroup.contingents[0].troopOptions[0];

if (!lightFoot) {
  throw new Error('the fixture army no longer offers a contingent to leave');
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const filled = withStands(
  withStands(withStands(empty, spearmen, 'SPR', 6), archers, 'ARC', 4),
  knights,
  'KNT',
  2,
);

const legal = withGeneral(filled, { option: spearmen.id, troopType: 'SPR' });

const report = (selection: ArmySelection) =>
  validationReport(list, selection, costs, names);

describe('validationReport', () => {
  it('has nothing to say about a legal army', () => {
    expect(report(legal)).toEqual({
      findings: [],
      errors: 0,
      warnings: 0,
      notes: 0,
      legal: true,
    });
  });

  it('counts the findings by severity', () => {
    const { errors, warnings, notes } = report(empty);

    expect({ errors, warnings, notes }).toEqual({
      errors: 2,
      warnings: 1,
      notes: 0,
    });
  });

  it('reads the errors first, then the warnings, then the notes', () => {
    const { findings } = report(withStands(empty, lightFoot, 'LFT', 1));

    expect(findings.map(({ severity }) => severity)).toEqual([
      'error',
      'error',
      'warning',
      'info',
    ]);
  });

  it('keeps the order the validator answered in within a severity', () => {
    const { findings } = report(empty);

    expect(findings.map(({ code }) => code)).toEqual([
      'troopOptionBelowMin',
      'generalMissing',
      'underPointsCap',
    ]);
  });

  it('is illegal only when something is an error', () => {
    expect(report(filled).legal).toBe(false);
    expect(report(withStands(legal, knights, 'KNT', 1)).legal).toBe(true);
  });

  it('judges against the rules it is given', () => {
    const { legal: under, findings } = validationReport(
      list,
      legal,
      costs,
      names,
      { pointsCap: 40 },
    );

    expect(under).toBe(false);
    expect(findings.map(({ code }) => code)).toEqual(['overPointsCap']);
  });
});
