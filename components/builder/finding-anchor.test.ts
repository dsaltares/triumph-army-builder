import { describe, expect, it } from 'vitest';
import {
  builderAnchors,
  findingAnchor,
} from '@/components/builder/finding-anchor';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { battleCardChoices } from '@/lib/domain/army/battle-card-selection';
import {
  allyTroopOptions,
  optionalContingents,
} from '@/lib/domain/army/contingent-selection';
import type { ArmySelection } from '@/lib/domain/army/selection';
import {
  emptySelection,
  withContingentGroup,
} from '@/lib/domain/army/selection';
import { requiredTroops } from '@/lib/domain/army/troop-selection';
import { troopTypeCosts } from '@/lib/domain/troop-types';
import { armyDetail } from '@/test/fixtures/army';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};

const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const optionalGroup = list.contingentGroups[0];

if (!spearmen || !optionalGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const lightFoot = optionalGroup.contingents[0].troopOptions[0];

if (!lightFoot) {
  throw new Error('the fixture army no longer offers a contingent to take');
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const anchorsFor = (selection: ArmySelection) =>
  builderAnchors({
    troops: requiredTroops(list, selection, costs),
    contingents: optionalContingents(list, selection, costs),
    allies: allyTroopOptions(list, selection, costs),
    cards: battleCardChoices(list, selection, costs),
  });

describe('findingAnchor', () => {
  it('names one element per target, without a character an id may not carry', () => {
    expect(findingAnchor({ kind: 'army' })).toBe('points');
    expect(findingAnchor({ kind: 'gating' })).toBe('gating');
    expect(findingAnchor({ kind: 'general' })).toBe('general');
    expect(
      findingAnchor({ kind: 'contingentGroup', group: optionalGroup.id }),
    ).toBe('contingent-group-0');
    expect(findingAnchor({ kind: 'troopOption', option: spearmen.id })).toBe(
      'troops-main-0',
    );
    expect(findingAnchor({ kind: 'armyBattleCard', code: 'FC' })).toBe(
      'card-army-FC',
    );
    expect(
      findingAnchor({
        kind: 'troopBattleCard',
        code: 'HL',
        option: spearmen.id,
      }),
    ).toBe('card-main-0-HL');
  });
});

describe('builderAnchors', () => {
  it('holds the three the builder always draws', () => {
    const anchors = anchorsFor(empty);

    expect(anchors.has('points')).toBe(true);
    expect(anchors.has('gating')).toBe(true);
    expect(anchors.has('general')).toBe(true);
  });

  it('holds a troop option and its battle card rows', () => {
    const anchors = anchorsFor(empty);

    expect(anchors.has('troops-main-0')).toBe(true);
    expect(anchors.has('card-army-FC')).toBe(true);
    expect(anchors.has('card-main-0-HL')).toBe(true);
  });

  it('holds a contingent group, and its troop options only once taken', () => {
    const untaken = anchorsFor(empty);

    expect(untaken.has('contingent-group-0')).toBe(true);
    expect(
      untaken.has(findingAnchor({ kind: 'troopOption', option: lightFoot.id })),
    ).toBe(false);

    const taken = anchorsFor(withContingentGroup(empty, optionalGroup));

    expect(
      taken.has(findingAnchor({ kind: 'troopOption', option: lightFoot.id })),
    ).toBe(true);
  });
});
