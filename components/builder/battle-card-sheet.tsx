'use client';

import { IconExternalLink } from '@tabler/icons-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  describeCost,
  purchaseHints,
} from '@/components/builder/battle-card-cost';
import type { BattleCardTextState } from '@/components/builder/use-battle-card-text';
import { MarkdownProse } from '@/components/reference/markdown-prose';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { BattleCardCode } from '@/lib/data/schema';
import type { BattleCardChoice } from '@/lib/domain/army/battle-card-selection';
import { parseMarkdown } from '@/lib/markdown';
import { routes } from '@/lib/navigation';

function RulesText({
  code,
  state,
}: {
  code: BattleCardCode;
  state: BattleCardTextState;
}) {
  const t = useTranslations('builder');
  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t('loadingRules')}</span>
        <Skeleton className="h-4 w-4/5" aria-hidden="true" />
        <Skeleton className="h-4 w-full" aria-hidden="true" />
        <Skeleton className="h-4 w-3/5" aria-hidden="true" />
      </div>
    );
  }
  if (state.status === 'failed') {
    return <p className="text-xs text-muted-foreground">{t('rulesFailed')}</p>;
  }
  return (
    <MarkdownProse blocks={parseMarkdown(state.text[code])} headingLevel={4} />
  );
}

export function BattleCardSheet({
  card,
  state,
  onClose,
}: {
  card: Pick<
    BattleCardChoice,
    'code' | 'name' | 'purchasedPer' | 'rule'
  > | null;
  state: BattleCardTextState;
  onClose: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations('builder');
  return (
    <Sheet
      open={card !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {card && (
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
          <SheetHeader className="mx-auto w-full max-w-3xl pb-3">
            <SheetTitle className="flex items-center gap-2 pr-8 text-base">
              {card.name}
              <Badge variant="outline">{card.code}</Badge>
            </SheetTitle>
            <SheetDescription>
              {t('costAndPurchase', {
                cost: describeCost(card.rule, locale),
                purchase: t(purchaseHints[card.purchasedPer]),
              })}
            </SheetDescription>
          </SheetHeader>
          <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-6">
            <RulesText code={card.code} state={state} />
          </div>
          <div className="mx-auto w-full max-w-3xl px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            <a
              className="inline-flex items-center gap-2 text-xs font-medium underline-offset-4 hover:underline"
              href={`${routes.battleCards}#${card.code}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('everyCardInReference')}
              <IconExternalLink className="size-3.5" />
            </a>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}
