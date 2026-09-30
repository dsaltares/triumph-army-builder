'use client';

import { useTranslations } from 'next-intl';
import {
  CategoryList,
  type ListedCategory,
} from '@/components/category/category-list';
import { EmptyState, EmptyStateText } from '@/components/empty-state';
import { SearchField } from '@/components/search-field';
import { Button } from '@/components/ui/button';
import { useFuzzyFilter } from '@/lib/hooks/use-fuzzy-filter';

export function CategoryBrowser({
  categories,
}: {
  categories: readonly ListedCategory[];
}) {
  const t = useTranslations('armies');
  const { query, setQuery, settledQuery, matches } = useFuzzyFilter(categories);

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        label={t('searchCategories')}
        placeholder={t('searchCategories')}
        value={query}
        onChange={setQuery}
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {settledQuery
          ? t('categoriesShown', {
              matches: matches.length,
              total: categories.length,
            })
          : t('categoriesCount', { count: categories.length })}
      </p>
      {matches.length === 0 ? (
        <EmptyState
          title={t('noCategoryMatches')}
          actions={
            <Button variant="outline" size="touch" onClick={() => setQuery('')}>
              {t('clearSearch')}
            </Button>
          }
        >
          <EmptyStateText>
            {t('noCategoryMatchesBody', { query: settledQuery })}
          </EmptyStateText>
        </EmptyState>
      ) : (
        <CategoryList categories={matches} />
      )}
    </div>
  );
}
