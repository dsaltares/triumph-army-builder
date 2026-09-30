'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Notice } from '@/components/notice';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useErrorMessage } from '@/components/use-error-message';

export type DeleteArmyDialogProps = {
  name: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<unknown>;
};

export function DeleteArmyDialog({
  name,
  onOpenChange,
  onConfirm,
}: DeleteArmyDialogProps) {
  const t = useTranslations('armies');
  const describe = useErrorMessage();
  const [failure, setFailure] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  return (
    <Dialog open={name !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('deleteTitle', { name: name ?? '' })}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('deleteDescription')}</DialogDescription>
        {failure && <Notice>{failure}</Notice>}
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" size="touch" />}
          >
            {t('keepIt')}
          </DialogClose>
          <Button
            variant="destructive"
            size="touch"
            disabled={deleting}
            onClick={async () => {
              setFailure(undefined);
              setDeleting(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch (thrown: unknown) {
                setFailure(describe(thrown));
              } finally {
                setDeleting(false);
              }
            }}
          >
            {deleting ? t('deleting') : t('deleteList')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
