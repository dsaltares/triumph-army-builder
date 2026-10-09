import { getLocale, getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArmyBuilder } from '@/components/builder/army-builder';
import { BuilderSkeleton } from '@/components/builder/builder-skeleton';
import { BuilderStateProvider } from '@/components/builder/builder-state';
import { BuilderActions } from '@/components/builder/builder-actions';
import { ListTitle } from '@/components/builder/list-title';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { type ServedReference, servedReference } from '@/lib/data/served-bundle';
import { triumphRules } from '@/lib/domain/games/triumph-rules';
import { formatYearSpan } from '@/lib/format';
import { armyUrl, type IdRouteProps } from '@/lib/navigation';

const armyEntry = async (reference: ServedReference | null, id: string) =>
  (await reference?.bundle.readArmyIndex())?.armies.find(
    (army) => army.id === id,
  ) ?? null;

export const generateMetadata = async ({
  params,
}: IdRouteProps): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const army = await armyEntry(reference, (await params).id);
  if (!army) {
    return {};
  }
  const t = await getTranslations('pages');
  return {
    title: t('buildTitle', { name: army.name }),
    description: t('buildDescription', {
      name: army.name,
      cap: triumphRules.pointsCap,
    }),
  };
};

export default async function BuildArmyPage({ params }: IdRouteProps) {
  const { id } = await params;
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const army = await armyEntry(reference, id);
  if (!army) {
    notFound();
  }
  return (
    <BuilderStateProvider>
      <PageHeader
        back={{ href: armyUrl(id), label: army.name }}
        title={<ListTitle armyName={army.name} />}
        description={`${army.name} · ${formatYearSpan(army, locale)}`}
        action={
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <BuilderActions />
          </div>
        }
      />
      <Suspense fallback={<BuilderSkeleton />}>
        <ArmyBuilder armyId={id} />
      </Suspense>
    </BuilderStateProvider>
  );
}
