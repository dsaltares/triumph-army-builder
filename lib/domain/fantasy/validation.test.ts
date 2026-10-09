import { beforeAll, describe, expect, it } from 'vitest';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import { type FantasyCatalogue, fantasyCatalogue } from './reference.ts';
import type { FantasySelection } from './selection-schema.ts';
import {
  type FantasyFinding,
  fantasyValidationReport,
  validateFantasyList,
} from './validation.ts';

let catalogue: FantasyCatalogue;

beforeAll(async () => {
  catalogue = fantasyCatalogue(await sampleFantasyReference());
});

const spears = fantasyUnit('spears', 'SPR', { stands: 8 });
const knights = fantasyUnit('knights', 'KNT', { stands: 4 });
const captain = fantasyHero('captain', { cards: cards('prowess') });

const legalList = (overrides: Partial<FantasySelection> = {}) =>
  fantasySelection({
    units: [spears, knights],
    heroes: [captain],
    armyCards: [{ code: 'packTrain' }],
    general: 'spears',
    ...overrides,
  });

const findings = (overrides: Partial<FantasySelection> = {}) =>
  validateFantasyList(legalList(overrides), catalogue);

const codes = (overrides: Partial<FantasySelection> = {}) =>
  findings(overrides).map(({ code }) => code);

const withUnit = (unit: ReturnType<typeof fantasyUnit>) => ({
  units: [spears, knights, unit],
});

const unitCard = (unit: string, code: string) => ({
  kind: 'unitCard',
  unit,
  code,
});

