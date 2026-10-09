'use client';

import { skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useFantasyReference } from '@/components/fantasy/use-fantasy-reference';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import { buildArmyList } from '@/lib/domain/army/army-list';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import {
  type SavedArmyEntry,
  savedListReading,
} from '@/lib/domain/army/saved-army-index';
import { useTRPC } from '@/lib/trpc/client';

export type SavedArmyEntries = {
  entries: readonly SavedArmyEntry[];
  pricing: boolean;
};

export const useSavedArmyEntries = (
  armies: readonly SavedArmy[],
): SavedArmyEntries => {
  const trpc = useTRPC();
  const { reference } = useReference();
  const armyListIds = useMemo(
    () =>
      [
        ...new Set(
          armies.flatMap(({ armyListId }) =>
            armyListId === null ? [] : [armyListId],
          ),
        ),
      ].sort(),
    [armies],
  );
  const fantasy = useFantasyReference(
    armies.some(({ game }) => game === 'fantasy'),
  );
  const fantasyReference =
    fantasy.status === 'ready' ? fantasy.reference : null;
  const troopTypes = useQuery(
    trpc.reference.troopTypes.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  const battleCards = useQuery(
    trpc.reference.battleCards.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  const details = useQueries({
    queries: armyListIds.map((id) =>
      trpc.reference.army.queryOptions(
        reference ? { ...reference, id } : skipToken,
        { staleTime: referenceStaleTime },
      ),
    ),
    combine: (results) => ({
      lists: results.flatMap(({ data }) => (data ? [buildArmyList(data)] : [])),
      pending: results.some(({ isPending }) => isPending),
    }),
  });

  const armyLists = useMemo(
    () => new Map(details.lists.map((armyList) => [armyList.id, armyList])),
    [details.lists],
  );
  const entries = useMemo(
    () =>
      armies.map((army): SavedArmyEntry => {
        if (army.game === 'fantasy') {
          return fantasyReference
            ? {
                army,
                ...savedListReading({
                  game: army.game,
                  selection: army.selection,
                  reference: fantasyReference,
                }),
              }
            : { army, listName: null, standing: null };
        }
        const armyList = armyLists.get(army.armyListId);
        if (!armyList) {
          return { army, listName: null, standing: null };
        }
        if (!troopTypes.data || !battleCards.data) {
          return { army, listName: armyList.name, standing: null };
        }
        return {
          army,
          ...savedListReading({
            game: army.game,
            selection: army.selection,
            reference: {
              armyList,
              troopTypes: troopTypes.data,
              battleCards: battleCards.data,
            },
          }),
        };
      }),
    [armies, armyLists, troopTypes.data, battleCards.data, fantasyReference],
  );

  return {
    entries,
    pricing:
      armies.length > 0 &&
      (details.pending ||
        troopTypes.isPending ||
        battleCards.isPending ||
        fantasy.status === 'loading'),
  };
};
