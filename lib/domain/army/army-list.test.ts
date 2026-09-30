import { beforeAll, describe, expect, it } from 'vitest';
import type { ArmyDetail } from '@/lib/data/bundle.ts';
import { armyDetail, troopOption } from '@/test/fixtures/army.ts';
import { sampleArmyDetails, sampleArmyLists } from '@/test/sample.ts';
import {
  type ArmyList,
  allTroopOptions,
  allyTroopOptionGroups,
  buildArmyList,
  type ContingentGroupId,
  type ContingentId,
  contingentsOf,
  findContingent,
  findContingentGroup,
  findTroopOption,
  mainContingentId,
  offeredContingentGroups,
  optionalContingentGroups,
  type TroopOptionId,
} from './army-list';

const sylvanCourtsId = 'army-sylvan-courts';

describe('buildArmyList', () => {
  const list = buildArmyList(armyDetail());

  it('keeps the army identity and date span', () => {
    expect(list).toMatchObject({
      id: 'army-1',
      key: '1a',
      name: 'Fixture Army',
      extendedName: 'Fixture Army 3000 to 2800 BC',
      dateRange: { startDate: -3000, endDate: -2800 },
      subFactions: null,
    });
  });

  it('numbers the main troop options under the main contingent', () => {
    expect(list.main.kind).toBe('main');
    expect(list.main.id).toBe(mainContingentId);
    expect(list.main.troopOptions.map(({ id }) => id)).toEqual([
      'main/0',
      'main/1',
      'main/2',
    ]);
    expect(
      list.main.troopOptions.every(({ contingent }) => contingent === 'main'),
    ).toBe(true);
  });

  it('names the battle line column rather than repeating core', () => {
    expect(list.main.troopOptions.map(({ battleLine }) => battleLine)).toEqual([
      'all',
      'none',
      'half',
    ]);
  });

  it('keeps a multi-type entry as a free mix under one min and max', () => {
    const [, mixed] = list.main.troopOptions;
    expect(mixed).toMatchObject({ min: 0, max: 4, note: 'only Kish' });
    expect(mixed?.troopEntries.map(({ troopType }) => troopType)).toEqual([
      'ARC',
      'BLV',
    ]);
    expect(mixed?.dateRanges).toEqual([{ startDate: -3000, endDate: -2900 }]);
  });

  it('cancels the free mix when every entry is annotated', () => {
    expect(list.main.troopOptions.map(({ mix }) => mix)).toEqual([
      'anyMix',
      'anyMix',
      'anyMix',
    ]);
    const annotated = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({
            troopEntries: [
              { troopTypeCode: 'PIK', dismountTypeCode: null, note: 'all' },
              { troopTypeCode: 'LSP', dismountTypeCode: null, note: 'all' },
            ],
          }),
        ],
      }),
    );
    expect(annotated.main.troopOptions[0]?.mix).toBe('singleType');
  });

  it('carries battle card allowances at both levels', () => {
    expect(list.battleCards).toEqual([
      { code: 'FC', min: null, max: null, note: null },
    ]);
    expect(list.main.troopOptions[0]?.battleCards).toEqual([
      { code: 'HL', min: 0, max: 2, note: null },
    ]);
  });

  it('collects the general troop types without repeating one', () => {
    expect(list.generalTroopTypes).toEqual(['SPR', 'KNT']);
  });

  it('splits contingents into optional and ally on internalContingent', () => {
    expect(contingentsOf(list).map(({ id, kind }) => [id, kind])).toEqual([
      ['main', 'main'],
      ['contingent-optional', 'optional'],
      ['contingent-bundled', 'optional'],
      ['contingent-ally', 'allied'],
    ]);
  });

  it('numbers a contingent troop option under its own contingent', () => {
    expect(
      findContingent(list, 'contingent-ally' as ContingentId)?.troopOptions,
    ).toMatchObject([{ id: 'contingent-ally/0', min: 2, max: 4 }]);
  });

  it('groups ally entries that are taken together', () => {
    expect(
      list.contingentGroups.map(({ id, kind, name, note, dateRange }) => ({
        id,
        kind,
        name,
        note,
        dateRange,
      })),
    ).toEqual([
      {
        id: 'group/0',
        kind: 'optionalContingent',
        name: 'Optional friends',
        note: null,
        dateRange: null,
      },
      {
        id: 'group/1',
        kind: 'allyTroopOption',
        name: 'Bundled optional and Bundled ally',
        note: 'only Kish',
        dateRange: { startDate: -2950, endDate: -2800 },
      },
    ]);
  });

  it('treats an option that mixes both flags as an ally troop option', () => {
    const mixed = list.contingentGroups[1];
    expect(mixed?.contingents.map(({ kind }) => kind)).toEqual([
      'optional',
      'allied',
    ]);
    expect(mixed?.kind).toBe('allyTroopOption');
  });

  it('refuses an ally option pointing at a contingent the army does not carry', () => {
    expect(() =>
      buildArmyList(armyDetail({ allyContingents: [] })),
    ).toThrowError(/references an ally contingent contingent-optional/);
  });

  it('refuses an army with no general troop types', () => {
    expect(() =>
      buildArmyList(armyDetail({ troopEntriesForGeneral: [] })),
    ).toThrowError(/no troop types its general can be drawn from/);
  });

  it('refuses a troop option with no troop entries', () => {
    expect(() =>
      buildArmyList(
        armyDetail({ troopOptions: [troopOption({ troopEntries: [] })] }),
      ),
    ).toThrowError(/troop option main\/0 has no troop entries/);
  });

  it('refuses an ally option with no entries', () => {
    expect(() =>
      buildArmyList(
        armyDetail({
          allyOptions: [{ allyEntries: [], dateRange: null, note: null }],
        }),
      ),
    ).toThrowError(/ally option with no contingents/);
  });
});

