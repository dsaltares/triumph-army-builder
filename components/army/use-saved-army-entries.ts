'use client';

import { skipToken, useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { pointCosts } from '@/lib/domain/army/points';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import {
  type SavedArmyEntry,
  savedArmyStanding,
} from '@/lib/domain/army/saved-army-index';
import { troopTypeNames } from '@/lib/domain/troop-types';
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
    () => [...new Set(armies.map(({ armyListId }) => armyListId))].sort(),
    [armies],
  );
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
  const pricing = useMemo(
    () =>
      troopTypes.data && battleCards.data
        ? {
            costs: pointCosts(troopTypes.data, battleCards.data),
            names: troopTypeNames(troopTypes.data),
          }
        : null,
    [troopTypes.data, battleCards.data],
  );

  const entries = useMemo(
    () =>
      armies.map((army): SavedArmyEntry => {
        const armyList = armyLists.get(army.armyListId);
        return {
          army,
          listName: armyList?.name ?? null,
          standing:
            armyList && pricing
              ? savedArmyStanding(
                  armyList,
                  army.selection,
                  pricing.costs,
                  pricing.names,
                )
              : null,
        };
      }),
    [armies, armyLists, pricing],
  );

  return {
    entries,
    pricing:
      armies.length > 0 &&
      (details.pending || troopTypes.isPending || battleCards.isPending),
  };
};
