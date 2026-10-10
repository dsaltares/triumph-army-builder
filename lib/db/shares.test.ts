import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { armyDetail, fixtureSelection } from '../../test/fixtures/army.ts';
import { buildArmyList } from '../domain/army/army-list.ts';
import { withStands } from '../domain/army/selection.ts';
import { shareIdPattern } from '../domain/army/shared-list.ts';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';
import type { UsersTable } from './schema.ts';
import { countShares, findShare, insertShare, shareId } from './shares.ts';

let db: ReturnType<typeof createDatabase>;

const owner = 'user-hannibal';

const browser = 'user-anonymous';

const at = '2026-09-20T10:00:00.000Z';

const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
  isAnonymous,
});

const share = (
  overrides: Partial<{ userId: string; name: string; at: string }> = {},
) =>
  insertShare(db, {
    userId: owner,
    name: 'Cannae',
    selection: fixtureSelection(),
    at,
    ...overrides,
  });

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(browser, 1)])
    .execute();
});

afterEach(async () => {
  await db.destroy();
});

describe('shareId', () => {
  it('is a short url-safe id', () => {
    expect(shareId({ name: 'Cannae', selection: fixtureSelection() })).toMatch(
      shareIdPattern,
    );
  });

  it('is the same id for the same list however it was clicked together', () => {
    const list = buildArmyList(armyDetail());
    const spearmen = list.main.troopOptions[0];
    if (!spearmen) {
      throw new Error('the fixture army no longer has a first troop option');
    }
    const wandered = withStands(
      withStands(fixtureSelection(), spearmen, 'SPR', 2),
      spearmen,
      'SPR',
      4,
    );

    expect(shareId({ name: 'Cannae', selection: wandered })).toBe(
      shareId({ name: 'Cannae', selection: fixtureSelection() }),
    );
  });

  it('is a different id for a different name or a different list', () => {
    const id = shareId({ name: 'Cannae', selection: fixtureSelection() });

    expect(shareId({ name: 'Trebia', selection: fixtureSelection() })).not.toBe(
      id,
    );
    expect(
      shareId({ name: 'Cannae', selection: fixtureSelection({ stands: 2 }) }),
    ).not.toBe(id);
  });
});

describe('insertShare', () => {
  it('files the copy under its game, keeping the selection as it always stored it', async () => {
    const shared = await share();

    const row = await db
      .selectFrom('shares')
      .select(['game', 'army_list_id', 'selection'])
      .where('id', '=', shared.id)
      .executeTakeFirstOrThrow();
    expect(shared.game).toBe('triumph');
    expect(row).toMatchObject({ game: 'triumph', army_list_id: 'army-1' });
    expect(JSON.parse(row.selection)).toEqual(fixtureSelection());
  });

  it('names the same copy whether or not the game is named', () => {
    expect(
      shareId({
        name: 'Cannae',
        game: 'triumph',
        selection: fixtureSelection(),
      }),
    ).toBe(shareId({ name: 'Cannae', selection: fixtureSelection() }));
  });

  it('stores the copy under its content id', async () => {
    const shared = await share();

    expect(shared).toMatchObject({
      id: shareId({ name: 'Cannae', selection: fixtureSelection() }),
      name: 'Cannae',
      armyListId: 'army-1',
      createdAt: at,
    });
    expect(shared.selection).toEqual(fixtureSelection());
  });

  it('returns the first copy when the same list is shared again', async () => {
    const first = await share();
    const again = await share({ userId: owner, at: '2026-09-21T10:00:00Z' });

    expect(again).toEqual(first);
    expect(await countShares(db, owner)).toBe(1);
  });

  it('keeps the copy when the author is deleted', async () => {
    const shared = await share();

    await db.deleteFrom('users').where('id', '=', owner).execute();

    expect(await findShare(db, shared.id)).toEqual(shared);
  });
});

describe('findShare', () => {
  it('reads a copy back by id', async () => {
    const shared = await share();

    expect(await findShare(db, shared.id)).toEqual(shared);
  });

  it('is null for an id nobody shared', async () => {
    expect(await findShare(db, 'nothinghere')).toBeNull();
  });
});
