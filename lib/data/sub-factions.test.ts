import { beforeAll, describe, expect, it } from 'vitest';
import {
  allyArmyListSchema,
  armyListSchema,
  type MeshweshArmyList,
  type MeshweshTroopOption,
} from '@/lib/data/schema.ts';
import type { MeshweshSnapshot } from '@/lib/data/snapshot.ts';
import {
  armyListKey,
  type SubFactionGroup,
  subFactionGroupFor,
  subFactionProblems,
} from '@/lib/data/sub-factions.ts';
import { availableTroopOptions } from '@/lib/domain/army/availability.ts';
import { rawAllyArmyList, rawArmyList } from '@/test/fixtures/meshwesh.ts';
import { sampleCuration, sampleSnapshot } from '@/test/sample.ts';

const overlay = sampleCuration.subFactions;

const armyList = (overrides: Record<string, unknown> = {}) =>
  armyListSchema.parse(rawArmyList(overrides));

const allyArmyList = (overrides: Record<string, unknown> = {}) =>
  allyArmyListSchema.parse(rawAllyArmyList(overrides));

const sylvanCourts = (overrides: Record<string, unknown> = {}) =>
  armyList({
    listId: 2,
    sublistId: 'a',
    name: 'Sylvan Courts',
    ...overrides,
  });

describe('the curated sub-faction overlay', () => {
  let snapshot: MeshweshSnapshot;

  beforeAll(async () => {
    snapshot = await sampleSnapshot();
  });

  it('curates every sub-faction note in the snapshot, and nothing else', () => {
    expect(subFactionProblems(overlay, snapshot)).toEqual([]);
  });

  it('covers all 11 notes across all 4 armies', () => {
    const notes = new Set(
      snapshot.armyLists.flatMap(({ troopOptions }) =>
        troopOptions.map(({ note }) => note).filter((note) => note !== ''),
      ),
    );
    const curated = new Set(
      Object.values(overlay).flatMap(({ rules }) => Object.keys(rules)),
    );

    expect(Object.keys(overlay)).toHaveLength(4);
    expect(notes.size).toBe(11);
    expect(curated).toEqual(notes);
  });

  it('gives every army at least two variants to choose between', () => {
    const thin = Object.entries(overlay).filter(
      ([, { variants }]) => variants.length < 2,
    );

    expect(thin).toEqual([]);
  });

  it('dates the campaigns that name one moment, inside the army span', () => {
    const dated = Object.entries(overlay).flatMap(([key, group]) =>
      group.variants
        .filter(({ year }) => year !== undefined)
        .map(({ name, year }) => `${key} ${name} ${year}`),
    );

    expect(dated).toEqual(['2a At the Moonfall -120']);
    expect(subFactionProblems(overlay, snapshot)).toEqual([]);
  });

  it('gives every army distinct variant ids', () => {
    const duplicated = Object.entries(overlay).filter(
      ([, { variants }]) =>
        new Set(variants.map(({ id }) => id)).size !== variants.length,
    );

    expect(duplicated).toEqual([]);
  });
});

describe('subFactionGroupFor', () => {
  it('keys on the list number and sublist letter', () => {
    expect(armyListKey({ listId: 42.5, sublistId: 'a' })).toBe('42.5a');
    expect(
      subFactionGroupFor(overlay, { listId: 3, sublistId: 'a' })?.army,
    ).toBe('Ember Principalities');
  });

  it('is null for an army with no sub-faction notes', () => {
    expect(
      subFactionGroupFor(overlay, { listId: 5, sublistId: 'a' }),
    ).toBeNull();
  });
});

describe('availableTroopOptions', () => {
  it('filters an ally contingent against the parent army it derives from', () => {
    const parent = sylvanCourts();
    const contingent = allyArmyList({
      armyListId: parent.id,
      troopOptions: [
        {
          ...rawAllyArmyList().troopOptions[0],
          note: 'Summer or Winter Court',
        },
      ],
    });

    expect(
      availableTroopOptions(
        contingent.troopOptions,
        subFactionGroupFor(overlay, parent),
        {
          year: -2900,
          variant: 'summer',
        },
      ),
    ).toHaveLength(1);
    expect(
      availableTroopOptions(
        contingent.troopOptions,
        subFactionGroupFor(overlay, parent),
        {
          year: -2900,
          variant: 'twilight',
        },
      ),
    ).toHaveLength(0);
  });
});

