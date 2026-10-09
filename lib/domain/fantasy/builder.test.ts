import { beforeAll, describe, expect, it } from 'vitest';
import type { FantasyCardCode } from '@/lib/data/schema.ts';
import {
  cards,
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import {
  armyCardOffers,
  canAddHero,
  canSplit,
  cardCountMax,
  heroCardOffers,
  ratingPoints,
  startFantasyList,
  takesNote,
  unitCardOffers,
  unitEventCardOffers,
  unitMayBeDelayed,
  unitMayRide,
  withArmyCard,
  withArmyCardCount,
  withArmyCardVariant,
  withFormat,
  withGeneral,
  withHeroAdded,
  withHeroCard,
  withHeroCardVariant,
  withHeroDelayedEntry,
  withHeroName,
  withHeroTags,
  withoutArmyCard,
  withoutHero,
  withoutHeroCard,
  withoutUnit,
  withoutUnitCard,
  withUnitAdded,
  withUnitCard,
  withUnitCardNote,
  withUnitCardVariant,
  withUnitEventCard,
  withUnitMark,
  withUnitName,
  withUnitSplit,
  withUnitStands,
  withUnitTags,
} from './builder.ts';
import { fantasyPoints } from './points.ts';
import { type FantasyCatalogue, fantasyCatalogue } from './reference.ts';

let catalogue: FantasyCatalogue;

beforeAll(async () => {
  catalogue = fantasyCatalogue(await sampleFantasyReference());
});

const codes = (offers: readonly { card: { code: FantasyCardCode } }[]) =>
  offers.map(({ card }) => card.code);

const card = (code: FantasyCardCode) => {
  const found = catalogue.cards.get(code);
  if (!found) {
    throw new Error(`the sample pack has no ${code}`);
  }
  return found;
};

describe('startFantasyList', () => {
  it('starts empty at the pack’s points total, with both ratings at their unpaid base', () => {
    const selection = startFantasyList(catalogue.format, '2026-10-09.abcdef01');

    expect(selection).toEqual({
      dataVersion: '2026-10-09.abcdef01',
      format: {
        pointsTotal: 51,
        topography: 'Arable',
        invasion: 2,
        maneuver: 2,
      },
      units: [],
      heroes: [],
      armyCards: [],
      general: null,
    });
    expect(fantasyPoints(selection, catalogue).total).toBe(0);
  });

  it('takes the points total the player asked for', () => {
    expect(
      startFantasyList(catalogue.format, '2026-10-09.abcdef01', 36).format
        .pointsTotal,
    ).toBe(36);
  });
});

describe('the format', () => {
  it('changes one setting and keeps the rest', () => {
    expect(
      withFormat(fantasySelection(), { topography: 'Dense Forest' }).format,
    ).toEqual({
      pointsTotal: 51,
      topography: 'Dense Forest',
      invasion: 2,
      maneuver: 2,
    });
  });

  it('prices each rating from the pack', () => {
    expect(ratingPoints(catalogue.format, 'invasion', 0)).toBe(1);
    expect(ratingPoints(catalogue.format, 'maneuver', 4)).toBe(3);
    expect(ratingPoints(catalogue.format, 'maneuver', 2)).toBe(0);
  });
});

describe('units', () => {
  it('adds a unit of one stand, and makes the first one the general', () => {
    const one = withUnitAdded(fantasySelection(), 'wargs', 'JCV');
    const two = withUnitAdded(one, 'archers', 'ARC');

    expect(two.units).toEqual([
      fantasyUnit('wargs', 'JCV'),
      fantasyUnit('archers', 'ARC'),
    ]);
    expect(two.general).toBe('wargs');
  });

  it('names, tags and sizes a unit', () => {
    let selection = withUnitAdded(fantasySelection(), 'wargs', 'JCV');
    selection = withUnitName(selection, 'wargs', 'Warg riders');
    selection = withUnitTags(selection, 'wargs', ['wolf', 'goblin']);
    selection = withUnitStands(selection, 'wargs', 4);

    expect(selection.units[0]).toMatchObject({
      name: 'Warg riders',
      tags: ['wolf', 'goblin'],
      stands: 4,
    });
  });

  it('keeps at least one stand, and never more marks than stands', () => {
    const selection = fantasySelection({
      units: [
        fantasyUnit('wargs', 'JCV', {
          stands: 4,
          marks: { delayedEntry: 3, transports: 2 },
        }),
      ],
    });

    expect(withUnitStands(selection, 'wargs', 2).units[0]).toMatchObject({
      stands: 2,
      marks: { delayedEntry: 2, transports: 2 },
    });
    expect(withUnitStands(selection, 'wargs', 0).units[0]?.stands).toBe(1);
  });

  it('removes a unit, handing the command to the next one', () => {
    const selection = fantasySelection({
      units: [fantasyUnit('wargs', 'JCV'), fantasyUnit('archers', 'ARC')],
      general: 'wargs',
    });

    expect(withoutUnit(selection, 'wargs')).toMatchObject({
      units: [{ id: 'archers' }],
      general: 'archers',
    });
    expect(withoutUnit(selection, 'archers').general).toBe('wargs');
    expect(
      withoutUnit(withoutUnit(selection, 'wargs'), 'archers').general,
    ).toBeNull();
  });

  it('chooses the general among the units', () => {
    const selection = fantasySelection({
      units: [fantasyUnit('wargs', 'JCV'), fantasyUnit('archers', 'ARC')],
      general: 'wargs',
    });

    expect(withGeneral(selection, 'archers').general).toBe('archers');
  });
});

describe('splitting a unit', () => {
  const wargs = fantasyUnit('wargs', 'JCV', {
    name: 'Warg riders',
    tags: ['wolf'],
    stands: 5,
    cards: cards('fierce'),
    marks: {
      delayedEntry: 4,
      transports: 0,
      eventCards: { chargeThrough: 1 },
    },
  });

  it('moves stands into a new unit with the same cards, right after it', () => {
    const selection = withUnitSplit(
      fantasySelection({
        units: [wargs, fantasyUnit('archers', 'ARC')],
      }),
      'wargs',
      2,
      'wargs-2',
    );

    expect(selection.units.map(({ id, stands }) => [id, stands])).toEqual([
      ['wargs', 3],
      ['wargs-2', 2],
      ['archers', 1],
    ]);
    expect(selection.units[1]).toMatchObject({
      name: 'Warg riders',
      tags: ['wolf'],
      troopType: 'JCV',
      cards: cards('fierce'),
      marks: { delayedEntry: 0, transports: 0, eventCards: {} },
    });
    expect(selection.units[0]?.marks).toEqual({
      delayedEntry: 3,
      transports: 0,
      eventCards: { chargeThrough: 1 },
    });
  });

  it('leaves at least one stand behind', () => {
    const selection = withUnitSplit(
      fantasySelection({ units: [wargs] }),
      'wargs',
      9,
      'wargs-2',
    );

    expect(selection.units.map(({ stands }) => stands)).toEqual([1, 4]);
  });

  it('cannot split a single stand, or a unit that is not there', () => {
    const single = fantasySelection({ units: [fantasyUnit('a', 'JCV')] });

    expect(canSplit(fantasyUnit('a', 'JCV'))).toBe(false);
    expect(withUnitSplit(single, 'a', 1, 'b')).toBe(single);
    expect(withUnitSplit(single, 'nobody', 1, 'b')).toBe(single);
  });
});

describe('a unit’s cards', () => {
  const base = fantasySelection({
    units: [fantasyUnit('rangers', 'LFT', { stands: 3 })],
  });

  it('adds a card once, chooses its variant, notes it and removes it', () => {
    let selection = withUnitCard(base, 'rangers', 'rangedAttack');
    selection = withUnitCard(selection, 'rangers', 'rangedAttack');
    selection = withUnitCardVariant(
      selection,
      'rangers',
      'rangedAttack',
      'effect',
      'magical',
    );
    selection = withUnitCard(selection, 'rangers', 'terrainAffinity');
    selection = withUnitCardNote(
      selection,
      'rangers',
      'terrainAffinity',
      'Hills, woods',
    );

    expect(selection.units[0]?.cards).toEqual([
      { code: 'rangedAttack', variants: { effect: 'magical' } },
      { code: 'terrainAffinity', note: 'Hills, woods' },
    ]);
    expect(
      withoutUnitCard(selection, 'rangers', 'rangedAttack').units[0]?.cards,
    ).toEqual([{ code: 'terrainAffinity', note: 'Hills, woods' }]);
  });

  it('asks for a note on Terrain Affinity alone', () => {
    expect(takesNote('terrainAffinity')).toBe(true);
    expect(takesNote('fierce')).toBe(false);
  });

  it('marks stands for Delayed Entry and transports, within the unit', () => {
    let selection = withUnitMark(base, 'rangers', 'delayedEntry', 2);
    selection = withUnitMark(selection, 'rangers', 'transports', 7);

    expect(selection.units[0]?.marks).toMatchObject({
      delayedEntry: 2,
      transports: 3,
    });
    expect(
      withUnitMark(selection, 'rangers', 'delayedEntry', -1).units[0]?.marks
        .delayedEntry,
    ).toBe(0);
  });

  it('buys event cards for the class, and drops one counted down to none', () => {
    let selection = withUnitEventCard(base, 'rangers', 'holdTheLine', 2);
    selection = withUnitEventCard(selection, 'rangers', 'chargeThrough', 1);

    expect(selection.units[0]?.marks.eventCards).toEqual({
      holdTheLine: 2,
      chargeThrough: 1,
    });
    expect(
      withUnitEventCard(selection, 'rangers', 'holdTheLine', 0).units[0]?.marks
        .eventCards,
    ).toEqual({ chargeThrough: 1 });
  });
});

describe('the cards offered to a unit', () => {
  const offered = (unit: ReturnType<typeof fantasyUnit>) =>
    codes(unitCardOffers(catalogue, unit, fantasySelection().format));

  it('offers stand cards the troop type may take, priced for it', () => {
    const offers = unitCardOffers(
      catalogue,
      fantasyUnit('wargs', 'JCV'),
      fantasySelection().format,
    );

    expect(codes(offers)).toContain('flying');
    expect(codes(offers)).toContain('deadly');
    expect(codes(offers)).not.toContain('champion');
    expect(codes(offers)).not.toContain('ambush');
    expect(codes(offers)).not.toContain('holdTheLine');
    expect(offers.find(({ card }) => card.code === 'deadly')?.points).toBe(2);
    expect(offers.find(({ card }) => card.code === 'flying')?.points).toBe(
      null,
    );
  });

  it('leaves out a card the troop type may not take', () => {
    expect(offered(fantasyUnit('guard', 'EFT'))).not.toContain('flying');
    expect(offered(fantasyUnit('wagons', 'WWG'))).not.toContain('fierce');
    expect(offered(fantasyUnit('wagons', 'WWG'))).toContain('flying');
  });

  it('leaves out a card the unit already has, or one its cards exclude', () => {
    const fierce = fantasyUnit('wargs', 'JCV', { cards: cards('fierce') });

    expect(offered(fierce)).not.toContain('fierce');
    expect(offered(fierce)).not.toContain('craven');
  });

  it('prices a card by the home topography', () => {
    const affinity = (topography: 'Forest' | 'Dense Forest') =>
      unitCardOffers(
        catalogue,
        fantasyUnit('rangers', 'LFT'),
        withFormat(fantasySelection(), { topography }).format,
      ).find(({ card }) => card.code === 'terrainAffinity')?.points;

    expect(affinity('Forest')).toBe(0.5);
    expect(affinity('Dense Forest')).toBe(1);
  });

  it('offers event cards the unit may carry', () => {
    const offers = (troopType: 'SPR' | 'KNT') =>
      codes(
        unitEventCardOffers(
          catalogue,
          fantasyUnit('a', troopType),
          fantasySelection().format,
        ),
      );

    expect(offers('SPR')).toEqual(['chargeThrough', 'holdTheLine']);
    expect(offers('KNT')).toEqual(['chargeThrough']);
  });

  it('says which units may be delayed or carried', () => {
    expect(unitMayBeDelayed(catalogue, fantasyUnit('a', 'KNT'))).toBe(true);
    expect(unitMayRide(catalogue, fantasyUnit('a', 'SPR'))).toBe(true);
    expect(unitMayRide(catalogue, fantasyUnit('a', 'KNT'))).toBe(false);
    expect(unitMayRide(catalogue, fantasyUnit('a', 'WWG'))).toBe(false);
  });
});

describe('heroes', () => {
  it('adds heroes up to the pack’s cap, and removes them', () => {
    let selection = fantasySelection();
    for (const id of ['a', 'b', 'c']) {
      expect(canAddHero(selection, catalogue.format)).toBe(true);
      selection = withHeroAdded(selection, id);
    }

    expect(selection.heroes).toEqual([
      fantasyHero('a'),
      fantasyHero('b'),
      fantasyHero('c'),
    ]);
    expect(canAddHero(selection, catalogue.format)).toBe(false);
    expect(withoutHero(selection, 'b').heroes.map(({ id }) => id)).toEqual([
      'a',
      'c',
    ]);
  });

  it('names, tags, delays and equips a hero', () => {
    let selection = withHeroAdded(fantasySelection(), 'shaman');
    selection = withHeroName(selection, 'shaman', 'Shaman');
    selection = withHeroTags(selection, 'shaman', ['goblin']);
    selection = withHeroDelayedEntry(selection, 'shaman', true);
    selection = withHeroCard(selection, 'shaman', 'negateMagic');
    selection = withHeroCard(selection, 'shaman', 'negateMagic');
    selection = withHeroCardVariant(
      selection,
      'shaman',
      'negateMagic',
      'reach',
      'zone',
    );
    selection = withHeroCard(selection, 'shaman', 'champion');
    selection = withoutHeroCard(selection, 'shaman', 'champion');

    expect(selection.heroes[0]).toEqual({
      id: 'shaman',
      name: 'Shaman',
      tags: ['goblin'],
      cards: [{ code: 'negateMagic', variants: { reach: 'zone' } }],
      delayedEntry: true,
    });
  });

  it('offers hero cards a hero may take, never a stand card', () => {
    const offered = codes(
      heroCardOffers(catalogue, fantasyHero('a'), fantasySelection().format),
    );

    expect(offered).toContain('champion');
    expect(offered).toContain('deadly');
    expect(offered).not.toContain('fierce');
    expect(offered).not.toContain('marksman');
  });

  it('offers Marksman to a hero once it can shoot', () => {
    const offered = codes(
      heroCardOffers(
        catalogue,
        fantasyHero('a', { cards: cards('rangedAttack') }),
        fantasySelection().format,
      ),
    );

    expect(offered).toContain('marksman');
    expect(offered).not.toContain('rangedAttack');
  });

  it('withholds a card that would lower a hero’s cost', () => {
    const lowering = {
      ...catalogue,
      cards: new Map([
        ...catalogue.cards,
        ['away', { ...card('away'), cost: { kind: 'flat', points: -1 } }],
      ]),
    } as FantasyCatalogue;

    expect(
      codes(
        heroCardOffers(lowering, fantasyHero('a'), fantasySelection().format),
      ),
    ).not.toContain('away');
  });
});

describe('army cards', () => {
  it('offers the army cards not yet bought, never Delayed Entry', () => {
    const selection = withArmyCard(fantasySelection(), 'noCamp');
    const offered = codes(armyCardOffers(catalogue, selection));

    expect(offered).toContain('ambush');
    expect(offered).toContain('mobileInfantry');
    expect(offered).not.toContain('noCamp');
    expect(offered).not.toContain('delayedEntry');
    expect(offered).not.toContain('fierce');
  });

  it('buys a card once, with a count and a variant, and sells it back', () => {
    let selection = withArmyCard(fantasySelection(), 'illusion');
    selection = withArmyCard(selection, 'illusion');
    selection = withArmyCardCount(selection, 'illusion', 3);
    selection = withArmyCard(selection, 'ambush');
    selection = withArmyCardVariant(selection, 'ambush', 'reach', 'anywhere');

    expect(selection.armyCards).toEqual([
      { code: 'illusion', count: 3 },
      { code: 'ambush', variants: { reach: 'anywhere' } },
    ]);
    expect(withArmyCardCount(selection, 'illusion', 0).armyCards[0]).toEqual({
      code: 'illusion',
      count: 1,
    });
    expect(withoutArmyCard(selection, 'illusion').armyCards).toEqual([
      { code: 'ambush', variants: { reach: 'anywhere' } },
    ]);
  });

  it('counts a card up to the most its cost allows', () => {
    expect(cardCountMax(card('illusion'))).toBe(6);
    expect(cardCountMax(card('noCamp'))).toBe(1);
  });
});
