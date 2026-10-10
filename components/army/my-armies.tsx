'use client';

import { IconAlertTriangle } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArmyRowsSkeleton } from '@/components/army/army-index-skeleton';
import { ArmyNameDialog } from '@/components/army/army-name-dialog';
import { DeleteArmyDialog } from '@/components/army/delete-army-dialog';
import { SavedArmiesEmpty } from '@/components/army/saved-armies-empty';
import { SavedArmiesTable } from '@/components/army/saved-armies-table';
import {
  useDeleteArmy,
  useDuplicateArmy,
  useSavedArmies,
  useUpdateArmy,
} from '@/components/army/use-saved-armies';
import { useSavedArmyEntries } from '@/components/army/use-saved-army-entries';
import { useSavedArmyTableState } from '@/components/army/use-saved-army-table-state';
import { ChipGroup } from '@/components/chip-group';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { useSheetExport } from '@/components/export/use-sheet-export';
import { LoadFailure } from '@/components/load-failure';
import { SearchField } from '@/components/search-field';
import { ShareLinkDialog } from '@/components/share/share-link-dialog';
import { useShareLink } from '@/components/share/use-share-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCurrentDataVersion } from '@/components/use-current-data-version';
import { useSession } from '@/lib/auth/client';
import { isSignedIn } from '@/lib/auth/session';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import { searchSavedArmies } from '@/lib/domain/army/saved-army-index';
import { savedSelectionOf } from '@/lib/domain/army/selection-schema';
import { savableGames } from '@/lib/domain/game';
import { describeError } from '@/lib/errors';
import { routes } from '@/lib/navigation';

const noArmies: readonly SavedArmy[] = [];

const sheetList = (army: SavedArmy) => ({
  name: army.name,
  ...savedSelectionOf(army),
});

export function MyArmies({ armyCount }: { armyCount: number }) {
  const t = useTranslations('armies');
  const { data: session } = useSession();
  const armies = useSavedArmies();
  const dataVersion = useCurrentDataVersion();
  const g = useTranslations('games');
  const {
    search,
    setSearch,
    games: chosenGames,
    setGames,
    sorting,
    setSorting,
  } = useSavedArmyTableState();
  const { entries, pricing } = useSavedArmyEntries(armies.data ?? noArmies);
  const matches = useMemo(
    () => searchSavedArmies(entries, search, chosenGames),
    [entries, search, chosenGames],
  );
  const rename = useUpdateArmy();
  const duplicate = useDuplicateArmy();
  const remove = useDeleteArmy();
  const shareLink = useShareLink();
  const exportSheet = useSheetExport();
  const [renaming, setRenaming] = useState<SavedArmy | null>(null);
  const [deleting, setDeleting] = useState<SavedArmy | null>(null);
  const duplicateArmy = duplicate.mutate;
  const shareArmy = shareLink.share;

  const actionsFor = useCallback(
    (army: SavedArmy) => ({
      onPreviewPdf: () => exportSheet(sheetList(army), 'inline'),
      onDownloadPdf: () => exportSheet(sheetList(army), 'attachment'),
      onShare: () => shareArmy(sheetList(army)),
      onRename: () => setRenaming(army),
      onDuplicate: () =>
        duplicateArmy(
          { id: army.id },
          { onError: (error) => toast.error(describeError(error)) },
        ),
      onDelete: () => setDeleting(army),
    }),
    [duplicateArmy, shareArmy, exportSheet],
  );

  if (armies.isError || dataVersion.isError) {
    return (
      <LoadFailure
        title={t('savedLoadFailed')}
        message={describeError(armies.error ?? dataVersion.error)}
      />
    );
  }

  if (armies.isPending || dataVersion.isPending) {
    return <ArmyRowsSkeleton />;
  }

  if (entries.length === 0) {
    return (
      <SavedArmiesEmpty signedIn={isSignedIn(session)} armyCount={armyCount} />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!isSignedIn(session) && (
        <Alert variant="warning">
          <IconAlertTriangle />
          <AlertTitle>{t('savedInBrowser')}</AlertTitle>
          <AlertDescription>
            {t.rich('savedInBrowserSignIn', {
              link: (chunks) => <Link href={routes.signIn}>{chunks}</Link>,
            })}
          </AlertDescription>
        </Alert>
      )}

      <SearchField
        label={t('searchYourLists')}
        placeholder={t('searchYourListsPlaceholder')}
        value={search}
        onChange={setSearch}
      />

      <ChipGroup
        label={t('gameFilter')}
        options={savableGames}
        selected={chosenGames}
        onToggle={(game) =>
          setGames(
            chosenGames.includes(game)
              ? chosenGames.filter((chosen) => chosen !== game)
              : [...chosenGames, game],
          )
        }
        labelFor={(game) => g(game)}
      />

      {matches.length === 0 ? (
        <EmptyState
          title={t('noListMatches')}
          actions={
            <Button
              variant="outline"
              size="touch"
              onClick={() => {
                setSearch('');
                setGames([]);
              }}
            >
              {chosenGames.length > 0
                ? t('clearSearchAndFilters')
                : t('clearSearch')}
            </Button>
          }
        >
          <EmptyStateText>
            {chosenGames.length > 0
              ? t('noSavedFilterMatchesBody')
              : t('noSavedMatchesBody')}
          </EmptyStateText>
        </EmptyState>
      ) : (
        <SavedArmiesTable
          entries={matches}
          sorting={sorting}
          onSortingChange={setSorting}
          pricing={pricing}
          dataVersion={dataVersion.data}
          actionsFor={actionsFor}
        />
      )}

      <ArmyNameDialog
        open={renaming !== null}
        title={t('renameList')}
        submit={t('rename')}
        working={t('renaming')}
        name={renaming?.name ?? ''}
        onOpenChange={(open) => !open && setRenaming(null)}
        onSubmit={(name) =>
          renaming
            ? rename.mutateAsync({ id: renaming.id, name })
            : Promise.resolve()
        }
      />

      <ShareLinkDialog {...shareLink.dialog} />

      <DeleteArmyDialog
        name={deleting?.name ?? null}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() =>
          deleting ? remove.mutateAsync({ id: deleting.id }) : Promise.resolve()
        }
      />
    </div>
  );
}
