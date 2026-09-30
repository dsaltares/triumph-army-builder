import { type Kysely, sql } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('activity_events')
    .addColumn('id', 'integer', (col) => col.notNull().primaryKey())
    .addColumn('occurred_at', 'text', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text')
    .addColumn('is_anonymous', 'integer', (col) =>
      col.notNull().check(sql`is_anonymous in (0, 1)`),
    )
    .addColumn('subject_id', 'text')
    .addColumn('props', 'text', (col) =>
      col.notNull().defaultTo('{}').check(sql`json_valid(props)`),
    )
    .addColumn('ip', 'text')
    .addColumn('country', 'text')
    .addColumn('region', 'text')
    .addColumn('city', 'text')
    .execute();

  await db.schema
    .createIndex('activity_events_kind_occurred_at_is_anonymous')
    .on('activity_events')
    .columns(['kind', 'occurred_at', 'is_anonymous'])
    .execute();

  await db.schema
    .createIndex('activity_events_occurred_at_is_anonymous_user_id')
    .on('activity_events')
    .columns(['occurred_at', 'is_anonymous', 'user_id'])
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('activity_events').execute();
};
