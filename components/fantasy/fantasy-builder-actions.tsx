'use client';

import { IconLink } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  type SavedListView,
  ViewListItem,
} from '@/components/builder/builder-actions';
import { ListActionsMenu } from '@/components/builder/list-actions-menu';
import {
  AutosaveStatus,
  SaveDraftAction,
} from '@/components/builder/save-list';
import { useAutosave } from '@/components/builder/use-autosave';
import {
  type FantasyBuilderSnapshot,
  useFantasySnapshot,
} from '@/components/fantasy/fantasy-builder-state';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { FantasySavedArmy } from '@/lib/domain/army/saved-army';
import { encodeShareCode } from '@/lib/domain/army/share-codec';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import { fantasy } from '@/lib/domain/games/fantasy';
import { draftListUrl } from '@/lib/navigation';

export const fantasyDraftUrl = (selection: FantasySelection) =>
  `${window.location.origin}${draftListUrl({
    game: fantasy.game,
    code: encodeShareCode({ game: fantasy.game, selection }),
  })}`;

function FantasyListMenu({
  snapshot,
  view,
}: {
  snapshot: FantasyBuilderSnapshot;
  view: SavedListView | null;
}) {
  const t = useTranslations('fantasyBuilder');
  const { listName, selection, reference } = snapshot;
  const sheet = useMemo(
    () =>
      fantasy.sheetData(
        {
          name: listName.trim() || fantasy.subjectName(reference),
          selection,
        },
        reference,
      ),
    [listName, selection, reference],
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fantasyDraftUrl(selection));
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyFailed'));
    }
  };

  return (
    <ListActionsMenu
      sheet={{ game: fantasy.game, sheet }}
      list={{ game: fantasy.game, selection }}
    >
      {view && <ViewListItem {...view} />}
      <DropdownMenuItem onClick={copyLink}>
        <IconLink />
        {t('copyLink')}
      </DropdownMenuItem>
    </ListActionsMenu>
  );
}

function SavedFantasyActions({
  snapshot,
  saved,
}: {
  snapshot: FantasyBuilderSnapshot;
  saved: FantasySavedArmy;
}) {
  const list = useMemo(
    () => ({ game: fantasy.game, selection: snapshot.selection }),
    [snapshot.selection],
  );
  const autosave = useAutosave({ saved, listName: snapshot.listName, list });

  return (
    <>
      <AutosaveStatus {...autosave} />
      <FantasyListMenu
        snapshot={snapshot}
        view={{ id: saved.id, settle: autosave.settle }}
      />
    </>
  );
}

export function FantasyBuilderActions() {
  const snapshot = useFantasySnapshot();

  if (!snapshot) {
    return null;
  }

  return snapshot.saved ? (
    <SavedFantasyActions snapshot={snapshot} saved={snapshot.saved} />
  ) : (
    <>
      <SaveDraftAction
        listName={snapshot.listName}
        list={{ game: fantasy.game, selection: snapshot.selection }}
      />
      <FantasyListMenu snapshot={snapshot} view={null} />
    </>
  );
}
