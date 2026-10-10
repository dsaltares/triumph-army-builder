import type { Kysely } from 'kysely';
import { z } from 'zod';
import {
  type Game,
  games,
  type TroopTypeCode,
  troopTypeCodes,
} from '../data/schema.ts';
import {
  type CollectionEntry,
  type CollectionEntryKind,
  type CollectionStatus,
  collectionEntryKinds,
  collectionStatuses,
  defaultGamesOf,
  heroGames,
} from '../domain/collection/entry.ts';
import type { CollectionEntryRow, Database } from './schema.ts';

export type CollectionEntryOwner = { id: string; userId: string };

export type CollectionEntryContent = {
  kind?: CollectionEntryKind | undefined;
  name: string;
  count: number;
  troopType: TroopTypeCode | null;
  tags: string[];
  games?: Game[] | undefined;
  status: CollectionStatus;
  notes: string;
};

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

const storedKindSchema = z.enum(collectionEntryKinds);

const storedTroopTypeSchema = z.enum(troopTypeCodes);

const storedTagsSchema = z.array(z.string());

const storedStatusSchema = z.enum(collectionStatuses);

const storedGamesSchema = z.array(z.enum(games)).min(1);

export const toCollectionEntry = (row: CollectionEntryRow): CollectionEntry => {
  const fields = {
    id: row.id,
    name: row.name,
    count: row.count,
    tags: storedTagsSchema.parse(JSON.parse(row.tags)),
    games: storedGamesSchema.parse(JSON.parse(row.games)),
    status: storedStatusSchema.parse(row.status),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return storedKindSchema.parse(row.kind) === 'hero'
    ? { ...fields, kind: 'hero' }
    : {
        ...fields,
        kind: 'stands',
        troopType: storedTroopTypeSchema.parse(row.troop_type),
      };
};

const definedOnly = <Value extends object>(value: Value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<Value>;

const kindOf = ({ kind, troopType }: CollectionEntryChanges) =>
  kind ?? (troopType ? 'stands' : undefined);

const troopTypeOf = (changes: CollectionEntryChanges) =>
  kindOf(changes) === 'hero' ? null : changes.troopType;

const gamesOf = (changes: CollectionEntryChanges) =>
  changes.games ?? (kindOf(changes) === 'hero' ? heroGames : undefined);

const toColumns = (changes: CollectionEntryChanges) => {
  const {
    kind: _kind,
    troopType: _troopType,
    tags,
    games: _games,
    ...rest
  } = changes;
  const games = gamesOf(changes);
  return definedOnly({
    ...rest,
    kind: kindOf(changes),
    troop_type: troopTypeOf(changes),
    tags: tags && JSON.stringify(tags),
    games: games && JSON.stringify(games),
  });
};

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
        kind: content.kind ?? 'stands',
        troop_type: troopTypeOf(content),
        tags: JSON.stringify(content.tags),
        games: JSON.stringify(content.games ?? defaultGamesOf(content.kind)),
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
