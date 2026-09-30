import type { ArmyIndexEntry } from '../data/bundle.ts';
import type { Topography } from '../data/schema.ts';
import { matchesAllTerms, searchTerms } from './text-search.ts';

export const ratingValues = [0, 1, 2, 3, 4] as const;

export type Rating = (typeof ratingValues)[number];

export type ArmyFilters = {
  search: string;
  from: number | null;
  to: number | null;
  categories: string[];
  topographies: Topography[];
  invasion: Rating[];
  maneuver: Rating[];
};

export const noArmyFilters: ArmyFilters = {
  search: '',
  from: null,
  to: null,
  categories: [],
  topographies: [],
  invasion: [],
  maneuver: [],
};

const matchesSearch = (
  { name, keywords }: ArmyIndexEntry,
  terms: readonly string[],
) => matchesAllTerms([name, ...keywords], terms);

const matchesYears = (
  { startDate, endDate }: ArmyIndexEntry,
  from: number | null,
  to: number | null,
) => (from === null || endDate >= from) && (to === null || startDate <= to);

const matchesAny = <Value>(
  selected: readonly Value[],
  values: readonly Value[],
) => selected.length === 0 || values.some((value) => selected.includes(value));

export const filterArmies = (
  entries: readonly ArmyIndexEntry[],
  filters: ArmyFilters,
) => {
  const terms = searchTerms(filters.search);
  return entries.filter(
    (entry) =>
      matchesSearch(entry, terms) &&
      matchesYears(entry, filters.from, filters.to) &&
      matchesAny(filters.categories, entry.categories) &&
      matchesAny(filters.topographies, entry.topographies) &&
      matchesAny(filters.invasion, entry.invasion) &&
      matchesAny(filters.maneuver, entry.maneuver),
  );
};

export const armyCountsByCategory = (
  entries: readonly ArmyIndexEntry[],
): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const { categories } of entries) {
    for (const category of categories) {
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }
  return counts;
};

export type CategoryYearSpan = {
  startDate: number;
  endDate: number;
};

export const yearSpansByCategory = (
  entries: readonly ArmyIndexEntry[],
): ReadonlyMap<string, CategoryYearSpan> => {
  const spans = new Map<string, CategoryYearSpan>();
  for (const { categories, startDate, endDate } of entries) {
    for (const category of categories) {
      const span = spans.get(category);
      spans.set(category, {
        startDate: Math.min(span?.startDate ?? startDate, startDate),
        endDate: Math.max(span?.endDate ?? endDate, endDate),
      });
    }
  }
  return spans;
};

export const activeArmyFilterCount = ({
  from,
  to,
  categories,
  topographies,
  invasion,
  maneuver,
}: ArmyFilters) =>
  (from !== null || to !== null ? 1 : 0) +
  categories.length +
  topographies.length +
  invasion.length +
  maneuver.length;

export const toggledValues = <Value>(
  values: readonly Value[],
  value: Value,
): Value[] =>
  values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
