import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './client';
import { migrateToLatest } from './migrator';
import type { NewArmy, NewCollectionPhotoRow, UsersTable } from './schema';

type NewUser = Insertable<UsersTable>;

let db: ReturnType<typeof createDatabase>;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

const user = (overrides: Partial<NewUser> = {}): NewUser => ({
  id: 'user-1',
  name: 'Hannibal',
  email: 'hannibal@carthage.example',
  image: null,
  ...overrides,
});

const army = (overrides: Partial<NewArmy> = {}): NewArmy => ({
  id: 'army-1',
  user_id: 'user-1',
  name: 'Cannae',
  army_list_id: '66c',
  selection: JSON.stringify({ army: '66c', year: -216 }),
  data_version: '2026-09-17.a1b2c3d4',
  ...overrides,
});

const insertUser = (overrides: Partial<NewUser> = {}) =>
  db.insertInto('users').values(user(overrides)).execute();

const insertArmy = (overrides: Partial<NewArmy> = {}) =>
  db.insertInto('armies').values(army(overrides)).execute();

const insertEntry = () =>
  db
    .insertInto('collection_entries')
    .values({
      id: 'entry-1',
      user_id: 'user-1',
      name: 'Libyan spearmen',
      count: 8,
      troop_type: 'SPR',
      tags: JSON.stringify(['libyan']),
      status: 'painted',
      notes: '',
    })
    .execute();

const insertPhoto = (overrides: Partial<NewCollectionPhotoRow> = {}) =>
  db
    .insertInto('collection_photos')
    .values({
      id: 'photo-1',
      entry_id: 'entry-1',
      user_id: 'user-1',
      position: 0,
      width: 1600,
      height: 1200,
      bytes: 280_000,
      ...overrides,
    })
    .execute();

const deleteUser = (id: string) =>
  db.deleteFrom('users').where('id', '=', id).execute();

describe('users', () => {
  it('defaults an account to unverified and not anonymous', async () => {
    await insertUser();

    const row = await db
      .selectFrom('users')
      .selectAll()
      .executeTakeFirstOrThrow();

    expect(row.emailVerified).toBe(0);
    expect(row.isAnonymous).toBe(0);
    expect(row.createdAt).toEqual(expect.any(String));
    expect(row.updatedAt).toEqual(expect.any(String));
  });

  it('carries the anonymous flag the anonymous plugin sets', async () => {
    await insertUser({
      id: 'anon-1',
      email: 'temp@anon.example',
      isAnonymous: 1,
    });

    const row = await db
      .selectFrom('users')
      .select('isAnonymous')
      .where('id', '=', 'anon-1')
      .executeTakeFirstOrThrow();

    expect(row.isAnonymous).toBe(1);
  });

  it('rejects a second account on the same address', async () => {
    await insertUser();

    await expect(insertUser({ id: 'user-2' })).rejects.toThrow(/UNIQUE/);
  });
});

describe('accounts', () => {
  it('holds more than one provider for the same user', async () => {
    await insertUser();
    await db
      .insertInto('accounts')
      .values([
        {
          id: 'account-1',
          userId: 'user-1',
          accountId: 'user-1',
          providerId: 'credential',
          password: 'hashed',
          accessToken: null,
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: null,
        },
        {
          id: 'account-2',
          userId: 'user-1',
          accountId: 'google-id',
          providerId: 'google',
          password: null,
          accessToken: 'token',
          refreshToken: null,
          idToken: null,
          accessTokenExpiresAt: null,
          refreshTokenExpiresAt: null,
          scope: 'email profile',
        },
      ])
      .execute();

    const rows = await db
      .selectFrom('accounts')
      .select('providerId')
      .where('userId', '=', 'user-1')
      .execute();

    expect(rows).toHaveLength(2);
  });
});

describe('verifications', () => {
  it('round-trips a token with its expiry', async () => {
    await db
      .insertInto('verifications')
      .values({
        id: 'verification-1',
        identifier: 'reset-password:hannibal@carthage.example',
        value: 'token-1',
        expiresAt: '2026-09-18T12:00:00.000Z',
      })
      .execute();

    const row = await db
      .selectFrom('verifications')
      .selectAll()
      .executeTakeFirstOrThrow();

    expect(row).toMatchObject({
      identifier: 'reset-password:hannibal@carthage.example',
      value: 'token-1',
      expiresAt: '2026-09-18T12:00:00.000Z',
    });
  });
});

