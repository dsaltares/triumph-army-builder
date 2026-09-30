import { describe, expect, it } from 'vitest';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army.ts';
import { sampleBattleCardCosts, sampleTroopTypes } from '@/test/sample.ts';
import { troopTypeCosts, troopTypeNames } from '../troop-types.ts';
import { buildArmyList } from './army-list';
import type { SavedArmy } from './saved-army';
import {
  type SavedArmyEntry,
  savedArmyStanding,
  searchSavedArmies,
} from './saved-army-index';
import { withStands } from './selection';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);

const list = buildArmyList(armyDetail());

const saved = (overrides: Partial<SavedArmy> = {}): SavedArmy => ({
  id: 'army-1',
  name: 'Cannae',
  armyListId: list.id,
  dataVersion: '2026-09-17.abcdef01',
  selection: fixtureSelection(),
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-18T10:00:00.000Z',
  ...overrides,
});

const entry = (
  army: Partial<SavedArmy>,
  listName: string | null = 'Fixture Army',
): SavedArmyEntry => ({
  army: saved(army),
  listName,
  standing: null,
});

const found = (entries: readonly SavedArmyEntry[]) =>
  entries.map(({ army }) => army.name);

describe('savedArmyStanding', () => {
  it('prices a saved selection and says whether it is legal', () => {
    const standing = savedArmyStanding(list, fixtureSelection(), costs, names);

    expect(standing.meter.total).toBeGreaterThan(0);
    expect(standing.meter.cap).toBe(48);
    expect(standing.legal).toBe(false);
    expect(standing.errors).toBeGreaterThan(0);
  });

  it('counts the stands the selection actually holds', () => {
    const spearmen = list.main.troopOptions[0];
    if (!spearmen) {
      throw new Error('the fixture army no longer has a first troop option');
    }
    const four = savedArmyStanding(list, fixtureSelection(), costs, names);
    const six = savedArmyStanding(
      list,
      withStands(fixtureSelection(), spearmen, 'SPR', 6),
      costs,
      names,
    );

    expect(six.meter.total).toBeGreaterThan(four.meter.total);
  });
});

describe('searchSavedArmies', () => {
  const entries = [
    entry({ id: 'a', name: 'Cannae' }),
    entry({ id: 'b', name: 'Zama' }),
    entry({ id: 'c', name: 'Ilipa' }, 'Tidewrack Corsairs'),
  ];

  it('keeps every list when nothing is searched for', () => {
    expect(found(searchSavedArmies(entries, '   '))).toEqual([
      'Cannae',
      'Zama',
      'Ilipa',
    ]);
  });

  it('searches the name the player gave the list', () => {
    expect(found(searchSavedArmies(entries, 'zam'))).toEqual(['Zama']);
  });

  it('searches the army list it was built from', () => {
    expect(found(searchSavedArmies(entries, 'corsairs'))).toEqual(['Ilipa']);
  });

  it('takes every term, in any order, ignoring case and accents', () => {
    expect(found(searchSavedArmies(entries, 'CORSAIRS ilipa'))).toEqual([
      'Ilipa',
    ]);
  });

  it('keeps the order it was given', () => {
    expect(found(searchSavedArmies(entries, 'a'))).toEqual([
      'Cannae',
      'Zama',
      'Ilipa',
    ]);
  });

  it('leaves out a list with no army list behind it when that is searched', () => {
    expect(
      found(searchSavedArmies([entry({ name: 'Zama' }, null)], 'army')),
    ).toEqual([]);
  });
});
