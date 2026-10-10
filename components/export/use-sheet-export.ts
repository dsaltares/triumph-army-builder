'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { useShareId } from '@/components/share/use-share-link';
import type { SavedSelection } from '@/lib/domain/army/selection-schema';
import { encodeShareCode } from '@/lib/domain/army/share-codec';
import { listSheetUrl, type SheetDisposition } from '@/lib/navigation';

export type SheetList = { name: string } & SavedSelection;

const deliverSheet = (
  disposition: SheetDisposition,
  reservedTab: Window | null,
  url: string,
) => {
  if (disposition === 'attachment') {
    window.location.assign(url);
    return;
  }
  if (reservedTab) {
    reservedTab.location.replace(url);
    return;
  }
  window.open(url, '_blank', 'noreferrer');
};

export const useSheetExport = () => {
  const locale = useLocale();
  const shareId = useShareId();

  return useCallback(
    async ({ name, ...list }: SheetList, disposition: SheetDisposition) => {
      const reservedTab =
        disposition === 'inline' ? window.open('', '_blank') : null;
      deliverSheet(
        disposition,
        reservedTab,
        listSheetUrl({
          code: encodeShareCode(list),
          name,
          share: await shareId({ name, ...list }),
          lang: locale,
          disposition,
        }),
      );
    },
    [locale, shareId],
  );
};
