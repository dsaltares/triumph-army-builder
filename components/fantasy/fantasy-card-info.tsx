'use client';

import { IconInfoCircle } from '@tabler/icons-react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';
import { FantasyCardDetails } from '@/components/reference/fantasy-card-reference';
import { MarkdownProse } from '@/components/reference/markdown-prose';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { referenceStaleTime, useReference } from '@/components/use-reference';
import type { FantasyCardCode } from '@/lib/data/schema';
import { fantasyCardDescriber } from '@/lib/domain/fantasy/card-reference';
import { fantasyTroopTypeNames } from '@/lib/domain/fantasy/naming';
import type { FantasyReference } from '@/lib/domain/fantasy/reference';
import { parseMarkdown } from '@/lib/markdown';
import { useTRPC } from '@/lib/trpc/client';

type CardInfoReference = {
  describe: ReturnType<typeof fantasyCardDescriber>;
  cards: ReadonlyMap<FantasyCardCode, FantasyReference['cards'][number]>;
};

const CardInfoContext = createContext<CardInfoReference | null>(null);

export function FantasyCardInfoProvider({
  reference,
  children,
}: {
  reference: FantasyReference;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({
      describe: fantasyCardDescriber({
        troopTypeNames: fantasyTroopTypeNames(reference),
        cards: reference.cards,
        denseTopographies: reference.format.denseTopographies,
      }),
      cards: new Map(reference.cards.map((card) => [card.code, card])),
    }),
    [reference],
  );
  return <CardInfoContext value={value}>{children}</CardInfoContext>;
}

const useFantasyCardText = (wanted: boolean) => {
  const trpc = useTRPC();
  const { reference, error } = useReference();
  const text = useQuery(
    trpc.reference.gameBattleCardText.queryOptions(
      wanted && reference ? { ...reference, game: 'fantasy' } : skipToken,
      { staleTime: referenceStaleTime },
    ),
  );
  if (error || text.isError) {
    return { status: 'failed' } as const;
  }
  return text.data
    ? ({ status: 'ready', text: text.data } as const)
    : ({ status: 'loading' } as const);
};

function RulesText({ code, open }: { code: FantasyCardCode; open: boolean }) {
  const t = useTranslations('builder');
  const state = useFantasyCardText(open);
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
    return (
      <p className="text-xs text-muted-foreground">{t('cardRulesFailed')}</p>
    );
  }
  return (
    <MarkdownProse
      blocks={parseMarkdown(state.text[code] ?? '')}
      headingLevel={4}
    />
  );
}

export function FantasyCardInfo({ code }: { code: FantasyCardCode }) {
  const t = useTranslations('fantasyBuilder');
  const reference = useContext(CardInfoContext);
  const [open, setOpen] = useState(false);
  const card = reference?.cards.get(code);
  if (!reference || !card) {
    return null;
  }
  const described = reference.describe(card, '');
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-touch"
            className="shrink-0 text-muted-foreground"
            aria-label={t('cardRules', { card: card.name })}
          />
        }
      >
        <IconInfoCircle />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[min(60dvh,32rem)] w-[min(24rem,calc(100vw-2rem))] gap-3 overflow-y-auto overscroll-contain p-3 text-sm"
      >
        <PopoverTitle className="font-heading">{card.name}</PopoverTitle>
        <FantasyCardDetails
          card={described}
          rules={<RulesText code={code} open={open} />}
        />
      </PopoverContent>
    </Popover>
  );
}