describe('armies', () => {
  it('round-trips an owned army', async () => {
    await insertUser();
    await insertArmy();

    const row = await db
      .selectFrom('armies')
      .selectAll()
      .executeTakeFirstOrThrow();

    expect(row).toMatchObject({
      id: 'army-1',
      user_id: 'user-1',
      name: 'Cannae',
      army_list_id: '66c',
      data_version: '2026-09-17.a1b2c3d4',
    });
    expect(JSON.parse(row.selection)).toEqual({ army: '66c', year: -216 });
    expect(row.created_at).toEqual(expect.any(String));
    expect(row.updated_at).toEqual(expect.any(String));
  });

  it('refuses an army with no owner', async () => {
    await expect(insertArmy()).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe('deleting a user', () => {
  it('takes their sessions and accounts with it', async () => {
    await insertUser();
    await db
      .insertInto('sessions')
      .values({
        id: 'session-1',
        userId: 'user-1',
        token: 'token-1',
        expiresAt: '2027-01-01T00:00:00.000Z',
        ipAddress: null,
        userAgent: null,
      })
      .execute();
    await db
      .insertInto('accounts')
      .values({
        id: 'account-1',
        userId: 'user-1',
        accountId: 'user-1',
        providerId: 'credential',
        password: 'hashed',
        accessToken: null,
        refreshToken: null,
        idToken: null,
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        scope: null,
      })
      .execute();

    await deleteUser('user-1');

    expect(await db.selectFrom('sessions').selectAll().execute()).toEqual([]);
    expect(await db.selectFrom('accounts').selectAll().execute()).toEqual([]);
  });

  it('takes their collection with it', async () => {
    await insertUser();
    await db
      .insertInto('collection_entries')
      .values({
        id: 'entry-1',
        user_id: 'user-1',
        name: 'Libyan spearmen',
        count: 8,
        troop_type: 'SPR',
        tags: JSON.stringify(['libyan']),
        status: 'painted',
        notes: '',
      })
      .execute();

    await deleteUser('user-1');

    expect(
      await db.selectFrom('collection_entries').selectAll().execute(),
    ).toEqual([]);
  });

  it('takes their collection photos with it', async () => {
    await insertUser();
    await insertEntry();
    await insertPhoto();

    await deleteUser('user-1');

    expect(
      await db.selectFrom('collection_photos').selectAll().execute(),
    ).toEqual([]);
  });

  it('is blocked while they still own armies', async () => {
    await insertUser({
      id: 'anon-1',
      email: 'temp@anon.example',
      isAnonymous: 1,
    });
    await insertArmy({ user_id: 'anon-1' });

    await expect(deleteUser('anon-1')).rejects.toThrow(/FOREIGN KEY/);
    expect(await db.selectFrom('armies').selectAll().execute()).toHaveLength(1);
  });

  it('succeeds once their armies have been reassigned', async () => {
    await insertUser({
      id: 'anon-1',
      email: 'temp@anon.example',
      isAnonymous: 1,
    });
    await insertUser({ id: 'user-1' });
    await insertArmy({ user_id: 'anon-1' });

    await db
      .updateTable('armies')
      .set({ user_id: 'user-1' })
      .where('user_id', '=', 'anon-1')
      .execute();
    await deleteUser('anon-1');

    const row = await db
      .selectFrom('armies')
      .select('user_id')
      .executeTakeFirstOrThrow();

    expect(row.user_id).toBe('user-1');
  });
});

describe('collection_photos', () => {
  beforeEach(async () => {
    await insertUser();
    await insertEntry();
  });

  it('goes with the entry it shows', async () => {
    await insertPhoto();

    await db
      .deleteFrom('collection_entries')
      .where('id', '=', 'entry-1')
      .execute();

    expect(
      await db.selectFrom('collection_photos').selectAll().execute(),
    ).toEqual([]);
  });

  it('refuses a photo of an entry that does not exist', async () => {
    await expect(insertPhoto({ entry_id: 'entry-missing' })).rejects.toThrow(
      /FOREIGN KEY/,
    );
  });

  it('refuses a photo with no pixels or no bytes', async () => {
    await expect(insertPhoto({ width: 0 })).rejects.toThrow(/CHECK/);
    await expect(insertPhoto({ height: 0 })).rejects.toThrow(/CHECK/);
    await expect(insertPhoto({ bytes: 0 })).rejects.toThrow(/CHECK/);
  });

  it('stamps when it was added', async () => {
    await insertPhoto();

    const row = await db
      .selectFrom('collection_photos')
      .selectAll()
      .executeTakeFirstOrThrow();
    expect(row.created_at).toEqual(expect.any(String));
  });
});

describe('army_collection_pins', () => {
  const insertPin = (count = 4, entryId = 'entry-1') =>
    db
      .insertInto('army_collection_pins')
      .values({
        army_id: 'army-1',
        troop_option: 'main/0',
        troop_type: 'SPR',
        entry_id: entryId,
        count,
      })
      .execute();

  const pins = () =>
    db.selectFrom('army_collection_pins').selectAll().execute();

  beforeEach(async () => {
    await insertUser();
    await insertArmy();
    await insertEntry();
  });

  it('goes with the list it pins into', async () => {
    await insertPin();

    await db.deleteFrom('armies').where('id', '=', 'army-1').execute();

    expect(await pins()).toEqual([]);
  });

  it('goes with the entry it pins', async () => {
    await insertPin();

    await db
      .deleteFrom('collection_entries')
      .where('id', '=', 'entry-1')
      .execute();

    expect(await pins()).toEqual([]);
  });

  it('refuses a pin to an entry that does not exist', async () => {
    await expect(insertPin(4, 'entry-missing')).rejects.toThrow(/FOREIGN KEY/);
  });

  it('refuses a pin of no stands', async () => {
    await expect(insertPin(0)).rejects.toThrow(/CHECK/);
  });

  it('holds one pin per entry, troop option and troop type in a list', async () => {
    await insertPin();

    await expect(insertPin(2)).rejects.toThrow(/UNIQUE/);
  });
});
