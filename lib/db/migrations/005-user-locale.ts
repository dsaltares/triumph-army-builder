import type { Kysely } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema.alterTable('users').addColumn('locale', 'text').execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.alterTable('users').dropColumn('locale').execute();
};
