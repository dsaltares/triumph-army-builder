import type { Kysely } from 'kysely';
import { credentialProviderId } from '../auth/providers.ts';
import { getDatabase } from './client.ts';
import type { Database } from './schema.ts';

export const hasPasswordCredential = async (
  userId: string,
  db: Kysely<Database> = getDatabase(),
) => {
  const account = await db
    .selectFrom('accounts')
    .select('id')
    .where('userId', '=', userId)
    .where('providerId', '=', credentialProviderId)
    .where('password', 'is not', null)
    .executeTakeFirst();

  return !!account;
};
