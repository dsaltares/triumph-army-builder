'use client';

import type { SortingState, Updater } from '@tanstack/react-table';
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { sendFilterUses } from '@/components/usage/send-filter-uses';
import { type Game, games } from '@/lib/domain/game';
import { addedFilterValues } from '@/lib/domain/usage/tracked';

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
  const [{ search, games: chosenGames, sort, dir }, setState] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      games: parseAsArrayOf(parseAsStringLiteral(games)).withDefault([]),
      sort: parseAsStringLiteral(savedArmyColumns).withDefault('updatedAt'),
      dir: parseAsStringLiteral(directions).withDefault('desc'),
    },
    { urlKeys: { search: 'q', games: 'game' } },
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

  const setGames = (next: Game[]) => {
    sendFilterUses(
      addedFilterValues(
        { games: 'myArmies.game' },
        { games: chosenGames },
        { games: next },
      ),
    );
    void setState({ games: next });
  };

  return {
    search,
    setSearch: (next: string) => void setState({ search: next }),
    games: chosenGames,
    setGames,
    sorting,
    setSorting,
  };
};
