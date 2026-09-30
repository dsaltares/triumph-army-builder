import { describe, expect, it } from 'vitest';
import type { SubFactionGroup } from '@/lib/data/sub-factions.ts';
import { armyDetail, entries, troopOption } from '@/test/fixtures/army.ts';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { troopTypeCosts } from '../troop-types.ts';
import { buildArmyList, type TroopOption } from './army-list';
import { type ArmySelection, emptySelection, withStands } from './selection';
import { requiredTroops } from './troop-selection';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};

const subFactions: SubFactionGroup = {
  army: 'Fixture Army',
  label: 'Sub-faction',
  variants: [
    { id: 'kish', name: 'Kish' },
    { id: 'other', name: 'Other city-states' },
  ],
  rules: { 'only Kish': { only: ['kish'] } },
};

const list = buildArmyList(armyDetail({ subFactions }));

const singleTypeList = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({
        min: 2,
        max: 4,
        troopEntries: entries('PIK', 'HFT').map((entry) => ({
          ...entry,
          note: 'all',
        })),
      }),
    ],
  }),
);

const optionAt = (armyList = list, index = 0): TroopOption => {
  const option = armyList.main.troopOptions[index];
  if (!option) {
    throw new Error('the fixture army no longer has the option the tests need');
  }
  return option;
};

const spearmen = optionAt();
const archers = optionAt(list, 1);
const knights = optionAt(list, 2);
const pikes = optionAt(singleTypeList);

const selectionAt = (
  year: number,
  variant: string | null = null,
): ArmySelection =>
  emptySelection({
    army: list.id,
    dataVersion: '2026-09-17.abcdef01',
    year,
    variant,
  });

const empty = selectionAt(-2950, 'kish');

const troops = (selection: ArmySelection, armyList = list) =>
  requiredTroops(armyList, selection, costs);

const forOption = (selection: ArmySelection, option: TroopOption) => {
  const found = troops(selection).options.find(
    ({ option: candidate }) => candidate.id === option.id,
  );
  if (!found) {
    throw new Error(`${option.id} is not among the options offered`);
  }
  return found;
};

describe('requiredTroops', () => {
  it('offers every option the gating leaves available', () => {
    const { options, withheld } = troops(empty);

    expect(options.map(({ option }) => option.id)).toEqual([
      spearmen.id,
      archers.id,
      knights.id,
    ]);
    expect(withheld).toBe(0);
  });

  it('counts an empty army as no stands and no points', () => {
    expect(troops(empty)).toMatchObject({ stands: 0, points: 0 });
  });

  it('prices a stand at the cost of its troop type', () => {
    const selection = withStands(empty, spearmen, 'SPR', 3);
    const [stepper] = forOption(selection, spearmen).steppers;

    expect(stepper).toMatchObject({
      troopType: 'SPR',
      stands: 3,
      pointsPerStand: 4,
      points: 12,
    });
    expect(troops(selection)).toMatchObject({ stands: 3, points: 12 });
  });

  it('totals a multi-type option over all of its troop types', () => {
    const selection = withStands(
      withStands(empty, archers, 'ARC', 2),
      archers,
      'BLV',
      1,
    );

    expect(forOption(selection, archers)).toMatchObject({
      stands: 3,
      points: 10,
    });
  });
});

