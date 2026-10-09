import { createHash } from 'node:crypto';
import type { Kysely } from 'kysely';
import {
  type SelectionInput,
  withGame,
} from '../domain/army/selection-schema.ts';
import { encodeShareCode } from '../domain/army/share-codec.ts';
import {
  type SharedGameList,
  shareIdLength,
} from '../domain/army/shared-list.ts';
import { listColumns, storedList } from './list-columns.ts';
import type { Database, Share } from './schema.ts';

export type ShareContent = SelectionInput & {
  name: string;
};

export type NewShareRecord = ShareContent & {
  userId: string;
  at: string;
};

export const shareId = ({ name, ...list }: ShareContent) =>
  createHash('sha256')
    .update(`${name}\n${encodeShareCode(withGame(list))}`)
    .digest('base64url')
    .slice(0, shareIdLength);

export const toSharedList = (row: Share): SharedGameList => ({
  id: row.id,
  name: row.name,
  ...storedList(row),
  dataVersion: row.data_version,
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
  { userId, at, ...content }: NewShareRecord,
): Promise<SharedGameList> => {
  const id = shareId(content);
  const { name, ...list } = content;
  await db
    .insertInto('shares')
    .values({
      id,
      user_id: userId,
      name,
      ...listColumns(list),
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
