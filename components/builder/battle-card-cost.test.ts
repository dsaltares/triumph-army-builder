import { describe, expect, it } from 'vitest';
import {
  describeCost,
  purchaseHints,
} from '@/components/builder/battle-card-cost';
import { type BattleCardCode, battleCardCodes } from '@/lib/data/schema';
import { wordsFor } from '@/lib/i18n/translator';
import { sampleBattleCardCosts } from '@/test/sample.ts';

const costOf = (code: BattleCardCode) =>
  describeCost(sampleBattleCardCosts[code].rule, 'en');

describe('describeCost', () => {
  it.each(battleCardCodes)('says what %s costs', (code) => {
    expect(costOf(code)).not.toBe('');
  });

  it('names a flat price', () => {
    expect(costOf('FC')).toBe('1 point');
    expect(costOf('NC')).toBe('3 points');
  });

  it('names a price that is free', () => {
    expect(costOf('SW')).toBe('No points');
  });

  it('names a price per stand', () => {
    expect(costOf('SS')).toBe('1 point per stand');
  });

  it('names a price per card, and the cap on one', () => {
    expect(costOf('PD')).toBe('½ point each');
    expect(costOf('CT')).toBe('1 point each, at most 2');
  });

  it('names a price whose first purchase is free', () => {
    expect(costOf('HL')).toBe('Free for the first, then 1 point each');
    expect(costOf('MI')).toBe('Free on one stand, 1 point on more');
  });

  it('names a price that changes what a stand costs', () => {
    expect(costOf('AC')).toBe('1 point off every stand it is on');
    expect(costOf('SF')).toBe('Every stand it is on costs 3½');
  });

  it('names a price that depends on what is declared', () => {
    expect(costOf('DC')).toBe('1 point per removal or exchange');
  });
});

describe('purchaseHints', () => {
  const says = (code: BattleCardCode, locale: 'en' | 'es') =>
    wordsFor(
      locale,
      'builder',
    )(purchaseHints[sampleBattleCardCosts[code].purchasedPer]);

  it('says what one purchase of a card covers', () => {
    expect(says('DD', 'en')).toContain('covers the army');
    expect(says('HL', 'en')).toContain('each troop option');
  });

  it('says it in Spanish too', () => {
    expect(says('DD', 'es')).toContain('cubre al ejército');
    expect(says('HL', 'es')).toContain('cada opción de tropa');
  });
});
