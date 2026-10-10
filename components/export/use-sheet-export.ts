'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { useShareId } from '@/components/share/use-share-link';
import type { ArmySelection } from '@/lib/domain/army/selection';
import { encodeShareCode } from '@/lib/domain/army/share-codec';
import type { ViewableGame } from '@/lib/domain/game';
import { listSheetUrl, type SheetDisposition } from '@/lib/navigation';

export type SheetList = {
  game: ViewableGame;
  name: string;
  selection: ArmySelection;
};

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
    async (
      { game, name, selection }: SheetList,
      disposition: SheetDisposition,
    ) => {
      const reservedTab =
        disposition === 'inline' ? window.open('', '_blank') : null;
      deliverSheet(
        disposition,
        reservedTab,
        listSheetUrl({
          code: encodeShareCode({ game, selection }),
          name,
          share: await shareId({ name, game, selection }),
          lang: locale,
          disposition,
        }),
      );
    },
    [locale, shareId],
  );
};
