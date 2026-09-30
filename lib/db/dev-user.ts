import { randomUUID } from 'node:crypto';
import type { Kysely } from 'kysely';
import { credentialProviderId } from '../auth/providers.ts';
import { getDatabase } from './client.ts';
import type { Database } from './schema.ts';

export const devUser = {
  name: 'Dev Player',
  email: 'dev@example.test',
  password: 'triumph-dev-password',
};

export type HashPassword = (password: string) => Promise<string>;

export const seedDevUser = async (
  hashPassword: HashPassword,
  db: Kysely<Database> = getDatabase(),
) => {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', devUser.email)
    .executeTakeFirst();
  if (existing) {
    return false;
  }

  const userId = randomUUID();
  const password = await hashPassword(devUser.password);
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('users')
      .values({
        id: userId,
        name: devUser.name,
        email: devUser.email,
        emailVerified: 1,
        image: null,
      })
      .execute();
    await trx
      .insertInto('accounts')
      .values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: credentialProviderId,
        password,
      })
      .execute();
  });
  return true;
};
