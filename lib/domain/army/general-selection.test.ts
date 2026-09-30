import { describe, expect, it } from 'vitest';
import {
  allyContingent,
  armyDetail,
  entries,
  troopOption,
} from '@/test/fixtures/army.ts';
import {
  type ArmyList,
  buildArmyList,
  type ContingentGroup,
  type TroopOption,
} from './army-list';
import { generalChoice } from './general-selection';
import {
  type ArmySelection,
  emptySelection,
  withAllyTroopOption,
  withContingentGroup,
  withGeneral,
  withStands,
} from './selection';

const list = buildArmyList(armyDetail());

const contingentDetail = (
  name: string,
  contingent: ReturnType<typeof allyContingent>,
) =>
  armyDetail({
    allyOptions: [
      {
        allyEntries: [{ allyArmyList: contingent.id, name }],
        dateRange: null,
        note: null,
      },
    ],
    allyContingents: [contingent],
  });

const withKnightlyFriends = buildArmyList(
  contingentDetail(
    'Optional friends',
    allyContingent({
      troopOptions: [
        troopOption({ min: 1, max: 2, troopEntries: entries('KNT') }),
      ],
    }),
  ),
);

const withAlliedSpear = buildArmyList(
  contingentDetail(
    'Allied horse',
    allyContingent({
      id: 'contingent-ally',
      name: 'Fixture Allied Contingent',
      internalContingent: false,
      troopOptions: [
        troopOption({ min: 2, max: 4, troopEntries: entries('SPR') }),
      ],
    }),
  ),
);

const optionAt = (
  troopOptions: readonly TroopOption[],
  index: number,
): TroopOption => {
  const option = troopOptions[index];
  if (!option) {
    throw new Error(`the fixture army no longer has troop option ${index}`);
  }
  return option;
};

const spearmen = optionAt(list.main.troopOptions, 0);
const bowmen = optionAt(list.main.troopOptions, 1);
const knights = optionAt(list.main.troopOptions, 2);

const groupOf = (armyList: ArmyList): ContingentGroup => {
  const [group] = armyList.contingentGroups;
  if (!group) {
    throw new Error('the fixture army no longer offers a contingent');
  }
  return group;
};

const contingentOptionOf = (armyList: ArmyList) =>
  optionAt(groupOf(armyList).contingents[0].troopOptions, 0);

const emptyOf = (armyList: ArmyList): ArmySelection =>
  emptySelection({
    army: armyList.id,
    dataVersion: '2026-09-17.abcdef01',
    year: -2950,
  });

const empty = emptyOf(list);

const named = (selection: ArmySelection, armyList = list) =>
  generalChoice(armyList, selection).candidates.map(
    ({ option, troopType, stands, chosen, excludedBy }) => ({
      option: option.id,
      troopType,
      stands,
      chosen,
      excludedBy,
    }),
  );

describe('generalChoice', () => {
  it('carries the troop types the army draws its general from', () => {
    expect(generalChoice(list, empty).troopTypes).toEqual(['SPR', 'KNT']);
  });

  it('offers nothing while the army has no stands', () => {
    const choice = generalChoice(list, empty);

    expect(choice.candidates).toEqual([]);
    expect(choice.chosen).toBeNull();
    expect(choice.eligible).toBe(0);
    expect(choice.stands).toBe(0);
  });

  it('offers a stand of every troop type the list allows', () => {
    const selection = withStands(
      withStands(empty, spearmen, 'SPR', 3),
      knights,
      'KNT',
      2,
    );

    expect(named(selection)).toEqual([
      {
        option: spearmen.id,
        troopType: 'SPR',
        stands: 3,
        chosen: false,
        excludedBy: null,
      },
      {
        option: knights.id,
        troopType: 'KNT',
        stands: 2,
        chosen: false,
        excludedBy: null,
      },
    ]);
  });

  it('withholds the troop types the list does not draw a general from', () => {
    const selection = withStands(
      withStands(empty, spearmen, 'SPR', 2),
      bowmen,
      'ARC',
      1,
    );
    const choice = generalChoice(list, selection);

    expect(choice.candidates.map(({ troopType }) => troopType)).toEqual([
      'SPR',
    ]);
    expect(choice.eligible).toBe(2);
    expect(choice.stands).toBe(3);
  });

  it('names the stand the selection made the general', () => {
    const selection = withGeneral(withStands(empty, spearmen, 'SPR', 2), {
      option: spearmen.id,
      troopType: 'SPR',
    });
    const { chosen } = generalChoice(list, selection);

    expect(chosen?.option.id).toBe(spearmen.id);
    expect(chosen?.troopType).toBe('SPR');
    expect(chosen?.chosen).toBe(true);
    expect(chosen?.excludedBy).toBeNull();
  });

  it('lets an optional contingent stand lead the army', () => {
    const group = groupOf(withKnightlyFriends);
    const option = contingentOptionOf(withKnightlyFriends);
    const selection = withStands(
      withContingentGroup(emptyOf(withKnightlyFriends), group),
      option,
      'KNT',
      2,
    );

    expect(named(selection, withKnightlyFriends)).toEqual([
      {
        option: option.id,
        troopType: 'KNT',
        stands: 2,
        chosen: false,
        excludedBy: null,
      },
    ]);
  });

  it('never offers an allied stand, whatever its troop type', () => {
    const group = groupOf(withAlliedSpear);
    const option = contingentOptionOf(withAlliedSpear);
    const selection = withStands(
      withAllyTroopOption(withAlliedSpear, emptyOf(withAlliedSpear), group),
      option,
      'SPR',
      2,
    );

    expect(named(selection, withAlliedSpear)).toEqual([]);
    expect(generalChoice(withAlliedSpear, selection).stands).toBe(2);
  });

  it('keeps a general the army may not have, flagged with what excludes it', () => {
    const group = groupOf(withAlliedSpear);
    const option = contingentOptionOf(withAlliedSpear);
    const selection = withGeneral(
      withStands(
        withAllyTroopOption(withAlliedSpear, emptyOf(withAlliedSpear), group),
        option,
        'SPR',
        2,
      ),
      { option: option.id, troopType: 'SPR' },
    );

    expect(named(selection, withAlliedSpear)).toEqual([
      {
        option: option.id,
        troopType: 'SPR',
        stands: 2,
        chosen: true,
        excludedBy: 'alliedContingent',
      },
    ]);
    expect(generalChoice(withAlliedSpear, selection).eligible).toBe(0);
  });

  it('keeps a general of a troop type the list does not allow', () => {
    const selection = withGeneral(withStands(empty, bowmen, 'ARC', 2), {
      option: bowmen.id,
      troopType: 'ARC',
    });

    expect(named(selection)).toEqual([
      {
        option: bowmen.id,
        troopType: 'ARC',
        stands: 2,
        chosen: true,
        excludedBy: 'troopType',
      },
    ]);
  });
});
