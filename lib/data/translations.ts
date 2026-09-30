import { z } from 'zod';
import type { Locale } from '../i18n/locales.ts';

export const translationEntrySchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const translationFileSchema = z.record(
  z.string(),
  translationEntrySchema,
);

export type TranslationEntry = z.infer<typeof translationEntrySchema>;

export type TranslationFile = z.infer<typeof translationFileSchema>;

export const translationFileNames = [
  'army-names',
  'ally-names',
  'troop-options',
  'troop-types',
  'thematic-categories',
  'battle-cards',
  'keywords',
  'notes',
  'sub-factions',
] as const;

export type TranslationFileName = (typeof translationFileNames)[number];

export type TranslationCatalogue = Readonly<
  Record<TranslationFileName, TranslationFile>
>;

export const emptyCatalogue = (): TranslationCatalogue =>
  Object.fromEntries(
    translationFileNames.map((name) => [name, {}]),
  ) as TranslationCatalogue;

const offsetBasis = 2166136261;

const prime = 16777619;

export const sourceKey = (source: string) => {
  let hash = offsetBasis;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, prime);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

export type Translate = <Source extends string | null | undefined>(
  source: Source,
) => Source;

const lookupBySource = (file: TranslationFile): Translate => {
  const bySource = new Map(
    Object.values(file).map(({ source, target }) => [source, target]),
  );
  return (<Source extends string | null | undefined>(source: Source) => {
    if (source === null || source === undefined) {
      return source;
    }
    const target = bySource.get(source);
    return (target && target.length > 0 ? target : source) as Source;
  }) as Translate;
};

export type Translator = {
  locale: Locale;
  armyName: (id: string, source: string) => string;
  allyName: Translate;
  troopOption: Translate;
  note: Translate;
  keyword: Translate;
  subFaction: Translate;
  troopTypeName: (code: string, source: string) => string;
  troopTypeDescription: (code: string, source: string) => string;
  categoryName: (id: string, source: string) => string;
  battleCardText: (code: string, source: string) => string;
  battleCardName: (code: string, source: string) => string;
  battleCardListName: (code: string, source: string) => string;
};

const byId =
  (file: TranslationFile, suffix = '') =>
  (id: string, source: string) => {
    const entry = file[`${id}${suffix}`];
    return entry && entry.target.length > 0 ? entry.target : source;
  };

export const createTranslator = (
  locale: Locale,
  catalogue: TranslationCatalogue,
): Translator => ({
  locale,
  armyName: byId(catalogue['army-names']),
  allyName: lookupBySource(catalogue['ally-names']),
  troopOption: lookupBySource(catalogue['troop-options']),
  note: lookupBySource(catalogue.notes),
  keyword: lookupBySource(catalogue.keywords),
  subFaction: lookupBySource(catalogue['sub-factions']),
  troopTypeName: byId(catalogue['troop-types'], '.name'),
  troopTypeDescription: byId(catalogue['troop-types'], '.description'),
  categoryName: byId(catalogue['thematic-categories']),
  battleCardName: byId(catalogue['battle-cards'], '.name'),
  battleCardListName: byId(catalogue['battle-cards'], '.listName'),
  battleCardText: byId(catalogue['battle-cards'], '.text'),
});

export const identityTranslator = (locale: Locale): Translator =>
  createTranslator(locale, emptyCatalogue());
