import { beforeAll, describe, expect, it } from 'vitest';
import type { BundledFantasyCard, FantasyCardText } from '@/lib/data/bundle.ts';
import { type FantasyCardCode, fantasyCardCodes } from '@/lib/data/schema.ts';
import fantasyText from '@/test/fixtures/reference/curation/games/fantasy/text.json';
import { sampleFantasyReference } from '@/test/sample.ts';
import { fantasyCardCategories } from './battle-cards.ts';
import {
  type FantasyCardNaming,
  type FantasyReferenceCard,
  type FantasyReferenceCardGroup,
  fantasyCardReference,
} from './card-reference.ts';
import { fantasyTroopTypeNames } from './naming.ts';

const text = fantasyText as FantasyCardText;

let naming: FantasyCardNaming;
let groups: readonly FantasyReferenceCardGroup[];

beforeAll(async () => {
  const reference = await sampleFantasyReference();
  naming = {
    troopTypeNames: fantasyTroopTypeNames(reference),
    cards: reference.cards,
    denseTopographies: reference.format.denseTopographies,
  };
  groups = fantasyCardReference(naming, text);
});

const card = (code: FantasyCardCode): FantasyReferenceCard => {
  const found = groups
    .flatMap((group) => group.cards)
    .find((entry) => entry.code === code);
  if (!found) {
    throw new Error(`${code} is not in the reference`);
  }
  return found;
};

