'use client';

import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { useMemo } from 'react';
import { sendFilterUses } from '@/components/usage/send-filter-uses';
import { troopTypeCodes } from '@/lib/data/schema';
import {
  type CollectionColumn,
  type CollectionFilters,
  type CollectionSort,
  collectionColumns,
  nextCollectionSort,
  sortDirections,
} from '@/lib/domain/collection/collection-index';
import { collectionStatuses } from '@/lib/domain/collection/entry';
import { addedFilterValues, type FilterKey } from '@/lib/domain/usage/tracked';

export const collectionFilterParsers = {
  search: parseAsString.withDefault(''),
  troopTypes: parseAsArrayOf(parseAsStringLiteral(troopTypeCodes)).withDefault(
    [],
  ),
  statuses: parseAsArrayOf(
    parseAsStringLiteral(collectionStatuses),
  ).withDefault([]),
  tags: parseAsArrayOf(parseAsString).withDefault([]),
};

export const collectionFilterUrlKeys = {
  search: 'q',
  troopTypes: 'type',
  statuses: 'status',
  tags: 'tag',
};

const collectionFilterUsageKeys = {
  troopTypes: 'collection.troopType',
  statuses: 'collection.status',
} satisfies Partial<Record<keyof CollectionFilters, FilterKey>>;

export const useCollectionFilters = () => {
  const [filters, setFilters] = useQueryStates(collectionFilterParsers, {
    urlKeys: collectionFilterUrlKeys,
  });
  const setAndReport: typeof setFilters = (next, options) => {
    const after = typeof next === 'function' ? next(filters) : next;
    if (after) {
      sendFilterUses(
        addedFilterValues(collectionFilterUsageKeys, filters, after),
      );
    }
    return setFilters(after, options);
  };
  return [filters satisfies CollectionFilters, setAndReport] as const;
};

export const collectionSortParsers = {
  sort: parseAsStringLiteral(collectionColumns),
  dir: parseAsStringLiteral(sortDirections).withDefault('asc'),
};

export const useCollectionSort = () => {
  const [{ sort, dir }, setState] = useQueryStates(collectionSortParsers);
  const current = useMemo<CollectionSort | null>(
    () => (sort ? { column: sort, direction: dir } : null),
    [sort, dir],
  );
  const sortBy = (column: CollectionColumn) => {
    const next = nextCollectionSort(current, column);
    void setState({ sort: next.column, dir: next.direction });
  };
  return [current, sortBy] as const;
};
