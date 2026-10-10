'use client';

import { IconPlus } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { ArmyRowsSkeleton } from '@/components/army/army-index-skeleton';
import { BuildableArmies } from '@/components/collection/buildable-armies';
import { CollectionEmpty } from '@/components/collection/collection-empty';
import { CollectionFiltersSheet } from '@/components/collection/collection-filters';
import {
  CollectionTable,
  type EntryCovers,
} from '@/components/collection/collection-table';
import {
  EntryDialog,
  type EntryEditing,
} from '@/components/collection/entry-dialog';
import { useCollectionEntries } from '@/components/collection/use-collection-entries';
import {
  useCollectionFilters,
  useCollectionSort,
} from '@/components/collection/use-collection-filters';
import { useNewEntryParam } from '@/components/collection/use-new-entry-param';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { LoadFailure } from '@/components/load-failure';
import { SearchField } from '@/components/search-field';
import { Button } from '@/components/ui/button';
import { useErrorMessage } from '@/components/use-error-message';
import { useSession } from '@/lib/auth/client';
import { isSignedIn } from '@/lib/auth/session';
import {
  activeCollectionFilterCount,
  collectionTags,
  collectionTotals,
  collectionTroopTypes,
  filterCollection,
  noCollectionFilters,
  sortCollection,
} from '@/lib/domain/collection/collection-index';
import type { CollectionEntry } from '@/lib/domain/collection/entry';
import { useTRPC } from '@/lib/trpc/client';

function Loading() {
  const t = useTranslations('collection');
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>
      <ArmyRowsSkeleton />
    </div>
  );
}

const noCovers: EntryCovers = {};

function CollectionHeader({
  entries = [],
  onAdd,
}: {
  entries?: readonly CollectionEntry[];
  onAdd?: () => void;
}) {
  const t = useTranslations('collection');
  const pages = useTranslations('pages');
  const totals = useMemo(() => collectionTotals(entries), [entries]);
  return (
    <PageHeader
      title={pages('collection')}
      description={entries.length > 0 ? t('totals', totals) : undefined}
      action={
        entries.length > 0 &&
        onAdd && (
          <Button size="touch" className="shrink-0" onClick={onAdd}>
            <IconPlus data-icon="inline-start" />
            {t('addStands')}
          </Button>
        )
      }
    />
  );
}

function Entries({
  entries,
  onEdit,
  onDelete,
}: {
  entries: readonly CollectionEntry[];
  onEdit: (entry: CollectionEntry) => void;
  onDelete: (entry: CollectionEntry) => void;
}) {
  const t = useTranslations('collection');
  const [filters, setFilters] = useCollectionFilters();
  const [sort, sortBy] = useCollectionSort();
  const trpc = useTRPC();
  const photos = useQuery(trpc.collection.photos.overview.queryOptions());
  const troopTypes = useMemo(
    () => collectionTroopTypes(entries, filters.troopTypes),
    [entries, filters.troopTypes],
  );
  const tags = useMemo(
    () => collectionTags(entries, filters.tags),
    [entries, filters.tags],
  );
  const matches = useMemo(
    () => sortCollection(filterCollection(entries, filters), sort),
    [entries, filters, sort],
  );
  const narrowed =
    filters.search.trim() !== '' || activeCollectionFilterCount(filters) > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchField
          label={t('searchCollection')}
          placeholder={t('searchCollectionPlaceholder')}
          value={filters.search}
          onChange={(search) => setFilters({ search })}
          className="flex-1"
        />
        <CollectionFiltersSheet
          troopTypes={troopTypes}
          tags={tags}
          filters={filters}
          matches={matches.length}
          onChange={setFilters}
        />
      </div>
      {narrowed && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('entriesShown', {
            matches: matches.length,
            total: entries.length,
          })}
        </p>
      )}
      {matches.length === 0 ? (
        <EmptyState
          title={t('noMatchesTitle')}
          actions={
            <Button
              variant="outline"
              size="touch"
              onClick={() => setFilters(noCollectionFilters)}
            >
              {t('clearSearchAndFilters')}
            </Button>
          }
        >
          <EmptyStateText>{t('noMatchesBody')}</EmptyStateText>
        </EmptyState>
      ) : (
        <CollectionTable
          entries={matches}
          covers={photos.data?.covers ?? noCovers}
          sort={sort}
          onSort={sortBy}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function AccountCollection() {
  const t = useTranslations('collection');
  const errorMessage = useErrorMessage();
  const { entries, remove } = useCollectionEntries();
  const [editing, setEditing] = useState<EntryEditing>(null);
  const [newEntry, setNewEntry] = useNewEntryParam();
  const adding: EntryEditing =
    newEntry === undefined ? null : { entry: null, ...newEntry };
  const add = () => setNewEntry({ kind: 'stands', troopType: null });
  const close = () => {
    setEditing(null);
    setNewEntry(undefined);
  };

  if (entries.isError) {
    return (
      <>
        <CollectionHeader />
        <LoadFailure
          title={t('loadFailed')}
          message={errorMessage(entries.error) ?? ''}
        />
      </>
    );
  }
  if (entries.isPending) {
    return (
      <>
        <CollectionHeader />
        <Loading />
      </>
    );
  }
  return (
    <>
      <CollectionHeader entries={entries.data} onAdd={add} />
      {entries.data.length === 0 ? (
        <CollectionEmpty onAdd={add} />
      ) : (
        <div className="flex flex-col gap-section">
          <Entries
            entries={entries.data}
            onEdit={(entry) => setEditing({ entry })}
            onDelete={remove}
          />
          <BuildableArmies />
        </div>
      )}
      <EntryDialog
        editing={editing ?? adding}
        onClose={close}
        onEdit={(next) => {
          setEditing(next);
          setNewEntry(undefined);
        }}
        onDelete={remove}
      />
    </>
  );
}

export function Collection() {
  const { data: session, isPending } = useSession();
  if (isPending) {
    return (
      <>
        <CollectionHeader />
        <Loading />
      </>
    );
  }
  return isSignedIn(session) ? (
    <AccountCollection />
  ) : (
    <>
      <CollectionHeader />
      <CollectionEmpty />
    </>
  );
}
