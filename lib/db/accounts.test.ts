import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hasPasswordCredential } from './accounts.ts';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';
import type { AccountsTable, UsersTable } from './schema.ts';

let db: ReturnType<typeof createDatabase>;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values({
      id: 'user-1',
      name: 'Hannibal',
      email: 'hannibal@carthage.example',
      image: null,
    } satisfies Insertable<UsersTable>)
    .execute();
});

afterEach(async () => {
  await db.destroy();
});

const insertAccount = (overrides: Partial<Insertable<AccountsTable>> = {}) =>
  db
    .insertInto('accounts')
    .values({
      id: 'account-1',
      userId: 'user-1',
      accountId: 'user-1',
      providerId: 'credential',
      password: 'scrypt:not-a-real-hash',
      ...overrides,
    })
    .execute();

describe('hasPasswordCredential', () => {
  it('finds the credential account a password sign-up leaves behind', async () => {
    await insertAccount();

    await expect(hasPasswordCredential('user-1', db)).resolves.toBe(true);
  });

  it('says no for an account that only ever signed in with a provider', async () => {
    await insertAccount({
      providerId: 'google',
      accountId: 'google-1',
      password: null,
    });

    await expect(hasPasswordCredential('user-1', db)).resolves.toBe(false);
  });

  it('says no for a credential row with no password on it', async () => {
    await insertAccount({ password: null });

    await expect(hasPasswordCredential('user-1', db)).resolves.toBe(false);
  });

  it('says no for a user with no accounts at all', async () => {
    await expect(hasPasswordCredential('user-1', db)).resolves.toBe(false);
  });

  it("does not answer for one user with another user's credential", async () => {
    await insertAccount();

    await expect(hasPasswordCredential('user-2', db)).resolves.toBe(false);
  });
});
