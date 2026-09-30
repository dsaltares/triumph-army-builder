import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';
import { confirmAddress } from './users.ts';

let db: ReturnType<typeof createDatabase>;

const userId = 'user-1';

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values({
      id: userId,
      name: 'Hannibal',
      email: 'hannibal@example.test',
      image: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .execute();
});

afterEach(async () => {
  await db.destroy();
});

const verifiedFlag = async () =>
  (
    await db
      .selectFrom('users')
      .select('emailVerified')
      .where('id', '=', userId)
      .executeTakeFirst()
  )?.emailVerified;

describe('confirmAddress', () => {
  it('marks the address confirmed', async () => {
    expect(await verifiedFlag()).toBe(0);

    expect(await confirmAddress(userId, db)).toBe(true);

    expect(await verifiedFlag()).toBe(1);
  });

  it('is happy to confirm an address that is already confirmed', async () => {
    await confirmAddress(userId, db);

    expect(await confirmAddress(userId, db)).toBe(true);
    expect(await verifiedFlag()).toBe(1);
  });

  it('says so when there is no such account to confirm', async () => {
    expect(await confirmAddress('nobody', db)).toBe(false);
  });
});
