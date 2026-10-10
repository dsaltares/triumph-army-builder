'use client';

import { IconCopy } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ListSheet } from '@/lib/domain/games/registry';
import {
  type ListTextFormat,
  listText,
  listTextFormats,
} from '@/lib/export/list-text';

const formatLabels = {
  plain: 'plainText',
  markdown: 'markdown',
  bbcode: 'bbcode',
} as const satisfies Record<ListTextFormat, string>;

const formatHints = {
  plain: 'plainHint',
  markdown: 'markdownHint',
  bbcode: 'bbcodeHint',
} as const satisfies Record<ListTextFormat, string>;

export type CopyListDialogProps = {
  open: boolean;
  sheet: ListSheet;
  siteUrl: string;
  onOpenChange: (open: boolean) => void;
};

function ListPreview({ text }: { text: string }) {
  const t = useTranslations('builder');
  return (
    <textarea
      readOnly
      spellCheck={false}
      aria-label={t('listText')}
      value={text}
      className="h-64 w-full resize-none rounded-md bg-muted/40 p-3 font-mono text-[0.6875rem]/relaxed ring-1 ring-foreground/10 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
  );
}

export function CopyListDialog({
  open,
  sheet,
  siteUrl,
  onOpenChange,
}: CopyListDialogProps) {
  const t = useTranslations('builder');
  const locale = useLocale();
  const [format, setFormat] = useState<ListTextFormat>('plain');
  const textFor = (marks: ListTextFormat) =>
    listText(sheet, { format: marks, siteUrl, locale });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(textFor(format));
      toast.success(
        t('copiedAs', {
          name: sheet.sheet.listName,
          format: t(formatLabels[format]),
        }),
      );
      onOpenChange(false);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t('copyThisList')}</DialogTitle>
        </DialogHeader>
        <DialogDescription>{t(formatHints[format])}</DialogDescription>
        <Tabs
          value={format}
          onValueChange={(value) => setFormat(value as ListTextFormat)}
        >
          <TabsList>
            {listTextFormats.map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(formatLabels[value])}
              </TabsTrigger>
            ))}
          </TabsList>
          {listTextFormats.map((value) => (
            <TabsContent key={value} value={value}>
              {value === format && <ListPreview text={textFor(value)} />}
            </TabsContent>
          ))}
        </Tabs>
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" size="touch" />}
          >
            {t('close')}
          </DialogClose>
          <Button type="button" size="touch" onClick={copy}>
            <IconCopy data-icon="inline-start" />
            {t('copy')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
