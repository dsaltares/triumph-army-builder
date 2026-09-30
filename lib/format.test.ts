import { describe, expect, it } from 'vitest';
import {
  alternativeParts,
  formatAllowance,
  formatArmyListCount,
  formatCount,
  formatCountry,
  formatDate,
  formatPoints,
  formatPointsWithUnit,
  formatRange,
  formatStandCount,
  formatTimeAgo,
  formatYear,
  formatYearSpan,
  formatYearSpans,
  joinWithOr,
} from './format.ts';

describe('formatYear', () => {
  it('names the era a year belongs to', () => {
    expect(formatYear(-448, 'en')).toBe('448 BC');
    expect(formatYear(1415, 'en')).toBe('1415 AD');
  });
});

describe('formatYearSpan', () => {
  it('names the era once when both ends share it', () => {
    expect(formatYearSpan({ startDate: -448, endDate: -225 }, 'en')).toBe(
      '448–225 BC',
    );
    expect(formatYearSpan({ startDate: 1337, endDate: 1453 }, 'en')).toBe(
      '1337–1453 AD',
    );
  });

  it('names both eras when the span crosses them', () => {
    expect(formatYearSpan({ startDate: -50, endDate: 20 }, 'en')).toBe(
      '50 BC – 20 AD',
    );
  });

  it('gives a single year for a span that does not move', () => {
    expect(formatYearSpan({ startDate: -331, endDate: -331 }, 'en')).toBe(
      '331 BC',
    );
  });
});

describe('formatYearSpans', () => {
  it('lists every span an option is available in', () => {
    expect(
      formatYearSpans(
        [
          { startDate: -3000, endDate: -2900 },
          { startDate: -2850, endDate: -2800 },
        ],
        'en',
      ),
    ).toBe('3000–2900 BC, 2850–2800 BC');
  });
});

describe('formatPoints', () => {
  it('prints a whole number of points as itself', () => {
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(48)).toBe('48');
    expect(formatPoints(-3)).toBe('-3');
  });

  it('prints the half points the battle cards price in', () => {
    expect(formatPoints(3.5)).toBe('3½');
    expect(formatPoints(0.5)).toBe('½');
    expect(formatPoints(-0.5)).toBe('-½');
    expect(formatPoints(-2.5)).toBe('-2½');
  });
});

describe('formatStandCount', () => {
  it('puts the count of stands before the troop type', () => {
    expect(formatStandCount(4, 'Elite Foot')).toBe('4 × Elite Foot');
  });
});

describe('formatRange', () => {
  it('collapses a range whose ends meet', () => {
    expect(formatRange(2, 2)).toBe('2');
    expect(formatRange(0, 4)).toBe('0–4');
  });
});

describe('formatPointsWithUnit', () => {
  it('names the unit, singular for one point and for a half', () => {
    expect(formatPointsWithUnit(1, 'en')).toBe('1 point');
    expect(formatPointsWithUnit(0.5, 'en')).toBe('½ point');
    expect(formatPointsWithUnit(-0.5, 'en')).toBe('-½ point');
    expect(formatPointsWithUnit(-1, 'en')).toBe('-1 point');
  });

  it('names the unit plural for none and for more than one', () => {
    expect(formatPointsWithUnit(0, 'en')).toBe('0 points');
    expect(formatPointsWithUnit(2, 'en')).toBe('2 points');
    expect(formatPointsWithUnit(3.5, 'en')).toBe('3½ points');
  });
});

describe('formatAllowance', () => {
  it('says nothing when neither bound is stated', () => {
    expect(formatAllowance(null, null, 'en')).toBeNull();
  });

  it('reads as a range when both bounds are stated', () => {
    expect(formatAllowance(0, 2, 'en')).toBe('0–2');
    expect(formatAllowance(2, 2, 'en')).toBe('2');
  });

  it('names the bound it has when only one is stated', () => {
    expect(formatAllowance(null, 3, 'en')).toBe('up to 3');
    expect(formatAllowance(1, null, 'en')).toBe('from 1');
  });
});

