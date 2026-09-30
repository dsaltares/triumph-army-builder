import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './client.ts';
import {
  deleteCollectionEntry,
  findCollectionEntry,
  insertCollectionEntry,
  listCollectionEntries,
  type NewCollectionEntryRecord,
  updateCollectionEntry,
} from './collection.ts';
import { migrateToLatest } from './migrator.ts';
import type { UsersTable } from './schema.ts';

let db: ReturnType<typeof createDatabase>;

const owner = 'user-hannibal';

const stranger = 'user-scipio';

const at = (day: number) => new Date(Date.UTC(2026, 8, day)).toISOString();

const user = (id: string): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
});

const phalangites = (
  overrides: Partial<NewCollectionEntryRecord> = {},
): NewCollectionEntryRecord => ({
  id: 'entry-phalangites',
  userId: owner,
  name: 'Macedonian phalangites',
  count: 8,
  troopType: 'PIK',
  tags: ['macedonian', 'pike'],
  status: 'painted',
  notes: 'Victrix, based on 40 mm',
  at: at(1),
  ...overrides,
});

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(stranger)])
    .execute();
});

afterEach(async () => {
  await db.destroy();
});

describe('insertCollectionEntry', () => {
  it('round-trips every field of an entry', async () => {
    const inserted = await insertCollectionEntry(db, phalangites());

    expect(inserted).toEqual({
      id: 'entry-phalangites',
      name: 'Macedonian phalangites',
      count: 8,
      troopType: 'PIK',
      tags: ['macedonian', 'pike'],
      status: 'painted',
      notes: 'Victrix, based on 40 mm',
      createdAt: at(1),
      updatedAt: at(1),
    });
    expect(
      await findCollectionEntry(db, { id: inserted.id, userId: owner }),
    ).toEqual(inserted);
  });

  it('refuses an entry with no stands', async () => {
    await expect(
      insertCollectionEntry(db, phalangites({ count: 0 })),
    ).rejects.toThrow(/CHECK/);
  });

  it('refuses a fraction of a stand', async () => {
    await expect(
      insertCollectionEntry(db, phalangites({ count: 1.5 })),
    ).rejects.toThrow(/CHECK/);
  });

  it('refuses an entry that fields as no troop type', async () => {
    await expect(
      insertCollectionEntry(
        db,
        phalangites({ troopType: '' as NewCollectionEntryRecord['troopType'] }),
      ),
    ).rejects.toThrow('collection entry needs a troop type');
  });

  it('refuses a status the entry does not know', async () => {
    await expect(
      insertCollectionEntry(
        db,
        phalangites({ status: 'based' as unknown as 'painted' }),
      ),
    ).rejects.toThrow(/CHECK/);
  });

  it('refuses an entry with no owner', async () => {
    await expect(
      insertCollectionEntry(db, phalangites({ userId: 'user-nobody' })),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('listCollectionEntries', () => {
  it('lists only the caller entries, most recently changed first', async () => {
    await insertCollectionEntry(db, phalangites({ id: 'entry-a', at: at(1) }));
    await insertCollectionEntry(db, phalangites({ id: 'entry-b', at: at(3) }));
    await insertCollectionEntry(db, phalangites({ id: 'entry-c', at: at(2) }));
    await insertCollectionEntry(
      db,
      phalangites({ id: 'entry-stranger', userId: stranger, at: at(4) }),
    );

    expect(
      (await listCollectionEntries(db, owner)).map(({ id }) => id),
    ).toEqual(['entry-b', 'entry-c', 'entry-a']);
  });

  it('is empty for a player with no collection', async () => {
    expect(await listCollectionEntries(db, owner)).toEqual([]);
  });
});

describe('findCollectionEntry', () => {
  it('does not find another player entry', async () => {
    await insertCollectionEntry(db, phalangites());

    expect(
      await findCollectionEntry(db, {
        id: 'entry-phalangites',
        userId: stranger,
      }),
    ).toBeNull();
  });
});

describe('updateCollectionEntry', () => {
  it('changes only the fields it is given and stamps the change', async () => {
    const inserted = await insertCollectionEntry(db, phalangites());

    const updated = await updateCollectionEntry(
      db,
      { id: 'entry-phalangites', userId: owner },
      { count: 12, tags: ['successor'], troopType: 'HFT' },
      at(5),
    );

    expect(updated).toEqual({
      ...inserted,
      count: 12,
      tags: ['successor'],
      troopType: 'HFT',
      updatedAt: at(5),
    });
  });

  it('leaves a field alone when its change is undefined', async () => {
    await insertCollectionEntry(db, phalangites());

    const updated = await updateCollectionEntry(
      db,
      { id: 'entry-phalangites', userId: owner },
      { name: undefined, status: 'inProgress' },
      at(5),
    );

    expect(updated).toMatchObject({
      name: 'Macedonian phalangites',
      status: 'inProgress',
    });
  });

  it('refuses to take an entry below one stand or off its troop type', async () => {
    await insertCollectionEntry(db, phalangites());
    const owned = { id: 'entry-phalangites', userId: owner };

    await expect(
      updateCollectionEntry(db, owned, { count: 2.5 }, at(5)),
    ).rejects.toThrow(/CHECK/);
    await expect(
      db
        .updateTable('collection_entries')
        .set({ troop_type: null as unknown as string })
        .where('id', '=', owned.id)
        .execute(),
    ).rejects.toThrow('collection entry needs a troop type');
    expect(await findCollectionEntry(db, owned)).toMatchObject({
      count: 8,
      troopType: 'PIK',
    });
  });

  it('does not touch another player entry', async () => {
    await insertCollectionEntry(db, phalangites());

    expect(
      await updateCollectionEntry(
        db,
        { id: 'entry-phalangites', userId: stranger },
        { name: 'Stolen' },
        at(5),
      ),
    ).toBeNull();
    expect(
      await findCollectionEntry(db, { id: 'entry-phalangites', userId: owner }),
    ).toMatchObject({ name: 'Macedonian phalangites', updatedAt: at(1) });
  });
});

describe('deleteCollectionEntry', () => {
  it('deletes the caller entry', async () => {
    await insertCollectionEntry(db, phalangites());

    expect(
      await deleteCollectionEntry(db, {
        id: 'entry-phalangites',
        userId: owner,
      }),
    ).toBe(true);
    expect(await listCollectionEntries(db, owner)).toEqual([]);
  });

  it('does not delete another player entry', async () => {
    await insertCollectionEntry(db, phalangites());

    expect(
      await deleteCollectionEntry(db, {
        id: 'entry-phalangites',
        userId: stranger,
      }),
    ).toBe(false);
    expect(await listCollectionEntries(db, owner)).toHaveLength(1);
  });
});
