import { type Kysely, sql } from 'kysely';

const createKindTriggers = async (db: Kysely<unknown>) => {
  for (const [event, when] of [
    ['insert', 'insert'],
    ['update', 'update of kind, troop_type, games'],
  ] as const) {
    await sql`create trigger ${sql.raw(`collection_entries_kind_on_${event}`)} before ${sql.raw(when)} on collection_entries begin
      select raise(abort, 'collection entry is stands or a hero') where new.kind not in ('stands', 'hero');
      select raise(abort, 'collection entry needs a troop type') where new.kind = 'stands' and (new.troop_type is null or new.troop_type = '');
      select raise(abort, 'a hero has no troop type') where new.kind = 'hero' and new.troop_type is not null;
      select raise(abort, 'collection entry belongs to at least one game') where not json_valid(new.games) or json_type(new.games) <> 'array' or json_array_length(new.games) = 0 or exists (select 1 from json_each(new.games) where value not in ('triumph', 'fantasy'));
      select raise(abort, 'a hero belongs to Fantasy Triumph alone') where new.kind = 'hero' and exists (select 1 from json_each(new.games) where value <> 'fantasy');
    end`.execute(db);
  }
};

const createSingleTroopTypeTriggers = async (db: Kysely<unknown>) => {
  await sql`create trigger collection_entries_troop_type_on_insert before insert on collection_entries when new.troop_type is null or new.troop_type = '' begin select raise(abort, 'collection entry needs a troop type'); end`.execute(
    db,
  );
  await sql`create trigger collection_entries_troop_type_on_update before update of troop_type on collection_entries when new.troop_type is null or new.troop_type = '' begin select raise(abort, 'collection entry needs a troop type'); end`.execute(
    db,
  );
};

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .alterTable('collection_entries')
    .addColumn('kind', 'text', (col) => col.notNull().defaultTo('stands'))
    .execute();
  await db.schema
    .alterTable('collection_entries')
    .addColumn('games', 'text', (col) => col.notNull().defaultTo('["triumph"]'))
    .execute();
  await sql`drop trigger collection_entries_troop_type_on_insert`.execute(db);
  await sql`drop trigger collection_entries_troop_type_on_update`.execute(db);
  await createKindTriggers(db);
};

const entriesBeyondTriumph = async (db: Kysely<unknown>) => {
  const { rows } = await sql<{
    entries: number;
  }>`select count(*) as entries from collection_entries where kind <> 'stands' or games <> '["triumph"]'`.execute(
    db,
  );
  return Number(rows[0]?.entries ?? 0);
};

export const down = async (db: Kysely<unknown>) => {
  const beyond = await entriesBeyondTriumph(db);
  if (beyond > 0) {
    throw new Error(
      `cannot roll back 013-entry-kind-and-games: ${beyond} collection entries are heroes or belong to a game other than Triumph! alone, which the schema before it cannot hold; restore the backup taken before the deploy instead`,
    );
  }
  await sql`drop trigger collection_entries_kind_on_insert`.execute(db);
  await sql`drop trigger collection_entries_kind_on_update`.execute(db);
  await createSingleTroopTypeTriggers(db);
  await db.schema
    .alterTable('collection_entries')
    .dropColumn('games')
    .execute();
  await db.schema.alterTable('collection_entries').dropColumn('kind').execute();
};
