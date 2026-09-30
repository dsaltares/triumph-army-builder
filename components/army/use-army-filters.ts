'use client';

import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { sendFilterUses } from '@/components/usage/send-filter-uses';
import { topographies } from '@/lib/data/schema';
import {
  type ArmyFilters,
  noArmyFilters,
  ratingValues,
} from '@/lib/domain/army-index';
import { addedFilterValues, type FilterKey } from '@/lib/domain/usage/tracked';

const ratingFilter = () =>
  parseAsArrayOf(parseAsNumberLiteral(ratingValues)).withDefault([]);

export const armyFilterParsers = {
  search: parseAsString.withDefault(noArmyFilters.search),
  from: parseAsInteger,
  to: parseAsInteger,
  categories: parseAsArrayOf(parseAsString).withDefault([]),
  topographies: parseAsArrayOf(parseAsStringLiteral(topographies)).withDefault(
    [],
  ),
  invasion: ratingFilter(),
  maneuver: ratingFilter(),
};

export const armyFilterUrlKeys = {
  search: 'q',
  categories: 'category',
  topographies: 'topography',
  maneuver: 'manoeuvre',
};

const armyFilterUsageKeys = {
  categories: 'armies.category',
  topographies: 'armies.topography',
  invasion: 'armies.invasion',
  maneuver: 'armies.manoeuvre',
} satisfies Partial<Record<keyof ArmyFilters, FilterKey>>;

export const useArmyFilters = () => {
  const [filters, setFilters] = useQueryStates(armyFilterParsers, {
    urlKeys: armyFilterUrlKeys,
  });
  const setAndReport: typeof setFilters = (next, options) => {
    const after = typeof next === 'function' ? next(filters) : next;
    if (after) {
      sendFilterUses(addedFilterValues(armyFilterUsageKeys, filters, after));
    }
    return setFilters(after, options);
  };
  return [filters satisfies ArmyFilters, setAndReport] as const;
};
