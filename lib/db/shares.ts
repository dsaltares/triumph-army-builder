import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import type { ArmySelection } from '../domain/army/selection.ts';
import { selectionSchema } from '../domain/army/selection-schema.ts';
import { encodeSelection } from '../domain/army/share-codec.ts';
import { type SharedList, shareIdLength } from '../domain/army/shared-list.ts';
import type { Database, Share } from './schema.ts';

export type ShareContent = {
  name: string;
  selection: ArmySelection;
};

export type NewShareRecord = ShareContent & {
  userId: string;
  at: string;
};

export const shareId = ({ name, selection }: ShareContent) =>
  createHash('sha256')
    .update(`${name}\n${encodeSelection(selection)}`)
    .digest('base64url')
    .slice(0, shareIdLength);

export const toSharedList = (row: Share): SharedList => ({
  id: row.id,
  name: row.name,
  armyListId: row.army_list_id,
  dataVersion: row.data_version,
  selection: selectionSchema.parse(JSON.parse(row.selection)),
  createdAt: row.created_at,
});

const sharedCopy = (db: Kysely<Database>) =>
  db.selectFrom('shares').selectAll();

export const findShare = async (db: Kysely<Database>, id: string) => {
  const row = await sharedCopy(db).where('id', '=', id).executeTakeFirst();
  return row ? toSharedList(row) : null;
};

export const listAllShares = async (db: Kysely<Database>) =>
  (await sharedCopy(db).orderBy('id').execute()).map(toSharedList);

export const countShares = async (db: Kysely<Database>, userId: string) =>
  Number(
    (
      await db
        .selectFrom('shares')
        .select(({ fn }) => fn.countAll<number>().as('shared'))
        .where('user_id', '=', userId)
        .executeTakeFirstOrThrow()
    ).shared,
  );

export const insertShare = async (
  db: Kysely<Database>,
  { userId, name, selection, at }: NewShareRecord,
): Promise<SharedList> => {
  const id = shareId({ name, selection });
  await db
    .insertInto('shares')
    .values({
      id,
      user_id: userId,
      name,
      army_list_id: selection.army,
      selection: JSON.stringify(selection),
      data_version: selection.dataVersion,
      created_at: at,
      last_seen_at: at,
    })
    .onConflict((conflict) => conflict.column('id').doNothing())
    .execute();
  return toSharedList(
    await sharedCopy(db).where('id', '=', id).executeTakeFirstOrThrow(),
  );
};

export const reassignShares = async (
  db: Kysely<Database>,
  { from, to }: { from: string; to: string },
) =>
  Number(
    (
      await db
        .updateTable('shares')
        .set({ user_id: to })
        .where('user_id', '=', from)
        .executeTakeFirst()
    ).numUpdatedRows,
  );

export const touchShare = async (
  db: Kysely<Database>,
  { id, at, staleBefore }: { id: string; at: string; staleBefore: string },
) => {
  const { numUpdatedRows } = await db
    .updateTable('shares')
    .set({ last_seen_at: at })
    .where('id', '=', id)
    .where('last_seen_at', '<', staleBefore)
    .executeTakeFirst();
  return numUpdatedRows > 0n;
};

export const deleteUnseenShares = async (
  db: Kysely<Database>,
  { unseenBefore }: { unseenBefore: string },
) => {
  const { numDeletedRows } = await db
    .deleteFrom('shares')
    .where('last_seen_at', '<', unseenBefore)
    .executeTakeFirst();
  return Number(numDeletedRows);
};
