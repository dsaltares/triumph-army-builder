import type { Kysely } from 'kysely';
import type { SavedArmy } from '../domain/army/saved-army.ts';
import type {
  SavedSelection,
  SelectionInput,
} from '../domain/army/selection-schema.ts';
import { listColumns, selectionColumns, storedList } from './list-columns.ts';
import type { Army, Database } from './schema.ts';

export type ArmyOwner = { id: string; userId: string };

export type NewArmyRecord = SelectionInput & {
  id: string;
  userId: string;
  name: string;
  at: string;
};

export type ArmyChanges = {
  name?: string | undefined;
  list?: SavedSelection | undefined;
};

export const toSavedArmy = (row: Army): SavedArmy => ({
  id: row.id,
  name: row.name,
  ...storedList(row),
  dataVersion: row.data_version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const countArmies = async (db: Kysely<Database>, userId: string) =>
  Number(
    (
      await db
        .selectFrom('armies')
        .select(({ fn }) => fn.countAll<number>().as('owned'))
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow()
    ).owned,
  );

export const listArmies = async (db: Kysely<Database>, userId: string) =>
  (
    await db
      .selectFrom('armies')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .execute()
  ).map(toSavedArmy);

export const listAllArmies = async (db: Kysely<Database>) =>
  (await db.selectFrom('armies').selectAll().orderBy('id').execute()).map(
    toSavedArmy,
  );

export const findArmy = async (
  db: Kysely<Database>,
  { id, userId }: ArmyOwner,
) => {
  const row = await db
    .selectFrom('armies')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return row ? toSavedArmy(row) : null;
};

export const insertArmy = async (
  db: Kysely<Database>,
  { id, userId, name, at, ...list }: NewArmyRecord,
) =>
  toSavedArmy(
    await db
      .insertInto('armies')
      .values({
        id,
        user_id: userId,
        name,
        ...listColumns(list),
        created_at: at,
        updated_at: at,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
  );

export const updateArmy = async (
  db: Kysely<Database>,
  { id, userId }: ArmyOwner,
  changes: ArmyChanges,
  at: string,
) => {
  const owned = db
    .updateTable('armies')
    .set({
      ...(changes.name === undefined ? {} : { name: changes.name }),
      ...(changes.list === undefined ? {} : selectionColumns(changes.list)),
      updated_at: at,
    })
    .where('id', '=', id)
    .where('user_id', '=', userId);
  const row = await (changes.list
    ? owned.where('game', '=', changes.list.game)
    : owned
  )
    .returningAll()
    .executeTakeFirst();
  return row ? toSavedArmy(row) : null;
};

export const deleteArmy = async (
  db: Kysely<Database>,
  { id, userId }: ArmyOwner,
) => {
  const { numDeletedRows } = await db
    .deleteFrom('armies')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return numDeletedRows > 0n;
};

export const deleteArmies = async (
  db: Kysely<Database>,
  { ids, userId }: { ids: readonly string[]; userId: string },
) => {
  if (ids.length === 0) {
    return [];
  }
  return (
    await db
      .deleteFrom('armies')
      .where('user_id', '=', userId)
      .where('id', 'in', ids)
      .returning('id')
      .execute()
  ).map(({ id }) => id);
};

export const reassignArmies = async (
  db: Kysely<Database>,
  { from, to }: { from: string; to: string },
) =>
  (
    await db
      .updateTable('armies')
      .set({ user_id: to })
      .where('user_id', '=', from)
      .returning('id')
      .execute()
  ).map(({ id }) => id);