describe('validateFantasyList', () => {
  it('finds nothing wrong with a 51-point list of eight stands or more and a general', () => {
    expect(findings()).toEqual([]);
  });

  it('reports a list over and under its points total, against whatever total the format holds', () => {
    expect(
      findings({
        format: {
          pointsTotal: 50,
          topography: 'Hilly',
          invasion: 2,
          maneuver: 2,
        },
      }),
    ).toContainEqual({
      code: 'overPointsTotal',
      severity: 'error',
      target: { kind: 'army' },
      params: { total: 51, over: 1, pointsTotal: 50 },
    });
    expect(findings({ armyCards: [] })).toContainEqual({
      code: 'underPointsTotal',
      severity: 'warning',
      target: { kind: 'army' },
      params: { total: 50, unspent: 1, pointsTotal: 51 },
    });
  });

  it('asks for one stand for every six points', () => {
    const sevenStands = {
      units: [fantasyUnit('spears', 'SPR', { stands: 7 })],
    };
    const total = (pointsTotal: number) =>
      ({
        format: { pointsTotal, topography: 'Hilly', invasion: 2, maneuver: 2 },
      }) as const;

    expect(findings(sevenStands)).toContainEqual(
      expect.objectContaining({
        code: 'tooFewStands',
        params: { stands: 7, required: 8, pointsTotal: 51 },
      }),
    );
    expect(codes({ ...sevenStands, ...total(47) })).not.toContain(
      'tooFewStands',
    );
    expect(codes(total(72))).not.toContain('tooFewStands');
    expect(findings(total(78))).toContainEqual(
      expect.objectContaining({
        code: 'tooFewStands',
        params: { stands: 12, required: 13, pointsTotal: 78 },
      }),
    );
  });

  it('caps heroes at three and their points at eight', () => {
    const heroes = (...heroCards: Parameters<typeof cards>[]) =>
      heroCards.map((heroCard, index) =>
        fantasyHero(`hero-${index}`, { cards: cards(...heroCard) }),
      );

    expect(codes({ heroes: heroes([], [], []) })).not.toContain(
      'tooManyHeroes',
    );
    expect(findings({ heroes: heroes([], [], [], []) })).toContainEqual(
      expect.objectContaining({
        code: 'tooManyHeroes',
        params: { heroes: 4, max: 3 },
      }),
    );
    expect(
      codes({ heroes: heroes(['mindblast', 'subcommander']) }),
    ).not.toContain('heroPointsAboveMax');
    expect(
      findings({ heroes: heroes(['mindblast', 'subcommander'], ['prowess']) }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'heroPointsAboveMax',
        params: { points: 9, max: 8 },
      }),
    );
  });

  it('asks for a general, and never a hero', () => {
    expect(findings({ general: null })).toContainEqual({
      code: 'generalMissing',
      severity: 'error',
      target: { kind: 'general' },
      params: {},
    });
    expect(codes({ general: 'gone' })).toContain('generalMissing');
    expect(codes({ general: 'captain' })).toEqual(
      expect.arrayContaining(['generalIsHero']),
    );
    expect(codes({ general: 'captain' })).not.toContain('generalMissing');
  });

  it('reports a card bought twice for one unit, one hero or the army', () => {
    expect(
      findings(
        withUnit(fantasyUnit('elves', 'LFT', { cards: cards('fast', 'fast') })),
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'cardBoughtTwice',
        target: unitCard('elves', 'fast'),
      }),
    );
    expect(
      codes({
        heroes: [fantasyHero('twice', { cards: cards('deadly', 'deadly') })],
      }),
    ).toContain('cardBoughtTwice');
    expect(
      codes({ armyCards: [{ code: 'packTrain' }, { code: 'packTrain' }] }),
    ).toContain('cardBoughtTwice');
  });

  it('notes a unit its cards price below one point a stand, and refuses a negative card on a hero', () => {
    expect(
      findings(
        withUnit(
          fantasyUnit('sprites', 'RBL', { cards: cards('brittle', 'unruly') }),
        ),
      ),
    ).toContainEqual({
      code: 'standCostRaisedToMinimum',
      severity: 'info',
      target: { kind: 'unit', unit: 'sprites' },
      params: { unclamped: -1, minimum: 1 },
    });
    expect(
      findings({
        heroes: [fantasyHero('coward', { cards: cards('slow') })],
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'negativeCardOnHero',
        target: { kind: 'heroCard', hero: 'coward', code: 'slow' },
      }),
    );
  });

  it('refuses a card where its category does not belong', () => {
    expect(
      findings({
        heroes: [fantasyHero('flyer', { cards: cards('regenerate') })],
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'cardNotForPlacement',
        params: { card: 'regenerate', category: 'stand', placement: 'hero' },
      }),
    );
    expect(
      codes(
        withUnit(fantasyUnit('champions', 'EFT', { cards: cards('champion') })),
      ),
    ).toContain('cardNotForPlacement');
    expect(codes({ armyCards: [{ code: 'deadly' }] })).toContain(
      'cardNotForPlacement',
    );
    expect(
      codes(
        withUnit(
          fantasyUnit('pikes', 'PIK', { marks: { eventCards: { deadly: 1 } } }),
        ),
      ),
    ).toContain('cardNotForPlacement');
  });

  it('asks for every variant a card offers', () => {
    expect(
      findings({
        heroes: [
          fantasyHero('mage', {
            cards: cards({
              code: 'spellblast',
              variants: { reach: 'limited' },
            }),
          }),
        ],
      }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'variantNotChosen',
        params: { card: 'spellblast', choice: 'effect' },
      }),
    );
    expect(
      codes({
        heroes: [
          fantasyHero('mage', {
            cards: cards({
              code: 'spellblast',
              variants: { reach: 'limited', effect: 'magical' },
            }),
          }),
        ],
      }),
    ).not.toContain('variantNotChosen');
    expect(
      codes({
        armyCards: [{ code: 'fortifiedCamp', variants: { defenses: 'moat' } }],
      }),
    ).toContain('variantNotChosen');
  });

  it('caps a card bought by count at the number its cost allows', () => {
    expect(
      codes({ armyCards: [{ code: 'illusion', count: 6 }] }),
    ).not.toContain('cardCountAboveMax');
    expect(
      findings({ armyCards: [{ code: 'illusion', count: 7 }] }),
    ).toContainEqual(
      expect.objectContaining({
        code: 'cardCountAboveMax',
        params: { card: 'illusion', count: 7, max: 6 },
      }),
    );
    expect(codes({ armyCards: [{ code: 'noCamp', count: 2 }] })).toContain(
      'cardCountAboveMax',
    );
    expect(
      codes(
        withUnit(
          fantasyUnit('pikes', 'PIK', {
            marks: { eventCards: { holdTheLine: 4 } },
          }),
        ),
      ),
    ).toContain('cardCountAboveMax');
  });

  it('warns about marks on more stands than the unit has', () => {
    expect(
      findings(
        withUnit(
          fantasyUnit('late', 'LFT', { stands: 2, marks: { delayedEntry: 3 } }),
        ),
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'marksExceedStands',
        params: { mark: 'delayedEntry', marked: 3, stands: 2 },
      }),
    );
  });

  it('warns about transports marked with no Mobile Infantry bought, and about Delayed Entry bought rather than marked', () => {
    expect(
      findings(
        withUnit(fantasyUnit('dwarves', 'EFT', { marks: { transports: 1 } })),
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'variantNotChosen',
        target: { kind: 'armyCard', code: 'mobileInfantry' },
      }),
    );
    expect(codes({ armyCards: [{ code: 'delayedEntry' }] })).toContain(
      'cardMarkedNotBought',
    );
  });

  it('warns about a card the pack does not hold', () => {
    const withoutAmbush: FantasyCatalogue = {
      ...catalogue,
      cards: new Map(
        [...catalogue.cards].filter(([code]) => code !== 'ambush'),
      ),
    };

    expect(
      validateFantasyList(
        legalList({
          armyCards: [{ code: 'ambush', variants: { reach: 'home' } }],
        }),
        withoutAmbush,
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'cardNotInPack',
        params: { card: 'ambush' },
      }),
    );
  });
});

