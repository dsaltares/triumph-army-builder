import type { Kysely } from 'kysely';
import { z } from 'zod';
import { troopTypeCodes } from '../data/schema.ts';
import {
  type CollectionEntry,
  collectionStatuses,
} from '../domain/collection/entry.ts';
import type { CollectionEntryRow, Database } from './schema.ts';

export type CollectionEntryOwner = { id: string; userId: string };

export type CollectionEntryContent = Omit<
  CollectionEntry,
  'id' | 'createdAt' | 'updatedAt'
>;

export type NewCollectionEntryRecord = CollectionEntryContent & {
  id: string;
  userId: string;
  at: string;
};

export type CollectionEntryChanges = {
  [Field in keyof CollectionEntryContent]?:
    | CollectionEntryContent[Field]
    | undefined;
};

const storedTroopTypeSchema = z.enum(troopTypeCodes);

const storedTagsSchema = z.array(z.string());

const storedStatusSchema = z.enum(collectionStatuses);

export const toCollectionEntry = (
  row: CollectionEntryRow,
): CollectionEntry => ({
  id: row.id,
  name: row.name,
  count: row.count,
  troopType: storedTroopTypeSchema.parse(row.troop_type),
  tags: storedTagsSchema.parse(JSON.parse(row.tags)),
  status: storedStatusSchema.parse(row.status),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const definedOnly = <Value extends object>(value: Value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<Value>;

const toColumns = ({ troopType, tags, ...rest }: CollectionEntryChanges) =>
  definedOnly({
    ...rest,
    troop_type: troopType,
    tags: tags && JSON.stringify(tags),
  });

export const listCollectionEntries = async (
  db: Kysely<Database>,
  userId: string,
) =>
  (
    await db
      .selectFrom('collection_entries')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .execute()
  ).map(toCollectionEntry);

export const findCollectionEntry = async (
  db: Kysely<Database>,
  { id, userId }: CollectionEntryOwner,
) => {
  const row = await db
    .selectFrom('collection_entries')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return row ? toCollectionEntry(row) : null;
};

export const insertCollectionEntry = async (
  db: Kysely<Database>,
  { id, userId, at, ...content }: NewCollectionEntryRecord,
) =>
  toCollectionEntry(
    await db
      .insertInto('collection_entries')
      .values({
        id,
        user_id: userId,
        name: content.name,
        count: content.count,
        troop_type: content.troopType,
        tags: JSON.stringify(content.tags),
        status: content.status,
        notes: content.notes,
        created_at: at,
        updated_at: at,
      })
      .returningAll()
      .executeTakeFirstOrThrow(),
  );

export const updateCollectionEntry = async (
  db: Kysely<Database>,
  { id, userId }: CollectionEntryOwner,
  changes: CollectionEntryChanges,
  at: string,
) => {
  const row = await db
    .updateTable('collection_entries')
    .set({ ...toColumns(changes), updated_at: at })
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .returningAll()
    .executeTakeFirst();
  return row ? toCollectionEntry(row) : null;
};

export const deleteCollectionEntry = async (
  db: Kysely<Database>,
  { id, userId }: CollectionEntryOwner,
) => {
  const { numDeletedRows } = await db
    .deleteFrom('collection_entries')
    .where('id', '=', id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return numDeletedRows > 0n;
};
