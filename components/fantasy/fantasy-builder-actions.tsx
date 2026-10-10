'use client';

import { IconChecklist, IconLink, IconMenu2 } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
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
import { FantasyCoverageSheet } from '@/components/fantasy/fantasy-coverage-sheet';
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

function FantasyListMenu({
  snapshot: { selection, reference },
}: {
  snapshot: FantasyBuilderSnapshot;
}) {
  const t = useTranslations('fantasyBuilder');
  const b = useTranslations('builder');
  const coverageWords = useTranslations('coverage');
  const [coverageOpen, setCoverageOpen] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(fantasyDraftUrl(selection));
      toast.success(t('linkCopied'));
    } catch {
      toast.error(t('linkCopyFailed'));
    }
  };

  return (
    <>
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
          <DropdownMenuItem onClick={() => setCoverageOpen(true)}>
            <IconChecklist />
            {coverageWords('canIBuildIt')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink}>
            <IconLink />
            {t('copyLink')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FantasyCoverageSheet
        selection={selection}
        reference={reference}
        control={{ open: coverageOpen, onOpenChange: setCoverageOpen }}
      />
    </>
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
      <FantasyListMenu snapshot={snapshot} />
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
      <FantasyListMenu snapshot={snapshot} />
    </>
  );
}
