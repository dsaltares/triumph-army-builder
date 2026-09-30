import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type Locale, locales } from '../i18n/locales.ts';
import {
  emptyCatalogue,
  type TranslationCatalogue,
  type TranslationFile,
  translationFileNames,
  translationFileSchema,
} from './translations.ts';

const readTranslationFile = async (
  directory: string,
  name: string,
): Promise<TranslationFile> => {
  try {
    const contents = await readFile(join(directory, `${name}.json`), 'utf8');
    return translationFileSchema.parse(JSON.parse(contents));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
};

export const loadTranslations = async (
  directory: string,
  locale: Locale,
): Promise<TranslationCatalogue> => {
  const localeDirectory = join(directory, locale);
  const entries = await Promise.all(
    translationFileNames.map(
      async (name) =>
        [name, await readTranslationFile(localeDirectory, name)] as const,
    ),
  );
  return { ...emptyCatalogue(), ...Object.fromEntries(entries) };
};

export const loadCatalogues = async (
  directory: string,
): Promise<Record<Locale, TranslationCatalogue>> =>
  Object.fromEntries(
    await Promise.all(
      locales.map(
        async (locale) =>
          [locale, await loadTranslations(directory, locale)] as const,
      ),
    ),
  ) as Record<Locale, TranslationCatalogue>;
