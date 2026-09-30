import { readFile } from 'node:fs/promises';
import type { Kysely } from 'kysely';
import { type ArmyDetail, bundlePaths } from '@/lib/data/bundle.ts';
import {
  parseReferencePack,
  type ReferencePack,
} from '@/lib/data/reference-pack.ts';
import { importReferencePack } from '@/lib/db/reference.ts';
import type { Database } from '@/lib/db/schema.ts';
import { buildArmyList } from '@/lib/domain/army/army-list.ts';
import {
  type ArmySelection,
  emptySelection,
  withStands,
} from '@/lib/domain/army/selection.ts';
import { type Locale, locales } from '@/lib/i18n/locales.ts';
import { samplePackPath } from '@/test/sample.ts';

const seededAt = new Date('2026-09-29T10:00:00.000Z');

export const samplePack = async (): Promise<ReferencePack> =>
  parseReferencePack(JSON.parse(await readFile(samplePackPath, 'utf8')));

export const seedReference = async (
  db: Kysely<Database>,
  pack?: ReferencePack,
) =>
  importReferencePack(db, pack ?? (await samplePack()), {
    now: () => seededAt,
  });

export type BundleFiles = Readonly<Record<string, unknown>>;

const bundleFiles = (files: BundleFiles) =>
  Object.entries(files).map(([path, contents]) => ({
    path,
    eager: path === bundlePaths.index,
    contents,
  }));

export const seedDataVersion = (
  db: Kysely<Database>,
  dataVersion: string,
  files: BundleFiles = {},
  translated: Partial<Record<Locale, BundleFiles>> = {},
) =>
  seedReference(db, {
    dataVersion,
    source: 'https://example.test/reference',
    builtAt: seededAt.toISOString(),
    locales: Object.fromEntries(
      locales.map((locale) => [
        locale,
        bundleFiles({ ...files, ...translated[locale] }),
      ]),
    ) as ReferencePack['locales'],
  });

export const renamedArmyIndex = (
  pack: ReferencePack,
  dataVersion: string,
  firstArmyName: string,
): ReferencePack => ({
  ...pack,
  dataVersion,
  locales: Object.fromEntries(
    locales.map((locale) => [
      locale,
      pack.locales[locale].map((file) => {
        if (file.path !== bundlePaths.index) {
          return file;
        }
        const index = file.contents as { armies: { name: string }[] };
        return {
          ...file,
          contents: {
            ...index,
            armies: index.armies.map((army, position) =>
              position === 0 ? { ...army, name: firstArmyName } : army,
            ),
          },
        };
      }),
    ]),
  ) as ReferencePack['locales'],
});

export const packArmySelection = (pack: ReferencePack): ArmySelection => {
  const detail = pack.locales.en.find(({ path }) => path.startsWith('armies/'))
    ?.contents as ArmyDetail | undefined;
  if (!detail) {
    throw new Error('the reference pack has no army lists');
  }
  const list = buildArmyList(detail);
  const option = list.main.troopOptions[0];
  if (!option) {
    throw new Error(`${list.id} has no troop options`);
  }
  return withStands(
    emptySelection({
      army: list.id,
      dataVersion: pack.dataVersion,
      year: list.dateRange.startDate,
    }),
    option,
    option.troopEntries[0].troopType,
    Math.max(option.min, 1),
  );
};
