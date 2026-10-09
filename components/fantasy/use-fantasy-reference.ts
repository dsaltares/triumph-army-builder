'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import type { FantasyReference } from '@/lib/domain/fantasy/reference';
import { useTRPC } from '@/lib/trpc/client';

export type FantasyReferenceState =
  | { status: 'loading' }
  | { status: 'failed'; error: unknown }
  | { status: 'ready'; dataVersion: string; reference: FantasyReference };

export const useFantasyReference = (enabled = true): FantasyReferenceState => {
  const trpc = useTRPC();
  const { reference, error } = useReference();
  const input = enabled && reference ? reference : skipToken;
  const troopTypes = useQuery(
    trpc.reference.troopTypes.queryOptions(
      input === skipToken ? skipToken : { ...input, game: 'fantasy' },
      { staleTime: referenceStaleTime },
    ),
  );
  const game = useQuery(
    trpc.reference.game.queryOptions(
      input === skipToken ? skipToken : { ...input, game: 'fantasy' },
      { staleTime: referenceStaleTime },
    ),
  );
  const dataVersion = reference?.dataVersion;
  const ready = useMemo(
    () =>
      dataVersion && troopTypes.data && game.data
        ? {
            dataVersion,
            reference: {
              troopTypes: troopTypes.data,
              cards: game.data.battleCards,
              format: game.data.format,
            },
          }
        : null,
    [dataVersion, troopTypes.data, game.data],
  );
  const failure = error ?? troopTypes.error ?? game.error;
  if (failure) {
    return { status: 'failed', error: failure };
  }
  return ready ? { status: 'ready', ...ready } : { status: 'loading' };
};