describe('subFactionProblems', () => {
  const problems = (
    armyLists: MeshweshArmyList[],
    allyArmyLists: ReturnType<typeof allyArmyList>[] = [],
  ) => subFactionProblems(overlay, { armyLists, allyArmyLists });

  const optionWithNote = (note: string) => ({
    ...rawArmyList().troopOptions[0],
    note,
  });

  const curatedArmies = () =>
    Object.entries(overlay).map(([key, { army, rules }]) =>
      armyList({
        id: key,
        listId: Number.parseFloat(key),
        sublistId: key.replace(/^[\d.]+/, ''),
        name: army,
        derivedData: {
          extendedName: army,
          listStartDate: -3000,
          listEndDate: 2000,
        },
        troopOptions: Object.keys(rules).map(optionWithNote),
      }),
    );

  it('reports an army whose notes nobody has curated', () => {
    expect(problems([...curatedArmies(), armyList()])).toEqual([
      '1a Goblin Warrens has 1 sub-faction notes and no curated variants',
    ]);
  });

  it('reports a note the overlay has no rule for', () => {
    const renamedNote = sylvanCourts({
      troopOptions: [optionWithNote('only the Summer Court')],
    });

    expect(problems([renamedNote])).toContain(
      '2a Sylvan Courts has no rule for "only the Summer Court"',
    );
  });

  it('reports a rule upstream has stopped using', () => {
    const untouched = sylvanCourts({
      troopOptions: [optionWithNote('')],
    });

    expect(problems([untouched])).toContain(
      '2a Sylvan Courts has a rule for "not Twilight Court", which upstream no longer uses',
    );
  });

  it('reports an army upstream has renamed', () => {
    const renamed = sylvanCourts({ name: 'Sylvan Kingdoms' });

    expect(problems([renamed])).toContain(
      '2a is curated as Sylvan Courts but upstream now calls it Sylvan Kingdoms',
    );
  });

  it('reports an army the overlay curates that upstream has dropped', () => {
    expect(problems([])).toContain(
      '2a Sylvan Courts is curated but no longer exists upstream',
    );
  });

  it('reports an ally contingent whose notes have no parent army', () => {
    const orphan = allyArmyList({ armyListId: null, name: 'Sumerian Vassals' });

    expect(problems(curatedArmies(), [orphan])).toEqual([
      'ally list 1a Sumerian Vassals has sub-faction notes and no parent army list',
    ]);
  });

  it('reports an ally contingent note the parent army does not curate', () => {
    const parent = sylvanCourts({ id: 'p1' });
    const contingent = allyArmyList({
      armyListId: 'p1',
      troopOptions: [optionWithNote('only the Autumn Court')],
    });

    expect(problems([parent], [contingent])).toContain(
      'ally list 1a Goblin Warrens has no rule for "only the Autumn Court" under Sylvan Courts',
    );
  });

  it('reports a campaign dated outside the army that runs it', () => {
    const courts = overlay['2a'];
    if (!courts) {
      throw new Error('2a Sylvan Courts is no longer curated');
    }

    expect(
      problems([
        armyList({
          id: '2a',
          listId: 2,
          sublistId: 'a',
          name: courts.army,
          derivedData: {
            extendedName: courts.army,
            listStartDate: -100,
            listEndDate: 300,
          },
          troopOptions: Object.keys(courts.rules).map(optionWithNote),
        }),
      ]).filter((problem) => problem.startsWith('2a')),
    ).toEqual([
      '2a Sylvan Courts dates At the Moonfall to -120, outside its -100 to 300 span',
    ]);
  });

  it('is quiet about an army with no notes at all', () => {
    expect(problems(curatedArmies())).toEqual([]);
  });
});

describe('the point floor gating removes', () => {
  let snapshot: MeshweshSnapshot;

  beforeAll(async () => {
    snapshot = await sampleSnapshot();
  });

  const pointFloor = (troopOptions: readonly MeshweshTroopOption[]) => {
    const cost = new Map(
      snapshot.troopTypes.map(({ permanentCode, cost }) => [
        permanentCode,
        cost,
      ]),
    );
    return troopOptions.reduce(
      (total, { min, troopEntries }) =>
        total +
        min *
          Math.min(
            ...troopEntries.map(
              ({ troopTypeCode }) => cost.get(troopTypeCode) ?? 0,
            ),
          ),
      0,
    );
  };

  const breakpoints = (
    army: MeshweshArmyList,
    group: SubFactionGroup | null,
  ) => {
    const { listStartDate, listEndDate } = army.derivedData;
    const years = [listStartDate, listEndDate];
    for (const { dateRanges } of army.troopOptions) {
      for (const { startDate, endDate } of dateRanges) {
        years.push(startDate, endDate, endDate + 1);
      }
    }
    for (const rule of Object.values(group?.rules ?? {})) {
      if (!('only' in rule)) {
        continue;
      }
      for (const clause of rule.only) {
        if (typeof clause === 'string') {
          continue;
        }
        if (clause.from !== undefined) {
          years.push(clause.from);
        }
        if (clause.to !== undefined) {
          years.push(clause.to, clause.to + 1);
        }
      }
    }
    return [
      ...new Set(
        years.filter((year) => year >= listStartDate && year <= listEndDate),
      ),
    ];
  };

  const floorsAcrossGating = (army: MeshweshArmyList) => {
    const group = subFactionGroupFor(overlay, army);
    const variants = group
      ? group.variants.map(({ id }) => id)
      : [null as string | null];
    return variants.flatMap((variant) =>
      breakpoints(army, group).map((year) =>
        pointFloor(
          availableTroopOptions(army.troopOptions, group, { year, variant }),
        ),
      ),
    );
  };

  const army = (name: string) => {
    const found = snapshot.armyLists.find((list) => list.name === name);
    if (!found) {
      throw new Error(`${name} is not in the snapshot`);
    }
    return found;
  };

  it.each([
    ['Sylvan Courts', 56, { year: 0, variant: 'summer' }, 36],
    ['Tidewrack Corsairs', 56, { year: 750, variant: 'other' }, 34],
    ['Sunspire Dominion', 58, { year: -2150, variant: null }, 46],
  ])(
    'makes %s buildable, floor %i before gating',
    (name, ungated, selection, gated) => {
      expect(pointFloor(army(name).troopOptions)).toBe(ungated);
      expect(
        pointFloor(
          availableTroopOptions(
            army(name).troopOptions,
            subFactionGroupFor(overlay, army(name)),
            selection,
          ),
        ),
      ).toBe(gated);
      expect(Math.min(...floorsAcrossGating(army(name)))).toBeLessThanOrEqual(
        48,
      );
    },
  );

  it('keeps every variant of every army inside the 48 point budget', () => {
    const overSpent = snapshot.armyLists
      .filter((list) => Math.max(...floorsAcrossGating(list)) > 48)
      .map((list) => `${armyListKey(list)} ${list.name}`);

    expect(overSpent).toEqual([]);
  });
});
