import { describe, expect, it } from 'vitest';
import { fixtureSelection } from '@/test/fixtures/army.ts';
import {
  armyNameMaxLength,
  armyNameSchema,
  byMostRecent,
  copyName,
  defaultListName,
  type SavedArmy,
  type TriumphSavedArmy,
  withArmyRemoved,
  withArmyUpserted,
} from './saved-army';

const saved = (
  overrides: Partial<TriumphSavedArmy> = {},
): TriumphSavedArmy => ({
  id: 'army-1',
  game: 'triumph',
  name: 'Cannae',
  armyListId: 'army-1',
  dataVersion: '2026-09-17.abcdef01',
  selection: fixtureSelection(),
  createdAt: '2026-09-18T10:00:00.000Z',
  updatedAt: '2026-09-18T10:00:00.000Z',
  ...overrides,
});

const ids = (armies: readonly SavedArmy[]) => armies.map(({ id }) => id);

describe('armyNameSchema', () => {
  it('trims the surrounding whitespace a phone keyboard adds', () => {
    expect(armyNameSchema.parse('  Cannae  ')).toBe('Cannae');
  });

  it('refuses a name that is only whitespace', () => {
    expect(armyNameSchema.safeParse('   ').success).toBe(false);
  });

  it('refuses a name longer than the column allows', () => {
    expect(
      armyNameSchema.safeParse('a'.repeat(armyNameMaxLength)).success,
    ).toBe(true);
    expect(
      armyNameSchema.safeParse('a'.repeat(armyNameMaxLength + 1)).success,
    ).toBe(false);
  });
});

describe('copyName', () => {
  it('marks the copy without renaming the original', () => {
    expect(copyName('Cannae')).toBe('Cannae (copy)');
  });

  it('keeps a copy of a copy distinguishable', () => {
    expect(copyName(copyName('Cannae'))).toBe('Cannae (copy) (copy)');
  });

  it('stays inside the name limit when the original fills it', () => {
    const name = copyName('a'.repeat(armyNameMaxLength));

    expect(name).toHaveLength(armyNameMaxLength);
    expect(name.endsWith(' (copy)')).toBe(true);
  });
});

describe('defaultListName', () => {
  it('names a new list after its army and the day it was started', () => {
    expect(defaultListName('Sunspire Dominion', new Date(2026, 8, 20))).toBe(
      'Sunspire Dominion \u00b7 20 September 2026',
    );
  });

  it('writes the day the way the rest of the app writes a date', () => {
    expect(defaultListName('Sunspire Dominion', new Date(2026, 0, 5))).toBe(
      'Sunspire Dominion \u00b7 5 January 2026',
    );
  });

  it('stays inside the name limit when the army name fills it', () => {
    const name = defaultListName('a'.repeat(armyNameMaxLength), new Date());

    expect(name).toHaveLength(armyNameMaxLength);
    expect(armyNameSchema.safeParse(name).success).toBe(true);
  });
});

describe('byMostRecent', () => {
  it('puts the most recently touched list first', () => {
    const armies = [
      saved({ id: 'older', updatedAt: '2026-09-18T09:00:00.000Z' }),
      saved({ id: 'newer', updatedAt: '2026-09-18T11:00:00.000Z' }),
    ].sort(byMostRecent);

    expect(ids(armies)).toEqual(['newer', 'older']);
  });

  it('breaks a tie on the id so the order never flickers', () => {
    const armies = [
      saved({ id: 'a' }),
      saved({ id: 'c' }),
      saved({ id: 'b' }),
    ].sort(byMostRecent);

    expect(ids(armies)).toEqual(['c', 'b', 'a']);
  });
});

describe('withArmyUpserted', () => {
  it('adds a new list in its sorted place', () => {
    const armies = withArmyUpserted(
      [saved({ id: 'old', updatedAt: '2026-09-18T09:00:00.000Z' })],
      saved({ id: 'fresh', updatedAt: '2026-09-18T12:00:00.000Z' }),
    );

    expect(ids(armies)).toEqual(['fresh', 'old']);
  });

  it('replaces the list it already holds rather than duplicating it', () => {
    const armies = withArmyUpserted(
      [saved({ id: 'army-1', name: 'Cannae' })],
      saved({ id: 'army-1', name: 'Zama' }),
    );

    expect(armies).toHaveLength(1);
    expect(armies[0]?.name).toBe('Zama');
  });

  it('leaves the list it was given untouched', () => {
    const armies = [saved({ id: 'army-1' })];

    withArmyUpserted(armies, saved({ id: 'army-2' }));

    expect(ids(armies)).toEqual(['army-1']);
  });
});

describe('withArmyRemoved', () => {
  it('drops the list by id', () => {
    const armies = withArmyRemoved(
      [saved({ id: 'army-1' }), saved({ id: 'army-2' })],
      'army-1',
    );

    expect(ids(armies)).toEqual(['army-2']);
  });

  it('is a no-op for a list that is not there', () => {
    const armies = withArmyRemoved([saved({ id: 'army-1' })], 'army-9');

    expect(ids(armies)).toEqual(['army-1']);
  });
});
