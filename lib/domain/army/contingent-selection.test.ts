import { describe, expect, it } from 'vitest';
import { contingentArmyDetail } from '@/test/fixtures/army.ts';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { troopTypeCosts } from '../troop-types.ts';
import {
  allyTroopOptionGroups,
  buildArmyList,
  type ContingentGroup,
  optionalContingentGroups,
  type TroopOption,
} from './army-list';
import { allyTroopOptions, optionalContingents } from './contingent-selection';
import {
  type ArmySelection,
  emptySelection,
  withAllyTroopOption,
  withContingentGroup,
  withStands,
} from './selection';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};

const list = buildArmyList(contingentArmyDetail());

const groupNamed = (name: string): ContingentGroup => {
  const group = optionalContingentGroups(list).find(
    (candidate) => candidate.name === name,
  );
  if (!group) {
    throw new Error(`the fixture army no longer offers ${name}`);
  }
  return group;
};

const allyNamed = (name: string): ContingentGroup => {
  const group = allyTroopOptionGroups(list).find(
    (candidate) => candidate.name === name,
  );
  if (!group) {
    throw new Error(`the fixture army no longer offers ${name}`);
  }
  return group;
};

const friends = groupNamed('Optional friends');
const late = groupNamed('Late arrivals');
const levies = groupNamed('Hill levy and River levy');

const optionOf = (
  group: ContingentGroup,
  index: number,
  contingent = 0,
): TroopOption => {
  const option = group.contingents[contingent]?.troopOptions[index];
  if (!option) {
    throw new Error(`${group.name} no longer has the option the tests need`);
  }
  return option;
};

const lightFoot = optionOf(friends, 0);
const rabble = optionOf(levies, 0);
const hillArchers = optionOf(levies, 1);
const riverHorde = optionOf(levies, 0, 1);

const selectionAt = (year: number): ArmySelection =>
  emptySelection({
    army: list.id,
    dataVersion: '2026-09-17.abcdef01',
    year,
  });

const empty = selectionAt(-2950);

const contingents = (selection: ArmySelection) =>
  optionalContingents(list, selection, costs);

const forGroup = (selection: ArmySelection, group: ContingentGroup) => {
  const found = contingents(selection).groups.find(
    ({ group: candidate }) => candidate.id === group.id,
  );
  if (!found) {
    throw new Error(`${group.name} is not among the contingents offered`);
  }
  return found;
};

describe('optionalContingents', () => {
  it('offers every optional contingent the year leaves available', () => {
    const { groups, offered, withheld } = contingents(empty);

    expect(groups.map(({ group }) => group.name)).toEqual([
      friends.name,
      levies.name,
    ]);
    expect(offered).toBe(3);
    expect(withheld).toBe(1);
  });

  it('leaves the ally troop options to the ally slot', () => {
    expect(
      contingents(empty).groups.map(({ group }) => group.kind),
    ).not.toContain('allyTroopOption');
  });

  it('opens with nothing taken and nothing spent', () => {
    expect(contingents(empty)).toMatchObject({
      taken: 0,
      stands: 0,
      points: 0,
    });
  });

  it('takes a contingent whole, and counts it once taken', () => {
    const selection = withContingentGroup(empty, friends);

    expect(forGroup(selection, friends).taken).toBe(true);
    expect(contingents(selection).taken).toBe(1);
  });

  it('takes any number of them', () => {
    const selection = withContingentGroup(
      withContingentGroup(empty, friends),
      levies,
    );

    expect(contingents(selection).taken).toBe(2);
  });

  it('prices the stands of a taken contingent', () => {
    const selection = withStands(
      withContingentGroup(empty, friends),
      lightFoot,
      'LFT',
      2,
    );

    expect(forGroup(selection, friends)).toMatchObject({
      stands: 2,
      points: 6,
    });
    expect(contingents(selection)).toMatchObject({ stands: 2, points: 6 });
  });

  it('brings both contingents of a group that names two', () => {
    const selection = withContingentGroup(empty, levies);
    const { contingents: brought } = forGroup(selection, levies);

    expect(brought.map(({ contingent }) => contingent.name)).toEqual([
      'Fixture Hill Contingent',
      'Fixture River Contingent',
    ]);
    expect(
      brought.every(({ contingent }) => contingent.kind === 'optional'),
    ).toBe(true);
  });

  it('totals a group over both of its contingents', () => {
    const selection = withStands(
      withStands(withContingentGroup(empty, levies), rabble, 'RBL', 2),
      riverHorde,
      'HRD',
      1,
    );

    expect(forGroup(selection, levies)).toMatchObject({
      stands: 3,
      points: 6,
    });
  });
});

