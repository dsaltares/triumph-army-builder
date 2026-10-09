import { describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import {
  fantasySavedSelectionSchema,
  fantasySelectionSchema,
} from './selection-schema.ts';

const list = fantasySelection({
  units: [
    fantasyUnit('wargs', 'JCV', {
      name: 'Warg riders',
      tags: ['wolf'],
      stands: 4,
      cards: cards('fierce', { code: 'flying', variants: { flight: 'hover' } }),
      marks: {
        delayedEntry: 1,
        transports: 0,
        eventCards: { chargeThrough: 1 },
      },
    }),
  ],
  heroes: [
    fantasyHero('shaman', { cards: cards('hearten'), delayedEntry: true }),
  ],
  armyCards: [{ code: 'preparedDefenses', count: 2 }],
  general: 'wargs',
});

describe('fantasySelectionSchema', () => {
  it('reads a whole list back unchanged', () => {
    expect(fantasySelectionSchema.parse(list)).toEqual(list);
    expect(
      fantasySavedSelectionSchema.parse({ game: 'fantasy', selection: list }),
    ).toEqual({ game: 'fantasy', selection: list });
  });

  it.each([
    ['a points total of zero', { format: { ...list.format, pointsTotal: 0 } }],
    ['an invasion rating of five', { format: { ...list.format, invasion: 5 } }],
    [
      'an unknown topography',
      { format: { ...list.format, topography: 'Lava' } },
    ],
    ['a unit of no stands', { units: [{ ...list.units[0], stands: 0 }] }],
    ['a card the game does not have', { armyCards: [{ code: 'dragonfire' }] }],
    ['a data version of the wrong shape', { dataVersion: 'today' }],
  ])('refuses %s', (_case, overrides) => {
    expect(
      fantasySelectionSchema.safeParse({ ...list, ...overrides }).success,
    ).toBe(false);
  });
});
