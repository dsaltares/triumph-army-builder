import { type TroopTypeCode, troopTypeCodes } from '../../data/schema.ts';
import { normaliseForSearch } from '../text-search.ts';
import {
  descriptionWords,
  suggestibleWords,
  takenStems,
} from './description-words.ts';

export type TagWord = {
  word: string;
  troopTypes: TroopTypeCode[];
  options: number;
};

export type DescribedOption = {
  description: string;
  troopTypes: readonly TroopTypeCode[];
};

type Tally = {
  options: number;
  troopTypes: Set<TroopTypeCode>;
  spellings: Map<string, number>;
};

const mostUsedSpelling = (spellings: ReadonlyMap<string, number>) =>
  [...spellings].reduce((best, candidate) =>
    candidate[1] > best[1] ||
    (candidate[1] === best[1] && candidate[0] < best[0])
      ? candidate
      : best,
  )[0];

const byUseThenWord = (left: TagWord, right: TagWord) =>
  right.options - left.options || (left.word < right.word ? -1 : 1);

export const tagWords = (options: readonly DescribedOption[]): TagWord[] => {
  const tallies = new Map<string, Tally>();
  for (const { description, troopTypes } of options) {
    const counted = new Set<string>();
    for (const { stem, word } of suggestibleWords(description)) {
      const tally = tallies.get(stem) ?? {
        options: 0,
        troopTypes: new Set(),
        spellings: new Map(),
      };
      tallies.set(stem, tally);
      tally.spellings.set(word, (tally.spellings.get(word) ?? 0) + 1);
      for (const code of troopTypes) {
        tally.troopTypes.add(code);
      }
      if (!counted.has(stem)) {
        counted.add(stem);
        tally.options += 1;
      }
    }
  }
  return [...tallies.values()]
    .map(({ options, troopTypes, spellings }) => ({
      word: mostUsedSpelling(spellings),
      troopTypes: troopTypeCodes.filter((code) => troopTypes.has(code)),
      options,
    }))
    .sort(byUseThenWord);
};

export type TagQuery = {
  typed: string;
  tags: readonly string[];
  troopType: TroopTypeCode | null;
};

export const tagWordSuggestionLimit = 6;

const fieldsAs = (word: TagWord, troopType: TroopTypeCode) =>
  word.troopTypes.includes(troopType);

export const suggestTags = (
  words: readonly TagWord[],
  { typed, tags, troopType }: TagQuery,
  limit = tagWordSuggestionLimit,
): string[] => {
  const prefix = normaliseForSearch(typed.trim());
  const taken = takenStems(tags);
  const candidates = words.filter(
    ({ word }) =>
      word.startsWith(prefix) &&
      word !== prefix &&
      !descriptionWords(word).every((stem) => taken.has(stem)),
  );
  const fitting =
    troopType === null
      ? candidates
      : [
          ...candidates.filter((word) => fieldsAs(word, troopType)),
          ...candidates.filter((word) => !fieldsAs(word, troopType)),
        ];
  return fitting.slice(0, limit).map(({ word }) => word);
};
