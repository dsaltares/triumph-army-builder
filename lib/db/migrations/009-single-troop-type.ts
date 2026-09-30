import { type Kysely, sql } from 'kysely';

export const up = async (db: Kysely<unknown>) => {
  await db.schema
    .alterTable('collection_entries')
    .addColumn('troop_type', 'text')
    .execute();
  await sql`update collection_entries set troop_type = json_extract(troop_types, '$[0]')`.execute(
    db,
  );
  await sql`delete from army_collection_pins where troop_type <> (select troop_type from collection_entries where collection_entries.id = army_collection_pins.entry_id)`.execute(
    db,
  );
  await db.schema
    .alterTable('collection_entries')
    .dropColumn('troop_types')
    .execute();
  await sql`create trigger collection_entries_troop_type_on_insert before insert on collection_entries when new.troop_type is null or new.troop_type = '' begin select raise(abort, 'collection entry needs a troop type'); end`.execute(
    db,
  );
  await sql`create trigger collection_entries_troop_type_on_update before update of troop_type on collection_entries when new.troop_type is null or new.troop_type = '' begin select raise(abort, 'collection entry needs a troop type'); end`.execute(
    db,
  );
};

export const down = async (db: Kysely<unknown>) => {
  await sql`drop trigger collection_entries_troop_type_on_insert`.execute(db);
  await sql`drop trigger collection_entries_troop_type_on_update`.execute(db);
  await db.schema
    .alterTable('collection_entries')
    .addColumn('troop_types', 'text')
    .execute();
  await sql`update collection_entries set troop_types = json_array(troop_type)`.execute(
    db,
  );
  await db.schema
    .alterTable('collection_entries')
    .dropColumn('troop_type')
    .execute();
};
