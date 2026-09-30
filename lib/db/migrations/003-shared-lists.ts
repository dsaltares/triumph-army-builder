import { type Kysely, sql } from 'kysely';

const now = sql`CURRENT_TIMESTAMP`;

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('shares')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('army_list_id', 'text', (col) => col.notNull())
    .addColumn('selection', 'text', (col) => col.notNull())
    .addColumn('data_version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createIndex('shares_user_id')
    .on('shares')
    .column('user_id')
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('shares').execute();
};
