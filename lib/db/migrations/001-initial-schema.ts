import { type Kysely, sql } from 'kysely';

const now = sql`CURRENT_TIMESTAMP`;

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .createTable('users')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('emailVerified', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('image', 'text')
    .addColumn('isAnonymous', 'integer', (col) => col.defaultTo(0))
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('userId', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('ipAddress', 'text')
    .addColumn('userAgent', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createIndex('sessions_user_id')
    .on('sessions')
    .column('userId')
    .execute();

  await db.schema
    .createTable('accounts')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('userId', 'text', (col) =>
      col.notNull().references('users.id').onDelete('cascade'),
    )
    .addColumn('accountId', 'text', (col) => col.notNull())
    .addColumn('providerId', 'text', (col) => col.notNull())
    .addColumn('accessToken', 'text')
    .addColumn('refreshToken', 'text')
    .addColumn('idToken', 'text')
    .addColumn('accessTokenExpiresAt', 'text')
    .addColumn('refreshTokenExpiresAt', 'text')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createIndex('accounts_user_id')
    .on('accounts')
    .column('userId')
    .execute();

  await db.schema
    .createTable('verifications')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expiresAt', 'text', (col) => col.notNull())
    .addColumn('createdAt', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updatedAt', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  await db.schema
    .createIndex('verifications_identifier')
    .on('verifications')
    .column('identifier')
    .execute();

  await db.schema
    .createTable('armies')
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('army_list_id', 'text', (col) => col.notNull())
    .addColumn('selection', 'text', (col) => col.notNull())
    .addColumn('data_version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

  // user_id leads because SQLite needs a leading-user_id index to check the
  // on delete restrict above; reorder the pair and deleting a user becomes a
  // full scan of armies. See lib/db/query-plans.test.ts (#110).
  await db.schema
    .createIndex('armies_user_id_updated_at')
    .on('armies')
    .columns(['user_id', 'updated_at'])
    .execute();
};

export const down = async (db: Kysely<unknown>) => {
  await db.schema.dropTable('armies').execute();
  await db.schema.dropTable('verifications').execute();
  await db.schema.dropTable('accounts').execute();
  await db.schema.dropTable('sessions').execute();
  await db.schema.dropTable('users').execute();
};
