import { describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { fantasySelectionSchema } from './selection-schema.ts';
import { canonicalFantasySelection } from './share.ts';

describe('canonicalFantasySelection', () => {
  it('encodes equal lists equally, whatever order their cards, tags and marks were added in', () => {
    const one = fantasySelection({
      units: [
        fantasyUnit('wargs', 'JCV', {
          tags: ['wolf', 'goblin'],
          cards: cards(
            'slow',
            { code: 'flying', variants: { flight: 'hover' } },
            'fierce',
          ),
          marks: { eventCards: { holdTheLine: 1, chargeThrough: 2 } },
        }),
      ],
      heroes: [
        fantasyHero('mage', {
          tags: ['b', 'a'],
          cards: cards('terror', 'hearten'),
        }),
      ],
      armyCards: [
        { code: 'packTrain', count: 1 },
        { code: 'ambush', variants: { reach: 'home' } },
      ],
    });
    const other = fantasySelection({
      units: [
        fantasyUnit('wargs', 'JCV', {
          tags: ['goblin', 'wolf', 'wolf'],
          cards: cards(
            'fierce',
            { code: 'flying', variants: { flight: 'hover' } },
            'slow',
          ),
          marks: { eventCards: { chargeThrough: 2, holdTheLine: 1 } },
        }),
      ],
      heroes: [
        fantasyHero('mage', {
          tags: ['a', 'b'],
          cards: cards('hearten', 'terror'),
        }),
      ],
      armyCards: [
        { code: 'ambush', variants: { reach: 'home' } },
        { code: 'packTrain' },
      ],
    });

    expect(JSON.stringify(canonicalFantasySelection(one))).toBe(
      JSON.stringify(canonicalFantasySelection(other)),
    );
  });

  it('keeps the order of units and heroes, which is the player’s', () => {
    const selection = fantasySelection({
      units: [fantasyUnit('b', 'SPR'), fantasyUnit('a', 'SPR')],
      heroes: [fantasyHero('z'), fantasyHero('y')],
    });

    const canonical = canonicalFantasySelection(selection);

    expect(canonical.units.map(({ id }) => id)).toEqual(['b', 'a']);
    expect(canonical.heroes.map(({ id }) => id)).toEqual(['z', 'y']);
  });

  it('drops empty variants and zero event cards, and still parses', () => {
    const canonical = canonicalFantasySelection(
      fantasySelection({
        units: [
          fantasyUnit('a', 'SPR', {
            cards: [{ code: 'deadly', variants: {} }],
            marks: { eventCards: { holdTheLine: 0 } },
          }),
        ],
        armyCards: [{ code: 'noCamp', variants: {} }],
      }),
    );

    expect(canonical.units[0]?.cards).toEqual([{ code: 'deadly' }]);
    expect(canonical.units[0]?.marks.eventCards).toEqual({});
    expect(canonical.armyCards).toEqual([{ code: 'noCamp' }]);
    expect(fantasySelectionSchema.parse(canonical)).toEqual(canonical);
  });
});
