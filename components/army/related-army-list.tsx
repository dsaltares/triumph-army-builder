import { useLocale } from 'next-intl';
import { LinkCard, LinkCardGrid } from '@/components/layout/link-card';
import type { RelatedArmy } from '@/lib/domain/related-armies';
import { formatYearSpan } from '@/lib/format';
import { armyUrl } from '@/lib/navigation';

type RelatedArmyListProps = {
  armies: readonly RelatedArmy[];
  empty: string;
};

export function RelatedArmyList({ armies, empty }: RelatedArmyListProps) {
  const locale = useLocale();
  if (armies.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <LinkCardGrid>
      {armies.map((army) => (
        <LinkCard
          key={army.id}
          href={armyUrl(army.id)}
          title={army.name}
          meta={`${army.key} \u00b7 ${formatYearSpan(army, locale)}`}
        />
      ))}
    </LinkCardGrid>
  );
}
