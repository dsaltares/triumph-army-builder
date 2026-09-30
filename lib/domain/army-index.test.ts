import { describe, expect, it } from 'vitest';
import {
  type ArmyFilters,
  activeArmyFilterCount,
  armyCountsByCategory,
  filterArmies,
  noArmyFilters,
  toggledValues,
  yearSpansByCategory,
} from '@/lib/domain/army-index.ts';
import { armyIndexEntry } from '@/test/fixtures/army.ts';

const sumerian = armyIndexEntry({
  id: 'sumerian',
  name: 'Goblin Warrens',
  keywords: [],
  startDate: -3000,
  endDate: -2800,
  invasion: [2],
  maneuver: [2],
  topographies: ['Delta'],
  categories: ['cradle'],
});

const gallic = armyIndexEntry({
  id: 'gallic',
  name: 'Sylvan Courts',
  keywords: ['Elf'],
  startDate: -99,
  endDate: -50,
  invasion: [0],
  maneuver: [3],
  topographies: ['Arable'],
  categories: ['rise-of-rome'],
});

const lombard = armyIndexEntry({
  id: 'lombard',
  name: 'Älvhem Early Elves',
  keywords: ['Germanic', 'Migration'],
  startDate: 489,
  endDate: 546,
  invasion: [3, 4],
  maneuver: [2],
  topographies: ['Arable', 'Hilly'],
  categories: ['birth-of-the-west', 'migrations'],
});

const armies = [sumerian, gallic, lombard];

const filters = (overrides: Partial<ArmyFilters> = {}): ArmyFilters => ({
  ...noArmyFilters,
  ...overrides,
});

const idsMatching = (overrides: Partial<ArmyFilters> = {}) =>
  filterArmies(armies, filters(overrides)).map(({ id }) => id);

describe('filterArmies', () => {
  it('keeps every army when nothing is filtered', () => {
    expect(idsMatching()).toEqual(['sumerian', 'gallic', 'lombard']);
  });

  it('matches a name regardless of case', () => {
    expect(idsMatching({ search: 'gObLiN' })).toEqual(['sumerian']);
  });

  it('matches a keyword', () => {
    expect(idsMatching({ search: 'elf' })).toEqual(['gallic']);
  });

  it('matches a name typed without its diacritics', () => {
    expect(idsMatching({ search: 'alvhem' })).toEqual(['lombard']);
  });

  it('requires every search term to match, in any order', () => {
    expect(idsMatching({ search: 'elves early' })).toEqual(['lombard']);
    expect(idsMatching({ search: 'elves sylvan' })).toEqual([]);
  });

  it('ignores surrounding and repeated whitespace in the search', () => {
    expect(idsMatching({ search: '  early   elves  ' })).toEqual(['lombard']);
  });

  it('keeps the armies whose span overlaps the years asked for', () => {
    expect(idsMatching({ from: -120, to: -60 })).toEqual(['gallic']);
  });

  it('treats an open-ended year bound as unbounded on that side', () => {
    expect(idsMatching({ from: 0 })).toEqual(['lombard']);
    expect(idsMatching({ to: -1000 })).toEqual(['sumerian']);
  });

  it('includes an army whose span only touches the bound', () => {
    expect(idsMatching({ from: -2800, to: -2800 })).toEqual(['sumerian']);
  });

  it('keeps the armies in any of the thematic categories asked for', () => {
    expect(idsMatching({ categories: ['cradle', 'migrations'] })).toEqual([
      'sumerian',
      'lombard',
    ]);
  });

  it('keeps the armies with any of the home topographies asked for', () => {
    expect(idsMatching({ topographies: ['Arable'] })).toEqual([
      'gallic',
      'lombard',
    ]);
  });

  it('keeps an army when any of its ratings is asked for', () => {
    expect(idsMatching({ invasion: [4] })).toEqual(['lombard']);
    expect(idsMatching({ maneuver: [2, 3] })).toEqual([
      'sumerian',
      'gallic',
      'lombard',
    ]);
  });

  it('narrows across facets rather than widening', () => {
    expect(idsMatching({ topographies: ['Arable'], maneuver: [3] })).toEqual([
      'gallic',
    ]);
  });

  it('matches nothing when the facets disagree', () => {
    expect(
      idsMatching({ search: 'sumerian', topographies: ['Arable'] }),
    ).toEqual([]);
  });
});

