import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { ArmyIndexEntry } from '@/lib/data/bundle';
import { formatYearSpan } from '@/lib/format';
import { armyUrl, categoryUrl } from '@/lib/navigation';

const ratings = (values: readonly number[]) => values.join(' / ');

export type RowCategory = {
  id: string;
  name: string;
};

export function ArmyRow({
  army,
  categories,
}: {
  army: ArmyIndexEntry;
  categories: readonly RowCategory[];
}) {
  const locale = useLocale();
  const t = useTranslations('armies');
  return (
    <article className="border-b border-border">
      <div className="relative -mx-2 flex flex-col gap-2 rounded-md px-2 py-3 transition-colors hover:bg-muted has-[[data-army-link]:focus-visible]:ring-2 has-[[data-army-link]:focus-visible]:ring-ring">
        <span className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium text-balance">
            <Link
              href={armyUrl(army.id)}
              data-army-link
              className="after:absolute after:inset-0 after:rounded-md focus-visible:outline-none"
            >
              {army.name}
            </Link>
          </h2>
          {army.status === 'DRAFT' && (
            <Badge variant="outline">{t('draft')}</Badge>
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatYearSpan(army, locale)}
          </span>
          {t('ratings', {
            invasion: ratings(army.invasion),
            manoeuvre: ratings(army.maneuver),
          })}
          {army.topographies.map((topography) => ` · ${topography}`)}
        </span>
        {categories.length > 0 && (
          <ul
            aria-label={t('thematicCategories')}
            className="relative z-10 flex w-fit flex-wrap items-center gap-x-2 -my-2"
          >
            {categories.map(({ id, name }) => (
              <li key={id}>
                <Link
                  href={categoryUrl(id)}
                  className="group/category flex min-h-11 items-center focus-visible:outline-none"
                >
                  <Badge
                    variant="outline"
                    className="group-hover/category:bg-background group-hover/category:underline group-focus-visible/category:ring-2 group-focus-visible/category:ring-ring"
                  >
                    {name}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
