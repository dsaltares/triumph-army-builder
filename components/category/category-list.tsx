import { useLocale } from 'next-intl';
import { LinkCard, LinkCardGrid } from '@/components/layout/link-card';
import {
  formatArmyListCount,
  formatYearSpan,
  type YearSpan,
} from '@/lib/format';
import { categoryUrl } from '@/lib/navigation';

export type ListedCategory = {
  id: string;
  name: string;
  armyCount: number;
  span?: YearSpan | undefined;
};

export function CategoryList({
  categories,
}: {
  categories: readonly ListedCategory[];
}) {
  const locale = useLocale();
  return (
    <LinkCardGrid className="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {categories.map(({ id, name, armyCount, span }) => (
        <LinkCard
          key={id}
          href={categoryUrl(id)}
          title={name}
          meta={span && formatYearSpan(span, locale)}
        >
          {formatArmyListCount(armyCount, locale)}
        </LinkCard>
      ))}
    </LinkCardGrid>
  );
}
