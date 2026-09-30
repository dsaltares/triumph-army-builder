import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CategoryBrowser } from '@/components/category/category-browser';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';
import {
  armyCountsByCategory,
  yearSpansByCategory,
} from '@/lib/domain/army-index';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('categories'),
});

export default async function CategoriesPage() {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const [categories, { armies }] = await Promise.all([
    reference.bundle.readThematicCategories(),
    reference.bundle.readArmyIndex(),
  ]);
  const counts = armyCountsByCategory(armies);
  const spans = yearSpansByCategory(armies);
  return (
    <>
      <PageHeader
        title={t('categories')}
        description={t('categoriesDescription', { count: categories.length })}
      />
      <CategoryBrowser
        categories={categories.map(({ id, name }) => ({
          id,
          name,
          armyCount: counts.get(id) ?? 0,
          span: spans.get(id),
        }))}
      />
    </>
  );
}