describe('alternativeParts', () => {
  it('places each item between the separators the locale puts around it', () => {
    expect(alternativeParts(3, 'en')).toEqual([
      { kind: 'item', index: 0 },
      { kind: 'separator', text: ', ' },
      { kind: 'item', index: 1 },
      { kind: 'separator', text: ' or ' },
      { kind: 'item', index: 2 },
    ]);
    expect(alternativeParts(2, 'es')).toEqual([
      { kind: 'item', index: 0 },
      { kind: 'separator', text: ' o ' },
      { kind: 'item', index: 1 },
    ]);
  });
});

describe('joinWithOr', () => {
  it('offers the alternatives in a troop entry', () => {
    expect(joinWithOr(['Archers'], 'en')).toBe('Archers');
    expect(joinWithOr(['Archers', 'Bow Levy'], 'en')).toBe(
      'Archers or Bow Levy',
    );
    expect(joinWithOr(['Archers', 'Bow Levy', 'Pikes'], 'en')).toBe(
      'Archers, Bow Levy or Pikes',
    );
  });
});

describe('formatArmyListCount', () => {
  it('counts the army lists in a thematic category', () => {
    expect(formatArmyListCount(0, 'en')).toBe('0 army lists');
    expect(formatArmyListCount(1, 'en')).toBe('1 army list');
    expect(formatArmyListCount(54, 'en')).toBe('54 army lists');
  });
});

describe('the locale a formatter is given', () => {
  const shared = '2026-09-20T00:00:00.000Z';

  it('keeps English dates in the one format the app writes them', () => {
    expect(formatDate(shared, 'en')).toBe('20 September 2026');
  });

  it('writes a Spanish date the Spanish way', () => {
    expect(formatDate(shared, 'es')).toBe('20 de septiembre de 2026');
  });

  it('joins alternatives with the language of the reader', () => {
    expect(joinWithOr(['Arqueros', 'Lanceros'], 'es')).toBe(
      'Arqueros o Lanceros',
    );
  });

  it('counts back in the language of the reader', () => {
    const now = Date.parse('2026-09-23T00:00:00.000Z');
    expect(formatTimeAgo(shared, 'en', now)).toBe('3 days ago');
    expect(formatTimeAgo(shared, 'es', now)).toBe('hace 3 días');
  });
});

describe('the words a formatter reaches for', () => {
  it('names the era in the language of the reader', () => {
    expect(formatYear(-3000, 'en')).toBe('3000 BC');
    expect(formatYear(-3000, 'es')).toBe('3000 a.C.');
    expect(formatYear(1415, 'es')).toBe('1415 d.C.');
  });

  it('counts points with the plural rule of the language', () => {
    expect(formatPointsWithUnit(1, 'es')).toBe('1 punto');
    expect(formatPointsWithUnit(3, 'es')).toBe('3 puntos');
  });

  it('counts army lists in Spanish', () => {
    expect(formatArmyListCount(1, 'es')).toBe('1 lista de ejército');
    expect(formatArmyListCount(21, 'es')).toBe('21 listas de ejército');
  });

  it('names an open-ended allowance in Spanish', () => {
    expect(formatAllowance(2, null, 'es')).toBe('desde 2');
    expect(formatAllowance(null, 3, 'es')).toBe('hasta 3');
  });
});

describe('formatCount', () => {
  it('groups thousands the way the language does', () => {
    expect(formatCount(12345, 'en')).toBe('12,345');
    expect(formatCount(12345, 'es')).toBe('12.345');
  });
});

describe('formatCountry', () => {
  it('names a country in the language', () => {
    expect(formatCountry('TN', 'en')).toBe('Tunisia');
    expect(formatCountry('IT', 'es')).toBe('Italia');
  });

  it('falls back to the code it cannot name', () => {
    expect(formatCountry('XX', 'en')).toBe('XX');
    expect(formatCountry('not a code', 'en')).toBe('not a code');
  });
});
