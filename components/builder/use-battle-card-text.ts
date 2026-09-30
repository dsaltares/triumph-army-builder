'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import type { BattleCardText } from '@/lib/data/bundle';
import { useTRPC } from '@/lib/trpc/client';

export type BattleCardTextState =
  | { status: 'loading' }
  | { status: 'ready'; text: BattleCardText }
  | { status: 'failed' };

export const useBattleCardText = (wanted: boolean): BattleCardTextState => {
  const trpc = useTRPC();
  const { reference, error } = useReference();
  const text = useQuery(
    trpc.reference.battleCardText.queryOptions(
      wanted && reference ? reference : skipToken,
      { staleTime: referenceStaleTime },
    ),
  );
  if (error || text.isError) {
    return { status: 'failed' };
  }
  return text.data
    ? { status: 'ready', text: text.data }
    : { status: 'loading' };
};