describe('the stepper bounds', () => {
  it('offers nothing to remove while an option is empty', () => {
    expect(forOption(empty, spearmen).steppers[0]?.canRemove).toBe(false);
    expect(forOption(empty, spearmen).steppers[0]?.canAdd).toBe(true);
  });

  it('stops adding once the option is at its maximum', () => {
    const selection = withStands(empty, spearmen, 'SPR', 6);
    const [stepper] = forOption(selection, spearmen).steppers;

    expect(stepper).toMatchObject({ canAdd: false, canRemove: true });
  });

  it('shares one maximum across the troop types of a free mix', () => {
    const selection = withStands(empty, archers, 'ARC', 4);

    expect(
      forOption(selection, archers).steppers.map(
        ({ troopType, canAdd }) => [troopType, canAdd] as const,
      ),
    ).toEqual([
      ['ARC', false],
      ['BLV', false],
    ]);
  });

  it('keeps removing from an option that is over its maximum', () => {
    const selection = withStands(empty, knights, 'KNT', 5);

    expect(forOption(selection, knights).steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
  });
});

describe('how full an option is', () => {
  it('is below its minimum until the minimum is met', () => {
    expect(forOption(empty, spearmen).fill).toBe('belowMin');
    expect(
      forOption(withStands(empty, spearmen, 'SPR', 1), spearmen).fill,
    ).toBe('belowMin');
  });

  it('is met anywhere between the minimum and the maximum', () => {
    expect(
      forOption(withStands(empty, spearmen, 'SPR', 2), spearmen).fill,
    ).toBe('met');
    expect(
      forOption(withStands(empty, spearmen, 'SPR', 6), spearmen).fill,
    ).toBe('met');
  });

  it('is met while an option with no minimum is empty', () => {
    expect(forOption(empty, knights).fill).toBe('met');
  });

  it('is above its maximum past the maximum', () => {
    expect(forOption(withStands(empty, knights, 'KNT', 3), knights).fill).toBe(
      'aboveMax',
    );
  });
});

describe('an option whose entries are annotated all', () => {
  it('takes one troop type without complaint', () => {
    const selection = withStands(
      emptySelection({
        army: singleTypeList.id,
        dataVersion: '2026-09-17.abcdef01',
        year: -2950,
      }),
      pikes,
      'PIK',
      3,
    );

    expect(troops(selection, singleTypeList).options[0]?.mixedTypes).toBe(
      false,
    );
  });

  it('reports a mix of two of them rather than refusing it', () => {
    const selection = withStands(
      withStands(
        emptySelection({
          army: singleTypeList.id,
          dataVersion: '2026-09-17.abcdef01',
          year: -2950,
        }),
        pikes,
        'PIK',
        2,
      ),
      pikes,
      'HFT',
      1,
    );
    const [only] = troops(selection, singleTypeList).options;

    expect(only).toMatchObject({ mixedTypes: true, stands: 3 });
    expect(only?.steppers.every(({ canAdd }) => canAdd)).toBe(true);
  });

  it('leaves a free mix unreported', () => {
    const selection = withStands(
      withStands(empty, archers, 'ARC', 1),
      archers,
      'BLV',
      1,
    );

    expect(forOption(selection, archers).mixedTypes).toBe(false);
  });
});

describe('withheld options', () => {
  it('drops an option the year has gated away', () => {
    const { options, withheld } = troops(selectionAt(-2850, 'kish'));

    expect(options.map(({ option }) => option.id)).toEqual([
      spearmen.id,
      knights.id,
    ]);
    expect(withheld).toBe(1);
  });

  it('drops an option the sub-faction question withholds', () => {
    const { options, withheld } = troops(selectionAt(-2950));

    expect(options.map(({ option }) => option.id)).not.toContain(archers.id);
    expect(withheld).toBe(1);
  });

  it('keeps a withheld option that still holds stands, and says why', () => {
    const selection = withStands(selectionAt(-2850, 'kish'), archers, 'ARC', 2);

    expect(forOption(selection, archers)).toMatchObject({
      withheldBy: 'year',
      stands: 2,
    });
    expect(troops(selection).withheld).toBe(0);
  });

  it('names the sub-faction as what withholds an option in range', () => {
    const selection = withStands(selectionAt(-2950), archers, 'ARC', 2);

    expect(forOption(selection, archers).withheldBy).toBe('subFaction');
  });

  it('lets a withheld option be emptied but not filled', () => {
    const selection = withStands(selectionAt(-2850, 'kish'), archers, 'ARC', 2);

    expect(forOption(selection, archers).steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
  });

  it('still counts the stands of a withheld option in the total', () => {
    const selection = withStands(selectionAt(-2850, 'kish'), archers, 'ARC', 2);

    expect(troops(selection)).toMatchObject({ stands: 2, points: 8 });
  });
});
