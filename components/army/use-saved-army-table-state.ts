'use client';

import type { SortingState, Updater } from '@tanstack/react-table';
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

export const savedArmyColumns = [
  'name',
  'army',
  'points',
  'status',
  'createdAt',
  'updatedAt',
] as const;

export type SavedArmyColumn = (typeof savedArmyColumns)[number];

const directions = ['asc', 'desc'] as const;

export const defaultSorting: SortingState = [{ id: 'updatedAt', desc: true }];

export const useSavedArmyTableState = () => {
  const [{ search, sort, dir }, setState] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      sort: parseAsStringLiteral(savedArmyColumns).withDefault('updatedAt'),
      dir: parseAsStringLiteral(directions).withDefault('desc'),
    },
    { urlKeys: { search: 'q' } },
  );

  const sorting: SortingState = [{ id: sort, desc: dir === 'desc' }];

  const setSorting = (updater: Updater<SortingState>) => {
    const next =
      typeof updater === 'function' ? updater(sorting) : (updater ?? []);
    const [column] = next.length > 0 ? next : defaultSorting;
    if (!column) {
      return;
    }
    void setState({
      sort: savedArmyColumns.find((id) => id === column.id) ?? 'updatedAt',
      dir: column.desc ? 'desc' : 'asc',
    });
  };

  return {
    search,
    setSearch: (next: string) => void setState({ search: next }),
    sorting,
    setSorting,
  };
};
