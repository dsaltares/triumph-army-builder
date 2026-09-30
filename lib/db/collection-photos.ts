import type { Kysely } from 'kysely';
import type { CollectionPhotoRow, Database } from './schema.ts';

export type CollectionPhoto = {
  id: string;
  entryId: string;
  position: number;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
};

export type NewCollectionPhotoRecord = {
  id: string;
  entryId: string;
  userId: string;
  position: number;
  width: number;
  height: number;
  bytes: number;
  at: string;
};

export type CollectionPhotoOwner = { id: string; userId: string };

export type CollectionEntryPhotos = { entryId: string; userId: string };

export type PhotoQuota = { perEntry: number; perAccount: number };

export type PhotoQuotaRefusal = 'noSuchEntry' | 'entryFull' | 'accountFull';

export type PhotoSlot =
  | { open: true; position: number }
  | { open: false; refusal: PhotoQuotaRefusal };

export type PhotoPlacement =
  | { placed: true; photo: CollectionPhoto }
  | { placed: false; refusal: PhotoQuotaRefusal };

export const toCollectionPhoto = (
  row: CollectionPhotoRow,
): CollectionPhoto => ({
  id: row.id,
  entryId: row.entry_id,
  position: row.position,
  width: row.width,
  height: row.height,
  bytes: row.bytes,
  createdAt: row.created_at,
});

export const insertCollectionPhoto = (
  db: Kysely<Database>,
  { id, entryId, userId, at, ...rest }: NewCollectionPhotoRecord,
) =>
  db
    .insertInto('collection_photos')
    .values({
      id,
      entry_id: entryId,
      user_id: userId,
      created_at: at,
      ...rest,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

const refuseSlot = (refusal: PhotoQuotaRefusal): PhotoSlot => ({
  open: false,
  refusal,
});

export const findPhotoSlot = async (
  db: Kysely<Database>,
  { entryId, userId }: CollectionEntryPhotos,
  quota: PhotoQuota,
): Promise<PhotoSlot> => {
  const entry = await db
    .selectFrom('collection_entries')
    .select('id')
    .where('id', '=', entryId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!entry) {
    return refuseSlot('noSuchEntry');
  }
  const onEntry = await db
    .selectFrom('collection_photos')
    .select((eb) => [
      eb.fn.countAll<number>().as('photos'),
      eb.fn.max('position').as('last'),
    ])
    .where('entry_id', '=', entry.id)
    .executeTakeFirstOrThrow();
  if (onEntry.photos >= quota.perEntry) {
    return refuseSlot('entryFull');
  }
  const onAccount = await db
    .selectFrom('collection_photos')
    .select((eb) => eb.fn.countAll<number>().as('photos'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
  if (onAccount.photos >= quota.perAccount) {
    return refuseSlot('accountFull');
  }
  return { open: true, position: (onEntry.last ?? -1) + 1 };
};

export const placeCollectionPhoto = (
  db: Kysely<Database>,
  record: Omit<NewCollectionPhotoRecord, 'position'>,
  quota: PhotoQuota,
  alongside: (trx: Kysely<Database>) => Promise<void> = async () => {},
) =>
  db.transaction().execute(async (trx): Promise<PhotoPlacement> => {
    const slot = await findPhotoSlot(trx, record, quota);
    if (!slot.open) {
      return { placed: false, refusal: slot.refusal };
    }
    const row = await insertCollectionPhoto(trx, {
      ...record,
      position: slot.position,
    });
    await alongside(trx);
    return { placed: true, photo: toCollectionPhoto(row) };
  });

export const listCollectionPhotos = async (
  db: Kysely<Database>,
  { entryId, userId }: CollectionEntryPhotos,
) =>
  (
    await db
      .selectFrom('collection_photos')
      .selectAll()
      .where('entry_id', '=', entryId)
      .where('user_id', '=', userId)
      .orderBy('position')
      .execute()
  ).map(toCollectionPhoto);

export const findCollectionPhoto = async (
  db: Kysely<Database>,
  { id, userId }: CollectionPhotoOwner,
) => {
  const row = await db
    .selectFrom('collection_photos')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return row ? toCollectionPhoto(row) : null;
};

export const deleteCollectionPhoto = async (
  db: Kysely<Database>,
  { id, userId }: CollectionPhotoOwner,
) => {
  const { numDeletedRows } = await db
    .deleteFrom('collection_photos')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return numDeletedRows > 0n;
};

const sameMembers = (left: readonly string[], right: readonly string[]) => {
  const members = new Set(left);
  return (
    members.size === left.length &&
    left.length === right.length &&
    right.every((id) => members.has(id))
  );
};

export const reorderCollectionPhotos = (
  db: Kysely<Database>,
  { entryId, userId }: CollectionEntryPhotos,
  ids: readonly string[],
) =>
  db.transaction().execute(async (trx) => {
    const current = await listCollectionPhotos(trx, { entryId, userId });
    if (
      !sameMembers(
        ids,
        current.map(({ id }) => id),
      )
    ) {
      return false;
    }
    for (const [position, id] of ids.entries()) {
      await trx
        .updateTable('collection_photos')
        .set({ position })
        .where('id', '=', id)
        .where('entry_id', '=', entryId)
        .where('user_id', '=', userId)
        .execute();
    }
    return true;
  });

export const collectionPhotoIds = async (db: Kysely<Database>) =>
  new Set(
    (await db.selectFrom('collection_photos').select('id').execute()).map(
      ({ id }) => id,
    ),
  );

export const deleteCollectionPhotosById = async (
  db: Kysely<Database>,
  ids: readonly string[],
) => {
  if (ids.length === 0) {
    return 0;
  }
  const { numDeletedRows } = await db
    .deleteFrom('collection_photos')
    .where('id', 'in', ids)
    .executeTakeFirst();
  return Number(numDeletedRows);
};

export type CollectionPhotoCovers = {
  onAccount: number;
  covers: Record<string, string>;
};

export const collectionPhotoCovers = async (
  db: Kysely<Database>,
  userId: string,
): Promise<CollectionPhotoCovers> => {
  const rows = await db
    .selectFrom('collection_photos')
    .select(['id', 'entry_id', 'position'])
    .where('user_id', '=', userId)
    .execute();
  const firsts = new Map<string, { id: string; position: number }>();
  for (const { id, entry_id, position } of rows) {
    const first = firsts.get(entry_id);
    if (!first || position < first.position) {
      firsts.set(entry_id, { id, position });
    }
  }
  return {
    onAccount: rows.length,
    covers: Object.fromEntries(
      [...firsts].map(([entryId, { id }]) => [entryId, id]),
    ),
  };
};
