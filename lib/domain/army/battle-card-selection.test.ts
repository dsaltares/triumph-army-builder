import { beforeAll, describe, expect, it } from 'vitest';
import type { SubFactionGroup } from '@/lib/data/sub-factions';
import {
  armyDetail,
  battleCardEntry,
  entries,
  troopOption,
} from '@/test/fixtures/army';
import {
  sampleArmyLists,
  sampleBattleCardCosts,
  sampleTroopTypes,
} from '@/test/sample.ts';
import { troopTypeCosts } from '../troop-types';
import { type ArmyList, buildArmyList, type TroopOption } from './army-list';
import { battleCardChoices } from './battle-card-selection';
import { armyPoints } from './points';
import {
  type ArmySelection,
  emptySelection,
  withArmyBattleCard,
  withStands,
  withTroopBattleCard,
} from './selection';

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

const listWith = (overrides: Parameters<typeof armyDetail>[0]) =>
  buildArmyList(armyDetail(overrides));

const selectionFor = (armyList: ArmyList, gating = {}) =>
  emptySelection({
    army: armyList.id,
    dataVersion: '2026-09-18.abcdef01',
    year: -2950,
    variant: 'kish',
    ...gating,
  });

const optionAt = (armyList: ArmyList, index: number): TroopOption => {
  const option = armyList.main.troopOptions[index];
  if (!option) {
    throw new Error(`the fixture army has no troop option ${index}`);
  }
  return option;
};

const choicesFor = (armyList: ArmyList, selection: ArmySelection) =>
  battleCardChoices(armyList, selection, costs);

const perStandList = (allowance: { min?: number; max?: number } = {}) =>
  listWith({
    troopOptions: [
      troopOption({
        min: 1,
        max: 5,
        battleCardEntries: [
          battleCardEntry({
            battleCardCode: 'PL',
            min: allowance.min ?? null,
            max: allowance.max ?? null,
          }),
        ],
      }),
    ],
  });

const fixture = listWith({ subFactions });
const spearmen = optionAt(fixture, 0);
const empty = selectionFor(fixture);

