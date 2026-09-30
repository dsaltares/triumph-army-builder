import { describe, expect, it } from 'vitest';
import { sampleTroopTypes } from '@/test/sample.ts';
import { troopTypeCodes } from '../data/schema.ts';
import {
  troopTypeCosts,
  troopTypeGroups,
  troopTypeMovements,
  troopTypeNames,
  troopTypeProfiles,
} from './troop-types';

const troopTypes = sampleTroopTypes;

describe('troopTypeCosts', () => {
  it('prices every troop type in the snapshot', () => {
    const costs = troopTypeCosts(troopTypes);
    expect(Object.keys(costs).sort()).toEqual([...troopTypeCodes].sort());
    expect(Object.values(costs).every((cost) => cost >= 2 && cost <= 4)).toBe(
      true,
    );
  });

  it('reads the cost of a stand from the data', () => {
    const costs = troopTypeCosts(troopTypes);
    expect(costs.SPR).toBe(4);
    expect(costs.PIK).toBe(3);
    expect(costs.HRD).toBe(2);
  });

  it('refuses to price an army when a troop type is missing', () => {
    expect(() =>
      troopTypeCosts(
        troopTypes.filter(({ permanentCode }) => permanentCode !== 'PIK'),
      ),
    ).toThrow('no stand cost for PIK');
  });
});

describe('troopTypeNames', () => {
  it('names every troop type in the snapshot', () => {
    const names = troopTypeNames(troopTypes);
    expect(Object.keys(names).sort()).toEqual([...troopTypeCodes].sort());
    expect(names.SPR).toBe('Spear');
    expect(names.HBW).toBe('Horse Bow');
  });

  it('refuses to name an army when a troop type is missing', () => {
    expect(() =>
      troopTypeNames(
        troopTypes.filter(({ permanentCode }) => permanentCode !== 'SPR'),
      ),
    ).toThrow('no name for SPR');
  });
});

describe('troopTypeProfiles', () => {
  const spearmen = {
    permanentCode: 'SPR',
    category: 'foot',
    order: 'Close',
    movement: 3,
    basing: {
      depths: { 40: 15, 60: 20, 80: 30 },
      figures: { kind: 'figures', min: 4, max: 4 },
    },
  } as const;

  it('reads the category and the order of every troop type from the data', () => {
    const profiles = troopTypeProfiles(troopTypes);
    expect(Object.keys(profiles).sort()).toEqual([...troopTypeCodes].sort());
    expect(profiles.ARC).toMatchObject({ category: 'foot', order: 'Open' });
    expect(profiles.PIK).toMatchObject({ category: 'foot', order: 'Close' });
    expect(profiles.CAT).toMatchObject({ category: 'mounted', order: 'Close' });
    expect(profiles.HBW).toMatchObject({ category: 'mounted', order: 'Open' });
  });

  it('carries the movement and basing the data gives it', () => {
    const { permanentCode, ...profile } = spearmen;
    expect(
      troopTypeProfiles([
        spearmen,
        ...troopTypes.filter(
          (troopType) => troopType.permanentCode !== permanentCode,
        ),
      ]).SPR,
    ).toEqual(profile);
  });

  it('knows no movement or basing the data leaves out', () => {
    expect(troopTypeProfiles(troopTypes).SPR).toEqual({
      category: 'foot',
      order: 'Close',
      movement: null,
      basing: null,
    });
  });

  it('refuses to describe an army when a troop type is missing', () => {
    expect(() =>
      troopTypeProfiles(
        troopTypes.filter(({ permanentCode }) => permanentCode !== 'KNT'),
      ),
    ).toThrow('no profile for KNT');
  });
});

describe('troopTypeMovements', () => {
  it('reads the movement of the troop types that have one', () => {
    expect(
      troopTypeMovements([
        { permanentCode: 'SPR', movement: 3 },
        { permanentCode: 'KNT' },
      ]),
    ).toEqual({ SPR: 3 });
  });
});

describe('troopTypeGroups', () => {
  const groups = troopTypeGroups(troopTypes);

  it('puts the foot troop types before the mounted ones', () => {
    expect(groups.map(({ category }) => category)).toEqual(['foot', 'mounted']);
  });

  it('accounts for every troop type in the sample snapshot exactly once', () => {
    const grouped = groups.flatMap(({ orders }) =>
      orders.flatMap(({ troopTypes: grouped }) =>
        grouped.map(({ permanentCode }) => permanentCode),
      ),
    );

    expect(grouped.sort()).toEqual([...troopTypeCodes].sort());
  });

  it('puts close order before open order within each category', () => {
    expect(
      groups.map(({ orders }) => orders.map(({ order }) => order)),
    ).toEqual([
      ['Close', 'Open'],
      ['Close', 'Open'],
    ]);
  });

  it('keeps each troop type in the order it fights in', () => {
    for (const { orders } of groups) {
      for (const { order, troopTypes: grouped } of orders) {
        expect(grouped.every((troopType) => troopType.order === order)).toBe(
          true,
        );
      }
    }
  });

  it('sorts each order by name', () => {
    expect(
      groups[1]?.orders.map(({ troopTypes: grouped }) =>
        grouped.map(({ displayName }) => displayName),
      ),
    ).toEqual([
      ['Cataphracts', 'Elephants'],
      [
        'Bad Horse',
        'Battle Taxi',
        'Chariots',
        'Elite Cavalry',
        'Horse Bow',
        'Javelin Cavalry',
        'Knights',
      ],
    ]);
  });

  it('leaves out an order no troop type in the category fights in', () => {
    const [foot, mounted] = troopTypeGroups(
      troopTypes.filter(({ order }) => order === 'Open'),
    );

    expect(foot?.orders.map(({ order }) => order)).toEqual(['Open']);
    expect(mounted?.orders.map(({ order }) => order)).toEqual(['Open']);
  });
});
