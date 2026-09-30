'use client';

import { IconPencil } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useOpenNewList } from '@/components/army/use-start-list';
import { ListActionsMenu } from '@/components/builder/list-actions-menu';
import { CollectionCoverage } from '@/components/collection/collection-coverage';
import { HeaderActionLabel, iconOnlyBelowMd } from '@/components/header-action';
import { Button } from '@/components/ui/button';
import type {
  CollectionReading,
  DraftList,
} from '@/lib/domain/army/shared-view';
import type { ArmySheet } from '@/lib/domain/army/sheet';

export function DraftViewActions({
  list,
  sheet,
  collection,
}: {
  list: DraftList;
  sheet: ArmySheet;
  collection: CollectionReading;
}) {
  const t = useTranslations('share');
  const { open, opening } = useOpenNewList();
  const [coverageOpen, setCoverageOpen] = useState(false);
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <Button
        size="touch"
        className={`shrink-0 ${iconOnlyBelowMd}`}
        disabled={opening}
        onClick={() => open(list.name, list.selection)}
      >
        <IconPencil data-icon="inline-start" />
        <HeaderActionLabel>{t('edit')}</HeaderActionLabel>
      </Button>
      <ListActionsMenu
        sheet={sheet}
        selection={list.selection}
        onCanIBuildIt={() => setCoverageOpen(true)}
      />
      <CollectionCoverage
        armyId={null}
        collection={collection}
        control={{ open: coverageOpen, onOpenChange: setCoverageOpen }}
      />
    </div>
  );
}
