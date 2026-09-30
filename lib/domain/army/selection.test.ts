import { describe, expect, it } from 'vitest';
import { armyDetail, contingentArmyDetail } from '@/test/fixtures/army.ts';
import {
  allyTroopOptionGroups,
  buildArmyList,
  optionalContingentGroups,
  type TroopOptionId,
} from './army-list';
import {
  type ArmySelection,
  battleCardSelections,
  emptySelection,
  hasContingentGroup,
  isGeneral,
  selectedContingents,
  standCount,
  standsOf,
  totalStandCount,
  troopOptionStandCount,
  withAllyTroopOption,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withoutContingentGroup,
  withStands,
  withTroopBattleCard,
} from './selection';

const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const optionalGroup = list.contingentGroups[0];
const allyGroup = list.contingentGroups[1];

if (!spearmen || !archers || !optionalGroup || !allyGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const optionalOption = optionalGroup.contingents[0].troopOptions[0];
const allyOption = allyGroup.contingents[1]?.troopOptions[0];

if (!optionalOption || !allyOption) {
  throw new Error(
    'the fixture army no longer has the contingents the tests need',
  );
}

const empty = emptySelection({
  army: list.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

describe('emptySelection', () => {
  it('selects nothing but the army, the year and the data version', () => {
    expect(empty).toEqual({
      army: 'army-1',
      dataVersion: '2026-09-17.abcdef01',
      year: -2900,
      variant: null,
      contingentGroups: [],
      stands: {},
      general: null,
      armyBattleCards: {},
      troopBattleCards: {},
    });
  });

  it('carries the sub-faction variant when the army asks for one', () => {
    expect(
      emptySelection({
        army: list.id,
        dataVersion: '2026-09-17.abcdef01',
        year: -2900,
        variant: 'kish',
      }).variant,
    ).toBe('kish');
  });
});

describe('withStands', () => {
  it('counts stands per troop type within a troop option', () => {
    const selection = withStands(
      withStands(empty, archers, 'ARC', 2),
      archers,
      'BLV',
      1,
    );
    expect(selection.stands).toEqual({ 'main/1': { ARC: 2, BLV: 1 } });
    expect(standCount(selection, archers.id, 'ARC')).toBe(2);
    expect(troopOptionStandCount(selection, archers.id)).toBe(3);
    expect(totalStandCount(selection)).toBe(3);
  });

  it('counts no stands for an option nothing has been put in', () => {
    expect(troopOptionStandCount(empty, spearmen.id)).toBe(0);
    expect(totalStandCount(empty)).toBe(0);
  });

  it('leaves the original selection untouched', () => {
    withStands(empty, spearmen, 'SPR', 3);
    expect(empty.stands).toEqual({});
  });

  it('drops a troop type at zero and the option once it is empty', () => {
    const selection = withStands(
      withStands(withStands(empty, archers, 'ARC', 2), archers, 'BLV', 1),
      archers,
      'ARC',
      0,
    );
    expect(selection.stands).toEqual({ 'main/1': { BLV: 1 } });
    expect(withStands(selection, archers, 'BLV', 0).stands).toEqual({});
  });

  it('refuses to count a fraction of a stand or a negative one', () => {
    expect(
      standCount(withStands(empty, spearmen, 'SPR', 2.7), spearmen.id, 'SPR'),
    ).toBe(2);
    expect(withStands(empty, spearmen, 'SPR', -3).stands).toEqual({});
  });

  it('refuses a troop type the option does not offer', () => {
    expect(() => withStands(empty, spearmen, 'ARC', 1)).toThrowError(
      /main\/0 has no ARC troop entry/,
    );
  });

  it('gives up the general when its last stand goes', () => {
    const selection = withGeneral(withStands(empty, spearmen, 'SPR', 2), {
      option: spearmen.id,
      troopType: 'SPR',
    });
    expect(withStands(selection, spearmen, 'SPR', 1).general).toEqual({
      option: 'main/0',
      troopType: 'SPR',
    });
    expect(withStands(selection, spearmen, 'SPR', 0).general).toBeNull();
  });
});

describe('withGeneral', () => {
  const selection = withStands(empty, spearmen, 'SPR', 2);

  it('designates a stand that has been selected', () => {
    const general = withGeneral(selection, {
      option: spearmen.id,
      troopType: 'SPR',
    });
    expect(isGeneral(general, spearmen.id, 'SPR')).toBe(true);
    expect(isGeneral(general, archers.id, 'ARC')).toBe(false);
  });

  it('gives the designation up again', () => {
    expect(withGeneral(selection, null).general).toBeNull();
  });

  it('refuses a stand that is not in the army', () => {
    expect(() =>
      withGeneral(selection, { option: archers.id, troopType: 'ARC' }),
    ).toThrowError(/main\/1 has no ARC stand to make the general/);
  });
});

describe('contingent groups', () => {
  it('takes a group whole and only once', () => {
    const taken = withContingentGroup(empty, allyGroup);
    expect(taken.contingentGroups).toEqual(['group/1']);
    expect(withContingentGroup(taken, allyGroup)).toBe(taken);
    expect(hasContingentGroup(taken, allyGroup)).toBe(true);
    expect(hasContingentGroup(taken, optionalGroup)).toBe(false);
  });

  it('takes every contingent the group bundles', () => {
    expect(
      selectedContingents(list, withContingentGroup(empty, allyGroup)).map(
        ({ id }) => id,
      ),
    ).toEqual(['main', 'contingent-bundled', 'contingent-ally']);
  });

  it('counts a contingent once when two taken groups share it', () => {
    const shared = buildArmyList(
      armyDetail({
        allyOptions: [
          {
            allyEntries: [
              { allyArmyList: 'contingent-optional', name: 'Friends' },
            ],
            dateRange: null,
            note: null,
          },
          {
            allyEntries: [
              { allyArmyList: 'contingent-optional', name: 'Friends again' },
            ],
            dateRange: null,
            note: null,
          },
        ],
      }),
    );
    const selection = shared.contingentGroups.reduce(
      withContingentGroup,
      emptySelection({ army: shared.id, dataVersion: 'x', year: -2900 }),
    );
    expect(selectedContingents(shared, selection).map(({ id }) => id)).toEqual([
      'main',
      'contingent-optional',
    ]);
  });

  it('gives up the stands, the cards and the general it carried when dropped', () => {
    const taken = withGeneral(
      withTroopBattleCard(
        withStands(
          withStands(
            withContingentGroup(empty, allyGroup),
            allyOption,
            'HBW',
            2,
          ),
          spearmen,
          'SPR',
          3,
        ),
        allyOption,
        'SS',
        2,
      ),
      { option: allyOption.id, troopType: 'HBW' },
    );
    const dropped = withoutContingentGroup(taken, allyGroup);
    expect(dropped.contingentGroups).toEqual([]);
    expect(dropped.stands).toEqual({ 'main/0': { SPR: 3 } });
    expect(dropped.troopBattleCards).toEqual({});
    expect(dropped.general).toBeNull();
  });

  it('keeps a general that stands outside the group', () => {
    const taken = withGeneral(
      withStands(withContingentGroup(empty, allyGroup), spearmen, 'SPR', 1),
      { option: spearmen.id, troopType: 'SPR' },
    );
    expect(withoutContingentGroup(taken, allyGroup).general).toEqual({
      option: 'main/0',
      troopType: 'SPR',
    });
  });
});

describe('the ally slot', () => {
  const allied = buildArmyList(contingentArmyDetail());
  const [horse, foot] = allyTroopOptionGroups(allied);
  const [friends] = optionalContingentGroups(allied);

  if (!horse || !foot || !friends) {
    throw new Error('the fixture army no longer offers the allies tests need');
  }

  const horseBow = horse.contingents[0].troopOptions[0];
  const alliedFoot = foot.contingents[0].troopOptions[0];

  if (!horseBow || !alliedFoot) {
    throw new Error('the fixture allies no longer offer a troop option');
  }

  const start = emptySelection({
    army: allied.id,
    dataVersion: '2026-09-17.abcdef01',
    year: -2950,
  });

  const withHorse = withStands(
    withAllyTroopOption(allied, start, horse),
    horseBow,
    'HBW',
    2,
  );

  it('takes the ally troop option it is given', () => {
    expect(withAllyTroopOption(allied, start, horse).contingentGroups).toEqual([
      horse.id,
    ]);
  });

  it('keeps at most one, dropping the stands of the one it replaces', () => {
    const swapped = withAllyTroopOption(allied, withHorse, foot);

    expect(swapped.contingentGroups).toEqual([foot.id]);
    expect(swapped.stands).toEqual({});
  });

  it('takes no ally at all when given none', () => {
    const dropped = withAllyTroopOption(allied, withHorse, null);

    expect(dropped.contingentGroups).toEqual([]);
    expect(dropped.stands).toEqual({});
  });

  it('leaves the optional contingents where they are', () => {
    const taken = withAllyTroopOption(
      allied,
      withContingentGroup(withHorse, friends),
      foot,
    );

    expect(taken.contingentGroups).toEqual([friends.id, foot.id]);
  });

  it('leaves a selection that already holds it untouched', () => {
    expect(withAllyTroopOption(allied, withHorse, horse)).toBe(withHorse);
  });
});

describe('battle cards', () => {
  it('counts army cards by copies and troop cards by stands', () => {
    const selection = withTroopBattleCard(
      withArmyBattleCard(empty, 'FC', 1),
      archers,
      'SS',
      2,
    );
    expect(selection.armyBattleCards).toEqual({ FC: 1 });
    expect(selection.troopBattleCards).toEqual({ 'main/1': { SS: 2 } });
  });

  it('counts a card bought for a whole troop entry in cards', () => {
    const selection = withTroopBattleCard(empty, spearmen, 'HL', 3);

    expect(selection.troopBattleCards).toEqual({ 'main/0': { HL: 3 } });
  });

  it('drops a card at zero and the option once it holds none', () => {
    const selection = withTroopBattleCard(
      withArmyBattleCard(withArmyBattleCard(empty, 'FC', 1), 'AM', 2),
      spearmen,
      'HL',
      2,
    );
    expect(withArmyBattleCard(selection, 'FC', 0).armyBattleCards).toEqual({
      AM: 2,
    });
    expect(
      withTroopBattleCard(selection, spearmen, 'HL', 0).troopBattleCards,
    ).toEqual({});
  });

  it('flattens to one selection per card, army first and then by option', () => {
    const selection = withTroopBattleCard(
      withTroopBattleCard(
        withTroopBattleCard(
          withArmyBattleCard(withArmyBattleCard(empty, 'PT', 1), 'AM', 2),
          archers,
          'SS',
          2,
        ),
        spearmen,
        'HL',
        1,
      ),
      spearmen,
      'CT',
      3,
    );
    expect(battleCardSelections(selection)).toEqual([
      { scope: 'army', code: 'AM', copies: 2 },
      { scope: 'army', code: 'PT', copies: 1 },
      { scope: 'troopOption', code: 'CT', option: 'main/0', stands: 3 },
      { scope: 'troopOption', code: 'HL', option: 'main/0', stands: 1 },
      { scope: 'troopOption', code: 'SS', option: 'main/1', stands: 2 },
    ]);
  });

  it('leaves cards that are already in order where they are', () => {
    const selection = withTroopBattleCard(
      withTroopBattleCard(
        withArmyBattleCard(withArmyBattleCard(empty, 'AM', 1), 'PT', 1),
        spearmen,
        'CT',
        1,
      ),
      archers,
      'SS',
      1,
    );
    expect(battleCardSelections(selection).map(({ code }) => code)).toEqual([
      'AM',
      'PT',
      'CT',
      'SS',
    ]);
  });

  it('flattens an empty selection to nothing', () => {
    expect(battleCardSelections(empty)).toEqual([]);
  });
});

describe('standsOf', () => {
  const selection = withGeneral(
    withStands(
      withStands(
        withStands(
          withContingentGroup(empty, optionalGroup),
          archers,
          'BLV',
          1,
        ),
        spearmen,
        'SPR',
        2,
      ),
      optionalOption,
      'LFT',
      1,
    ),
    { option: spearmen.id, troopType: 'SPR' },
  );

  it('expands the counts into one stand each, in army list order', () => {
    expect(standsOf(list, selection)).toEqual([
      {
        contingent: 'main',
        option: 'main/0',
        troopType: 'SPR',
        battleLine: 'all',
        general: true,
      },
      {
        contingent: 'main',
        option: 'main/0',
        troopType: 'SPR',
        battleLine: 'all',
        general: false,
      },
      {
        contingent: 'main',
        option: 'main/1',
        troopType: 'BLV',
        battleLine: 'none',
        general: false,
      },
      {
        contingent: 'contingent-optional',
        option: 'contingent-optional/0',
        troopType: 'LFT',
        battleLine: 'all',
        general: false,
      },
    ]);
  });

  it('orders the stands the same way whatever order they were chosen in', () => {
    const reversed = withGeneral(
      withStands(
        withStands(
          withStands(
            withContingentGroup(empty, optionalGroup),
            optionalOption,
            'LFT',
            1,
          ),
          archers,
          'BLV',
          1,
        ),
        spearmen,
        'SPR',
        2,
      ),
      { option: spearmen.id, troopType: 'SPR' },
    );
    expect(standsOf(list, reversed)).toEqual(standsOf(list, selection));
  });

  it('makes exactly one stand the general', () => {
    expect(
      standsOf(list, selection).filter(({ general }) => general),
    ).toHaveLength(1);
  });

  it('leaves out the stands of a contingent that is not taken', () => {
    const untaken: ArmySelection = {
      ...selection,
      contingentGroups: [],
    };
    expect(
      standsOf(list, untaken).map(({ option }) => option as TroopOptionId),
    ).toEqual(['main/0', 'main/0', 'main/1']);
  });

  it('expands nothing for an empty selection', () => {
    expect(standsOf(list, empty)).toEqual([]);
  });
});
