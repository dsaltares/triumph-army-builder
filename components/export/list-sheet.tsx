import { ArmySheetDocument } from '@/components/export/army-sheet';
import { FantasySheetDocument } from '@/components/export/fantasy-sheet';
import type { ListSheet } from '@/lib/domain/games/registry';
import type { Locale } from '@/lib/i18n/locales';

type SheetDocumentOptions = {
  generatedAt: Date;
  siteUrl: string;
  locale: Locale;
  shareUrl: string | null;
};

export const listSheetDocument = (
  list: ListSheet,
  options: SheetDocumentOptions,
) => {
  switch (list.game) {
    case 'triumph':
      return <ArmySheetDocument sheet={list.sheet} {...options} />;
    case 'fantasy':
      return <FantasySheetDocument sheet={list.sheet} {...options} />;
  }
};
