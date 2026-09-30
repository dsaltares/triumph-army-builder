import { type Kysely, sql } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('reference_versions')
    .addColumn('data_version', 'text', (col) => col.primaryKey())
    .addColumn('source', 'text', (col) => col.notNull())
    .addColumn('built_at', 'text', (col) => col.notNull())
    .addColumn('imported_at', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('reference_current')
    .addColumn('id', 'integer', (col) => col.primaryKey().check(sql`id = 1`))
    .addColumn('data_version', 'text', (col) =>
      col.notNull().references('reference_versions.data_version'),
    )
    .execute();

  await db.schema
    .createTable('reference_documents')
    .addColumn('data_version', 'text', (col) =>
      col
        .notNull()
        .references('reference_versions.data_version')
        .onDelete('cascade'),
    )
    .addColumn('locale', 'text', (col) => col.notNull())
    .addColumn('path', 'text', (col) => col.notNull())
    .addColumn('body', 'text', (col) => col.notNull())
    .addPrimaryKeyConstraint('reference_documents_primary_key', [
      'data_version',
      'locale',
      'path',
    ])
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('reference_documents').execute();
  await db.schema.dropTable('reference_current').execute();
  await db.schema.dropTable('reference_versions').execute();
};
