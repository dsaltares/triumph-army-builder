import { hashPassword } from 'better-auth/crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAuth } from '../auth/auth.ts';
import { createDatabase } from './client.ts';
import { devUser, seedDevUser } from './dev-user.ts';
import { migrateToLatest } from './migrator.ts';

let db: ReturnType<typeof createDatabase>;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('seedDevUser', () => {
  it('seeds a player who can sign in without confirming an address', async () => {
    await seedDevUser(hashPassword, db);
    const auth = createAuth({
      db,
      secret: 'a-test-secret-nobody-signs-anything-real-with',
      baseUrl: 'http://localhost:3013',
      socialProviders: {},
      sendEmail: () => Promise.resolve({ delivered: true, id: 'msg_1' }),
    });

    const { user } = await auth.api.signInEmail({
      body: { email: devUser.email, password: devUser.password },
    });

    expect(user.email).toBe(devUser.email);
  });

  it('leaves an already seeded database alone', async () => {
    expect(await seedDevUser(hashPassword, db)).toBe(true);
    expect(await seedDevUser(hashPassword, db)).toBe(false);

    const users = await db.selectFrom('users').select('id').execute();
    expect(users).toHaveLength(1);
  });
});
