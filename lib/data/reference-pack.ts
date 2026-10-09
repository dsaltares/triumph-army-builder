import { gunzipSync, gzipSync } from 'node:zlib';
import { z } from 'zod';
import { type Locale, locales } from '../i18n/locales.ts';
import { type BundleFile, buildBundle, bundlePaths } from './bundle.ts';
import {
  armyDetailSchema,
  armyIndexSchema,
  battleCardTextSchema,
  bundledBattleCardsSchema,
  bundledFantasyCardsSchema,
  bundledTroopTypesSchema,
  fantasyCardTextSchema,
  tagWordsSchema,
} from './bundle-schema.ts';
import { type Curation, fantasyFormatSchema } from './curation-schema.ts';
import { manifestSchema, thematicCategorySchema } from './schema.ts';
import type { MeshweshSnapshot } from './snapshot.ts';
import { createTranslator, type TranslationCatalogue } from './translations.ts';
import { summarisedIssues } from './zod-issues.ts';

const armyPathPattern = /^armies\/[A-Za-z0-9_-]+\.json$/;

const sharedFileSchemas: Readonly<Record<string, z.ZodType>> = {
  [bundlePaths.index]: armyIndexSchema,
  [bundlePaths.troopTypes]: bundledTroopTypesSchema,
  [bundlePaths.battleCards]: bundledBattleCardsSchema,
  [bundlePaths.battleCardText]: battleCardTextSchema,
  [bundlePaths.thematicCategories]: thematicCategorySchema.array(),
  [bundlePaths.tagWords]: tagWordsSchema,
};

const requiredPaths = Object.keys(sharedFileSchemas);

const fantasyFileSchemas: Readonly<Record<string, z.ZodType>> = {
  [bundlePaths.fantasy.troopTypes]: bundledTroopTypesSchema,
  [bundlePaths.fantasy.battleCards]: bundledFantasyCardsSchema,
  [bundlePaths.fantasy.battleCardText]: fantasyCardTextSchema,
  [bundlePaths.fantasy.format]: fantasyFormatSchema,
};

const fantasyPaths = Object.keys(fantasyFileSchemas);

const contentsSchemaFor = (path: string) =>
  sharedFileSchemas[path] ??
  fantasyFileSchemas[path] ??
  (armyPathPattern.test(path) ? armyDetailSchema : undefined);

const bundleFileSchema: z.ZodType<BundleFile> = z
  .strictObject({
    path: z.string().min(1),
    eager: z.boolean(),
    contents: z.unknown(),
  })
  .superRefine(({ path, contents }, context) => {
    const schema = contentsSchemaFor(path);
    if (!schema) {
      context.addIssue({
        code: 'custom',
        path: ['path'],
        message: `${path} is not a data bundle file`,
      });
      return;
    }
    const result = schema.safeParse(contents);
    if (!result.success) {
      context.addIssue({
        code: 'custom',
        path: ['contents'],
        message: `${path} does not match the data bundle schema (${summarisedIssues(result.error)})`,
      });
    }
  });

const localeFilesSchema = z
  .array(bundleFileSchema)
  .superRefine((files, context) => {
    const paths = new Set<string>();
    for (const { path } of files) {
      if (paths.has(path)) {
        context.addIssue({ code: 'custom', message: `${path} appears twice` });
      }
      paths.add(path);
    }
    for (const path of requiredPaths.filter((path) => !paths.has(path))) {
      context.addIssue({ code: 'custom', message: `${path} is missing` });
    }
    if (fantasyPaths.some((path) => paths.has(path))) {
      for (const path of fantasyPaths.filter((path) => !paths.has(path))) {
        context.addIssue({
          code: 'custom',
          message: `${path} is missing from the Fantasy Triumph section`,
        });
      }
    }
  });

export const referencePackSchema = z.strictObject({
  dataVersion: manifestSchema.shape.dataVersion,
  source: manifestSchema.shape.source,
  builtAt: z.iso.datetime(),
  locales: z.record(z.enum(locales), localeFilesSchema),
});

export type ReferencePack = z.infer<typeof referencePackSchema>;

export const referencePackFileName = (dataVersion: string) =>
  `reference-${dataVersion}.json.gz`;

export const buildReferencePack = ({
  snapshot,
  curation,
  catalogues,
  builtAt,
}: {
  snapshot: MeshweshSnapshot;
  curation: Curation;
  catalogues: Readonly<Record<Locale, TranslationCatalogue>>;
  builtAt: Date;
}): ReferencePack => ({
  dataVersion: snapshot.manifest.dataVersion,
  source: snapshot.manifest.source,
  builtAt: builtAt.toISOString(),
  locales: Object.fromEntries(
    locales.map((locale) => [
      locale,
      buildBundle(
        snapshot,
        curation,
        createTranslator(locale, catalogues[locale]),
      ),
    ]),
  ) as Record<Locale, BundleFile[]>,
});

export const encodeReferencePack = (pack: ReferencePack) =>
  gzipSync(JSON.stringify(pack));

export const parseReferencePack = (json: unknown): ReferencePack => {
  const result = referencePackSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `the reference pack does not match its schema (${summarisedIssues(result.error)})`,
    );
  }
  return result.data;
};

export const decodeReferencePack = (compressed: Uint8Array): ReferencePack => {
  let json: unknown;
  try {
    json = JSON.parse(gunzipSync(compressed).toString('utf8'));
  } catch {
    throw new Error('the reference pack is not gzipped JSON');
  }
  return parseReferencePack(json);
};
