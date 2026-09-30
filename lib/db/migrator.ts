import type { Kysely } from 'kysely';
import { type Migration, Migrator } from 'kysely/migration';
import { getDatabase } from './client.ts';
import * as initialSchema from './migrations/001-initial-schema.ts';
import * as queryPlanIndexes from './migrations/002-query-plan-indexes.ts';
import * as sharedLists from './migrations/003-shared-lists.ts';
import * as shareLastSeen from './migrations/004-share-last-seen.ts';
import * as userLocale from './migrations/005-user-locale.ts';
import * as collectionEntries from './migrations/006-collection-entries.ts';
import * as collectionPhotos from './migrations/007-collection-photos.ts';
import * as armyCollectionPins from './migrations/008-army-collection-pins.ts';
import * as singleTroopType from './migrations/009-single-troop-type.ts';
import * as referenceData from './migrations/010-reference-data.ts';
import * as activityEvents from './migrations/011-activity-events.ts';
import type { Database } from './schema.ts';

const migrations: Record<string, Migration> = {
  '001-initial-schema': initialSchema,
  '002-query-plan-indexes': queryPlanIndexes,
  '003-shared-lists': sharedLists,
  '004-share-last-seen': shareLastSeen,
  '005-user-locale': userLocale,
  '006-collection-entries': collectionEntries,
  '007-collection-photos': collectionPhotos,
  '008-army-collection-pins': armyCollectionPins,
  '009-single-troop-type': singleTroopType,
  '010-reference-data': referenceData,
  '011-activity-events': activityEvents,
};

const createMigrator = (db: Kysely<Database> = getDatabase()) =>
  new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });

export const migrateToLatest = async (db?: Kysely<Database>) => {
  const { error, results } = await createMigrator(db).migrateToLatest();
  if (error) {
    throw error;
  }
  return (results ?? []).map(({ migrationName }) => migrationName);
};

export const migrateDown = async (db?: Kysely<Database>) => {
  const { error, results } = await createMigrator(db).migrateDown();
  if (error) {
    throw error;
  }
  return (results ?? []).map(({ migrationName }) => migrationName);
};
