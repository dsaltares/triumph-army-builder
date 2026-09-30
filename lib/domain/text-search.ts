const diacritics = /\p{Diacritic}/gu;
const whitespace = /\s+/;

export const normaliseForSearch = (value: string) =>
  value.normalize('NFD').replace(diacritics, '').toLowerCase();

export const searchTerms = (search: string) =>
  normaliseForSearch(search)
    .split(whitespace)
    .filter((term) => term !== '');

export const matchesAllTerms = (
  searchable: readonly (string | null | undefined)[],
  terms: readonly string[],
) => {
  const text = normaliseForSearch(
    searchable.filter((part) => !!part).join(' '),
  );
  return terms.every((term) => text.includes(term));
};
