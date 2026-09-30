import { describe, expect, it } from 'vitest';
import { adjustStandCost, costRulePoints } from './cost-rules';

describe('adjustStandCost', () => {
  it('subtracts a reduction from the base cost', () => {
    expect(adjustStandCost({ kind: 'reduceBy', points: 1 }, 4)).toBe(3);
  });

  it('never reduces a stand below zero', () => {
    expect(adjustStandCost({ kind: 'reduceBy', points: 3 }, 2)).toBe(0);
  });

  it('replaces the base cost outright', () => {
    expect(adjustStandCost({ kind: 'setTo', points: 3.5 }, 4)).toBe(3.5);
  });
});

describe('costRulePoints', () => {
  it('charges nothing for a free card', () => {
    expect(costRulePoints({ kind: 'free' }, { copies: 3, stands: 5 })).toBe(0);
  });

  it('charges a flat price per copy and ignores stands', () => {
    const rule = { kind: 'flat', points: 2 } as const;
    expect(costRulePoints(rule, { stands: 5 })).toBe(2);
    expect(costRulePoints(rule, { copies: 3, stands: 5 })).toBe(6);
  });

  it('defaults to a single copy and no stands', () => {
    expect(costRulePoints({ kind: 'flat', points: 3 })).toBe(3);
    expect(costRulePoints({ kind: 'perStand', pointsPerStand: 1 })).toBe(0);
  });

  it('charges per stand', () => {
    expect(
      costRulePoints({ kind: 'perStand', pointsPerStand: 1 }, { stands: 5 }),
    ).toBe(5);
  });

  it('charges a fractional price per card', () => {
    expect(
      costRulePoints({ kind: 'perCard', pointsPerCard: 0.5 }, { copies: 3 }),
    ).toBe(1.5);
  });

  it('caps a per-card price', () => {
    const rule = {
      kind: 'perCardCapped',
      pointsPerCard: 1,
      maxPoints: 2,
    } as const;
    expect(costRulePoints(rule, { copies: 1 })).toBe(1);
    expect(costRulePoints(rule, { copies: 2 })).toBe(2);
    expect(costRulePoints(rule, { copies: 5 })).toBe(2);
  });

  it('charges every card after the first', () => {
    const rule = {
      kind: 'firstFreeThenFlat',
      countedIn: 'cards',
      pointsAfterFirst: 1,
      cumulative: true,
    } as const;
    expect(costRulePoints(rule, { copies: 1 })).toBe(0);
    expect(costRulePoints(rule, { copies: 3 })).toBe(2);
  });

  it('charges once for going beyond a single stand', () => {
    const rule = {
      kind: 'firstFreeThenFlat',
      countedIn: 'stands',
      pointsAfterFirst: 1,
      cumulative: false,
    } as const;
    expect(costRulePoints(rule, { stands: 1 })).toBe(0);
    expect(costRulePoints(rule, { stands: 2 })).toBe(1);
    expect(costRulePoints(rule, { stands: 5 })).toBe(1);
  });

  it('returns the net change a stand-cost modifier makes to the army total', () => {
    expect(
      costRulePoints(
        { kind: 'modifiesStandCost', effect: { kind: 'reduceBy', points: 1 } },
        { stands: 4, standCost: 4 },
      ),
    ).toBe(-4);
    expect(
      costRulePoints(
        { kind: 'modifiesStandCost', effect: { kind: 'setTo', points: 3.5 } },
        { stands: 4, standCost: 4 },
      ),
    ).toBe(-2);
  });

  it('charges per declaration', () => {
    expect(
      costRulePoints(
        { kind: 'conditional', pointsPerDeclaration: 1 },
        { declarations: 3 },
      ),
    ).toBe(3);
  });
});
