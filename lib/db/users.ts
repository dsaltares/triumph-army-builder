import type { Kysely } from 'kysely';
import { getDatabase } from './client.ts';
import type { Database } from './schema.ts';

export const confirmAddress = async (
  userId: string,
  db: Kysely<Database> = getDatabase(),
) => {
  const confirmed = await db
    .updateTable('users')
    .set({ emailVerified: 1 })
    .where('id', '=', userId)
    .executeTakeFirst();

  return confirmed.numUpdatedRows > 0n;
};
