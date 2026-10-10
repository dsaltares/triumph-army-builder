'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CountTable } from '@/components/admin/count-table';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { Section } from '@/components/layout/section';
import type { FilterKey } from '@/lib/domain/usage/tracked';

export type PageCount = { route: string; events: number };

export type FilterCount = { key: string; value: string; events: number };

const filterLabelKeys = {
  'armies.category': 'filterArmiesCategory',
  'armies.topography': 'filterArmiesTopography',
  'armies.invasion': 'filterArmiesInvasion',
  'armies.manoeuvre': 'filterArmiesManoeuvre',
  'collection.kind': 'filterCollectionKind',
  'collection.game': 'filterCollectionGame',
  'collection.troopType': 'filterCollectionTroopType',
  'collection.status': 'filterCollectionStatus',
  'myArmies.game': 'filterMyArmiesGame',
} as const satisfies Record<FilterKey, string>;

const isFilterKey = (key: string): key is FilterKey => key in filterLabelKeys;

export function UsageInterest({
  pages,
  filters,
  widen,
}: {
  pages: readonly PageCount[];
  filters: readonly FilterCount[];
  widen: ReactNode;
}) {
  const t = useTranslations('admin');
  const filterLabel = (key: string) =>
    isFilterKey(key) ? t(filterLabelKeys[key]) : key;
  return (
    <Section title={t('interestTitle')} description={t('interestDescription')}>
      {pages.length === 0 && filters.length === 0 ? (
        <EmptyState title={t('noInterestTitle')} actions={widen}>
          <EmptyStateText>{t('noInterestText')}</EmptyStateText>
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <CountTable
            title={t('pagesTitle')}
            labelColumns={[t('pageColumn')]}
            countColumn={t('viewsColumn')}
            rows={pages.map(({ route, events }) => ({
              key: route,
              labels: [route],
              count: events,
            }))}
          />
          <CountTable
            title={t('filtersTitle')}
            labelColumns={[t('filterColumn'), t('valueColumn')]}
            countColumn={t('usesColumn')}
            rows={filters.map(({ key, value, events }) => ({
              key: `${key}|${value}`,
              labels: [filterLabel(key), value],
              count: events,
            }))}
          />
        </div>
      )}
    </Section>
  );
}
