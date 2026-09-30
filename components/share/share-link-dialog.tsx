'use client';

import { IconCheck, IconCopy } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ListQr = lazy(async () => ({
  default: (await import('@/components/share/list-qr')).ListQr,
}));

const qrSize = 132;

export type ShareLinkDialogProps = {
  open: boolean;
  pending: boolean;
  error: string | null;
  url: string | null;
  onOpenChange: (open: boolean) => void;
};

const copyThroughSelection = (input: HTMLInputElement | null) => {
  if (!input) {
    return false;
  }
  input.focus();
  input.select();
  return document.execCommand('copy');
};

export function ShareLinkDialog({
  open,
  pending,
  error,
  url,
  onOpenChange,
}: ShareLinkDialogProps) {
  const t = useTranslations('share');
  const [copied, setCopied] = useState(false);
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);

  const reportCopied = () => {
    setCopied(true);
    toast.success(t('linkCopied'));
  };

  const copy = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      reportCopied();
    } catch {
      if (copyThroughSelection(input.current)) {
        reportCopied();
        return;
      }
      toast.error(t('copyFailed'));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setCopied(false);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shareThisList')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t('shareDescription')}</DialogDescription>
        {error && <Notice>{error}</Notice>}
        {pending && (
          <p className="text-sm text-muted-foreground">{t('makingLink')}</p>
        )}
        {url && (
          <div className="flex flex-col items-center gap-4">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded-sm outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Suspense
                fallback={
                  <div
                    className="rounded-sm border border-border bg-muted"
                    style={{ width: qrSize, height: qrSize }}
                  />
                }
              >
                <ListQr url={url} size={qrSize} />
              </Suspense>
            </a>
            <div className="flex w-full flex-col gap-2">
              <Label htmlFor={inputId}>{t('link')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={input}
                  id={inputId}
                  readOnly
                  value={url}
                  className="h-11 sm:h-9"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="touch"
                  className="shrink-0"
                  onClick={copy}
                >
                  {copied ? (
                    <IconCheck data-icon="inline-start" />
                  ) : (
                    <IconCopy data-icon="inline-start" />
                  )}
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{t('scanHint')}</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" size="touch" />}>
            {t('done')}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
