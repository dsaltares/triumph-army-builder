'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useSavedArmy } from '@/components/army/use-saved-armies';
import {
  ArmyBuilderView,
  type BuilderData,
} from '@/components/builder/army-builder-view';
import { BuilderSkeleton } from '@/components/builder/builder-skeleton';
import { useSavedListId } from '@/components/builder/use-saved-list';
import { LoadFailure } from '@/components/load-failure';
import { useErrorMessage } from '@/components/use-error-message';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import { buildArmyList } from '@/lib/domain/army/army-list';
import { pointCosts } from '@/lib/domain/army/points';
import {
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
  troopTypeProfiles,
} from '@/lib/domain/troop-types';
import { describeError } from '@/lib/errors';
import { useTRPC } from '@/lib/trpc/client';

const useBuilderData = (armyId: string) => {
  const trpc = useTRPC();
  const errorMessage = useErrorMessage();
  const { reference, error } = useReference();
  const detail = useQuery(
    trpc.reference.army.queryOptions(
      reference ? { ...reference, id: armyId } : skipToken,
      { staleTime: referenceStaleTime },
    ),
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
  const dataVersion = reference?.dataVersion;
  const data = useMemo(
    (): BuilderData | null =>
      dataVersion && detail.data && troopTypes.data && battleCards.data
        ? {
            dataVersion,
            armyList: buildArmyList(detail.data),
            costs: pointCosts(troopTypes.data, battleCards.data),
            names: troopTypeNames(troopTypes.data),
            factors: troopTypeFactors(troopTypes.data),
            movement: troopTypeMovements(troopTypes.data),
            profiles: troopTypeProfiles(troopTypes.data),
          }
        : null,
    [dataVersion, detail.data, troopTypes.data, battleCards.data],
  );
  const failure =
    error ?? detail.error ?? troopTypes.error ?? battleCards.error;
  if (failure) {
    return { status: 'failed', message: errorMessage(failure) ?? '' } as const;
  }
  return data
    ? ({ status: 'ready', data } as const)
    : ({ status: 'loading' } as const);
};

export function ArmyBuilder({ armyId }: { armyId: string }) {
  const t = useTranslations('builder');
  const [listId] = useSavedListId();
  const saved = useSavedArmy(listId);
  const state = useBuilderData(armyId);

  if (state.status === 'failed') {
    return <LoadFailure title={t('armyLoadFailed')} message={state.message} />;
  }

  if (listId !== null && saved.isError) {
    return (
      <LoadFailure
        title={t('savedListFailed')}
        message={describeError(saved.error)}
      />
    );
  }

  return state.status === 'loading' || (listId !== null && saved.isPending) ? (
    <BuilderSkeleton />
  ) : (
    <ArmyBuilderView
      key={saved.data?.id ?? 'unsaved'}
      {...state.data}
      saved={saved.data ?? null}
    />
  );
}
