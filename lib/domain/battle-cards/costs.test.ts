import { describe, expect, it } from 'vitest';
import { type BattleCardCode, battleCardCodes } from '@/lib/data/schema';
import {
  sampleBattleCardCosts,
  sampleBattleCards,
  sampleCuration,
  sampleSnapshotBattleCards,
} from '@/test/sample.ts';
import { battleCardPurchaseScopes } from './cost-rules';
import {
  appliedPerStand,
  appliedToPairsOfStands,
  battleCardCosts,
  battleCardPoints,
  battleCardStandCostEffect,
  boughtForTheWholeTroopEntry,
  wholeTroopEntryCardsPerArmy,
} from './costs';

const curated = sampleCuration.battleCardCosts;

const costs = sampleBattleCardCosts;

const mountedStandCost = 4;

const wholeTroopEntryRules = [
  'on every stand of a troop entry or on none of them',
  'covers every stand in its troop entry, never a single stand',
];

const pairsRule = 'in pairs of stands';

const snapshotByCode = new Map(
  sampleSnapshotBattleCards.map((card) => [card.permanentCode, card]),
);

const costsAtStands: Record<BattleCardCode, [number, number, number]> = {
  FC: [1, 1, 1],
  PD: [0.5, 0.5, 0.5],
  AM: [1, 1, 1],
  SW: [0, 0, 0],
  NC: [3, 3, 3],
  PT: [1, 1, 1],
  SC: [2, 2, 2],
  SB: [0, 0, 0],
  SP: [0, 0, 0],
  LC: [0, 0, 0],
  DD: [1, 1, 1],
  HL: [0, 0, 0],
  HD: [0, 0, 0],
  MI: [0, 1, 1],
  ES: [2, 2, 2],
  ET: [0, 0, 0],
  PL: [1, 2, 5],
  AC: [-1, -2, -5],
  CC: [-1, -2, -5],
  SS: [1, 2, 5],
  CT: [1, 1, 1],
  MD: [2, 2, 2],
  SV: [0, 0, 0],
  SF: [-0.5, -1, -2.5],
  CH: [0, 0, 0],
  CF: [1, 1, 1],
  DC: [1, 1, 1],
};

describe('the curated battle card costs', () => {
  it('covers every card in the sample snapshot exactly once', () => {
    expect(Object.keys(curated).sort()).toEqual(
      sampleSnapshotBattleCards.map((card) => card.permanentCode).sort(),
    );
  });

  it.each(battleCardCodes)(
    'matches the sample snapshot record for %s',
    (code) => {
      const card = snapshotByCode.get(code);
      expect(card).toBeDefined();
      expect(curated[code].name).toBe(card?.displayName);
      expect(curated[code].category).toBe(card?.category);
    },
  );

  it.each(battleCardCodes)('cites live mdText for %s', (code) => {
    const mdText = snapshotByCode.get(code)?.mdText ?? '';
    const { sources } = curated[code];
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(mdText).toContain(source);
    }
  });

  it.each(battleCardCodes)('says what one purchase of %s covers', (code) => {
    expect(battleCardPurchaseScopes).toContain(curated[code].purchasedPer);
  });

  it.each(battleCardCodes)(
    'takes the whole troop entry reading of %s from its own text',
    (code) => {
      expect(boughtForTheWholeTroopEntry(code)).toBe(
        curated[code].sources.some((source) =>
          wholeTroopEntryRules.some((rule) => source.includes(rule)),
        ),
      );
    },
  );

  it.each(battleCardCodes)(
    'takes the number of %s an army may buy from its own text',
    (code) => {
      const perArmy = wholeTroopEntryCardsPerArmy(code);
      if (perArmy === null) {
        return;
      }
      expect(boughtForTheWholeTroopEntry(code)).toBe(true);
      expect(snapshotByCode.get(code)?.mdText).toContain(
        `more than ${perArmy}`,
      );
    },
  );

  it.each(battleCardCodes)(
    'takes the pairs reading of %s from its own text',
    (code) => {
      expect(appliedToPairsOfStands(code)).toBe(
        curated[code].sources.some((source) => source.includes(pairsRule)),
      );
    },
  );

  it('counts a troop card in stands unless it covers the whole entry', () => {
    expect(appliedPerStand(costs, 'PL')).toBe(true);
    expect(appliedPerStand(costs, 'MI')).toBe(true);
    expect(appliedPerStand(costs, 'CF')).toBe(true);
    expect(appliedPerStand(costs, 'SS')).toBe(false);
    expect(appliedPerStand(costs, 'HL')).toBe(false);
    expect(appliedPerStand(costs, 'DD')).toBe(false);
    expect(appliedPerStand(costs, 'FC')).toBe(false);
  });

  it('buys an all-or-none card once and a card-counted one to its maximum', () => {
    expect(
      (['SS', 'AC', 'CC', 'SF', 'CH'] as const).map(
        wholeTroopEntryCardsPerArmy,
      ),
    ).toEqual([null, null, null, null, null]);
    expect(wholeTroopEntryCardsPerArmy('HL')).toBe(3);
    expect(wholeTroopEntryCardsPerArmy('CT')).toBe(2);
  });

  it.each(battleCardCodes)('costs %s at 1, 2 and 5 stands', (code) => {
    const context = { copies: 1, declarations: 1, standCost: mountedStandCost };
    expect(
      [1, 2, 5].map((stands) =>
        battleCardPoints(costs, code, { ...context, stands }),
      ),
    ).toEqual(costsAtStands[code]);
  });
});

describe('cards priced by the number of cards bought', () => {
  it('charges Prepared Defenses half a point per card', () => {
    expect(battleCardPoints(costs, 'PD', { copies: 3 })).toBe(1.5);
  });

  it('gives the first Hold the Line away and caps Charge Through at 2 points', () => {
    expect(
      [1, 2, 3].map((copies) => battleCardPoints(costs, 'HL', { copies })),
    ).toEqual([0, 1, 2]);
    expect(
      [1, 2, 3].map((copies) => battleCardPoints(costs, 'CT', { copies })),
    ).toEqual([1, 2, 2]);
  });

  it('charges Deceptive Deployment per declared deception', () => {
    expect(battleCardPoints(costs, 'DC', { declarations: 3 })).toBe(3);
  });
});

describe('cards that change what a stand costs', () => {
  it('exposes the effect of the three stand-cost modifiers', () => {
    expect(battleCardStandCostEffect(costs, 'AC')).toEqual({
      kind: 'reduceBy',
      points: 1,
    });
    expect(battleCardStandCostEffect(costs, 'CC')).toEqual({
      kind: 'reduceBy',
      points: 1,
    });
    expect(battleCardStandCostEffect(costs, 'SF')).toEqual({
      kind: 'setTo',
      points: 3.5,
    });
  });

  it('has no effect for a card that only prices itself', () => {
    expect(battleCardStandCostEffect(costs, 'FC')).toBeNull();
  });
});

describe('battleCardCosts', () => {
  it('names each card as the data does', () => {
    expect(costs.CC).toEqual({
      name: 'Charging Camelry',
      purchasedPer: 'troopOption',
      rule: {
        kind: 'modifiesStandCost',
        effect: { kind: 'reduceBy', points: 1 },
      },
    });
  });

  it('refuses to price an army when a card has no cost', () => {
    expect(() =>
      battleCardCosts(
        sampleBattleCards.filter(({ permanentCode }) => permanentCode !== 'SF'),
      ),
    ).toThrow('no cost for battle cards SF');
  });
});
