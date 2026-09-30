import { describe, expect, it } from 'vitest';
import type { TroopTypeCode } from '@/lib/data/schema.ts';
import {
  armyDetail,
  entries as troopEntries,
  troopOption,
} from '@/test/fixtures/army.ts';
import {
  sampleBattleCardCosts,
  sampleCuration,
  sampleTroopTypes,
} from '@/test/sample.ts';
import { buildArmyList } from '../army/army-list';
import {
  type ArmySelection,
  emptySelection,
  withStands,
} from '../army/selection';
import { armySheet } from '../army/sheet';
import {
  troopTypeCosts,
  troopTypeFactors,
  troopTypeNames,
} from '../troop-types.ts';
import { type CollectionEntry, type CollectionPin, coverage } from './coverage';
import { listCoverage } from './list-coverage';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};

const armyList = buildArmyList(
  armyDetail({
    troopOptions: [
      troopOption({
        min: 0,
        max: 12,
        description: 'Sumerian spearmen',
        troopEntries: troopEntries('SPR'),
      }),
      troopOption({
        min: 0,
        max: 6,
        description: 'Archers',
        troopEntries: troopEntries('ARC', 'BLV'),
      }),
    ],
  }),
);

const [spearmen, archers] = armyList.main.troopOptions;
if (!spearmen || !archers) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const empty = emptySelection({
  army: armyList.id,
  dataVersion: '2026-09-17.abcdef01',
  year: -2900,
});

const list = withStands(
  withStands(withStands(empty, spearmen, 'SPR', 6), archers, 'ARC', 2),
  archers,
  'BLV',
  1,
);

type NamedEntry = CollectionEntry & { name: string };

const entry = (
  id: string,
  count: number,
  troopType: TroopTypeCode,
  overrides: Partial<NamedEntry> = {},
): NamedEntry => ({
  id,
  name: id,
  count,
  troopType,
  tags: [],
  status: 'painted',
  ...overrides,
});

const covering = (
  selection: ArmySelection,
  entries: readonly NamedEntry[],
  pins: readonly CollectionPin[] = [],
) =>
  listCoverage(
    armySheet({
      listName: 'Lagash',
      armyList,
      selection,
      costs,
      names: troopTypeNames(sampleTroopTypes),
      factors: troopTypeFactors(sampleTroopTypes),
      movement: sampleCuration.movement,
      cardNames: {},
    }),
    coverage(selection, armyList, entries, pins),
    entries,
  );

const listPoints =
  6 * costs.troopTypes.SPR + 2 * costs.troopTypes.ARC + costs.troopTypes.BLV;

describe('listCoverage', () => {
  it('lays the coverage out the way the sheet lays out the list', () => {
    const result = covering(list, []);

    expect(result.contingents).toHaveLength(1);
    expect(
      result.contingents[0]?.options.map(({ description, lines }) => ({
        description,
        lines: lines.map(({ troopType, stands }) => ({ troopType, stands })),
      })),
    ).toEqual([
      {
        description: 'Sumerian spearmen',
        lines: [{ troopType: 'SPR', stands: 6 }],
      },
      {
        description: 'Archers',
        lines: [
          { troopType: 'ARC', stands: 2 },
          { troopType: 'BLV', stands: 1 },
        ],
      },
    ]);
  });

  it('puts every stand and every point to buy with an empty collection', () => {
    expect(covering(list, [])).toMatchObject({
      entries: 0,
      points: listPoints,
      coveredPoints: 0,
      stands: 9,
      covered: 0,
      toBuy: 9,
      toPaint: 0,
    });
  });

  it('counts the points of the stands it covers', () => {
    const result = covering(list, [entry('Spearmen', 4, 'SPR')]);

    expect(result).toMatchObject({
      points: listPoints,
      coveredPoints: 4 * costs.troopTypes.SPR,
      covered: 4,
      toBuy: 5,
    });
  });

  it('names the entry behind each covered stand and says how well it fits', () => {
    const result = covering(list, [
      entry('entry-spear', 6, 'SPR', {
        name: 'Lagash spearmen',
        tags: ['spearmen'],
      }),
      entry('entry-bows', 2, 'ARC', {
        name: 'Sunspire bowmen',
        status: 'unpainted',
      }),
    ]);
    const [spear, archery] = result.contingents[0]?.options ?? [];

    expect(spear?.lines[0]?.sources).toEqual([
      {
        entry: 'entry-spear',
        name: 'Lagash spearmen',
        stands: 6,
        fit: 'match',
        pinned: false,
        status: 'painted',
        tags: ['spearmen'],
        suggestedTags: [],
      },
    ]);
    expect(archery?.lines.map(({ sources }) => sources)).toEqual([
      [
        {
          entry: 'entry-bows',
          name: 'Sunspire bowmen',
          stands: 2,
          fit: 'standIn',
          pinned: false,
          status: 'unpainted',
          tags: [],
          suggestedTags: ['archers'],
        },
      ],
      [],
    ]);
    expect(result).toMatchObject({ covered: 8, toBuy: 1, toPaint: 2 });
  });

  it('offers every entry that fields as the troop type to pin there', () => {
    const result = covering(list, [
      entry('entry-spear', 6, 'SPR', { name: 'Lagash spearmen' }),
      entry('entry-levy', 4, 'SPR', { name: 'Levy' }),
      entry('entry-levy-bows', 3, 'ARC', { name: 'Levy bowmen' }),
      entry('entry-bows', 2, 'ARC', { name: 'Sunspire bowmen' }),
    ]);
    const [spear, archery] = result.contingents[0]?.options ?? [];

    expect(spear?.lines[0]?.candidates).toEqual([
      { entry: 'entry-spear', name: 'Lagash spearmen', count: 6 },
      { entry: 'entry-levy', name: 'Levy', count: 4 },
    ]);
    expect(archery?.lines.map(({ candidates }) => candidates)).toEqual([
      [
        { entry: 'entry-levy-bows', name: 'Levy bowmen', count: 3 },
        { entry: 'entry-bows', name: 'Sunspire bowmen', count: 2 },
      ],
      [],
    ]);
  });

  it('marks a pinned source, and no longer offers it to pin there', () => {
    const result = covering(
      list,
      [
        entry('entry-spear', 6, 'SPR', { name: 'Lagash spearmen' }),
        entry('entry-levy', 6, 'SPR', { name: 'Levy' }),
      ],
      [
        {
          option: spearmen.id,
          troopType: 'SPR',
          entry: 'entry-levy',
          count: 6,
        },
      ],
    );
    const line = result.contingents[0]?.options[0]?.lines[0];

    expect(line?.sources).toEqual([
      expect.objectContaining({
        entry: 'entry-levy',
        stands: 6,
        fit: 'match',
        pinned: true,
        suggestedTags: [],
      }),
    ]);
    expect(line?.candidates).toEqual([
      { entry: 'entry-spear', name: 'Lagash spearmen', count: 6 },
    ]);
  });

  it('covers nothing on a list with no stands', () => {
    expect(covering(empty, [entry('Spearmen', 4, 'SPR')])).toMatchObject({
      contingents: [],
      entries: 1,
      points: 0,
      stands: 0,
    });
  });
});
