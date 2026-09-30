import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ArmyIndexView } from '@/components/army/army-index';
import { ArmyIndexSkeleton } from '@/components/army/army-index-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import {
  type ServedReference,
  servedReference,
} from '@/lib/data/served-bundle';
import { armyCountsByCategory } from '@/lib/domain/army-index';
import { formatArmyListCount } from '@/lib/format';
import { type IdRouteProps, routes } from '@/lib/navigation';

const findCategory = async (reference: ServedReference | null, id: string) =>
  (await reference?.bundle.readThematicCategories())?.find(
    (category) => category.id === id,
  ) ?? null;

export const generateMetadata = async ({
  params,
}: IdRouteProps): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const category = await findCategory(reference, (await params).id);
  if (!category) {
    return {};
  }
  const t = await getTranslations('pages');
  return {
    title: category.name,
    description: t('categoryDescription', { name: category.name }),
  };
};

export default async function CategoryPage({ params }: IdRouteProps) {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const t = await getTranslations('pages');
  const [category, { armies }] = await Promise.all([
    findCategory(reference, (await params).id),
    reference.bundle.readArmyIndex(),
  ]);
  if (!category) {
    notFound();
  }
  const armyCount = armyCountsByCategory(armies).get(category.id) ?? 0;
  return (
    <>
      <PageHeader
        back={{ href: routes.categories, label: t('allCategories') }}
        title={category.name}
        description={t('categoryArmies', {
          count: formatArmyListCount(armyCount, locale),
        })}
      />
      <Suspense fallback={<ArmyIndexSkeleton />}>
        <ArmyIndexView categoryId={category.id} />
      </Suspense>
    </>
  );
}
