import { describe, expect, it } from 'vitest';
import { armyDetail } from '@/test/fixtures/army.ts';
import { randomSequence } from '@/test/random.ts';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { troopTypeCosts } from '../troop-types.ts';
import { buildArmyList } from './army-list';
import { armyPoints } from './points';
import {
  type ArmySelection,
  emptySelection,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withStands,
  withTroopBattleCard,
} from './selection';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const knights = list.main.troopOptions[2];
const optionalGroup = list.contingentGroups[0];
const allyGroup = list.contingentGroups[1];

if (!spearmen || !archers || !knights || !optionalGroup || !allyGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const lightFoot = optionalGroup.contingents[0].troopOptions[0];
const warband = allyGroup.contingents[0].troopOptions[0];
const horseBow = allyGroup.contingents[1]?.troopOptions[0];

if (!lightFoot || !warband || !horseBow) {
  throw new Error(
    'the fixture army no longer has the contingents the tests need',
  );
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const points = (selection: ArmySelection) => armyPoints(list, selection, costs);

describe('stand costs', () => {
  it('charges nothing for an empty selection', () => {
    expect(points(empty)).toEqual({
      standPoints: 0,
      allyStandPoints: 0,
      battleCardPoints: 0,
      total: 0,
      standLines: [],
      battleCardLines: [],
    });
  });

  it('charges each stand the cost of its troop type', () => {
    const selection = withStands(
      withStands(withStands(empty, spearmen, 'SPR', 3), archers, 'ARC', 2),
      archers,
      'BLV',
      1,
    );
    expect(points(selection).standLines).toEqual([
      {
        contingent: 'main',
        kind: 'main',
        option: spearmen.id,
        troopType: 'SPR',
        stands: 3,
        pointsPerStand: 4,
        points: 12,
      },
      {
        contingent: 'main',
        kind: 'main',
        option: archers.id,
        troopType: 'ARC',
        stands: 2,
        pointsPerStand: 4,
        points: 8,
      },
      {
        contingent: 'main',
        kind: 'main',
        option: archers.id,
        troopType: 'BLV',
        stands: 1,
        pointsPerStand: 2,
        points: 2,
      },
    ]);
    expect(points(selection).total).toBe(22);
  });

  it('leaves out stands in a contingent the army has not taken', () => {
    const selection = withStands(empty, horseBow, 'HBW', 2);
    expect(points(selection).total).toBe(0);
    expect(points(withContingentGroup(selection, allyGroup)).total).toBe(8);
  });

  it('tells the allied stands apart from the rest', () => {
    const selection = withStands(
      withStands(withContingentGroup(empty, allyGroup), horseBow, 'HBW', 2),
      spearmen,
      'SPR',
      3,
    );

    expect(points(selection)).toMatchObject({
      standPoints: 20,
      allyStandPoints: 8,
    });
  });

  it('counts the allied half of a group that also hands over a contingent', () => {
    const selection = withStands(
      withStands(withContingentGroup(empty, allyGroup), warband, 'WBD', 2),
      horseBow,
      'HBW',
      1,
    );

    expect(points(selection)).toMatchObject({
      standPoints: 10,
      allyStandPoints: 4,
    });
  });

  it('does not charge for the general', () => {
    const selection = withStands(empty, spearmen, 'SPR', 2);
    expect(
      points(withGeneral(selection, { option: spearmen.id, troopType: 'SPR' }))
        .total,
    ).toBe(points(selection).total);
  });
});

describe('battle card costs', () => {
  it('charges an army card once per copy', () => {
    expect(points(withArmyBattleCard(empty, 'FC', 1)).total).toBe(1);
    expect(points(withArmyBattleCard(empty, 'FC', 2)).total).toBe(2);
    expect(points(withArmyBattleCard(empty, 'PD', 3)).total).toBe(1.5);
  });

  it('gives away the first card of a whole troop entry card, army-wide', () => {
    const one = withTroopBattleCard(empty, spearmen, 'HL', 1);
    const two = withTroopBattleCard(one, archers, 'HL', 1);
    const three = withTroopBattleCard(two, knights, 'HL', 1);
    expect(
      [one, two, three].map((selection) => points(selection).total),
    ).toEqual([0, 1, 2]);
  });

  it('charges every card past the first on one entry as well', () => {
    expect(
      [1, 2, 3].map(
        (cards) =>
          points(withTroopBattleCard(empty, spearmen, 'HL', cards)).total,
      ),
    ).toEqual([0, 1, 2]);
  });

  it('spreads a whole troop entry card over the stands the option holds', () => {
    const selection = withTroopBattleCard(
      withStands(empty, spearmen, 'SPR', 4),
      spearmen,
      'HL',
      1,
    );
    expect(points(selection).battleCardLines).toEqual([
      {
        code: 'HL',
        purchases: 1,
        stands: 4,
        options: [spearmen.id],
        points: 0,
      },
    ]);
  });

  it('caps Charge Through at two points however many options buy it', () => {
    const selection = withTroopBattleCard(
      withTroopBattleCard(
        withTroopBattleCard(empty, spearmen, 'CT', 1),
        archers,
        'CT',
        1,
      ),
      knights,
      'CT',
      1,
    );
    expect(points(selection).total).toBe(2);
  });

  it('charges a card bought for the army once however many options apply it', () => {
    const one = withTroopBattleCard(empty, spearmen, 'DD', 3);
    const two = withTroopBattleCard(one, knights, 'DD', 2);
    expect([one, two].map((selection) => points(selection).total)).toEqual([
      1, 1,
    ]);
    expect(points(two).battleCardLines).toEqual([
      {
        code: 'DD',
        purchases: 1,
        stands: 5,
        options: [spearmen.id, knights.id],
        points: 1,
      },
    ]);
  });

  it('prices Mobile Infantry per troop option, not across the army', () => {
    const spread = withTroopBattleCard(
      withTroopBattleCard(empty, spearmen, 'MI', 1),
      knights,
      'MI',
      1,
    );
    const stacked = withTroopBattleCard(empty, spearmen, 'MI', 2);
    expect(points(spread).total).toBe(0);
    expect(points(stacked).total).toBe(1);
  });

  it('charges a per-stand card for every stand it is applied to', () => {
    expect(points(withTroopBattleCard(empty, archers, 'PL', 3)).total).toBe(3);
  });

  it('spreads an all-or-none card over every stand the option holds', () => {
    const stood = withStands(empty, archers, 'ARC', 3);

    expect(
      [1, 2, 3].map(
        (count) =>
          points(withTroopBattleCard(stood, archers, 'SS', count))
            .battleCardPoints,
      ),
    ).toEqual([3, 3, 3]);
  });

  it('counts one declared deception per army copy and per stand', () => {
    expect(points(withArmyBattleCard(empty, 'DC', 2)).total).toBe(2);
    expect(points(withTroopBattleCard(empty, archers, 'DC', 3)).total).toBe(3);
  });

  it('keeps a free card on the breakdown at zero points', () => {
    expect(points(withTroopBattleCard(empty, archers, 'HD', 2))).toMatchObject({
      total: 0,
      battleCardLines: [
        {
          code: 'HD',
          purchases: 1,
          stands: 2,
          options: [archers.id],
          points: 0,
        },
      ],
    });
  });

  it('leaves out cards on a contingent the army has not taken', () => {
    expect(points(withTroopBattleCard(empty, horseBow, 'SS', 2)).total).toBe(0);
  });
});

describe('cards that change what a stand costs', () => {
  const twoKnights = withStands(empty, knights, 'KNT', 2);

  it('takes a point off each stand it is applied to', () => {
    expect(
      points(withTroopBattleCard(twoKnights, knights, 'AC', 2)),
    ).toMatchObject({
      standPoints: 8,
      battleCardPoints: -2,
      total: 6,
    });
  });

  it('modifies a stand once when two cards are applied to the same option', () => {
    const selection = withTroopBattleCard(
      withTroopBattleCard(twoKnights, knights, 'AC', 2),
      knights,
      'CC',
      2,
    );
    expect(points(selection).total).toBe(6);
  });

  it('modifies no more stands than the option holds', () => {
    const selection = withTroopBattleCard(
      withStands(empty, knights, 'KNT', 1),
      knights,
      'AC',
      3,
    );
    expect(points(selection).total).toBe(3);
  });

  it('sets the cost of the stands it is applied to', () => {
    expect(
      points(withTroopBattleCard(twoKnights, knights, 'SF', 2)).total,
    ).toBe(7);
  });

  it('charges nothing for a modifier that reaches no stand', () => {
    expect(points(withArmyBattleCard(twoKnights, 'AC', 1))).toMatchObject({
      battleCardPoints: 0,
      total: 8,
    });
  });

  it('sets every stand of an all-or-none option, dear and cheap alike', () => {
    const selection = withTroopBattleCard(
      withStands(withStands(empty, archers, 'ARC', 1), archers, 'BLV', 1),
      archers,
      'SF',
      1,
    );
    expect(points(selection)).toMatchObject({
      standPoints: 6,
      battleCardPoints: 1,
      total: 7,
    });
  });

  it('reduces a cheap stand like any other', () => {
    const selection = withTroopBattleCard(
      withStands(empty, archers, 'BLV', 1),
      archers,
      'AC',
      1,
    );
    expect(points(selection).total).toBe(1);
  });
});

describe('the total is stable regardless of selection order', () => {
  const steps: readonly ((selection: ArmySelection) => ArmySelection)[] = [
    (selection) => withStands(selection, spearmen, 'SPR', 4),
    (selection) => withStands(selection, archers, 'ARC', 2),
    (selection) => withStands(selection, archers, 'BLV', 1),
    (selection) => withStands(selection, knights, 'KNT', 2),
    (selection) => withStands(selection, lightFoot, 'LFT', 2),
    (selection) => withStands(selection, warband, 'WBD', 1),
    (selection) => withStands(selection, horseBow, 'HBW', 2),
    (selection) => withContingentGroup(selection, optionalGroup),
    (selection) => withContingentGroup(selection, allyGroup),
    (selection) => withArmyBattleCard(selection, 'FC', 1),
    (selection) => withArmyBattleCard(selection, 'PD', 2),
    (selection) => withTroopBattleCard(selection, spearmen, 'HL', 4),
    (selection) => withTroopBattleCard(selection, knights, 'HL', 2),
    (selection) => withTroopBattleCard(selection, knights, 'AC', 2),
    (selection) => withTroopBattleCard(selection, archers, 'SS', 3),
    (selection) => withTroopBattleCard(selection, lightFoot, 'MI', 2),
    (selection) => withTroopBattleCard(selection, horseBow, 'DD', 2),
  ];

  const shuffled = (random: () => number) =>
    steps
      .map((step) => ({ step, key: random() }))
      .sort((left, right) => left.key - right.key)
      .map(({ step }) => step);

  const build = (
    order: readonly ((selection: ArmySelection) => ArmySelection)[],
  ) => order.reduce((selection, step) => step(selection), empty);

  const expected = points(build(steps));

  it('adds the stands and the battle cards up', () => {
    expect(expected.standPoints).toBe(51);
    expect(expected.battleCardPoints).toBe(10);
    expect(expected.total).toBe(61);
  });

  it.each(Array.from({ length: 50 }, (_run, seed) => seed))(
    'breaks the same army down the same way in order %i',
    (seed) => {
      expect(points(build(shuffled(randomSequence(seed + 1))))).toEqual(
        expected,
      );
    },
  );
});