describe('battleCardChoices', () => {
  it('offers the cards the army carries as a whole', () => {
    const { army } = choicesFor(fixture, empty);

    expect(army).toEqual([
      expect.objectContaining({
        code: 'FC',
        name: 'Fortified Camp',
        count: 0,
        min: null,
        max: null,
        limit: 1,
        purchasedPer: 'army',
        points: 0,
        bounds: 'met',
        canAdd: true,
        canRemove: false,
      }),
    ]);
  });

  it('prices an army-wide card from the points engine', () => {
    const taken = withArmyBattleCard(empty, 'FC', 1);
    const { army, points, taken: count } = choicesFor(fixture, taken);

    expect(army[0]?.points).toBe(1);
    expect(army[0]?.canAdd).toBe(false);
    expect(army[0]?.canRemove).toBe(true);
    expect(points).toBe(armyPoints(fixture, taken, costs).battleCardPoints);
    expect(count).toBe(1);
  });

  it('caps a card with no stated maximum at one copy', () => {
    const list = listWith({
      battleCardEntries: [battleCardEntry({ battleCardCode: 'PD' })],
    });

    expect(choicesFor(list, selectionFor(list)).army[0]?.limit).toBe(1);
  });

  it('opens a card up to the maximum the army states', () => {
    const list = listWith({
      battleCardEntries: [
        battleCardEntry({ battleCardCode: 'PD', min: 0, max: 3 }),
      ],
    });
    const selection = withArmyBattleCard(selectionFor(list), 'PD', 2);
    const [choice] = choicesFor(list, selection).army;

    expect(choice).toMatchObject({ limit: 3, max: 3, count: 2, canAdd: true });
    expect(choice?.points).toBe(1);
  });

  it('reports a count above the maximum rather than clamping it', () => {
    const list = listWith({
      battleCardEntries: [
        battleCardEntry({ battleCardCode: 'PD', min: 0, max: 1 }),
      ],
    });
    const selection = withArmyBattleCard(selectionFor(list), 'PD', 3);
    const [choice] = choicesFor(list, selection).army;

    expect(choice?.bounds).toBe('aboveMax');
    expect(choice?.canAdd).toBe(false);
    expect(choice?.canRemove).toBe(true);
  });

  it('reports a count below a minimum the army insists on', () => {
    const list = listWith({
      battleCardEntries: [
        battleCardEntry({ battleCardCode: 'PD', min: 1, max: 2 }),
      ],
    });

    expect(choicesFor(list, selectionFor(list)).army[0]?.bounds).toBe(
      'belowMin',
    );
  });

  it('carries the note the army list prints beside a card', () => {
    const list = listWith({
      battleCardEntries: [battleCardEntry({ note: 'Wagon laager' })],
    });

    expect(choicesFor(list, selectionFor(list)).army[0]?.note).toBe(
      'Wagon laager',
    );
  });

  it('offers a card once however many times the army list repeats it', () => {
    const list = listWith({
      battleCardEntries: [
        battleCardEntry({
          battleCardCode: 'PD',
          min: 1,
          max: 2,
          note: 'Ditch',
        }),
        battleCardEntry({
          battleCardCode: 'PD',
          min: 0,
          max: 3,
          note: 'Wagon laager',
        }),
      ],
    });
    const { army } = choicesFor(list, selectionFor(list));

    expect(army).toHaveLength(1);
    expect(army[0]).toMatchObject({
      min: 0,
      max: 3,
      note: 'Ditch · Wagon laager',
    });
  });

  it('keeps a repeated card unbounded when either clause leaves it so', () => {
    const list = listWith({
      battleCardEntries: [
        battleCardEntry({ battleCardCode: 'PD', min: 0, max: 2 }),
        battleCardEntry({ battleCardCode: 'PD' }),
      ],
    });
    const [choice] = choicesFor(list, selectionFor(list)).army;

    expect(choice).toMatchObject({
      min: null,
      max: null,
      limit: 1,
      note: null,
    });
  });

  it('groups troop option cards under the option that offers them', () => {
    const { troopOptions } = choicesFor(fixture, empty);

    expect(troopOptions).toHaveLength(1);
    expect(troopOptions[0]?.option.id).toBe(spearmen.id);
    expect(troopOptions[0]?.choices.map(({ code }) => code)).toEqual(['HL']);
  });

  it('leaves out the options that offer no cards at all', () => {
    const list = listWith({
      troopOptions: [troopOption({ troopEntries: entries('SPR') })],
    });

    expect(choicesFor(list, selectionFor(list)).troopOptions).toEqual([]);
  });

  it('bounds a troop option card by the stands the option holds', () => {
    const list = perStandList();
    const option = optionAt(list, 0);
    const [group] = choicesFor(list, selectionFor(list)).troopOptions;

    expect(group?.stands).toBe(0);
    expect(group?.choices[0]).toMatchObject({ limit: 0, canAdd: false });

    const [filled] = choicesFor(
      list,
      withStands(selectionFor(list), option, 'SPR', 1),
    ).troopOptions;

    expect(filled?.stands).toBe(1);
    expect(filled?.choices[0]).toMatchObject({ limit: 1, canAdd: true });
  });

  it('offers no card at all to an option holding no stands', () => {
    const [group] = choicesFor(fixture, empty).troopOptions;

    expect(group?.stands).toBe(0);
    expect(group?.choices[0]).toMatchObject({ limit: 0, canAdd: false });
  });

  it('bounds it by the option maximum when that is the lower of the two', () => {
    const list = perStandList({ max: 2 });
    const option = optionAt(list, 0);
    const selection = withStands(selectionFor(list), option, 'SPR', 5);
    const [group] = choicesFor(list, selection).troopOptions;

    expect(group?.choices[0]).toMatchObject({ limit: 2, max: 2 });
  });

  it('offers a whole troop entry card its army maximum, not its stands', () => {
    const selection = withStands(empty, spearmen, 'SPR', 2);
    const [group] = choicesFor(fixture, selection).troopOptions;

    expect(group?.choices[0]).toMatchObject({
      code: 'HL',
      limit: 3,
      appliedPerStand: false,
    });
  });

  it('prices every whole troop entry card past the first on one option', () => {
    const [group] = choicesFor(
      fixture,
      withTroopBattleCard(
        withStands(empty, spearmen, 'SPR', 2),
        spearmen,
        'HL',
        3,
      ),
    ).troopOptions;

    expect(group?.choices[0]).toMatchObject({
      count: 3,
      points: 2,
      canAdd: false,
    });
  });

  it('spends the army maximum of a whole troop entry card across options', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('SPR'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
        troopOption({
          troopEntries: entries('HFT'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
      ],
    });
    const first = optionAt(list, 0);
    const second = optionAt(list, 1);
    const stood = withStands(
      withStands(selectionFor(list), first, 'SPR', 2),
      second,
      'HFT',
      2,
    );
    const { troopOptions } = choicesFor(
      list,
      withTroopBattleCard(stood, first, 'HL', 2),
    );

    expect(troopOptions.map(({ choices }) => choices[0]?.limit)).toEqual([
      3, 1,
    ]);
  });

  it('prices a per-stand card from the stands it is applied to', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('HBW'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'SS' })],
        }),
      ],
    });
    const stood = withStands(selectionFor(list), optionAt(list, 0), 'HBW', 3);
    const applied = withTroopBattleCard(stood, optionAt(list, 0), 'SS', 3);
    const { troopOptions, points } = choicesFor(list, applied);

    expect(troopOptions[0]?.choices[0]?.points).toBe(3);
    expect(points).toBe(3);
  });

  it('prices a stand-cost modifier as the points it takes off', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('KNT'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'SF' })],
        }),
      ],
    });
    const stood = withStands(selectionFor(list), optionAt(list, 0), 'KNT', 2);
    const applied = withTroopBattleCard(stood, optionAt(list, 0), 'SF', 2);
    const { troopOptions, points } = choicesFor(list, applied);

    expect(troopOptions[0]?.choices[0]?.points).toBe(-1);
    expect(points).toBe(-1);
    expect(armyPoints(list, applied, costs).total).toBe(7);
  });

  it('buys a card whose purchase covers the army once per army', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('KNT'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'DD' })],
        }),
      ],
    });
    const stood = withStands(selectionFor(list), optionAt(list, 0), 'KNT', 4);
    const [group] = choicesFor(list, stood).troopOptions;

    expect(group?.choices[0]).toMatchObject({
      purchasedPer: 'army',
      limit: 1,
    });

    const applied = withTroopBattleCard(stood, optionAt(list, 0), 'DD', 1);

    expect(choicesFor(list, applied).troopOptions[0]?.choices[0]?.points).toBe(
      1,
    );
  });

  it('charges a card that covers the army once across the options it is on', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('KNT'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'MD' })],
        }),
        troopOption({
          troopEntries: entries('CAT'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'MD' })],
        }),
      ],
    });
    const knights = optionAt(list, 0);
    const cataphracts = optionAt(list, 1);
    const stood = withStands(
      withStands(selectionFor(list), knights, 'KNT', 1),
      cataphracts,
      'CAT',
      1,
    );
    const applied = withTroopBattleCard(
      withTroopBattleCard(stood, knights, 'MD', 1),
      cataphracts,
      'MD',
      1,
    );
    const { troopOptions, points } = choicesFor(list, applied);

    expect(troopOptions.map(({ choices }) => choices[0]?.points)).toEqual([
      2, 0,
    ]);
    expect(points).toBe(2);
    expect(points).toBe(armyPoints(list, applied, costs).battleCardPoints);
  });

  it('spreads the cost of a card that is free the first time it is bought', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('SPR'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
        troopOption({
          troopEntries: entries('HFT'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
      ],
    });
    const first = optionAt(list, 0);
    const second = optionAt(list, 1);
    const stood = withStands(
      withStands(selectionFor(list), first, 'SPR', 2),
      second,
      'HFT',
      2,
    );
    const applied = withTroopBattleCard(
      withTroopBattleCard(stood, first, 'HL', 2),
      second,
      'HL',
      2,
    );
    const { troopOptions, points } = choicesFor(list, applied);

    expect(troopOptions.map(({ choices }) => choices[0]?.points)).toEqual([
      1, 2,
    ]);
    expect(points).toBe(armyPoints(list, applied, costs).battleCardPoints);
  });

  it('reports a card applied to more stands than the option holds', () => {
    const list = perStandList();
    const option = optionAt(list, 0);
    const applied = withTroopBattleCard(
      withStands(selectionFor(list), option, 'SPR', 2),
      option,
      'PL',
      2,
    );
    const emptied = withStands(applied, option, 'SPR', 1);
    const [group] = choicesFor(list, emptied).troopOptions;

    expect(group?.choices[0]).toMatchObject({
      exceedsStands: true,
      canAdd: false,
      canRemove: true,
    });
    expect(
      choicesFor(list, applied).troopOptions[0]?.choices[0]?.exceedsStands,
    ).toBe(false);
  });

  it('withholds the cards of an option the year has gated away', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('SPR'),
          dateRanges: [{ startDate: -3000, endDate: -2900 }],
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
      ],
    });

    expect(
      choicesFor(list, selectionFor(list, { year: -2850 })).troopOptions,
    ).toEqual([]);
  });

  it('keeps a withheld option that still holds a card, and says what withheld it', () => {
    const list = listWith({
      troopOptions: [
        troopOption({
          troopEntries: entries('SPR'),
          dateRanges: [{ startDate: -3000, endDate: -2900 }],
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
      ],
    });
    const option = optionAt(list, 0);
    const applied = withTroopBattleCard(
      withStands(selectionFor(list), option, 'SPR', 2),
      option,
      'HL',
      2,
    );
    const [group] = choicesFor(list, {
      ...applied,
      year: -2850,
    }).troopOptions;

    expect(group?.withheldBy).toBe('year');
    expect(group?.choices[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
  });

  it('withholds the cards the sub-faction question has not released', () => {
    const list = listWith({
      subFactions,
      troopOptions: [
        troopOption({
          troopEntries: entries('SPR'),
          note: 'only Kish',
          battleCardEntries: [battleCardEntry({ battleCardCode: 'HL' })],
        }),
      ],
    });

    expect(
      choicesFor(list, selectionFor(list, { variant: null })).troopOptions,
    ).toEqual([]);
    expect(
      choicesFor(list, selectionFor(list)).troopOptions[0]?.withheldBy,
    ).toBeNull();
  });

  it('counts what is offered and what is taken', () => {
    const applied = withArmyBattleCard(
      withTroopBattleCard(
        withStands(empty, spearmen, 'SPR', 2),
        spearmen,
        'HL',
        2,
      ),
      'FC',
      1,
    );
    const choices = choicesFor(fixture, applied);

    expect(choices.offered).toBe(2);
    expect(choices.taken).toBe(2);
    expect(choices.points).toBe(2);
  });

  it('says nothing is offered when the army carries no cards', () => {
    const list = listWith({
      battleCardEntries: [],
      troopOptions: [troopOption({ troopEntries: entries('SPR') })],
    });
    const choices = choicesFor(list, selectionFor(list));

    expect(choices).toMatchObject({
      army: [],
      troopOptions: [],
      offered: 0,
      taken: 0,
      points: 0,
    });
  });

  it('adds up to the battle card subtotal the points engine reports', () => {
    const list = listWith({
      battleCardEntries: [
        battleCardEntry({ battleCardCode: 'PD', min: 0, max: 3 }),
        battleCardEntry({ battleCardCode: 'FC' }),
      ],
      troopOptions: [
        troopOption({
          troopEntries: entries('KNT'),
          battleCardEntries: [
            battleCardEntry({ battleCardCode: 'SF' }),
            battleCardEntry({ battleCardCode: 'DD' }),
          ],
        }),
        troopOption({
          troopEntries: entries('HBW'),
          battleCardEntries: [battleCardEntry({ battleCardCode: 'SS' })],
        }),
      ],
    });
    const knights = optionAt(list, 0);
    const bowmen = optionAt(list, 1);
    const stood = withStands(
      withStands(selectionFor(list), knights, 'KNT', 3),
      bowmen,
      'HBW',
      2,
    );
    const applied = [
      (selection: ArmySelection) => withArmyBattleCard(selection, 'PD', 2),
      (selection: ArmySelection) => withArmyBattleCard(selection, 'FC', 1),
      (selection: ArmySelection) =>
        withTroopBattleCard(selection, knights, 'SF', 3),
      (selection: ArmySelection) =>
        withTroopBattleCard(selection, knights, 'DD', 1),
      (selection: ArmySelection) =>
        withTroopBattleCard(selection, bowmen, 'SS', 2),
    ].reduce((selection, apply) => apply(selection), stood);
    const choices = choicesFor(list, applied);

    expect(choices.points).toBe(
      armyPoints(list, applied, costs).battleCardPoints,
    );
    expect(choices.taken).toBe(5);
  });
});

describe('on the sample snapshot', () => {
  let lists: ArmyList[];

  beforeAll(async () => {
    lists = await sampleArmyLists();
  });

  it('finds every card a troop option offers in a main contingent', () => {
    const offered = lists.flatMap(({ name, contingentGroups }) =>
      contingentGroups.flatMap(({ contingents }) =>
        contingents.flatMap(({ name: contingent, troopOptions }) =>
          troopOptions
            .filter(({ battleCards }) => battleCards.length > 0)
            .map(({ id }) => `${name} | ${contingent} | ${id}`),
        ),
      ),
    );

    expect(offered).toEqual([]);
  });

  it('offers a card on 24 of the main contingents’ troop options', () => {
    const offering = lists.flatMap(({ main }) =>
      main.troopOptions.filter(({ battleCards }) => battleCards.length > 0),
    );

    expect(offering).toHaveLength(24);
  });
});
