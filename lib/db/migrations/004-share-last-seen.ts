import { type Kysely, sql } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .alterTable('shares')
    .addColumn('last_seen_at', 'text')
    .execute();

  await sql`update shares set last_seen_at = created_at`.execute(db);

  await db.schema
    .createIndex('shares_last_seen_at')
    .on('shares')
    .column('last_seen_at')
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropIndex('shares_last_seen_at').execute();
  await db.schema.alterTable('shares').dropColumn('last_seen_at').execute();
};
