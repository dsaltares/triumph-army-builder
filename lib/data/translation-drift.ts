import type { Locale } from '../i18n/locales.ts';
import {
  createTranslator,
  type TranslationCatalogue,
  type TranslationFileName,
  type Translator,
  translationFileNames,
} from './translations.ts';

/**
 * Two shapes of file, because two shapes of lookup. An id-keyed file is
 * matched on the upstream id, so a reworded English string is a *drifted*
 * translation that still resolves. A source-keyed file is matched on the
 * English itself, so a reworded string simply stops matching and falls back —
 * it reads as one entry missing and the old one orphaned.
 */
const keying = {
  'army-names': 'id',
  'troop-types': 'id',
  'thematic-categories': 'id',
  'battle-cards': 'id',
  'ally-names': 'source',
  'troop-options': 'source',
  keywords: 'source',
  notes: 'source',
  'sub-factions': 'source',
} as const satisfies Record<TranslationFileName, 'id' | 'source'>;

export type TranslationRequest = {
  file: TranslationFileName;
  key: string | null;
  source: string;
};

export type TranslationProblem = {
  locale: Locale;
  file: TranslationFileName;
  kind: 'missing' | 'drifted' | 'orphaned';
  detail: string;
};

/**
 * Wraps a translator and writes down every lookup it is asked for. What the
 * bundle asks to translate is, by construction, exactly what needs an entry,
 * so the report comes out of a real build rather than out of a second
 * description of the snapshot that could fall out of step with it.
 */
export const recordingTranslator = (
  locale: Locale,
  catalogue: TranslationCatalogue,
) => {
  const asked = new Map<string, TranslationRequest>();
  const inner = createTranslator(locale, catalogue);

  const note = (
    file: TranslationFileName,
    key: string | null,
    source: string,
  ) => {
    asked.set(`${file}/${key ?? source}`, { file, key, source });
  };

  const bySource = (
    file: TranslationFileName,
    translate: Translator['allyName'],
  ) =>
    (<Source extends string | null | undefined>(source: Source) => {
      if (typeof source === 'string' && source.length > 0) {
        note(file, null, source);
      }
      return translate(source);
    }) as Translator['allyName'];

  const byId =
    (
      file: TranslationFileName,
      suffix: string,
      translate: (id: string, source: string) => string,
    ) =>
    (id: string, source: string) => {
      note(file, `${id}${suffix}`, source);
      return translate(id, source);
    };

  const translator: Translator = {
    locale,
    armyName: byId('army-names', '', inner.armyName),
    allyName: bySource('ally-names', inner.allyName),
    troopOption: bySource('troop-options', inner.troopOption),
    note: bySource('notes', inner.note),
    keyword: bySource('keywords', inner.keyword),
    subFaction: bySource('sub-factions', inner.subFaction),
    troopTypeName: byId('troop-types', '.name', inner.troopTypeName),
    troopTypeDescription: byId(
      'troop-types',
      '.description',
      inner.troopTypeDescription,
    ),
    categoryName: byId('thematic-categories', '', inner.categoryName),
    battleCardName: byId('battle-cards', '.name', inner.battleCardName),
    battleCardListName: byId(
      'battle-cards',
      '.listName',
      inner.battleCardListName,
    ),
    battleCardText: byId('battle-cards', '.text', inner.battleCardText),
  };

  return { translator, asked: () => [...asked.values()] };
};

const summarise = (source: string, limit = 60) =>
  source.length > limit ? `${source.slice(0, limit)}…` : source;

/**
 * A stale translation falls back to English, which reads worse but still
 * works, so this reports and never throws. `validate:snapshot` keeps throwing
 * for the curated overlays, where a mismatch is a bug rather than a gap.
 */
export const translationProblems = ({
  locale,
  catalogue,
  asked,
}: {
  locale: Locale;
  catalogue: TranslationCatalogue;
  asked: readonly TranslationRequest[];
}): TranslationProblem[] => {
  const problems: TranslationProblem[] = [];
  const sourcesAsked = new Map<TranslationFileName, Set<string>>();
  const keysAsked = new Map<TranslationFileName, Set<string>>();
  const sourcesHeld = new Map<TranslationFileName, Set<string>>();

  for (const file of translationFileNames) {
    sourcesAsked.set(file, new Set());
    keysAsked.set(file, new Set());
    sourcesHeld.set(
      file,
      new Set(Object.values(catalogue[file]).map(({ source }) => source)),
    );
  }

  for (const { file, key, source } of asked) {
    sourcesAsked.get(file)?.add(source);
    if (key === null) {
      if (!sourcesHeld.get(file)?.has(source)) {
        problems.push({
          locale,
          file,
          kind: 'missing',
          detail: `${locale} has no ${file} entry for "${summarise(source)}"`,
        });
      }
      continue;
    }
    keysAsked.get(file)?.add(key);
    const entry = catalogue[file][key];
    if (!entry) {
      problems.push({
        locale,
        file,
        kind: 'missing',
        detail: `${locale} has no ${file} entry for ${key}, "${summarise(source)}"`,
      });
      continue;
    }
    if (entry.source !== source) {
      problems.push({
        locale,
        file,
        kind: 'drifted',
        detail: `${locale} ${file} ${key} was translated from "${summarise(entry.source)}", which upstream now writes as "${summarise(source)}"`,
      });
    }
  }

  for (const file of translationFileNames) {
    for (const [key, entry] of Object.entries(catalogue[file])) {
      const stillSaid =
        keying[file] === 'id'
          ? keysAsked.get(file)?.has(key)
          : sourcesAsked.get(file)?.has(entry.source);
      if (!stillSaid) {
        problems.push({
          locale,
          file,
          kind: 'orphaned',
          detail: `${locale} ${file} ${key} translates "${summarise(entry.source)}", which nothing in the snapshot says any more`,
        });
      }
    }
  }

  return problems;
};