describe('what a contingent may be filled with', () => {
  it('offers nothing to add while the contingent is not taken', () => {
    const [option] = forGroup(empty, friends).contingents[0].options;

    expect(option?.steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: false,
    });
  });

  it("applies the contingent's own minimum and maximum once taken", () => {
    const selection = withContingentGroup(empty, friends);
    const [option] = forGroup(selection, friends).contingents[0].options;

    expect(option).toMatchObject({ fill: 'belowMin' });
    expect(option?.option).toMatchObject({ min: 1, max: 2 });
    expect(option?.steppers[0]?.canAdd).toBe(true);
  });

  it('stops adding once a taken contingent option is full', () => {
    const selection = withStands(
      withContingentGroup(empty, friends),
      lightFoot,
      'LFT',
      2,
    );
    const [option] = forGroup(selection, friends).contingents[0].options;

    expect(option).toMatchObject({ fill: 'met' });
    expect(option?.steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
  });

  it('drops a troop option the year of the list has gated away', () => {
    const selection = withContingentGroup(selectionAt(-2850), levies);
    const [hill] = forGroup(selection, levies).contingents;

    expect(hill?.options.map(({ option }) => option.id)).toEqual([rabble.id]);
  });

  it('keeps a gated troop option that still holds stands, and says why', () => {
    const selection = withStands(
      withContingentGroup(selectionAt(-2850), levies),
      hillArchers,
      'ARC',
      1,
    );
    const [hill] = forGroup(selection, levies).contingents;
    const gated = hill?.options.find(
      ({ option }) => option.id === hillArchers.id,
    );

    expect(gated).toMatchObject({ withheldBy: 'year', stands: 1 });
    expect(gated?.steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
  });
});

describe('a contingent the year withholds', () => {
  it('is not offered outside the years of its ally option', () => {
    expect(
      contingents(empty).groups.map(({ group }) => group.id),
    ).not.toContain(late.id);
  });

  it('is offered inside them', () => {
    const { groups, withheld } = contingents(selectionAt(-2850));

    expect(groups.map(({ group }) => group.name)).toContain(late.name);
    expect(withheld).toBe(0);
  });

  it('stays, unfillable, when the year moves out from under a taken one', () => {
    const taken = withStands(
      withContingentGroup(selectionAt(-2850), late),
      optionOf(late, 0),
      'WBD',
      2,
    );
    const moved = { ...taken, year: -2950 };
    const group = forGroup(moved, late);

    expect(group).toMatchObject({
      taken: true,
      offeredInYear: false,
      stands: 2,
      points: 6,
    });
    expect(group.contingents[0].options[0]?.steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
    expect(contingents(moved).withheld).toBe(0);
  });
});

describe('allyTroopOptions', () => {
  const horse = allyNamed('Allied horse');
  const pair = allyNamed('Northern allies and Southern allies');
  const lateAllies = allyNamed('Late allies');
  const horseBow = optionOf(horse, 0);

  const allies = (selection: ArmySelection) =>
    allyTroopOptions(list, selection, costs);

  const chosenAlly = (group: ContingentGroup) =>
    allies(withAllyTroopOption(list, empty, group));

  it('offers every ally troop option the year leaves available', () => {
    const { groups, offered, withheld } = allies(empty);

    expect(groups.map(({ group }) => group.name)).toEqual([
      'Allied horse',
      'Allied foot',
      'Northern allies and Southern allies',
      'Allied horse and Allied foot',
    ]);
    expect(offered).toBe(5);
    expect(withheld).toBe(1);
  });

  it('leaves the optional contingents to their own section', () => {
    expect(allies(empty).groups.map(({ group }) => group.kind)).not.toContain(
      'optionalContingent',
    );
  });

  it('opens with no ally taken', () => {
    expect(allies(empty)).toMatchObject({
      chosen: null,
      taken: 0,
      stands: 0,
      points: 0,
    });
  });

  it('names the one ally that is taken', () => {
    expect(chosenAlly(horse).chosen?.group.name).toBe('Allied horse');
    expect(chosenAlly(horse).taken).toBe(1);
  });

  it('prices the stands of the ally that is taken', () => {
    const selection = withStands(
      withAllyTroopOption(list, empty, horse),
      horseBow,
      'HBW',
      2,
    );

    expect(allies(selection)).toMatchObject({ stands: 2, points: 8 });
  });

  it('counts nothing for an ally that shares a contingent with the taken one', () => {
    const shared = allyNamed('Allied horse and Allied foot');
    const section = allies(
      withStands(withAllyTroopOption(list, empty, horse), horseBow, 'HBW', 2),
    );

    expect(
      section.groups.find(({ group }) => group.id === shared.id),
    ).toMatchObject({ taken: false, stands: 0, points: 0 });
    expect(section).toMatchObject({ stands: 2, points: 8 });
  });

  it('brings both contingents of a pair, each of them allied', () => {
    const { contingents } = chosenAlly(pair).chosen ?? {};

    expect(contingents?.map(({ contingent }) => contingent.name)).toEqual([
      'Fixture Northern Contingent',
      'Fixture Southern Contingent',
    ]);
    expect(
      contingents?.every(({ contingent }) => contingent.kind === 'allied'),
    ).toBe(true);
  });

  it('spends the one slot on a pair, not one slot each', () => {
    expect(chosenAlly(pair).taken).toBe(1);
  });

  it('keeps an ally the year has moved away from, unfillable', () => {
    const taken = withStands(
      withAllyTroopOption(list, selectionAt(-2850), lateAllies),
      optionOf(lateAllies, 0),
      'KNT',
      1,
    );
    const moved = allies({ ...taken, year: -2950 });

    expect(moved.chosen).toMatchObject({
      taken: true,
      offeredInYear: false,
      stands: 1,
    });
    expect(moved.chosen?.contingents[0].options[0]?.steppers[0]).toMatchObject({
      canAdd: false,
      canRemove: true,
    });
  });
});
