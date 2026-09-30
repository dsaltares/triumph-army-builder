import type { Kysely, Transaction } from 'kysely';
import {
  type BundleSource,
  documentBundleSource,
} from '../data/bundle-source.ts';
import type { ReferencePack } from '../data/reference-pack.ts';
import { type Locale, locales } from '../i18n/locales.ts';
import type { Database } from './schema.ts';

const currentRow = 1;

const documentsPerInsert = 200;

export type ReferenceImport = {
  dataVersion: string;
  imported: boolean;
};

const chunked = <Item>(items: readonly Item[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );

const setCurrentVersion = (
  db: Kysely<Database> | Transaction<Database>,
  dataVersion: string,
) =>
  db
    .insertInto('reference_current')
    .values({ id: currentRow, data_version: dataVersion })
    .onConflict((conflict) =>
      conflict.column('id').doUpdateSet({ data_version: dataVersion }),
    )
    .execute();

export const importReferencePack = (
  db: Kysely<Database>,
  pack: ReferencePack,
  { now }: { now: () => Date },
): Promise<ReferenceImport> =>
  db.transaction().execute(async (trx) => {
    const { dataVersion } = pack;
    const inserted = await trx
      .insertInto('reference_versions')
      .values({
        data_version: dataVersion,
        source: pack.source,
        built_at: pack.builtAt,
        imported_at: now().toISOString(),
      })
      .onConflict((conflict) => conflict.column('data_version').doNothing())
      .executeTakeFirst();
    if (Number(inserted.numInsertedOrUpdatedRows ?? 0) === 0) {
      return { dataVersion, imported: false };
    }
    const documents = locales.flatMap((locale) =>
      pack.locales[locale].map(({ path, contents }) => ({
        data_version: dataVersion,
        locale,
        path,
        body: JSON.stringify(contents),
      })),
    );
    for (const batch of chunked(documents, documentsPerInsert)) {
      await trx.insertInto('reference_documents').values(batch).execute();
    }
    await setCurrentVersion(trx, dataVersion);
    return { dataVersion, imported: true };
  });

export const makeReferenceCurrent = (
  db: Kysely<Database>,
  dataVersion: string,
) =>
  db.transaction().execute(async (trx) => {
    const known = await trx
      .selectFrom('reference_versions')
      .select('data_version')
      .where('data_version', '=', dataVersion)
      .executeTakeFirst();
    if (!known) {
      throw new Error(
        `Reference data ${dataVersion} has not been imported, so it cannot be made current.`,
      );
    }
    await setCurrentVersion(trx, dataVersion);
  });

export const hasReferenceVersion = async (
  db: Kysely<Database>,
  dataVersion: string,
) =>
  (await db
    .selectFrom('reference_versions')
    .select('data_version')
    .where('data_version', '=', dataVersion)
    .executeTakeFirst()) !== undefined;

export const currentReferenceVersion = async (db: Kysely<Database>) =>
  (
    await db
      .selectFrom('reference_current')
      .select('data_version')
      .where('id', '=', currentRow)
      .executeTakeFirst()
  )?.data_version ?? null;

const noCurrentVersion =
  'No reference data is current. Run `yarn db:import-reference <pack>` to import some.';

export const currentDataVersion = async (db: Kysely<Database>) => {
  const dataVersion = await currentReferenceVersion(db);
  if (dataVersion === null) {
    throw new Error(noCurrentVersion);
  }
  return dataVersion;
};

const versionSource = (
  db: Kysely<Database>,
  locale: Locale,
  dataVersion: string,
) =>
  documentBundleSource({
    read: async (path) =>
      (
        await db
          .selectFrom('reference_documents')
          .select('body')
          .where('data_version', '=', dataVersion)
          .where('locale', '=', locale)
          .where('path', '=', path)
          .executeTakeFirst()
      )?.body ?? null,
    missing: (path) =>
      `${path} is missing from reference data ${dataVersion} in ${locale}. Import a complete reference pack with \`yarn db:import-reference\`.`,
  });

export const databaseBundleSource = (
  db: Kysely<Database>,
  locale: Locale,
  version?: string,
): BundleSource => {
  if (version) {
    return versionSource(db, locale, version);
  }
  let memoised: { dataVersion: string; source: BundleSource } | null = null;
  const current = async () => {
    const dataVersion = await currentDataVersion(db);
    if (memoised?.dataVersion !== dataVersion) {
      memoised = {
        dataVersion,
        source: versionSource(db, locale, dataVersion),
      };
    }
    return memoised.source;
  };
  return {
    readArmyIndex: async () => (await current()).readArmyIndex(),
    readTroopTypes: async () => (await current()).readTroopTypes(),
    readBattleCards: async () => (await current()).readBattleCards(),
    readBattleCardText: async () => (await current()).readBattleCardText(),
    readThematicCategories: async () =>
      (await current()).readThematicCategories(),
    readTagWords: async () => (await current()).readTagWords(),
    readArmyDetail: async (id) => (await current()).readArmyDetail(id),
    readArmyDetails: async () => (await current()).readArmyDetails(),
  };
};