describe('fantasyCardReference', () => {
  it('groups every card under its category, in the order the rules list them', () => {
    expect(groups.map(({ category }) => category)).toEqual(
      fantasyCardCategories,
    );
    expect(
      groups.flatMap(({ cards }) => cards.map(({ code }) => code)).sort(),
    ).toEqual([...fantasyCardCodes].sort());
    expect(
      groups
        .find(({ category }) => category === 'hero')
        ?.cards.map(({ name }) => name),
    ).toEqual(['Champion', 'Subcommander']);
  });

  it('sorts the cards of a category by name', () => {
    for (const { cards } of groups) {
      const names = cards.map(({ name }) => name);
      expect(names).toEqual([...names].sort());
    }
  });

  it('drops a category the catalogue has no card in', () => {
    const withoutHeroes = naming.cards.filter(
      ({ category }) => category !== 'hero',
    );

    expect(
      fantasyCardReference({ ...naming, cards: withoutHeroes }, text).map(
        ({ category }) => category,
      ),
    ).not.toContain('hero');
  });

  it('carries the rules text of each card', () => {
    expect(card('deadly').text).toBe(text.deadly);
  });

  it('prices a flat card once', () => {
    expect(card('deadly').cost).toEqual([
      { points: 2, basis: { kind: 'once' }, qualifiers: [] },
    ]);
  });

  it('prices a card by troop type override by override, then everything else, with Fantasy names', () => {
    expect(card('brittle').cost).toEqual([
      {
        points: 0,
        basis: { kind: 'once' },
        qualifiers: [
          {
            kind: 'stand',
            when: [{ kind: 'troopTypes', names: ['Artillery'] }],
          },
        ],
      },
      {
        points: -1,
        basis: { kind: 'once' },
        qualifiers: [
          {
            kind: 'stand',
            when: [{ kind: 'troopTypes', names: ['Bow Levy', 'Shooters'] }],
          },
        ],
      },
      {
        points: -1,
        basis: { kind: 'once' },
        qualifiers: [
          {
            kind: 'stand',
            when: [{ kind: 'cards', names: ['Mindblast', 'Spellblast'] }],
          },
        ],
      },
      {
        points: -2,
        basis: { kind: 'once' },
        qualifiers: [{ kind: 'otherwise' }],
      },
    ]);
  });

  it('prices a card by the density of the home topography, naming the dense ones', () => {
    expect(card('terrainAffinity').cost).toEqual([
      {
        points: 1,
        basis: { kind: 'once' },
        qualifiers: [
          {
            kind: 'denseTopography',
            topographies: naming.denseTopographies,
          },
        ],
      },
      {
        points: 0.5,
        basis: { kind: 'once' },
        qualifiers: [{ kind: 'otherTopography' }],
      },
    ]);
  });

  it('prices each variant under its translated name', () => {
    expect(card('flying').cost).toEqual([
      {
        points: 1,
        basis: { kind: 'once' },
        qualifiers: [{ kind: 'variant', name: 'Hover Flying' }],
      },
      {
        points: 2,
        basis: { kind: 'once' },
        qualifiers: [{ kind: 'variant', name: 'Zoom Flying' }],
      },
    ]);
  });

  it('falls back to the option key when a variant has no name', () => {
    const flying = naming.cards.find(
      ({ code }) => code === 'flying',
    ) as BundledFantasyCard;
    const unnamed = { ...flying, variants: {} };

    const [lines] = fantasyCardReference(
      { ...naming, cards: [unnamed] },
      text,
    ).map(({ cards }) => cards[0]?.cost);

    expect(lines?.map(({ qualifiers }) => qualifiers)).toEqual([
      [{ kind: 'variant', name: 'hover' }],
      [{ kind: 'variant', name: 'zoom' }],
    ]);
  });

  it('prices a counted card per count, up to its maximum, through what each one costs', () => {
    expect(card('mobileInfantry').cost).toEqual([
      {
        points: 0.5,
        basis: { kind: 'perCount', max: 8 },
        qualifiers: [{ kind: 'variant', name: 'Ground transport' }],
      },
      {
        points: 1,
        basis: { kind: 'perCount', max: 8 },
        qualifiers: [{ kind: 'variant', name: 'Flying transport' }],
      },
    ]);
  });

  it('prices a marking card per marked stand', () => {
    expect(card('delayedEntry').cost).toEqual([
      { points: -2, basis: { kind: 'perMarked' }, qualifiers: [] },
    ]);
  });

  it('prices a card by who bears it', () => {
    expect(card('away').cost).toEqual([
      {
        points: 0.5,
        basis: { kind: 'once' },
        qualifiers: [{ kind: 'bearer', bearer: 'stand' }],
      },
      {
        points: 1,
        basis: { kind: 'once' },
        qualifiers: [{ kind: 'bearer', bearer: 'hero' }],
      },
    ]);
  });

  it('describes who may and may not take a card, term by term', () => {
    expect(card('supportingShooters').constraints).toEqual([
      {
        kind: 'eligible',
        anyOf: [
          [
            { kind: 'order', order: 'Close' },
            { kind: 'category', category: 'foot' },
          ],
          [
            {
              kind: 'troopTypes',
              names: ['Light Foot', 'Raiders', 'Light Spear'],
            },
          ],
        ],
      },
      {
        kind: 'ineligible',
        anyOf: [
          [
            {
              kind: 'troopTypes',
              names: ['Artillery', 'Pavisiers', 'Horde', 'War Wagons'],
            },
          ],
        ],
      },
      { kind: 'excludedWith', cards: ['Ranged Attack'] },
    ]);
    expect(card('fast').constraints[0]).toEqual({
      kind: 'ineligible',
      anyOf: [[{ kind: 'minMovement', distance: 8 }]],
    });
  });

  it('describes what a card requires, and of which bearer', () => {
    expect(card('marksman').constraints).toEqual([
      {
        kind: 'eligible',
        anyOf: [
          [
            {
              kind: 'troopTypes',
              names: ['Shooters', 'Pavisiers', 'Artillery', 'War Wagons'],
            },
          ],
          [{ kind: 'cards', names: ['Ranged Attack'] }],
        ],
      },
      { kind: 'requires', cards: ['Ranged Attack'], bearer: 'hero' },
      { kind: 'maxStandsPerArmy', max: 4 },
      { kind: 'maxHeroesPerArmy', max: 1 },
    ]);
  });

  it('describes a requirement on any bearer, names a card the catalogue lacks by its code, and caps stands alone', () => {
    const unreliable = naming.cards.find(
      ({ code }) => code === 'unreliable',
    ) as BundledFantasyCard;
    const needy = {
      ...unreliable,
      constraints: [
        { kind: 'requires', cards: ['fierce'] },
        ...unreliable.constraints,
      ],
    } satisfies BundledFantasyCard;

    const [described] = fantasyCardReference(
      { ...naming, cards: [needy] },
      text,
    ).flatMap(({ cards }) => cards);

    expect(described?.constraints).toEqual([
      { kind: 'requires', cards: ['fierce'], bearer: null },
      { kind: 'maxStandsPerArmy', max: 4 },
      { kind: 'notOnGeneral' },
    ]);
  });

  it('passes the army-wide constraints through as they are', () => {
    expect(card('fortifiedCamp').constraints).toEqual([
      { kind: 'oncePerArmy' },
    ]);
    expect(card('illusion').constraints).toEqual([
      { kind: 'notOnHeroes' },
      { kind: 'notOnGeneral' },
    ]);
    expect(card('chargeThrough').constraints).toEqual([
      { kind: 'oneClassPerArmy' },
    ]);
  });

  it('offers the variant choices the cost does not depend on, and only those', () => {
    expect(card('rangedAttack').choices).toEqual([['Physical', 'Magical']]);
    expect(card('spellblast').choices).toEqual([['Physical', 'Magical']]);
    expect(card('flying').choices).toEqual([]);
    expect(card('deadly').choices).toEqual([]);
  });
});
