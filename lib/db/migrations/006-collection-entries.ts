import { type Kysely, sql } from 'kysely';

const now = sql`CURRENT_TIMESTAMP`;

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('collection_entries')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('count', 'integer', (col) =>
      col.notNull().check(sql`typeof(count) = 'integer' and count >= 1`),
    )
    .addColumn('troop_types', 'text', (col) =>
      col.notNull().check(sql`json_array_length(troop_types) >= 1`),
    )
    .addColumn('tags', 'text', (col) => col.notNull())
    .addColumn('status', 'text', (col) =>
      col
        .notNull()
        .check(sql`status in ('unpainted', 'inProgress', 'painted')`),
    )
    .addColumn('notes', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createIndex('collection_entries_user_id_updated_at')
    .on('collection_entries')
    .columns(['user_id', 'updated_at'])
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('collection_entries').execute();
};
