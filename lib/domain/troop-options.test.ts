import { beforeAll, describe, expect, it } from 'vitest';
import type { MeshweshSnapshot } from '@/lib/data/snapshot.ts';
import { sampleSnapshot } from '@/test/sample.ts';
import { battleLine, troopTypeChoices, troopTypeMix } from './troop-options';

const entry = (troopTypeCode: string, note: string | null = null) => ({
  troopTypeCode,
  note,
});

describe('battleLine', () => {
  it('reads the three values upstream sends', () => {
    expect(battleLine({ core: 'all' })).toBe('all');
    expect(battleLine({ core: 'half' })).toBe('half');
    expect(battleLine({ core: '' })).toBe('none');
  });

  it('keeps anything it does not recognise out of the battle line', () => {
    expect(battleLine({ core: 'core' })).toBe('none');
  });
});

describe('troopTypeMix', () => {
  it('lets a multi-type option mix freely', () => {
    expect(troopTypeMix({ troopEntries: [entry('ARC'), entry('PAV')] })).toBe(
      'anyMix',
    );
  });

  it('holds a multi-type option to one type when every entry says all', () => {
    expect(
      troopTypeMix({
        troopEntries: [entry('ARC', 'all'), entry('PAV', 'all')],
      }),
    ).toBe('singleType');
  });

  it('ignores an annotation on only some of the entries', () => {
    expect(
      troopTypeMix({ troopEntries: [entry('ARC', 'all'), entry('PAV')] }),
    ).toBe('anyMix');
  });

  it('has nothing to restrict on a single-type option', () => {
    expect(troopTypeMix({ troopEntries: [entry('ARC', 'all')] })).toBe(
      'anyMix',
    );
  });
});

describe('troopTypeChoices', () => {
  it('offers every type together when the option mixes freely', () => {
    expect(
      troopTypeChoices({ troopEntries: [entry('ARC'), entry('PAV')] }),
    ).toEqual([['ARC', 'PAV']]);
  });

  it('offers one type at a time when the option is held to one', () => {
    expect(
      troopTypeChoices({
        troopEntries: [entry('ARC', 'all'), entry('PAV', 'all')],
      }),
    ).toEqual([['ARC'], ['PAV']]);
  });
});

describe('the sample snapshot', () => {
  let snapshot: MeshweshSnapshot;

  beforeAll(async () => {
    snapshot = await sampleSnapshot();
  });

  const troopOptions = () =>
    snapshot.armyLists.flatMap((armyList) =>
      armyList.troopOptions.map((troopOption) => ({ armyList, troopOption })),
    );

  const annotated = <
    Option extends { troopEntries: { note: string | null }[] },
  >(
    options: readonly Option[],
  ) =>
    options.filter(({ troopEntries }) => troopEntries.some(({ note }) => note));

  it('carries one half battle line, on the Mammoth Clans outriders', () => {
    const half = troopOptions().filter(
      ({ troopOption }) => battleLine(troopOption) === 'half',
    );

    expect(half).toHaveLength(1);
    expect(half[0]?.armyList.name).toBe('Mammoth Clans');
    expect(half[0]?.armyList.listId).toBe(6);
    expect(half[0]?.armyList.sublistId).toBe('a');
    expect(half[0]?.troopOption.description).toBe('Tusker outriders');
    expect(half[0]?.troopOption.min).toBe(4);
    expect(half[0]?.troopOption.max).toBe(10);
    expect(
      half[0]?.troopOption.troopEntries.map(
        ({ troopTypeCode }) => troopTypeCode,
      ),
    ).toEqual(['HBW']);
  });

  it('repeats the half battle line on the ally list derived from that army', () => {
    const half = snapshot.allyArmyLists.flatMap((allyArmyList) =>
      allyArmyList.troopOptions
        .filter((troopOption) => battleLine(troopOption) === 'half')
        .map((troopOption) => ({ allyArmyList, troopOption })),
    );

    expect(half).toHaveLength(1);
    expect(half[0]?.allyArmyList.id).toBe('ally-mammoth-clans');
    expect(half[0]?.allyArmyList.listId).toBe(6);
    expect(half[0]?.allyArmyList.sublistId).toBe('a');
    expect(half[0]?.troopOption.description).toBe('Tusker outriders');
  });

  it('annotates troop entries with nothing but all', () => {
    const notes = new Set(
      [...snapshot.armyLists, ...snapshot.allyArmyLists].flatMap(
        ({ troopOptions: options }) =>
          options.flatMap(({ troopEntries }) =>
            troopEntries
              .map(({ note }) => note)
              .filter((note) => note !== null),
          ),
      ),
    );

    expect([...notes]).toEqual(['all']);
  });

  it('annotates every entry of an option, never a subset', () => {
    const partial = annotated(
      [...snapshot.armyLists, ...snapshot.allyArmyLists].flatMap(
        ({ troopOptions: options }) => options,
      ),
    ).filter(({ troopEntries }) => troopEntries.some(({ note }) => !note));

    expect(partial).toEqual([]);
  });

  it('only annotates options that would otherwise mix types', () => {
    const singleTypeEntries = annotated(
      [...snapshot.armyLists, ...snapshot.allyArmyLists].flatMap(
        ({ troopOptions: options }) => options,
      ),
    ).filter(({ troopEntries }) => troopEntries.length < 2);

    expect(singleTypeEntries).toEqual([]);
  });

  it('holds 1 army option and 2 ally options to a single troop type', () => {
    const armyOptions = annotated(
      snapshot.armyLists.flatMap(({ troopOptions: options }) => options),
    );
    const allyOptions = annotated(
      snapshot.allyArmyLists.flatMap(({ troopOptions: options }) => options),
    );

    expect(armyOptions.map(({ description }) => description)).toEqual([
      'Glade wardens, with bow or with tall shield',
    ]);
    expect(
      armyOptions.flatMap(({ troopEntries }) => troopEntries),
    ).toHaveLength(2);
    expect(allyOptions.map(({ description }) => description)).toEqual([
      'Glade wardens, with bow or with tall shield',
      'Bolt-throwers or armoured wains',
    ]);
    expect(
      allyOptions.flatMap(({ troopEntries }) => troopEntries),
    ).toHaveLength(4);
    expect(
      [...armyOptions, ...allyOptions].every(
        (option) => troopTypeMix(option) === 'singleType',
      ),
    ).toBe(true);
  });
});
