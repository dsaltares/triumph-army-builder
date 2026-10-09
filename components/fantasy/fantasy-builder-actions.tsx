'use client';

import { IconLink, IconMenu2 } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { toast } from 'sonner';
import {
  AutosaveStatus,
  SaveDraftAction,
} from '@/components/builder/save-list';
import { useAutosave } from '@/components/builder/use-autosave';
import {
  type FantasyBuilderSnapshot,
  useFantasySnapshot,
} from '@/components/fantasy/fantasy-builder-state';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

function FantasyListMenu({ selection }: { selection: FantasySelection }) {
  const t = useTranslations('fantasyBuilder');
  const b = useTranslations('builder');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fantasyDraftUrl(selection));
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyFailed'));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-touch"
            className="shrink-0"
            aria-label={b('listActions')}
          />
        }
      >
        <IconMenu2 />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem onClick={copyLink}>
          <IconLink />
          {t('copyLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
      <FantasyListMenu selection={snapshot.selection} />
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
      <FantasyListMenu selection={snapshot.selection} />
    </>
  );
}
