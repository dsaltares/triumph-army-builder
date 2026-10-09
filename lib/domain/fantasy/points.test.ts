import { beforeAll, describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import { fantasyPoints } from './points.ts';
import { type FantasyCatalogue, fantasyCatalogue } from './reference.ts';

let catalogue: FantasyCatalogue;

beforeAll(async () => {
  catalogue = fantasyCatalogue(await sampleFantasyReference());
});

const zoomFlying = { code: 'flying', variants: { flight: 'zoom' } } as const;
const hoverFlying = { code: 'flying', variants: { flight: 'hover' } } as const;

const priced = (...args: Parameters<typeof fantasySelection>) =>
  fantasyPoints(fantasySelection(...args), catalogue);

describe('the worked examples of Appendix B', () => {
  it('prices Glaurung, a Behemoth, at 8½ and at 6½ after Delayed Entry', () => {
    const points = priced({
      units: [
        fantasyUnit('glaurung', 'ELE', {
          cards: cards('deadly', 'armored', 'rangedAttack', 'marksman'),
          marks: { delayedEntry: 1 },
        }),
      ],
    });

    expect(points.units[0]?.points).toBe(8.5);
    expect(points.victoryValue).toBe(8.5);
    expect(points.total).toBe(6.5);
  });

  it('prices the fire-breathing dragon, a Knight, at 8½ and at 6½ after Delayed Entry', () => {
    const dragon = (delayedEntry: number) =>
      priced({
        units: [
          fantasyUnit('dragon', 'KNT', {
            cards: cards(
              zoomFlying,
              'massive',
              'deadly',
              'armored',
              'rangedAttack',
              'marksman',
              'unreliable',
              'unruly',
            ),
            marks: { delayedEntry },
          }),
        ],
      });

    expect(dragon(0).total).toBe(8.5);
    expect(dragon(1).total).toBe(6.5);
    expect(dragon(1).victoryValue).toBe(8.5);
  });

  it('prices the Elder White Dragon, a War Wagon, at 9½ and 7½ after Delayed Entry', () => {
    const points = priced({
      units: [
        fantasyUnit('elder', 'WWG', {
          cards: cards(
            zoomFlying,
            'deadly',
            'armored',
            'rangedAttack',
            'marksman',
          ),
          marks: { delayedEntry: 1 },
        }),
      ],
    });

    expect(points.victoryValue).toBe(9.5);
    expect(points.total).toBe(7.5);
  });

  it('prices the Young Black Dragon, Javelin Cavalry, at 7½ and 5½ after Delayed Entry', () => {
    const points = priced({
      units: [
        fantasyUnit('young', 'JCV', {
          cards: cards(hoverFlying, 'prowess', 'armored', 'rangedAttack'),
          marks: { delayedEntry: 1 },
        }),
      ],
    });

    expect(points.victoryValue).toBe(7.5);
    expect(points.total).toBe(5.5);
  });
});

describe('the heroes of Appendix D', () => {
  it.each([
    ['Achilles', cards('champion', 'deadly'), 4],
    [
      'Blue, the ice wizard',
      cards('rangedAttack', 'marksman', 'subcommander'),
      5,
    ],
    [
      'the cannibal witchdoctor',
      cards({ code: 'negateMagic', variants: { reach: 'self' } }, 'prowess'),
      3,
    ],
    ['the mind flayer', cards('mindblast', 'subcommander'), 7],
  ])('prices %s at the appendix figure', (_name, heroCards, expected) => {
    const points = priced({
      heroes: [fantasyHero('hero', { cards: heroCards })],
    });

    expect(points.heroes[0]?.points).toBe(expected);
    expect(points.total).toBe(expected);
  });

  it('refunds a 1-point hero on Delayed Entry by 1, not 2', () => {
    const points = priced({
      heroes: [fantasyHero('demon', { delayedEntry: true })],
    });

    expect(points.lines).toContainEqual({
      kind: 'delayedEntry',
      bearer: { kind: 'hero', hero: 'demon' },
      points: -1,
    });
    expect(points.victoryValue).toBe(1);
    expect(points.total).toBe(0);
  });
});

describe('the army cards of Appendix C', () => {
  it('prices the Medieval Dwarves’ two Elite Foot on ponies at ½ a point each', () => {
    const points = priced({
      units: [
        fantasyUnit('dwarves', 'EFT', { stands: 6, marks: { transports: 2 } }),
      ],
      armyCards: [
        { code: 'mobileInfantry', variants: { transport: 'ground' } },
      ],
    });

    expect(points.lines).toContainEqual({
      kind: 'armyCard',
      code: 'mobileInfantry',
      count: 2,
      variants: { transport: 'ground' },
      points: 1,
    });
    expect(points.standPoints).toBe(24);
    expect(points.total).toBe(25);
  });

  it('prices transports with no Mobile Infantry bought as a line it cannot price', () => {
    const points = priced({
      units: [
        fantasyUnit('dwarves', 'EFT', { stands: 2, marks: { transports: 1 } }),
      ],
    });

    expect(points.lines).toContainEqual({
      kind: 'armyCard',
      code: 'mobileInfantry',
      count: 1,
      points: null,
    });
    expect(points.total).toBe(8);
  });
});

describe('fantasyPoints', () => {
  it('multiplies a unit’s per-stand cost by its stands', () => {
    const points = priced({
      units: [
        fantasyUnit('wargs', 'JCV', {
          stands: 4,
          cards: cards('slow', 'fierce'),
        }),
      ],
    });

    expect(points.units[0]).toMatchObject({
      basePoints: 4,
      pointsPerStand: 3,
      points: 12,
    });
  });

  it('raises a stand that its cards price below one point to one', () => {
    const points = priced({
      units: [
        fantasyUnit('sprites', 'RBL', {
          stands: 2,
          cards: cards('brittle', 'unruly'),
        }),
      ],
    });

    expect(points.units[0]).toMatchObject({
      unclampedPointsPerStand: -1,
      pointsPerStand: 1,
      points: 2,
    });
  });

  it('prices a card by troop type, by the cards beside it, by topography and by bearer', () => {
    const unit = (
      troopType: 'ELE' | 'KNT' | 'SPR',
      ...codes: Parameters<typeof cards>
    ) =>
      priced({
        units: [fantasyUnit('unit', troopType, { cards: cards(...codes) })],
      }).units[0]?.cards;

    expect(unit('ELE', 'unreliable')).toEqual([
      { code: 'unreliable', points: -2 },
    ]);
    expect(unit('KNT', 'unreliable')).toEqual([
      { code: 'unreliable', points: -2 },
    ]);
    expect(unit('SPR', 'unreliable')).toEqual([
      { code: 'unreliable', points: -1 },
    ]);
    expect(unit('SPR', 'fierce', 'unreliable')).toContainEqual({
      code: 'unreliable',
      points: -2,
    });
    expect(
      priced({ heroes: [fantasyHero('hero', { cards: cards('away') })] })
        .heroes[0]?.cards,
    ).toEqual([{ code: 'away', points: 1 }]);
    expect(unit('SPR', 'away')).toEqual([{ code: 'away', points: 0.5 }]);

    const affinity = (topography: 'Forest' | 'Dense Forest') =>
      fantasyPoints(
        fantasySelection({
          format: { pointsTotal: 51, topography, invasion: 2, maneuver: 2 },
          units: [
            fantasyUnit('elves', 'LFT', { cards: cards('terrainAffinity') }),
          ],
        }),
        catalogue,
      ).units[0]?.pointsPerStand;
    expect(affinity('Forest')).toBe(3.5);
    expect(affinity('Dense Forest')).toBe(4);
  });

  it('leaves a card whose variant is not chosen unpriced', () => {
    const points = priced({
      units: [fantasyUnit('eagles', 'JCV', { cards: cards('flying') })],
    });

    expect(points.units[0]?.cards).toEqual([{ code: 'flying', points: null }]);
    expect(points.units[0]?.pointsPerStand).toBe(4);
  });

  it('prices invasion and manoeuvre from the pack, nothing at the base rating', () => {
    const lines = (invasion: number, maneuver: number) =>
      fantasyPoints(
        fantasySelection({
          format: { pointsTotal: 51, topography: 'Hilly', invasion, maneuver },
        }),
        catalogue,
      ).lines;

    expect(lines(2, 2)).toEqual([
      { kind: 'invasion', rating: 2, points: 0 },
      { kind: 'maneuver', rating: 2, points: 0 },
    ]);
    expect(lines(0, 4)).toEqual([
      { kind: 'invasion', rating: 0, points: 1 },
      { kind: 'maneuver', rating: 4, points: 3 },
    ]);
    expect(
      lines(4, 0).reduce((total, line) => total + (line.points ?? 0), 0),
    ).toBe(-4);
  });

  it('prices army cards by count and variant, and event cards on the unit they were bought for', () => {
    const points = priced({
      format: {
        pointsTotal: 51,
        topography: 'Dense Underground',
        invasion: 2,
        maneuver: 2,
      },
      units: [
        fantasyUnit('pikes', 'PIK', {
          stands: 3,
          marks: { eventCards: { holdTheLine: 2 } },
        }),
      ],
      armyCards: [
        { code: 'preparedDefenses', count: 3 },
        { code: 'fortifiedCamp', variants: { defenses: 'heavily' } },
        { code: 'ambush', variants: { reach: 'home' } },
      ],
    });

    expect(points.lines.slice(2)).toEqual([
      { kind: 'armyCard', code: 'preparedDefenses', count: 3, points: 3 },
      {
        kind: 'armyCard',
        code: 'fortifiedCamp',
        count: 1,
        variants: { defenses: 'heavily' },
        points: 2,
      },
      {
        kind: 'armyCard',
        code: 'ambush',
        count: 1,
        variants: { reach: 'home' },
        points: 2,
      },
      {
        kind: 'eventCard',
        code: 'holdTheLine',
        unit: 'pikes',
        count: 2,
        points: 1,
      },
    ]);
    expect(points.victoryValue).toBe(9);
    expect(points.total).toBe(17);
  });

  it('refunds Delayed Entry per marked stand, never more stands than the unit has', () => {
    const points = priced({
      units: [
        fantasyUnit('skeletons', 'LFT', {
          stands: 2,
          cards: cards('away', 'slow'),
          marks: { delayedEntry: 5 },
        }),
      ],
    });

    expect(points.lines).toContainEqual({
      kind: 'delayedEntry',
      bearer: { kind: 'unit', unit: 'skeletons', stands: 2 },
      points: -4,
    });
    expect(points.victoryValue).toBe(6);
    expect(points.total).toBe(2);
  });
});
