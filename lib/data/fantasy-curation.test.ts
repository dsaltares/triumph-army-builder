import { describe, expect, it } from 'vitest';
import {
  type FantasyCuration,
  fantasyCurationSchema,
} from '@/lib/data/curation-schema.ts';
import { fantasyCardCodes } from '@/lib/data/schema.ts';
import type { FantasyCardCost } from '@/lib/domain/fantasy/battle-cards.ts';
import { sampleCuration } from '@/test/sample.ts';

const sampleFantasy = (): FantasyCuration => {
  const { fantasy } = sampleCuration.games;
  if (!fantasy) {
    throw new Error('the sample curation has no Fantasy Triumph section');
  }
  return fantasy;
};

const { cards, text, troopTypeNames, format } = sampleFantasy();

const costKinds = (cost: FantasyCardCost): string[] => {
  switch (cost.kind) {
    case 'byVariant':
      return [cost.kind, ...Object.values(cost.options).flatMap(costKinds)];
    case 'perCount':
      return [cost.kind, ...costKinds(cost.each)];
    case 'byBearer':
      return [cost.kind, ...costKinds(cost.stand), ...costKinds(cost.hero)];
    default:
      return [cost.kind];
  }
};

const unique = (values: readonly string[]) => [...new Set(values)].sort();

const parsedWith = (change: (curation: FantasyCuration) => unknown) =>
  fantasyCurationSchema.safeParse(
    change(JSON.parse(JSON.stringify(sampleFantasy()))),
  );

describe('the sample Fantasy Triumph curation', () => {
  it('curates and describes every card', () => {
    expect(Object.keys(cards).sort()).toEqual([...fantasyCardCodes].sort());
    expect(Object.keys(text).sort()).toEqual([...fantasyCardCodes].sort());
  });

  it('prices with every kind of cost rule', () => {
    expect(
      unique(Object.values(cards).flatMap(({ cost }) => costKinds(cost))),
    ).toEqual([
      'byBearer',
      'byTopography',
      'byTroopType',
      'byVariant',
      'flat',
      'perCount',
      'perMarkedCappedAtValue',
    ]);
  });

  it('constrains with every kind of constraint', () => {
    expect(
      unique(
        Object.values(cards).flatMap(({ constraints }) =>
          constraints.map(({ kind }) => kind),
        ),
      ),
    ).toEqual([
      'eligible',
      'excludedWith',
      'ineligible',
      'maxPerArmy',
      'notOnGeneral',
      'notOnHeroes',
      'oncePerArmy',
      'oneClassPerArmy',
      'requires',
    ]);
  });

  it('reads a flat price', () => {
    expect(cards.deadly.cost).toEqual({ kind: 'flat', points: 2 });
    expect(cards.slow.cost).toEqual({ kind: 'flat', points: -0.5 });
  });

  it('reads a price by troop type, with the first matching override winning', () => {
    expect(cards.brittle.cost).toEqual({
      kind: 'byTroopType',
      points: -2,
      overrides: [
        { when: { troopTypes: ['ART'] }, points: 0 },
        { when: { troopTypes: ['BLV', 'ARC'] }, points: -1 },
        { when: { cards: ['mindblast', 'spellblast'] }, points: -1 },
      ],
    });
  });

  it('reads a price by the density of the home topography', () => {
    expect(cards.terrainAffinity.cost).toEqual({
      kind: 'byTopography',
      points: 0.5,
      dense: 1,
    });
  });

  it('reads a price by the variant chosen at purchase', () => {
    expect(cards.flying.variants).toEqual({
      flight: { hover: 'Hover Flying', zoom: 'Zoom Flying' },
    });
    expect(cards.flying.cost).toEqual({
      kind: 'byVariant',
      choice: 'flight',
      options: {
        hover: { kind: 'flat', points: 1 },
        zoom: { kind: 'flat', points: 2 },
      },
    });
  });

  it('reads a variant that changes play and not the price', () => {
    expect(cards.spellblast.variants).toEqual({
      reach: {
        limited: 'Limited Spellblast',
        unlimited: 'Unlimited Spellblast',
      },
      effect: { physical: 'Physical', magical: 'Magical' },
    });
    expect(cards.rangedAttack.cost).toEqual({ kind: 'flat', points: 1 });
  });

  it('reads a price per card bought, up to a cap', () => {
    expect(cards.illusion.cost).toEqual({
      kind: 'perCount',
      max: 6,
      each: { kind: 'flat', points: 1 },
    });
  });

  it('reads a price per marked stand, capped at what the stand is worth', () => {
    expect(cards.delayedEntry.cost).toEqual({
      kind: 'perMarkedCappedAtValue',
      points: -2,
    });
  });

  it('reads one price for a stand and another for a hero', () => {
    expect(cards.away.cost).toEqual({
      kind: 'byBearer',
      stand: { kind: 'flat', points: 0.5 },
      hero: { kind: 'flat', points: 1 },
    });
  });

  it('composes kinds where one card needs two', () => {
    expect(cards.ambush.cost).toEqual({
      kind: 'byVariant',
      choice: 'reach',
      options: {
        home: { kind: 'byTopography', points: 1, dense: 2 },
        anywhere: { kind: 'flat', points: 2 },
      },
    });
    expect(cards.preparedDefenses.cost).toEqual({
      kind: 'perCount',
      max: 6,
      each: { kind: 'byTopography', points: 0.5, dense: 1 },
    });
    expect(cards.mobileInfantry.cost).toEqual({
      kind: 'perCount',
      max: 8,
      each: {
        kind: 'byVariant',
        choice: 'transport',
        options: {
          ground: { kind: 'flat', points: 0.5 },
          flying: { kind: 'flat', points: 1 },
        },
      },
    });
  });

  it('reads troop types a card is open to, by code, order, category or movement', () => {
    expect(cards.flying.constraints).toContainEqual({
      kind: 'eligible',
      anyOf: [{ order: 'Open' }, { troopTypes: ['WWG', 'ART'] }],
    });
    expect(cards.supportingShooters.constraints).toContainEqual({
      kind: 'eligible',
      anyOf: [
        { order: 'Close', category: 'foot' },
        { troopTypes: ['LFT', 'RDR', 'LSP'] },
      ],
    });
    expect(cards.fast.constraints).toContainEqual({
      kind: 'ineligible',
      anyOf: [{ minMovement: 8 }],
    });
  });

  it('reads troop types a card is closed to', () => {
    expect(cards.unruly.constraints).toEqual([
      { kind: 'ineligible', anyOf: [{ troopTypes: ['WWG', 'ART', 'ELE'] }] },
    ]);
  });

  it('reads the cards another card cannot be bought with', () => {
    expect(cards.craven.constraints).toContainEqual({
      kind: 'excludedWith',
      cards: ['fierce'],
    });
  });

  it('reads a card a hero must already hold', () => {
    expect(cards.marksman.constraints).toContainEqual({
      kind: 'requires',
      cards: ['rangedAttack'],
      bearer: 'hero',
    });
  });

  it('reads a cap per army on stands and heroes apart', () => {
    expect(cards.delayedEntry.constraints).toContainEqual({
      kind: 'maxPerArmy',
      stands: 4,
      heroes: 1,
    });
    expect(cards.unreliable.constraints).toContainEqual({
      kind: 'maxPerArmy',
      stands: 4,
    });
  });

  it('reads the cards bought once, kept off the general, kept off heroes or held by one class', () => {
    expect(cards.subcommander.constraints).toEqual([{ kind: 'oncePerArmy' }]);
    expect(cards.illusion.constraints).toEqual([
      { kind: 'notOnHeroes' },
      { kind: 'notOnGeneral' },
    ]);
    expect(cards.chargeThrough.constraints).toEqual([
      { kind: 'oneClassPerArmy' },
    ]);
  });

  it('renames Archers and Elephants and no other troop type', () => {
    expect(troopTypeNames).toEqual({ ARC: 'Shooters', ELE: 'Behemoths' });
  });

  it('reads the format the validator measures a list against', () => {
    expect(format).toMatchObject({
      points: 51,
      pointsPerRequiredStand: 6,
      minimumStandCost: 1,
      heroes: {
        max: 3,
        maxPoints: 8,
        cost: 1,
        mayTakeNegativeCostCards: false,
      },
      invasion: { base: 2, costs: { 0: 1, 4: -1 } },
      maneuver: { base: 2, costs: { 0: -3, 4: 3 } },
      victory: { numerator: 1, denominator: 3 },
    });
  });
});

