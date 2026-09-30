'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { parseAsBoolean, parseAsString, useQueryState } from 'nuqs';
import { useId } from 'react';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { LinkCard, LinkCardGrid } from '@/components/layout/link-card';
import { Section } from '@/components/layout/section';
import { LoadFailure } from '@/components/load-failure';
import { SearchField } from '@/components/search-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useErrorMessage } from '@/components/use-error-message';
import { encodeSelection } from '@/lib/domain/army/share-codec';
import {
  type BuildableList,
  buildableListLimit,
} from '@/lib/domain/collection/buildable';
import { formatPoints, formatYear } from '@/lib/format';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { newCollectionEntryUrl, unsavedListUrl } from '@/lib/navigation';
import { useTRPC } from '@/lib/trpc/client';

const useStandInsParam = () =>
  useQueryState('stand-ins', parseAsBoolean.withDefault(true));

const useCompleteParam = () =>
  useQueryState('complete', parseAsBoolean.withDefault(false));

const useArmySearchParam = () =>
  useQueryState('army', parseAsString.withDefault(''));

const armySearchDelayMs = 300;

const placeholderCards = ['first', 'second', 'third'] as const;

function Loading() {
  const t = useTranslations('collection');
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('buildableLoading')}</span>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {placeholderCards.map((card) => (
          <Skeleton key={card} className="h-20" />
        ))}
      </div>
    </div>
  );
}

function NothingBuildable() {
  const t = useTranslations('collection');
  return (
    <EmptyState
      title={t('buildableEmptyTitle')}
      actions={
        <Link
          href={newCollectionEntryUrl()}
          className={buttonVariants({ variant: 'outline', size: 'touch' })}
        >
          {t('addEntry')}
        </Link>
      }
    >
      <EmptyStateText>{t('buildableEmptyBody')}</EmptyStateText>
    </EmptyState>
  );
}

function NothingFromMatches({
  onCountStandIns,
}: {
  onCountStandIns: () => void;
}) {
  const t = useTranslations('collection');
  return (
    <EmptyState
      title={t('buildableMatchesOnlyTitle')}
      actions={
        <Button variant="outline" size="touch" onClick={onCountStandIns}>
          {t('buildableStandIns')}
        </Button>
      }
    >
      <EmptyStateText>{t('buildableMatchesOnlyBody')}</EmptyStateText>
    </EmptyState>
  );
}

function NothingComplete({ onShowEvery }: { onShowEvery: () => void }) {
  const t = useTranslations('collection');
  return (
    <EmptyState
      title={t('buildableCompleteOnlyTitle')}
      actions={
        <Button variant="outline" size="touch" onClick={onShowEvery}>
          {t('buildableShowEvery')}
        </Button>
      }
    >
      <EmptyStateText>{t('buildableCompleteOnlyBody')}</EmptyStateText>
    </EmptyState>
  );
}

function NothingNamedLike({ onClearSearch }: { onClearSearch: () => void }) {
  const t = useTranslations('collection');
  return (
    <EmptyState
      title={t('buildableNoSearchMatchTitle')}
      actions={
        <Button variant="outline" size="touch" onClick={onClearSearch}>
          {t('buildableClearSearch')}
        </Button>
      }
    >
      <EmptyStateText>{t('buildableNoSearchMatchBody')}</EmptyStateText>
    </EmptyState>
  );
}

function FilterSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <Label htmlFor={id} className="min-h-11 w-fit gap-2 text-sm">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      {label}
    </Label>
  );
}

function BuildableCards({ lists }: { lists: readonly BuildableList[] }) {
  const t = useTranslations('collection');
  const locale = useLocale();
  return (
    <LinkCardGrid>
      {lists.map((list) => (
        <LinkCard
          key={list.army}
          href={unsavedListUrl(encodeSelection(list.selection))}
          title={list.name}
          meta={[formatYear(list.year, locale), list.subFaction]
            .filter(Boolean)
            .join(' · ')}
        >
          {t('buildableCovered', { points: formatPoints(list.pointsCovered) })}
          {' · '}
          {t('buildableFit', {
            matched: list.matched,
            standIns: list.standIns,
          })}
          {list.battleCardPoints > 0 &&
            ` · ${t('buildableBattleCards', {
              points: formatPoints(list.battleCardPoints),
            })}`}
        </LinkCard>
      ))}
    </LinkCardGrid>
  );
}

function Buildable({
  standIns,
  complete,
  search,
  onCountStandIns,
  onShowEvery,
  onClearSearch,
}: {
  standIns: boolean;
  complete: boolean;
  search: string;
  onCountStandIns: () => void;
  onShowEvery: () => void;
  onClearSearch: () => void;
}) {
  const t = useTranslations('collection');
  const errorMessage = useErrorMessage();
  const locale = useLocale();
  const trpc = useTRPC();
  const lists = useQuery({
    ...trpc.collection.buildable.queryOptions({
      locale,
      standIns,
      complete,
      search,
    }),
    placeholderData: keepPreviousData,
  });

  if (lists.isError) {
    return (
      <LoadFailure
        title={t('buildableFailed')}
        message={errorMessage(lists.error) ?? ''}
      />
    );
  }
  if (lists.isPending) {
    return <Loading />;
  }
  if (lists.data.length === 0) {
    if (search !== '') {
      return <NothingNamedLike onClearSearch={onClearSearch} />;
    }
    if (complete) {
      return <NothingComplete onShowEvery={onShowEvery} />;
    }
    return standIns ? (
      <NothingBuildable />
    ) : (
      <NothingFromMatches onCountStandIns={onCountStandIns} />
    );
  }
  return (
    <>
      {lists.data.length === buildableListLimit && (
        <p className="text-xs text-muted-foreground">
          {t('buildableBest', { count: buildableListLimit })}
        </p>
      )}
      <BuildableCards lists={lists.data} />
    </>
  );
}

export function BuildableArmies() {
  const t = useTranslations('collection');
  const [standIns, setStandIns] = useStandInsParam();
  const [complete, setComplete] = useCompleteParam();
  const [search, setSearch] = useArmySearchParam();
  const settledSearch = useDebouncedValue(search, armySearchDelayMs).trim();
  return (
    <Section
      id="which-armies"
      title={t('buildableTitle')}
      description={t('buildableDescription')}
    >
      <div className="flex flex-col gap-3">
        <SearchField
          label={t('buildableSearch')}
          placeholder={t('buildableSearchPlaceholder')}
          value={search}
          onChange={(next) => setSearch(next)}
        />
        <div className="flex flex-wrap gap-x-6">
          <FilterSwitch
            label={t('buildableStandIns')}
            checked={standIns}
            onChange={setStandIns}
          />
          <FilterSwitch
            label={t('buildableCompleteOnly')}
            checked={complete}
            onChange={setComplete}
          />
        </div>
        <Buildable
          standIns={standIns}
          complete={complete}
          search={settledSearch}
          onCountStandIns={() => setStandIns(true)}
          onShowEvery={() => setComplete(false)}
          onClearSearch={() => setSearch('')}
        />
      </div>
    </Section>
  );
}