describe('lookups', () => {
  const list = buildArmyList(armyDetail());

  it('finds every troop option across the contingents', () => {
    expect(allTroopOptions(list).map(({ id }) => id)).toEqual([
      'main/0',
      'main/1',
      'main/2',
      'contingent-optional/0',
      'contingent-bundled/0',
      'contingent-ally/0',
    ]);
  });

  it('lists a contingent once even when two options share it', () => {
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
    expect(contingentsOf(shared).map(({ id }) => id)).toEqual([
      'main',
      'contingent-optional',
    ]);
  });

  it('answers with the option, the contingent and the group behind an id', () => {
    expect(findTroopOption(list, 'main/1' as TroopOptionId)?.note).toBe(
      'only Kish',
    );
    expect(
      findContingent(list, 'contingent-optional' as ContingentId)?.name,
    ).toBe('Fixture Optional Contingent');
    expect(
      findContingentGroup(list, 'group/1' as ContingentGroupId)?.kind,
    ).toBe('allyTroopOption');
  });

  it('answers with null for an id the army list does not carry', () => {
    expect(findTroopOption(list, 'main/9' as TroopOptionId)).toBeNull();
    expect(findContingent(list, 'nobody' as ContingentId)).toBeNull();
    expect(
      findContingentGroup(list, 'group/9' as ContingentGroupId),
    ).toBeNull();
  });
});

describe('buildArmyList, on the sample snapshot', () => {
  let details: ArmyDetail[];
  let lists: ArmyList[];

  beforeAll(async () => {
    details = await sampleArmyDetails();
    lists = details.map(buildArmyList);
  });

  it('builds every army list', () => {
    expect(lists).toHaveLength(8);
  });

  it('gives every troop option an id unique within its army', () => {
    const duplicated = lists.filter((list) => {
      const ids = allTroopOptions(list).map(({ id }) => id);
      return new Set(ids).size !== ids.length;
    });
    expect(duplicated).toEqual([]);
  });

  it('keeps the sub-faction question attached to the army it belongs to', () => {
    const sylvan = lists.find(({ id }) => id === sylvanCourtsId);
    expect(sylvan?.subFactions?.variants.map(({ id }) => id)).toEqual([
      'summer',
      'winter',
      'twilight',
      'moonfall',
      'other',
    ]);
    expect(
      sylvan?.main.troopOptions.some(
        ({ note }) => note === 'all except Summer or Winter Court',
      ),
    ).toBe(true);
  });

  it('finds both kinds of contingent group upstream', () => {
    const kinds = new Set(
      lists.flatMap(({ contingentGroups }) =>
        contingentGroups.map(({ kind }) => kind),
      ),
    );
    expect(kinds).toEqual(new Set(['optionalContingent', 'allyTroopOption']));
  });
});

describe('the contingent groups an army offers', () => {
  const allied = {
    allyOptions: [
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Steppe allies' },
        ],
        dateRange: null,
        note: null,
      },
    ],
  };

  it('offers an optional contingent apart from an ally troop option', () => {
    const list = buildArmyList(
      armyDetail({
        allyOptions: [
          ...armyDetail().allyOptions.slice(0, 1),
          ...allied.allyOptions,
        ],
      }),
    );

    expect(optionalContingentGroups(list).map(({ name }) => name)).toEqual([
      'Optional friends',
    ]);
    expect(allyTroopOptionGroups(list).map(({ name }) => name)).toEqual([
      'Steppe allies',
    ]);
  });

  it('withholds a pair that bundles a contingent with an ally', () => {
    const list = buildArmyList(armyDetail());

    expect(list.contingentGroups).toHaveLength(2);
    expect(offeredContingentGroups(list).map(({ id }) => id)).toEqual([
      'group/0',
    ]);
    expect(allyTroopOptionGroups(list)).toEqual([]);
  });
});

describe('the contingent groups an army offers, on the sample snapshot', () => {
  let lists: ArmyList[];

  beforeAll(async () => {
    lists = await sampleArmyLists();
  });

  it('withholds the one pair the sample offers twice over', () => {
    const groups = lists.flatMap(({ contingentGroups }) => contingentGroups);
    const offered = lists.flatMap(offeredContingentGroups);
    const withheld = groups.filter((group) => !offered.includes(group));

    expect(groups).toHaveLength(12);
    expect(offered).toHaveLength(11);
    expect(withheld.map(({ name }) => name)).toEqual([
      'Sylvan allies and Crown militia',
    ]);
    expect(
      lists.flatMap(optionalContingentGroups).length +
        lists.flatMap(allyTroopOptionGroups).length,
    ).toBe(11);
  });

  it('offers every withheld contingent under a group of its own', () => {
    const unreachable = lists.flatMap((list) => {
      const offered = new Set(
        offeredContingentGroups(list).flatMap(({ contingents }) =>
          contingents.map(({ id }) => id),
        ),
      );
      return list.contingentGroups
        .flatMap(({ contingents }) => contingents)
        .filter(({ id }) => !offered.has(id))
        .map(({ name }) => `${list.name}: ${name}`);
    });

    expect(unreachable).toEqual([]);
  });
});
