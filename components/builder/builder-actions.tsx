'use client';

import { IconDice5, IconListDetails } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type MouseEvent, useMemo, useState } from 'react';
import {
  type BuilderSnapshot,
  useBuilderSnapshot,
} from '@/components/builder/builder-state';
import { CoverageSheet } from '@/components/builder/coverage-sheet';
import { ListActionsMenu } from '@/components/builder/list-actions-menu';
import {
  AutosaveStatus,
  SaveDraftAction,
} from '@/components/builder/save-list';
import { useAutosave } from '@/components/builder/use-autosave';
import { useRandomizeList } from '@/components/builder/use-randomize-list';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { TriumphSavedArmy } from '@/lib/domain/army/saved-army';
import { armySheet } from '@/lib/domain/army/sheet';
import { triumph } from '@/lib/domain/games/triumph';
import { listViewUrl } from '@/lib/navigation';

export type SavedListView = {
  id: string;
  settle: () => Promise<void>;
};

const opensElsewhere = (event: MouseEvent) =>
  event.button !== 0 ||
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey;

function ViewListItem({ id, settle }: SavedListView) {
  const t = useTranslations('builder');
  const router = useRouter();
  const href = listViewUrl(id);

  return (
    <DropdownMenuItem
      render={<Link href={href} />}
      onClick={async (event) => {
        if (opensElsewhere(event)) {
          return;
        }
        event.preventDefault();
        await settle();
        router.push(href);
      }}
    >
      <IconListDetails />
      {t('viewList')}
    </DropdownMenuItem>
  );
}

export function BuilderMenu({
  snapshot,
  view,
}: {
  snapshot: BuilderSnapshot;
  view: SavedListView | null;
}) {
  const t = useTranslations('builder');
  const [coverageOpen, setCoverageOpen] = useState(false);
  const { armyList, listName, selection, costs, names, factors, movement } =
    snapshot;
  const sheet = useMemo(
    () =>
      armySheet({
        listName: listName.trim() || armyList.name,
        armyList,
        selection,
        costs,
        names,
        factors,
        movement,
        cardNames: {},
      }),
    [listName, armyList, selection, costs, names, factors, movement],
  );
  const randomize = useRandomizeList(snapshot);

  return (
    <>
      <ListActionsMenu
        sheet={sheet}
        game={triumph.game}
        selection={selection}
        onCanIBuildIt={() => setCoverageOpen(true)}
      >
        {view && (
          <>
            <ViewListItem {...view} />
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={randomize}>
          <IconDice5 />
          {t('randomize')}
        </DropdownMenuItem>
      </ListActionsMenu>
      <CoverageSheet
        armyList={armyList}
        selection={selection}
        costs={costs}
        names={names}
        factors={factors}
        movement={movement}
        control={{ open: coverageOpen, onOpenChange: setCoverageOpen }}
      />
    </>
  );
}

function SavedListActions({
  snapshot,
  saved,
}: {
  snapshot: BuilderSnapshot;
  saved: TriumphSavedArmy;
}) {
  const list = useMemo(
    () => ({ game: triumph.game, selection: snapshot.selection }),
    [snapshot.selection],
  );
  const autosave = useAutosave({ saved, listName: snapshot.listName, list });

  return (
    <>
      <AutosaveStatus {...autosave} />
      <BuilderMenu
        snapshot={snapshot}
        view={{ id: saved.id, settle: autosave.settle }}
      />
    </>
  );
}

export function BuilderActions() {
  const snapshot = useBuilderSnapshot();

  if (!snapshot) {
    return null;
  }

  return snapshot.saved ? (
    <SavedListActions snapshot={snapshot} saved={snapshot.saved} />
  ) : (
    <>
      <SaveDraftAction
        listName={snapshot.listName}
        list={{ game: triumph.game, selection: snapshot.selection }}
      />
      <BuilderMenu snapshot={snapshot} view={null} />
    </>
  );
}
