import { type Kysely, sql } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('army_collection_pins')
    .addColumn('army_id', 'text', (col) =>
      col.notNull().references('armies.id').onDelete('cascade'),
    )
    .addColumn('troop_option', 'text', (col) => col.notNull())
    .addColumn('troop_type', 'text', (col) => col.notNull())
    .addColumn('entry_id', 'text', (col) =>
      col.notNull().references('collection_entries.id').onDelete('cascade'),
    )
    .addColumn('count', 'integer', (col) =>
      col.notNull().check(sql`typeof(count) = 'integer' and count >= 1`),
    )
    .addPrimaryKeyConstraint('army_collection_pins_primary_key', [
      'army_id',
      'troop_option',
      'troop_type',
      'entry_id',
    ])
    .execute();

  await db.schema
    .createIndex('army_collection_pins_entry_id')
    .on('army_collection_pins')
    .column('entry_id')
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('army_collection_pins').execute();
};
