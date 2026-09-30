'use client';

import { IconPlus } from '@tabler/icons-react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useStartList } from '@/components/army/use-start-list';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { LoadFailure } from '@/components/load-failure';
import { SearchField } from '@/components/search-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useErrorMessage } from '@/components/use-error-message';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import { filterArmies, noArmyFilters } from '@/lib/domain/army-index';
import { formatYearSpan } from '@/lib/format';
import { useTRPC } from '@/lib/trpc/client';

const maxMatchesShown = 50;

const skeletonRows = [0, 1, 2, 3, 4];

const useArmies = () => {
  const trpc = useTRPC();
  const errorMessage = useErrorMessage();
  const { reference, error } = useReference();
  const index = useQuery(
    trpc.reference.index.queryOptions(reference ?? skipToken, {
      staleTime: referenceStaleTime,
    }),
  );
  const failure = error ?? index.error;
  if (failure) {
    return { status: 'failed', message: errorMessage(failure) ?? '' } as const;
  }
  return index.data
    ? ({ status: 'ready', data: index.data.armies } as const)
    : ({ status: 'loading' } as const);
};

function ArmyPicker() {
  const t = useTranslations('armies');
  const locale = useLocale();
  const { start, starting } = useStartList();
  const state = useArmies();
  const [search, setSearch] = useState('');
  const armies = state.status === 'ready' ? state.data : [];
  const matches = useMemo(
    () => filterArmies(armies, { ...noArmyFilters, search }),
    [armies, search],
  );
  const shown = matches.slice(0, maxMatchesShown);
  const [first] = shown;

  if (state.status === 'failed') {
    return <LoadFailure title={t('indexLoadFailed')} message={state.message} />;
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (first) {
          void start(first);
        }
      }}
    >
      <SearchField
        label={t('searchArmies')}
        placeholder={t('searchArmiesPlaceholder')}
        value={search}
        onChange={setSearch}
      />

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {state.status === 'loading'
          ? t('loadingArmies')
          : search.trim() !== ''
            ? t('armyListsShown', {
                matches: matches.length,
                total: armies.length,
              })
            : t('armyListsInScope', { count: armies.length })}
      </p>

      {state.status === 'loading' && (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {skeletonRows.map((row) => (
            <Skeleton key={row} className="h-11" />
          ))}
        </div>
      )}

      {state.status === 'ready' && matches.length === 0 && (
        <EmptyState
          title={t('noArmyMatches')}
          actions={
            <Button
              variant="outline"
              size="touch"
              onClick={() => setSearch('')}
            >
              {t('clearSearch')}
            </Button>
          }
        >
          <EmptyStateText>{t('noArmyMatchesBody')}</EmptyStateText>
        </EmptyState>
      )}

      {shown.length > 0 && (
        <ul className="-mx-2 max-h-[50dvh] overflow-y-auto overscroll-contain">
          {shown.map((army) => (
            <li key={army.id}>
              <button
                type="button"
                disabled={starting}
                onClick={() => start(army)}
                className="flex min-h-11 w-full flex-col justify-center gap-0.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-balance">
                    {army.name}
                  </span>
                  {army.status === 'DRAFT' && (
                    <Badge variant="outline">{t('draft')}</Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatYearSpan(army, locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {matches.length > shown.length && (
        <p className="text-xs text-muted-foreground">
          {t('firstMatchesShown', { count: shown.length })}
        </p>
      )}
    </form>
  );
}

export function NewListDialog({ label }: { label?: string } = {}) {
  const pages = useTranslations('pages');
  return (
    <Dialog>
      <DialogTrigger render={<Button size="touch" className="shrink-0" />}>
        <IconPlus data-icon="inline-start" />
        {label ?? pages('newList')}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pages('newList')}</DialogTitle>
        </DialogHeader>
        <ArmyPicker />
      </DialogContent>
    </Dialog>
  );
}
