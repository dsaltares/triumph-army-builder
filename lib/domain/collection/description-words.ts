import { normaliseForSearch } from '../text-search.ts';

const apostrophes = /['’]/g;
const wordRuns = /[\p{L}\p{N}]+/gu;
const pluralS = /s$/;

export const descriptionWords = (text: string): readonly string[] =>
  (normaliseForSearch(text).replace(apostrophes, '').match(wordRuns) ?? []).map(
    (word) => word.replace(pluralS, ''),
  );

const startsAt = (
  words: readonly string[],
  phrase: readonly string[],
  start: number,
) => phrase.every((word, offset) => words[start + offset] === word);

const containsPhrase = (words: readonly string[], phrase: readonly string[]) =>
  phrase.length > 0 &&
  words.some((_word, start) => startsAt(words, phrase, start));

export const tagMatchesDescription = (tag: string, description: string) =>
  containsPhrase(descriptionWords(description), descriptionWords(tag));

export type TagMatcher = (description: string) => readonly boolean[];

export const tagMatcher = (
  tagLists: readonly (readonly string[])[],
): TagMatcher => {
  const phrases = tagLists.map((tags) => tags.map(descriptionWords));
  const matched = new Map<string, readonly boolean[]>();
  return (description) => {
    const known = matched.get(description);
    if (known) {
      return known;
    }
    const words = descriptionWords(description);
    const found = phrases.map((tags) =>
      tags.some((phrase) => containsPhrase(words, phrase)),
    );
    matched.set(description, found);
    return found;
  };
};

const tagSuggestionLimit = 3;

const shortestSuggestion = 3;

const digitsOnly = /^\p{N}+$/u;

const connectingWords = new Set([
  'and',
  'any',
  'armed',
  'but',
  'for',
  'from',
  'into',
  'mixed',
  'often',
  'other',
  'possibly',
  'some',
  'sometime',
  'the',
  'their',
  'who',
  'with',
  'without',
]);

const surfaceWords = (text: string): readonly string[] =>
  normaliseForSearch(text).replace(apostrophes, '').match(wordRuns) ?? [];

export type SuggestibleWord = { stem: string; word: string };

export const suggestibleWords = (text: string): readonly SuggestibleWord[] =>
  surfaceWords(text).flatMap((word) => {
    const [stem = word] = descriptionWords(word);
    return word.length >= shortestSuggestion &&
      !digitsOnly.test(word) &&
      !connectingWords.has(stem)
      ? [{ stem, word }]
      : [];
  });

export const takenStems = (tags: readonly string[]) =>
  new Set(tags.flatMap(descriptionWords));

export const tagSuggestions = (
  description: string,
  tags: readonly string[],
): readonly string[] => {
  const taken = takenStems(tags);
  const suggested = new Map<string, string>();
  for (const { stem, word } of suggestibleWords(description)) {
    if (!taken.has(stem) && !suggested.has(stem)) {
      suggested.set(stem, word);
    }
  }
  return [...suggested.values()].slice(0, tagSuggestionLimit);
};
