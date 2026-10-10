'use client';

import { IconPencil } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListActionsMenu } from '@/components/builder/list-actions-menu';
import {
  CollectionCoverage,
  type SheetControl,
} from '@/components/collection/collection-coverage';
import { FantasyCoverageSheet } from '@/components/fantasy/fantasy-coverage-sheet';
import { HeaderActionLabel, iconOnlyBelowMd } from '@/components/header-action';
import { buttonVariants } from '@/components/ui/button';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import { savedSelectionOf } from '@/lib/domain/army/selection-schema';
import type { CollectionReading } from '@/lib/domain/army/shared-view';
import type { FantasyReference } from '@/lib/domain/fantasy/reference';
import type { ListSheet } from '@/lib/domain/games/registry';
import { savedListUrl } from '@/lib/navigation';

function ListCoverage({
  list,
  collection,
  fantasyReference,
  control,
}: {
  list: SavedArmy;
  collection: CollectionReading | null;
  fantasyReference: FantasyReference | null;
  control: SheetControl;
}) {
  if (collection) {
    return (
      <CollectionCoverage
        armyId={list.id}
        collection={collection}
        control={control}
      />
    );
  }
  return list.game === 'fantasy' && fantasyReference ? (
    <FantasyCoverageSheet
      selection={list.selection}
      reference={fantasyReference}
      control={control}
    />
  ) : null;
}

export function ListViewActions({
  list,
  sheet,
  collection,
  fantasyReference = null,
}: {
  list: SavedArmy;
  sheet: ListSheet;
  collection: CollectionReading | null;
  fantasyReference?: FantasyReference | null;
}) {
  const t = useTranslations('share');
  const [coverageOpen, setCoverageOpen] = useState(false);
  const coverable =
    collection !== null || (list.game === 'fantasy' && !!fantasyReference);
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Link
        href={savedListUrl(list)}
        className={buttonVariants({
          size: 'touch',
          className: ['shrink-0', iconOnlyBelowMd],
        })}
      >
        <IconPencil data-icon="inline-start" />
        <HeaderActionLabel>{t('edit')}</HeaderActionLabel>
      </Link>
      <ListActionsMenu
        sheet={sheet}
        list={savedSelectionOf(list)}
        onCanIBuildIt={coverable ? () => setCoverageOpen(true) : undefined}
      />
      <ListCoverage
        list={list}
        collection={collection}
        fantasyReference={fantasyReference}
        control={{ open: coverageOpen, onOpenChange: setCoverageOpen }}
      />
    </div>
  );
}