describe('every constraint kind in the pack', () => {
  const unitCodes = (unit: ReturnType<typeof fantasyUnit>) =>
    codes(withUnit(unit));

  it('eligible: Flying only on open order, War Wagons or Artillery', () => {
    expect(
      unitCodes(
        fantasyUnit('eagles', 'JCV', {
          cards: cards({ code: 'flying', variants: { flight: 'zoom' } }),
        }),
      ),
    ).not.toContain('cardNotEligible');
    expect(
      findings(
        withUnit(
          fantasyUnit('flying spears', 'SPR', {
            cards: cards({ code: 'flying', variants: { flight: 'zoom' } }),
          }),
        ),
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'cardNotEligible',
        target: unitCard('flying spears', 'flying'),
      }),
    );
  });

  it('eligible: Mobile Infantry only carries foot', () => {
    const transported = (troopType: 'EFT' | 'KNT') =>
      codes({
        units: [
          spears,
          knights,
          fantasyUnit('riders', troopType, { marks: { transports: 1 } }),
        ],
        armyCards: [
          { code: 'packTrain' },
          { code: 'mobileInfantry', variants: { transport: 'ground' } },
        ],
      });

    expect(transported('EFT')).not.toContain('cardNotEligible');
    expect(transported('KNT')).toContain('cardNotEligible');
  });

  it('ineligible: no Armored War Wagons', () => {
    expect(
      unitCodes(fantasyUnit('wagons', 'WWG', { cards: cards('armored') })),
    ).toContain('cardNotEligible');
    expect(
      unitCodes(fantasyUnit('knights', 'EFT', { cards: cards('armored') })),
    ).not.toContain('cardNotEligible');
  });

  it('ineligible: no Fast stand that already moves 8', () => {
    expect(
      unitCodes(fantasyUnit('horse', 'HBW', { cards: cards('fast') })),
    ).toContain('cardNotEligible');
    expect(
      unitCodes(fantasyUnit('horse', 'ECV', { cards: cards('fast') })),
    ).not.toContain('cardNotEligible');
  });

  it('ineligible: Hold the Line, an event card, not for Knights', () => {
    expect(
      unitCodes(
        fantasyUnit('lancers', 'KNT', {
          marks: { eventCards: { holdTheLine: 1 } },
        }),
      ),
    ).toContain('cardNotEligible');
    expect(
      unitCodes(
        fantasyUnit('pikes', 'PIK', {
          marks: { eventCards: { holdTheLine: 1 } },
        }),
      ),
    ).not.toContain('cardNotEligible');
  });

  it('excludedWith: Fierce and Craven, reported on each card under one pair', () => {
    const both = findings(
      withUnit(
        fantasyUnit('mushrooms', 'LFT', { cards: cards('fierce', 'craven') }),
      ),
    ).filter(({ code }) => code === 'cardsExcludeEachOther');

    expect(both).toEqual([
      {
        code: 'cardsExcludeEachOther',
        severity: 'error',
        target: unitCard('mushrooms', 'craven'),
        params: { card: 'craven', other: 'fierce' },
      },
      {
        code: 'cardsExcludeEachOther',
        severity: 'error',
        target: unitCard('mushrooms', 'fierce'),
        params: { card: 'craven', other: 'fierce' },
      },
    ]);
    expect(
      unitCodes(fantasyUnit('mushrooms', 'LFT', { cards: cards('craven') })),
    ).not.toContain('cardsExcludeEachOther');
  });

  it('excludedWith: Spiked Carts with transports marked', () => {
    expect(
      unitCodes(
        fantasyUnit('carts', 'HFT', {
          cards: cards('spikedCarts'),
          marks: { transports: 1 },
        }),
      ),
    ).toContain('cardsExcludeEachOther');
  });

  it('requires: a Marksman hero needs Ranged Attack', () => {
    const marksman = (...heroCards: Parameters<typeof cards>) =>
      codes({
        heroes: [
          fantasyHero('archer', { cards: cards('marksman', ...heroCards) }),
        ],
      });

    expect(marksman()).toContain('cardRequiresCard');
    expect(
      marksman({ code: 'rangedAttack', variants: { effect: 'physical' } }),
    ).not.toContain('cardRequiresCard');
  });

  it('maxPerArmy: four stands and one hero on Delayed Entry', () => {
    const late = (delayed: number, heroes: number) =>
      findings({
        units: [
          spears,
          knights,
          fantasyUnit('late', 'LFT', {
            stands: 6,
            marks: { delayedEntry: delayed },
          }),
        ],
        heroes: Array.from({ length: heroes }, (_, index) =>
          fantasyHero(`late-${index}`, { delayedEntry: true }),
        ),
      }).filter(({ code }) => code === 'cardAboveArmyMax');

    expect(late(4, 1)).toEqual([]);
    expect(late(5, 2)).toEqual([
      {
        code: 'cardAboveArmyMax',
        severity: 'error',
        target: { kind: 'armyCard', code: 'delayedEntry' },
        params: { card: 'delayedEntry', bearer: 'stands', count: 5, max: 4 },
      },
      {
        code: 'cardAboveArmyMax',
        severity: 'error',
        target: { kind: 'armyCard', code: 'delayedEntry' },
        params: { card: 'delayedEntry', bearer: 'heroes', count: 2, max: 1 },
      },
    ]);
  });

  it('maxPerArmy: Unreliable on four stands at most, counted across units', () => {
    expect(
      codes({
        units: [
          spears,
          fantasyUnit('knights', 'KNT', {
            stands: 4,
            cards: cards('unreliable'),
          }),
        ],
      }),
    ).not.toContain('cardAboveArmyMax');
    expect(
      codes({
        units: [
          spears,
          fantasyUnit('knights', 'KNT', {
            stands: 3,
            cards: cards('unreliable'),
          }),
          fantasyUnit('more', 'KNT', { stands: 2, cards: cards('unreliable') }),
        ],
      }),
    ).toContain('cardAboveArmyMax');
  });

  it('oncePerArmy: one Subcommander and one Fortified Camp', () => {
    const subcommanders = (heroes: number) =>
      codes({
        heroes: Array.from({ length: heroes }, (_, index) =>
          fantasyHero(`sub-${index}`, { cards: cards('subcommander') }),
        ),
      });

    expect(subcommanders(1)).not.toContain('cardMoreThanOncePerArmy');
    expect(subcommanders(2)).toContain('cardMoreThanOncePerArmy');
    expect(
      codes({
        armyCards: [
          {
            code: 'fortifiedCamp',
            count: 2,
            variants: { defenses: 'fortified' },
          },
        ],
      }),
    ).toContain('cardMoreThanOncePerArmy');
  });

  it('notOnGeneral: the general is never Unreliable, and never wholly on Delayed Entry', () => {
    const general = (unit: ReturnType<typeof fantasyUnit>) =>
      findings({ units: [unit, knights], general: unit.id });

    expect(
      general(
        fantasyUnit('spears', 'SPR', { stands: 8, cards: cards('unreliable') }),
      ),
    ).toContainEqual({
      code: 'cardOnGeneral',
      severity: 'error',
      target: unitCard('spears', 'unreliable'),
      params: { card: 'unreliable' },
    });
    expect(
      general(
        fantasyUnit('spears', 'SPR', { stands: 8, marks: { delayedEntry: 1 } }),
      ).map(({ code }) => code),
    ).not.toContain('cardOnGeneral');
    expect(
      general(
        fantasyUnit('dragon', 'SPR', { stands: 1, marks: { delayedEntry: 1 } }),
      ).map(({ code }) => code),
    ).toContain('cardOnGeneral');
  });

  it('notOnHeroes: Regenerate never on a hero', () => {
    const regenerating = findings({
      heroes: [fantasyHero('lich', { cards: cards('regenerate') })],
    });

    expect(regenerating.map(({ code }) => code)).toContain(
      'cardNotForPlacement',
    );
    expect(
      validateFantasyList(
        legalList({
          heroes: [fantasyHero('lich', { cards: cards('regenerate') })],
        }),
        {
          ...catalogue,
          cards: new Map(
            [...catalogue.cards].map(([code, card]) => [
              code,
              code === 'regenerate'
                ? { ...card, category: 'standOrHero' }
                : card,
            ]),
          ),
        },
      ),
    ).toContainEqual(
      expect.objectContaining({
        code: 'cardOnHero',
        target: { kind: 'heroCard', hero: 'lich', code: 'regenerate' },
      }),
    );
    expect(
      unitCodes(fantasyUnit('zombies', 'HRD', { cards: cards('regenerate') })),
    ).not.toContain('cardOnHero');
  });

  it('oneClassPerArmy: Charge Through for one unit only', () => {
    const charging = (...units: string[]) =>
      codes({
        units: [
          spears,
          knights,
          ...units.map((id) =>
            fantasyUnit(id, 'ECV', {
              marks: { eventCards: { chargeThrough: 1 } },
            }),
          ),
        ],
      });

    expect(charging('riders')).not.toContain('cardOnSeveralUnits');
    expect(charging('riders', 'more riders')).toContain('cardOnSeveralUnits');
  });
});

describe('fantasyValidationReport', () => {
  it('sorts errors first and counts each severity', () => {
    const report = fantasyValidationReport(
      legalList({
        general: null,
        armyCards: [{ code: 'fortifiedCamp' }],
        units: [
          spears,
          knights,
          fantasyUnit('sprites', 'RBL', { cards: cards('brittle', 'unruly') }),
        ],
      }),
      catalogue,
    );

    expect(
      report.findings.map(({ code, severity }: FantasyFinding) => [
        code,
        severity,
      ]),
    ).toEqual([
      ['generalMissing', 'error'],
      ['variantNotChosen', 'warning'],
      ['standCostRaisedToMinimum', 'info'],
    ]);
    expect(report).toMatchObject({
      errors: 1,
      warnings: 1,
      notes: 1,
      legal: false,
    });
  });
});
