'use client';

import { IconPencil } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListActionsMenu } from '@/components/builder/list-actions-menu';
import { CollectionCoverage } from '@/components/collection/collection-coverage';
import { HeaderActionLabel, iconOnlyBelowMd } from '@/components/header-action';
import { buttonVariants } from '@/components/ui/button';
import type { SavedArmy } from '@/lib/domain/army/saved-army';
import { savedSelectionOf } from '@/lib/domain/army/selection-schema';
import type { CollectionReading } from '@/lib/domain/army/shared-view';
import type { ListSheet } from '@/lib/domain/games/registry';
import { savedListUrl } from '@/lib/navigation';

export function ListViewActions({
  list,
  sheet,
  collection,
}: {
  list: SavedArmy;
  sheet: ListSheet;
  collection: CollectionReading | null;
}) {
  const t = useTranslations('share');
  const [coverageOpen, setCoverageOpen] = useState(false);
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
        onCanIBuildIt={collection ? () => setCoverageOpen(true) : undefined}
      />
      {collection && (
        <CollectionCoverage
          armyId={list.id}
          collection={collection}
          control={{ open: coverageOpen, onOpenChange: setCoverageOpen }}
        />
      )}
    </div>
  );
}
