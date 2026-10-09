import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from './client';
import { migrateDown, migrateToLatest } from './migrator';
import type { Database } from './schema';

let db: ReturnType<typeof createDatabase>;

beforeEach(() => {
  db = createDatabase(':memory:');
});

afterEach(async () => {
  await db.destroy();
});

const isOurs = (name: string) => !name.startsWith('kysely_');

const tableNames = async () => {
  const tables = await db.introspection.getTables();
  return tables
    .map(({ name }) => name)
    .filter(isOurs)
    .sort();
};

const indexesFromInitialSchema = [
  'accounts_user_id',
  'armies_user_id_updated_at',
  'sessions_user_id',
  'verifications_identifier',
];

const indexNames = async () =>
  (
    await sql<{
      name: string;
    }>`select name from sqlite_master where type = 'index' and name not like 'sqlite_%'`.execute(
      db,
    )
  ).rows
    .map(({ name }) => name)
    .filter(isOurs)
    .sort();

const columnNames = async (table: keyof Database) => {
  const tables = await db.introspection.getTables();
  return (tables.find(({ name }) => name === table)?.columns ?? [])
    .map(({ name }) => name)
    .sort();
};

describe('migrations', () => {
  it('creates every table the app and Better Auth need', async () => {
    await migrateToLatest(db);

    expect(await tableNames()).toEqual([
      'accounts',
      'activity_events',
      'armies',
      'army_collection_pins',
      'collection_entries',
      'collection_photos',
      'reference_current',
      'reference_documents',
      'reference_versions',
      'sessions',
      'shares',
      'users',
      'verifications',
    ]);
  });

  it('gives users the columns Better Auth and the anonymous plugin write', async () => {
    await migrateToLatest(db);

    expect(await columnNames('users')).toEqual([
      'createdAt',
      'email',
      'emailVerified',
      'id',
      'image',
      'isAnonymous',
      'locale',
      'name',
      'updatedAt',
    ]);
  });

  it('gives sessions the columns Better Auth writes', async () => {
    await migrateToLatest(db);

    expect(await columnNames('sessions')).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'ipAddress',
      'token',
      'updatedAt',
      'userAgent',
      'userId',
    ]);
  });

  it('gives accounts the columns Better Auth writes', async () => {
    await migrateToLatest(db);

    expect(await columnNames('accounts')).toEqual([
      'accessToken',
      'accessTokenExpiresAt',
      'accountId',
      'createdAt',
      'id',
      'idToken',
      'password',
      'providerId',
      'refreshToken',
      'refreshTokenExpiresAt',
      'scope',
      'updatedAt',
      'userId',
    ]);
  });

  it('gives verifications the columns Better Auth writes', async () => {
    await migrateToLatest(db);

    expect(await columnNames('verifications')).toEqual([
      'createdAt',
      'expiresAt',
      'id',
      'identifier',
      'updatedAt',
      'value',
    ]);
  });

  it('gives armies an owner, a list reference, a selection and a data version', async () => {
    await migrateToLatest(db);

    expect(await columnNames('armies')).toEqual([
      'army_list_id',
      'created_at',
      'data_version',
      'game',
      'id',
      'name',
      'selection',
      'updated_at',
      'user_id',
    ]);
  });

  it('gives shares a copy of the list, and an author it can outlive', async () => {
    await migrateToLatest(db);

    expect(await columnNames('shares')).toEqual([
      'army_list_id',
      'created_at',
      'data_version',
      'game',
      'id',
      'last_seen_at',
      'name',
      'selection',
      'user_id',
    ]);
  });

  it('gives collection entries an owner, a batch of stands and what they are', async () => {
    await migrateToLatest(db);

    expect(await columnNames('collection_entries')).toEqual([
      'count',
      'created_at',
      'id',
      'name',
      'notes',
      'status',
      'tags',
      'troop_type',
      'updated_at',
      'user_id',
    ]);
  });

  it('gives collection photos an entry, an owner, an order and a size', async () => {
    await migrateToLatest(db);

    expect(await columnNames('collection_photos')).toEqual([
      'bytes',
      'created_at',
      'entry_id',
      'height',
      'id',
      'position',
      'user_id',
      'width',
    ]);
  });

  it('pins an entry to one troop type of one troop option in one army', async () => {
    await migrateToLatest(db);

    expect(await columnNames('army_collection_pins')).toEqual([
      'army_id',
      'count',
      'entry_id',
      'troop_option',
      'troop_type',
    ]);
  });

  it('gives activity events a kind, a player, a subject, props and where they came from', async () => {
    await migrateToLatest(db);

    expect(await columnNames('activity_events')).toEqual([
      'city',
      'country',
      'id',
      'ip',
      'is_anonymous',
      'kind',
      'occurred_at',
      'props',
      'region',
      'subject_id',
      'user_id',
    ]);
  });

  it('keeps every imported version of the reference data, and one current', async () => {
    await migrateToLatest(db);

    expect(await columnNames('reference_versions')).toEqual([
      'built_at',
      'data_version',
      'imported_at',
      'source',
    ]);
    expect(await columnNames('reference_current')).toEqual([
      'data_version',
      'id',
    ]);
    expect(await columnNames('reference_documents')).toEqual([
      'body',
      'data_version',
      'locale',
      'path',
    ]);
  });

  it('holds at most one current reference version, and only an imported one', async () => {
    await migrateToLatest(db);
    await sql`insert into reference_versions (data_version, source, built_at, imported_at) values ('2026-09-17.a1b2c3d4', 'https://meshwesh.example.test', '2026-09-29T10:00:00.000Z', '2026-09-29T12:00:00.000Z')`.execute(
      db,
    );

    await expect(
      sql`insert into reference_current (id, data_version) values (1, '2026-10-01.0badf00d')`.execute(
        db,
      ),
    ).rejects.toThrow('FOREIGN KEY');
    await expect(
      sql`insert into reference_current (id, data_version) values (2, '2026-09-17.a1b2c3d4')`.execute(
        db,
      ),
    ).rejects.toThrow('CHECK');
  });

  it('applies nothing on a second run', async () => {
    expect(await migrateToLatest(db)).toEqual([
      '001-initial-schema',
      '002-query-plan-indexes',
      '003-shared-lists',
      '004-share-last-seen',
      '005-user-locale',
      '006-collection-entries',
      '007-collection-photos',
      '008-army-collection-pins',
      '009-single-troop-type',
      '010-reference-data',
      '011-activity-events',
      '012-list-game',
    ]);
    expect(await migrateToLatest(db)).toEqual([]);
  });

  it('rolls back one migration at a time', async () => {
    await migrateToLatest(db);

    expect(await migrateDown(db)).toEqual(['012-list-game']);
    expect(await columnNames('armies')).not.toContain('game');
    expect(await migrateDown(db)).toEqual(['011-activity-events']);
    expect(await tableNames()).not.toContain('activity_events');
    expect(await migrateDown(db)).toEqual(['010-reference-data']);
    expect(await tableNames()).not.toContain('reference_documents');
    expect(await migrateDown(db)).toEqual(['009-single-troop-type']);
    expect(await migrateDown(db)).toEqual(['008-army-collection-pins']);
    expect(await migrateDown(db)).toEqual(['007-collection-photos']);
    expect(await migrateDown(db)).toEqual(['006-collection-entries']);
    expect(await migrateDown(db)).toEqual(['005-user-locale']);
    expect(await migrateDown(db)).toEqual(['004-share-last-seen']);
    expect(await migrateDown(db)).toEqual(['003-shared-lists']);
    expect(await migrateDown(db)).toEqual(['002-query-plan-indexes']);
    expect(await indexNames()).toEqual(indexesFromInitialSchema);

    expect(await migrateDown(db)).toEqual(['001-initial-schema']);
    expect(await tableNames()).toEqual([]);
  });

  it('runs again after a rollback', async () => {
    await migrateToLatest(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);
    await migrateDown(db);

    expect(await migrateToLatest(db)).toEqual([
      '001-initial-schema',
      '002-query-plan-indexes',
      '003-shared-lists',
      '004-share-last-seen',
      '005-user-locale',
      '006-collection-entries',
      '007-collection-photos',
      '008-army-collection-pins',
      '009-single-troop-type',
      '010-reference-data',
      '011-activity-events',
      '012-list-game',
    ]);
    expect(await tableNames()).toHaveLength(13);
  });

  const migrateDownThrough = async (name: string) => {
    while (!(await migrateDown(db)).includes(name)) {}
  };

  describe('fielding an entry as a single troop type', () => {
    const seedFromBeforeSingleTroopType = async () => {
      await migrateToLatest(db);
      await migrateDownThrough('009-single-troop-type');
      await sql`insert into users (id, name, email) values ('user-1', 'Hannibal', 'hannibal@carthage.example')`.execute(
        db,
      );
      await sql`insert into armies (id, user_id, name, army_list_id, selection, data_version) values ('army-1', 'user-1', 'Cannae', '66c', '{}', '2026-09-17.a1b2c3d4')`.execute(
        db,
      );
      await sql`insert into collection_entries (id, user_id, name, count, troop_types, tags, status, notes) values ('entry-1', 'user-1', 'Hoplites', 8, '["HFT","SPR"]', '[]', 'painted', '')`.execute(
        db,
      );
      await sql`insert into army_collection_pins (army_id, troop_option, troop_type, entry_id, count) values ('army-1', 'main/0', 'HFT', 'entry-1', 4), ('army-1', 'main/1', 'SPR', 'entry-1', 4)`.execute(
        db,
      );
    };

    const troopTypeColumns = () =>
      sql<Record<string, string>>`select * from collection_entries`
        .execute(db)
        .then(({ rows }) =>
          rows.map((row) =>
            Object.fromEntries(
              Object.entries(row).filter(([column]) =>
                column.startsWith('troop_type'),
              ),
            ),
          ),
        );

    it('keeps the first troop type an entry fielded as', async () => {
      await seedFromBeforeSingleTroopType();

      expect(await migrateToLatest(db)).toEqual([
        '009-single-troop-type',
        '010-reference-data',
        '011-activity-events',
        '012-list-game',
      ]);

      expect(await troopTypeColumns()).toEqual([{ troop_type: 'HFT' }]);
    });

    it('drops the pins to a troop type the entry no longer fields as', async () => {
      await seedFromBeforeSingleTroopType();

      await migrateToLatest(db);

      expect(
        await db
          .selectFrom('army_collection_pins')
          .select(['troop_option', 'troop_type'])
          .execute(),
      ).toEqual([{ troop_option: 'main/0', troop_type: 'HFT' }]);
    });

    it('restores the troop type as a list of one on the way down', async () => {
      await seedFromBeforeSingleTroopType();
      await migrateToLatest(db);

      await migrateDownThrough('009-single-troop-type');

      expect(await troopTypeColumns()).toEqual([{ troop_types: '["HFT"]' }]);
    });
  });

  describe('giving every list a game', () => {
    const storedSelection =
      '{"army":"66c","dataVersion":"2026-09-17.a1b2c3d4"}';

    const seedFromBeforeListGame = async () => {
      await migrateToLatest(db);
      await migrateDownThrough('012-list-game');
      await sql`insert into users (id, name, email) values ('user-1', 'Hannibal', 'hannibal@carthage.example')`.execute(
        db,
      );
      await sql`insert into armies (id, user_id, name, army_list_id, selection, data_version) values ('army-1', 'user-1', 'Cannae', '66c', ${storedSelection}, '2026-09-17.a1b2c3d4')`.execute(
        db,
      );
      await sql`insert into shares (id, user_id, name, army_list_id, selection, data_version, last_seen_at) values ('share-1', 'user-1', 'Cannae', '66c', ${storedSelection}, '2026-09-17.a1b2c3d4', '2026-09-20T10:00:00.000Z')`.execute(
        db,
      );
      await sql`insert into collection_entries (id, user_id, name, count, troop_type, tags, status, notes) values ('entry-1', 'user-1', 'Hoplites', 8, 'SPR', '[]', 'painted', '')`.execute(
        db,
      );
      await sql`insert into army_collection_pins (army_id, troop_option, troop_type, entry_id, count) values ('army-1', 'main/0', 'SPR', 'entry-1', 4)`.execute(
        db,
      );
    };

    const insertList = (table: 'armies' | 'shares', game: string) =>
      table === 'armies'
        ? sql`insert into armies (id, user_id, name, game, army_list_id, selection, data_version) values ('army-2', 'user-1', 'Zama', ${game}, null, '{}', '2026-09-17.a1b2c3d4')`.execute(
            db,
          )
        : sql`insert into shares (id, user_id, name, game, army_list_id, selection, data_version, last_seen_at) values ('share-2', 'user-1', 'Zama', ${game}, null, '{}', '2026-09-17.a1b2c3d4', '2026-09-20T10:00:00.000Z')`.execute(
            db,
          );

    it('makes every list saved or shared before it a Triumph! list, its selection untouched', async () => {
      await seedFromBeforeListGame();

      await migrateToLatest(db);

      for (const table of ['armies', 'shares'] as const) {
        expect(
          await db
            .selectFrom(table)
            .select(['game', 'army_list_id', 'selection'])
            .execute(),
        ).toEqual([
          { game: 'triumph', army_list_id: '66c', selection: storedSelection },
        ]);
      }
    });

    const seedVariedLists = async () => {
      await sql`insert into users (id, name, email) values ('user-2', 'Scipio', 'scipio@rome.example')`.execute(
        db,
      );
      await sql`insert into armies (id, user_id, name, army_list_id, selection, data_version, created_at, updated_at) values ('army-3', 'user-2', 'Zama · 202 BC', '66d', '{"army":"66d","year":-202}', '2026-10-01.0badf00d', '2026-09-18T08:00:00.000Z', '2026-10-02T09:30:00.000Z')`.execute(
        db,
      );
      await sql`insert into shares (id, user_id, name, army_list_id, selection, data_version, created_at, last_seen_at) values ('share-3', null, 'Ilipa ✦ «copia»', '66d', '{"army":"66d"}', '2026-10-01.0badf00d', '2026-09-18T08:00:00.000Z', null)`.execute(
        db,
      );
    };

    const everyRow = async () => {
      const rows = async (table: string) =>
        (
          await sql<
            Record<string, unknown>
          >`select * from ${sql.table(table)} order by 1, 2, 3`.execute(db)
        ).rows;
      return {
        armies: await rows('armies'),
        shares: await rows('shares'),
        pins: await rows('army_collection_pins'),
        users: await rows('users'),
      };
    };

    const withoutGame = (rows: readonly Record<string, unknown>[]) =>
      rows.map(({ game: _game, ...row }) => row);

    it('keeps every column of every row, on the way up and back down', async () => {
      await seedFromBeforeListGame();
      await seedVariedLists();
      const before = await everyRow();

      await migrateToLatest(db);
      const migrated = await everyRow();

      expect({
        ...migrated,
        armies: withoutGame(migrated.armies),
        shares: withoutGame(migrated.shares),
      }).toEqual(before);
      expect(
        [...migrated.armies, ...migrated.shares].map(({ game }) => game),
      ).toEqual(['triumph', 'triumph', 'triumph', 'triumph']);

      await migrateDownThrough('012-list-game');

      expect(await everyRow()).toEqual(before);
    });

    it('leaves the foreign keys on, and pointing at the rebuilt tables', async () => {
      await seedFromBeforeListGame();
      await migrateToLatest(db);

      expect(
        (await sql<{ foreign_keys: number }>`pragma foreign_keys`.execute(db))
          .rows,
      ).toEqual([{ foreign_keys: 1 }]);
      await expect(
        sql`delete from users where id = 'user-1'`.execute(db),
      ).rejects.toThrow('FOREIGN KEY');
      await expect(
        sql`insert into armies (id, user_id, name, army_list_id, selection, data_version) values ('army-9', 'user-nobody', 'Zama', '66c', '{}', '2026-09-17.a1b2c3d4')`.execute(
          db,
        ),
      ).rejects.toThrow('FOREIGN KEY');
      await sql`delete from armies where id = 'army-1'`.execute(db);
      expect(
        await db.selectFrom('army_collection_pins').selectAll().execute(),
      ).toEqual([]);
      await sql`delete from armies`.execute(db);
      await sql`delete from users where id = 'user-1'`.execute(db);
      expect(await db.selectFrom('shares').select('user_id').execute()).toEqual(
        [{ user_id: null }],
      );
    });

    it('keeps the pins of every list it rebuilds', async () => {
      await seedFromBeforeListGame();

      await migrateToLatest(db);

      expect(
        await db.selectFrom('army_collection_pins').select('army_id').execute(),
      ).toEqual([{ army_id: 'army-1' }]);
    });

    it.each(['armies', 'shares'] as const)(
      'lets a list of another game in %s go without an army list, and never a Triumph! one',
      async (table) => {
        await seedFromBeforeListGame();
        await migrateToLatest(db);

        await expect(insertList(table, 'triumph')).rejects.toThrow(
          'a Triumph! list needs an army list',
        );
        await expect(
          db.updateTable(table).set({ army_list_id: null }).execute(),
        ).rejects.toThrow('a Triumph! list needs an army list');
        await expect(insertList(table, 'fantasy')).resolves.toBeDefined();
      },
    );

    it('restores the army list as mandatory on the way down', async () => {
      await seedFromBeforeListGame();
      await migrateToLatest(db);

      await migrateDownThrough('012-list-game');

      expect(await columnNames('armies')).not.toContain('game');
      expect(await columnNames('shares')).not.toContain('game');
      await expect(
        sql`insert into armies (id, user_id, name, army_list_id, selection, data_version) values ('army-2', 'user-1', 'Zama', null, '{}', '2026-09-17.a1b2c3d4')`.execute(
          db,
        ),
      ).rejects.toThrow('NOT NULL');
      expect(
        await db.selectFrom('army_collection_pins').select('army_id').execute(),
      ).toEqual([{ army_id: 'army-1' }]);
    });

    it.each(['armies', 'shares'] as const)(
      'refuses to roll back once %s holds a list of another game',
      async (table) => {
        await seedFromBeforeListGame();
        await migrateToLatest(db);
        await insertList(table, 'fantasy');

        await expect(migrateDown(db)).rejects.toThrow(
          'restore the backup taken before the deploy',
        );
        expect(await columnNames(table)).toContain('game');
      },
    );
  });

  it('adds the indexes the query plans justify', async () => {
    await migrateToLatest(db);

    expect(await indexNames()).toEqual(
      [
        ...indexesFromInitialSchema,
        'accounts_provider_id_account_id',
        'activity_events_kind_occurred_at_is_anonymous',
        'activity_events_occurred_at_is_anonymous_user_id',
        'army_collection_pins_entry_id',
        'collection_entries_user_id_updated_at',
        'collection_photos_entry_id_position',
        'collection_photos_user_id',
        'shares_last_seen_at',
        'shares_user_id',
        'verifications_expires_at',
      ].sort(),
    );
  });
});
