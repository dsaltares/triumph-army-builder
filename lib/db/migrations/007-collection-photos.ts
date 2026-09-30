import { type Kysely, sql } from 'kysely';

const now = sql`CURRENT_TIMESTAMP`;

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('collection_photos')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('entry_id', 'text', (col) =>
      col.notNull().references('collection_entries.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('position', 'integer', (col) => col.notNull())
    .addColumn('width', 'integer', (col) =>
      col.notNull().check(sql`width >= 1`),
    )
    .addColumn('height', 'integer', (col) =>
      col.notNull().check(sql`height >= 1`),
    )
    .addColumn('bytes', 'integer', (col) =>
      col.notNull().check(sql`bytes >= 1`),
    )
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createIndex('collection_photos_entry_id_position')
    .on('collection_photos')
    .columns(['entry_id', 'position'])
    .execute();

  await db.schema
    .createIndex('collection_photos_user_id')
    .on('collection_photos')
    .column('user_id')
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('collection_photos').execute();
};