describe('activeArmyFilterCount', () => {
  it('counts nothing when no facet is set', () => {
    expect(activeArmyFilterCount(filters({ search: 'sumerian' }))).toBe(0);
  });

  it('counts a year range once, however many bounds it carries', () => {
    expect(activeArmyFilterCount(filters({ from: -500 }))).toBe(1);
    expect(activeArmyFilterCount(filters({ from: -500, to: 0 }))).toBe(1);
  });

  it('counts every selected value of every other facet', () => {
    expect(
      activeArmyFilterCount(
        filters({
          to: 0,
          categories: ['cradle'],
          topographies: ['Arable', 'Hilly'],
          invasion: [2],
          maneuver: [3, 4],
        }),
      ),
    ).toBe(7);
  });
});

describe('toggledValues', () => {
  it('adds a value that is not selected', () => {
    expect(toggledValues(['Arable'], 'Hilly')).toEqual(['Arable', 'Hilly']);
  });

  it('removes a value that is selected', () => {
    expect(toggledValues(['Arable', 'Hilly'], 'Arable')).toEqual(['Hilly']);
  });
});

describe('armyCountsByCategory', () => {
  it('counts the armies filed under each category', () => {
    const counts = armyCountsByCategory(armies);

    expect(counts.get('cradle')).toBe(1);
    expect(counts.get('rise-of-rome')).toBe(1);
  });

  it('counts an army once per category it belongs to', () => {
    const counts = armyCountsByCategory([
      armyIndexEntry({ id: 'a1', categories: ['one', 'two'] }),
      armyIndexEntry({ id: 'a2', categories: ['two'] }),
    ]);

    expect([...counts]).toEqual([
      ['one', 1],
      ['two', 2],
    ]);
  });

  it('knows nothing about a category no army belongs to', () => {
    expect(armyCountsByCategory([]).get('cradle')).toBeUndefined();
  });
});

describe('yearSpansByCategory', () => {
  it('runs from the earliest army in a category to the latest', () => {
    const spans = yearSpansByCategory([
      armyIndexEntry({
        id: 'a1',
        categories: ['cradle'],
        startDate: -2500,
        endDate: -2000,
      }),
      armyIndexEntry({
        id: 'a2',
        categories: ['cradle'],
        startDate: -3000,
        endDate: -2800,
      }),
      armyIndexEntry({
        id: 'a3',
        categories: ['cradle'],
        startDate: -1800,
        endDate: -1500,
      }),
    ]);

    expect(spans.get('cradle')).toEqual({ startDate: -3000, endDate: -1500 });
  });

  it("is the one army's own span when a category holds only it", () => {
    expect(yearSpansByCategory(armies).get('rise-of-rome')).toEqual({
      startDate: -99,
      endDate: -50,
    });
  });

  it('stretches every category an army belongs to', () => {
    const spans = yearSpansByCategory([
      armyIndexEntry({
        id: 'a1',
        categories: ['one', 'two'],
        startDate: 400,
        endDate: 600,
      }),
      armyIndexEntry({
        id: 'a2',
        categories: ['two'],
        startDate: -100,
        endDate: 200,
      }),
    ]);

    expect([...spans]).toEqual([
      ['one', { startDate: 400, endDate: 600 }],
      ['two', { startDate: -100, endDate: 600 }],
    ]);
  });

  it('knows nothing about a category no army belongs to', () => {
    expect(yearSpansByCategory([]).get('cradle')).toBeUndefined();
  });
});
