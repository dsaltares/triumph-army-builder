'use client';

import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { ArmyFiltersSheet } from '@/components/army/army-filters';
import { ArmyRowsSkeleton } from '@/components/army/army-index-skeleton';
import { ArmyList } from '@/components/army/army-list';
import { useArmyFilters } from '@/components/army/use-army-filters';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { LoadFailure } from '@/components/load-failure';
import { SearchField } from '@/components/search-field';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/components/use-error-message';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import {
  activeArmyFilterCount,
  filterArmies,
  noArmyFilters,
} from '@/lib/domain/army-index';
import { useTRPC } from '@/lib/trpc/client';

const useArmyIndexData = () => {
  const trpc = useTRPC();
  const errorMessage = useErrorMessage();
  const { reference, error } = useReference();
  const index = useQuery(
    trpc.reference.index.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  const categories = useQuery(
    trpc.reference.thematicCategories.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  const failure = error ?? index.error ?? categories.error;
  if (failure) {
    return { status: 'failed', message: errorMessage(failure) ?? '' } as const;
  }
  return index.data && categories.data
    ? ({
        status: 'ready',
        data: { armies: index.data.armies, categories: categories.data },
      } as const)
    : ({ status: 'loading' } as const);
};

export function ArmyIndexView({ categoryId }: { categoryId?: string } = {}) {
  const t = useTranslations('armies');
  const state = useArmyIndexData();
  const [filters, setFilters] = useArmyFilters();

  const armies = state.status === 'ready' ? state.data.armies : [];
  const categories = state.status === 'ready' ? state.data.categories : [];
  const inScope = useMemo(
    () =>
      categoryId
        ? filterArmies(armies, { ...noArmyFilters, categories: [categoryId] })
        : armies,
    [armies, categoryId],
  );
  const matches = useMemo(
    () => filterArmies(inScope, filters),
    [inScope, filters],
  );
  const categoryNames = useMemo(
    () =>
      new Map(
        categories
          .filter(({ id }) => id !== categoryId)
          .map(({ id, name }) => [id, name]),
      ),
    [categories, categoryId],
  );
  const narrowed =
    filters.search.trim() !== '' || activeArmyFilterCount(filters) > 0;

  if (state.status === 'failed') {
    return <LoadFailure title={t('indexLoadFailed')} message={state.message} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchField
          label={t('searchArmies')}
          placeholder={t('searchArmiesPlaceholder')}
          value={filters.search}
          onChange={(search) => setFilters({ search })}
          className="flex-1"
        />
        <ArmyFiltersSheet
          filters={filters}
          categories={categoryId ? [] : categories}
          matches={matches.length}
          onChange={setFilters}
        />
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {state.status === 'loading'
          ? t('loadingArmies')
          : narrowed
            ? t('armyListsShown', {
                matches: matches.length,
                total: inScope.length,
              })
            : t('armyListsInScope', { count: inScope.length })}
      </p>

      {state.status === 'loading' && <ArmyRowsSkeleton />}

      {state.status === 'ready' && matches.length === 0 && (
        <EmptyState
          title={t('noArmyMatches')}
          actions={
            <Button
              variant="outline"
              size="touch"
              onClick={() => setFilters(null)}
            >
              {t('clearSearchAndFilters')}
            </Button>
          }
        >
          <EmptyStateText>{t('noIndexMatchesBody')}</EmptyStateText>
        </EmptyState>
      )}

      {state.status === 'ready' && matches.length > 0 && (
        <ArmyList armies={matches} categoryNames={categoryNames} />
      )}
    </div>
  );
}
