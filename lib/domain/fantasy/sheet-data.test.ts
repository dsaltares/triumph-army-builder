import { beforeAll, describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import type { FantasyReference } from './reference.ts';
import { fantasySheet } from './sheet-data.ts';

let reference: FantasyReference;

beforeAll(async () => {
  reference = await sampleFantasyReference();
});

const goblins = fantasySelection({
  format: {
    pointsTotal: 51,
    topography: 'Dense Underground',
    invasion: 1,
    maneuver: 3,
  },
  units: [
    fantasyUnit('wargs', 'JCV', {
      name: 'Warg riders',
      tags: ['wolf'],
      stands: 4,
      cards: cards('slow', 'fierce', {
        code: 'terrainAffinity',
        note: ' Hills and woods ',
      }),
      marks: { eventCards: { chargeThrough: 1 } },
    }),
    fantasyUnit('archers', 'ARC', {
      stands: 3,
      cards: cards({ code: 'rangedAttack', variants: { effect: 'magical' } }),
      marks: { delayedEntry: 2 },
    }),
  ],
  heroes: [
    fantasyHero('shaman', {
      name: ' Hyperborean shaman ',
      cards: cards('hearten'),
      delayedEntry: true,
    }),
  ],
  armyCards: [{ code: 'ambush', variants: { reach: 'anywhere' } }],
  general: 'wargs',
});

describe('fantasySheet', () => {
  it('prints the format with its costs, and whether the topography is dense', () => {
    expect(
      fantasySheet({ name: 'Goblin host', selection: goblins }, reference),
    ).toMatchObject({
      listName: 'Goblin host',
      dataVersion: goblins.dataVersion,
      format: {
        pointsTotal: 51,
        topography: 'Dense Underground',
        dense: true,
        invasion: { rating: 1, points: 0.5 },
        maneuver: { rating: 3, points: 1 },
      },
    });
  });

  it('prints each unit under its name or its Fantasy troop type name, with the general marked', () => {
    const { units } = fantasySheet(
      { name: 'Goblin host', selection: goblins },
      reference,
    );

    expect(units).toEqual([
      {
        id: 'wargs',
        name: 'Warg riders',
        troopType: 'JCV',
        troopTypeName: 'Javelin Cavalry',
        stands: 4,
        general: true,
        cards: [
          { code: 'slow', name: 'Slow', variants: [], note: null },
          { code: 'fierce', name: 'Fierce', variants: [], note: null },
          {
            code: 'terrainAffinity',
            name: 'Terrain Affinity',
            variants: [],
            note: 'Hills and woods',
          },
        ],
        delayedStands: 0,
        transports: 0,
        pointsPerStand: 4,
        points: 16,
      },
      {
        id: 'archers',
        name: 'Shooters',
        troopType: 'ARC',
        troopTypeName: 'Shooters',
        stands: 3,
        general: false,
        cards: [
          {
            code: 'rangedAttack',
            name: 'Ranged Attack',
            variants: ['Magical'],
            note: null,
          },
        ],
        delayedStands: 2,
        transports: 0,
        pointsPerStand: 5,
        points: 15,
      },
    ]);
  });

  it('prints heroes, and the army cards with Delayed Entry refunds on lines of their own', () => {
    const sheet = fantasySheet(
      { name: 'Goblin host', selection: goblins },
      reference,
    );

    expect(sheet.heroes).toEqual([
      {
        id: 'shaman',
        name: 'Hyperborean shaman',
        cards: [{ code: 'hearten', name: 'Hearten', variants: [], note: null }],
        delayedEntry: true,
        points: 2,
      },
    ]);
    expect(sheet.armyCards).toEqual([
      {
        kind: 'armyCard',
        code: 'ambush',
        name: 'Ambush',
        count: 1,
        variants: ['Any topography'],
        bearer: null,
        points: 2,
      },
      {
        kind: 'eventCard',
        code: 'chargeThrough',
        name: 'Charge Through',
        count: 1,
        variants: [],
        bearer: 'Warg riders',
        points: 1,
      },
      {
        kind: 'delayedEntry',
        code: 'delayedEntry',
        name: 'Delayed Entry',
        count: 2,
        variants: [],
        bearer: 'Shooters',
        points: -4,
      },
      {
        kind: 'delayedEntry',
        code: 'delayedEntry',
        name: 'Delayed Entry',
        count: 1,
        variants: [],
        bearer: 'Hyperborean shaman',
        points: -2,
      },
    ]);
  });

  it('totals the victory value apart from the total', () => {
    expect(
      fantasySheet({ name: 'Goblin host', selection: goblins }, reference)
        .totals,
    ).toEqual({
      stands: 7,
      heroes: 1,
      victoryValue: 33,
      total: 31.5,
      pointsTotal: 51,
    });
  });

  it('prints a card it cannot price as unpriced and a card the pack lacks under its code', () => {
    const sheet = fantasySheet(
      {
        name: 'Unpriced',
        selection: fantasySelection({
          armyCards: [{ code: 'fortifiedCamp' }],
        }),
      },
      {
        ...reference,
        cards: reference.cards.filter(({ code }) => code !== 'fortifiedCamp'),
      },
    );

    expect(sheet.armyCards).toEqual([
      {
        kind: 'armyCard',
        code: 'fortifiedCamp',
        name: 'fortifiedCamp',
        count: 1,
        variants: [],
        bearer: null,
        points: null,
      },
    ]);
  });
});
