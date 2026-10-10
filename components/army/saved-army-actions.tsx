'use client';

import {
  IconCopy,
  IconCursorText,
  IconDots,
  IconDownload,
  IconEye,
  IconLink,
  IconTrash,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type SavedArmyViewActions = {
  onPreviewPdf: () => void;
  onDownloadPdf: () => void;
  onShare: () => void;
};

export type SavedArmyActions = SavedArmyViewActions & {
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
};

export function SavedArmyActionsMenu({
  name,
  onPreviewPdf,
  onDownloadPdf,
  onShare,
  onRename,
  onDuplicate,
  onDelete,
}: SavedArmyActions & { name: string }) {
  const t = useTranslations('armies');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-touch" />}
      >
        <IconDots className="size-4" />
        <span className="sr-only">{t('actionsFor', { name })}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem onClick={onShare}>
          <IconLink />
          {t('shareLink')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPreviewPdf}>
          <IconEye />
          {t('previewPdf')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownloadPdf}>
          <IconDownload />
          {t('downloadPdf')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onRename}>
          <IconCursorText />
          {t('rename')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <IconCopy />
          {t('duplicate')}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <IconTrash />
          {t('delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
