import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';
import type { BattleCardAllowance } from '@/lib/domain/army/army-list';
import {
  type BattleCardNames,
  listedBattleCards,
} from '@/lib/domain/battle-cards/listing';
import { formatAllowance } from '@/lib/format';
import { cn } from '@/lib/utils';

type BattleCardListProps = {
  allowances: readonly BattleCardAllowance[];
  battleCardNames: BattleCardNames;
  empty: ReactNode;
  className?: string;
};

export function BattleCardList({
  allowances,
  battleCardNames,
  empty,
  className,
}: BattleCardListProps) {
  const locale = useLocale();
  const battleCards = listedBattleCards(allowances, battleCardNames);
  if (battleCards.length === 0) {
    return <p className="text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className={cn('flex flex-col gap-0.5', className)}>
      {battleCards.map((battleCard) => {
        const bounds = formatAllowance(battleCard.min, battleCard.max, locale);
        return (
          <li key={battleCard.code}>
            {battleCard.name}
            {bounds && (
              <span className="text-muted-foreground tabular-nums">
                {' '}
                {bounds}
              </span>
            )}
            {battleCard.note && (
              <span className="text-muted-foreground">
                {' '}
                ({battleCard.note})
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
