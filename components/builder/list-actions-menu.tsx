'use client';

import {
  IconChecklist,
  IconClipboardText,
  IconDownload,
  IconEye,
  IconLink,
  IconMenu2,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { CopyListDialog } from '@/components/builder/copy-list-dialog';
import { useSheetExport } from '@/components/export/use-sheet-export';
import { ShareLinkDialog } from '@/components/share/share-link-dialog';
import { useShareLink } from '@/components/share/use-share-link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ArmySelection } from '@/lib/domain/army/selection';
import type { ArmySheet } from '@/lib/domain/army/sheet';
import type { ViewableGame } from '@/lib/domain/game';

const useListExport = (
  sheet: ArmySheet,
  game: ViewableGame,
  selection: ArmySelection,
) => {
  const t = useTranslations('builder');
  const { share, dialog } = useShareLink();
  const exportSheet = useSheetExport();
  const [copying, setCopying] = useState(false);
  const list = { name: sheet.listName, game, selection };

  const sharing = (
    <>
      <DropdownMenuItem onClick={() => share(list)}>
        <IconLink />
        {t('shareLink')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => setCopying(true)}>
        <IconClipboardText />
        {t('copyAsText')}
      </DropdownMenuItem>
    </>
  );

  const sheetItems = (
    <>
      <DropdownMenuItem onClick={() => exportSheet(list, 'inline')}>
        <IconEye />
        {t('previewPdf')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => exportSheet(list, 'attachment')}>
        <IconDownload />
        {t('downloadPdf')}
      </DropdownMenuItem>
    </>
  );

  const dialogs = (
    <>
      {copying && (
        <CopyListDialog
          open
          sheet={sheet}
          siteUrl={window.location.origin}
          onOpenChange={setCopying}
        />
      )}
      <ShareLinkDialog {...dialog} />
    </>
  );

  return { sharing, sheet: sheetItems, dialogs };
};

export function ListActionsMenu({
  sheet,
  game,
  selection,
  onCanIBuildIt,
  children,
}: {
  sheet: ArmySheet;
  game: ViewableGame;
  selection: ArmySelection;
  onCanIBuildIt: () => void;
  children?: ReactNode;
}) {
  const t = useTranslations('builder');
  const coverageWords = useTranslations('coverage');
  const {
    sharing,
    sheet: sheetItems,
    dialogs,
  } = useListExport(sheet, game, selection);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="icon-touch"
              className="shrink-0"
              aria-label={t('listActions')}
            />
          }
        >
          <IconMenu2 />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {children}
          <DropdownMenuItem onClick={onCanIBuildIt}>
            <IconChecklist />
            {coverageWords('canIBuildIt')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('export')}</DropdownMenuLabel>
            {sharing}
            {sheetItems}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}
