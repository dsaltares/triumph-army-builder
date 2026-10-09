import { describe, expect, it } from 'vitest';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army.ts';
import { sampleBattleCards, sampleBundledTroopTypes } from '@/test/sample.ts';
import { buildArmyList } from './army-list';
import type { SavedArmy } from './saved-army';
import {
  type SavedArmyEntry,
  savedListReading,
  searchSavedArmies,
} from './saved-army-index';
import { type ArmySelection, withStands } from './selection';

const list = buildArmyList(armyDetail());

const reference = {
  armyList: list,
  troopTypes: sampleBundledTroopTypes,
  battleCards: sampleBattleCards,
};

const standingOf = (selection: ArmySelection) =>
  savedListReading({ game: 'triumph', selection }, reference).standing;

const saved = (overrides: Partial<SavedArmy> = {}): SavedArmy => ({
  id: 'army-1',
  game: 'triumph',
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

describe('savedListReading', () => {
  it('names a saved list after the army list it was built from', () => {
    expect(
      savedListReading(
        { game: 'triumph', selection: fixtureSelection() },
        reference,
      ).listName,
    ).toBe(list.name);
  });

  it('prices a saved selection and says whether it is legal', () => {
    const standing = standingOf(fixtureSelection());

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
    const four = standingOf(fixtureSelection());
    const six = standingOf(withStands(fixtureSelection(), spearmen, 'SPR', 6));

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

  it('keeps the lists of the games asked for, alongside the search', () => {
    expect(found(searchSavedArmies(entries, 'a', ['triumph']))).toEqual([
      'Cannae',
      'Zama',
      'Ilipa',
    ]);
    expect(found(searchSavedArmies(entries, 'zam', ['triumph']))).toEqual([
      'Zama',
    ]);
  });
});