describe('fantasyCurationSchema', () => {
  it('accepts the sample curation', () => {
    expect(parsedWith((curation) => curation).success).toBe(true);
  });

  it('refuses a cost rule it does not know', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.deadly, {
          cost: { kind: 'perMoon', points: 1 },
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a price that is not a whole or half point', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.deadly, {
          cost: { kind: 'flat', points: 0.25 },
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a cost that prices a variant the card does not offer', () => {
    const result = parsedWith((curation) => {
      const { variants: _variants, ...flying } = curation.cards.flying;
      return { ...curation, cards: { ...curation.cards, flying } };
    });

    expect(result.error?.issues[0]?.message).toBe(
      'prices by the variant flight, which the card does not offer',
    );
  });

  it('refuses a variant with a single option', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.rangedAttack, {
          variants: { effect: { physical: 'Physical' } },
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a constraint it does not know', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.deadly, {
          constraints: [{ kind: 'onlyOnTuesdays' }],
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a selector that names nothing', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.deadly, {
          constraints: [{ kind: 'eligible', anyOf: [{}] }],
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a cap per army that caps nothing', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.deadly, {
          constraints: [{ kind: 'maxPerArmy' }],
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a card code it does not know inside a constraint', () => {
    expect(
      parsedWith((curation) => {
        Object.assign(curation.cards.deadly, {
          constraints: [{ kind: 'excludedWith', cards: ['dragonfire'] }],
        });
        return curation;
      }).success,
    ).toBe(false);
  });

  it('refuses a name for a troop type it does not know', () => {
    expect(
      parsedWith((curation) => ({
        ...curation,
        troopTypeNames: { ...curation.troopTypeNames, DRG: 'Dragons' },
      })).success,
    ).toBe(false);
  });

  it('refuses a dense topography the game does not know', () => {
    expect(
      parsedWith((curation) => ({
        ...curation,
        format: { ...curation.format, denseTopographies: ['Dense Clouds'] },
      })).success,
    ).toBe(false);
  });
});
