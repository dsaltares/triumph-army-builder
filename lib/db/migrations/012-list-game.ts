import { type Kysely, sql } from 'kysely';

const now = sql`CURRENT_TIMESTAMP`;

type ListShape = 'withGame' | 'triumphOnly';

const listTables = ['armies', 'shares'] as const;

type ListTable = (typeof listTables)[number];

const rebuiltTable = (table: ListTable) => `${table}_rebuilt`;

const createArmies = (db: Kysely<unknown>, shape: ListShape) =>
  db.schema
    .createTable(rebuiltTable('armies'))
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('users.id').onDelete('restrict'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .$call((builder) =>
      shape === 'withGame'
        ? builder
            .addColumn('game', 'text', (col) =>
              col.notNull().defaultTo('triumph'),
            )
            .addColumn('army_list_id', 'text')
        : builder.addColumn('army_list_id', 'text', (col) => col.notNull()),
    )
    .addColumn('selection', 'text', (col) => col.notNull())
    .addColumn('data_version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('updated_at', 'text', (col) => col.notNull().defaultTo(now))
    .execute();

const createShares = (db: Kysely<unknown>, shape: ListShape) =>
  db.schema
    .createTable(rebuiltTable('shares'))
    .addColumn('id', 'text', (col) => col.notNull().primaryKey())
    .addColumn('user_id', 'text', (col) =>
      col.references('users.id').onDelete('set null'),
    )
    .addColumn('name', 'text', (col) => col.notNull())
    .$call((builder) =>
      shape === 'withGame'
        ? builder
            .addColumn('game', 'text', (col) =>
              col.notNull().defaultTo('triumph'),
            )
            .addColumn('army_list_id', 'text')
        : builder.addColumn('army_list_id', 'text', (col) => col.notNull()),
    )
    .addColumn('selection', 'text', (col) => col.notNull())
    .addColumn('data_version', 'text', (col) => col.notNull())
    .addColumn('created_at', 'text', (col) => col.notNull().defaultTo(now))
    .addColumn('last_seen_at', 'text')
    .execute();

const sharedColumns: Record<ListTable, readonly string[]> = {
  armies: [
    'id',
    'user_id',
    'name',
    'army_list_id',
    'selection',
    'data_version',
    'created_at',
    'updated_at',
  ],
  shares: [
    'id',
    'user_id',
    'name',
    'army_list_id',
    'selection',
    'data_version',
    'created_at',
    'last_seen_at',
  ],
};

const createIndexes = async (db: Kysely<unknown>) => {
  await db.schema
    .createIndex('armies_user_id_updated_at')
    .on('armies')
    .columns(['user_id', 'updated_at'])
    .execute();
  await db.schema
    .createIndex('shares_user_id')
    .on('shares')
    .column('user_id')
    .execute();
  await db.schema
    .createIndex('shares_last_seen_at')
    .on('shares')
    .column('last_seen_at')
    .execute();
};

const triumphNeedsArmyList = 'a Triumph! list needs an army list';

const createTriumphArmyListTriggers = async (
  db: Kysely<unknown>,
  table: ListTable,
) => {
  await sql`create trigger ${sql.raw(`${table}_triumph_army_list_on_insert`)} before insert on ${sql.table(table)} when new.game = 'triumph' and new.army_list_id is null begin select raise(abort, ${sql.lit(triumphNeedsArmyList)}); end`.execute(
    db,
  );
  await sql`create trigger ${sql.raw(`${table}_triumph_army_list_on_update`)} before update of game, army_list_id on ${sql.table(table)} when new.game = 'triumph' and new.army_list_id is null begin select raise(abort, ${sql.lit(triumphNeedsArmyList)}); end`.execute(
    db,
  );
};

const copyInto = async (db: Kysely<unknown>, table: ListTable) => {
  const columns = sql.join(sharedColumns[table].map((name) => sql.ref(name)));
  await sql`insert into ${sql.table(rebuiltTable(table))} (${columns}) select ${columns} from ${sql.table(table)}`.execute(
    db,
  );
  await db.schema.dropTable(table).execute();
  await db.schema.alterTable(rebuiltTable(table)).renameTo(table).execute();
};

// SQLite cannot drop a NOT NULL constraint in place, so both tables are
// rebuilt. Foreign keys are off while they are, or dropping the old armies
// table would cascade into army_collection_pins; the pragma is a no-op inside
// a transaction, so it is set around one.
const rebuildListTables = async (
  db: Kysely<unknown>,
  shape: ListShape,
  afterRebuild: (trx: Kysely<unknown>) => Promise<void> = async () => {},
) => {
  await sql`pragma foreign_keys = off`.execute(db);
  try {
    await db.transaction().execute(async (trx) => {
      await createArmies(trx, shape);
      await createShares(trx, shape);
      for (const table of listTables) {
        await copyInto(trx, table);
      }
      await createIndexes(trx);
      await afterRebuild(trx);
      const { rows } = await sql`pragma foreign_key_check`.execute(trx);
      if (rows.length > 0) {
        throw new Error('rebuilding the list tables broke a foreign key');
      }
    });
  } finally {
    await sql`pragma foreign_keys = on`.execute(db);
  }
};

export const up = async (db: Kysely<unknown>) =>
  rebuildListTables(db, 'withGame', async (trx) => {
    for (const table of listTables) {
      await createTriumphArmyListTriggers(trx, table);
    }
  });

const listsOfOtherGames = async (db: Kysely<unknown>) => {
  const { rows } = await sql<{
    lists: number;
  }>`select (select count(*) from armies where game <> 'triumph') + (select count(*) from shares where game <> 'triumph') as lists`.execute(
    db,
  );
  return Number(rows[0]?.lists ?? 0);
};

export const down = async (db: Kysely<unknown>) => {
  const others = await listsOfOtherGames(db);
  if (others > 0) {
    throw new Error(
      `cannot roll back 012-list-game: ${others} saved or shared lists belong to a game other than Triumph! and have no army list to keep; restore the backup taken before the deploy instead`,
    );
  }
  await rebuildListTables(db, 'triumphOnly');
};
