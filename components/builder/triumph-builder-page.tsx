import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ArmyBuilder } from '@/components/builder/army-builder';
import { BuilderActions } from '@/components/builder/builder-actions';
import { BuilderSkeleton } from '@/components/builder/builder-skeleton';
import { BuilderStateProvider } from '@/components/builder/builder-state';
import { ListTitle } from '@/components/builder/list-title';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import {
  type ServedReference,
  servedReference,
} from '@/lib/data/served-bundle';
import type { ArmySelection } from '@/lib/domain/army/selection';
import { triumphRules } from '@/lib/domain/games/triumph-rules';
import { formatYearSpan } from '@/lib/format';
import { armyUrl } from '@/lib/navigation';

export type TriumphBuilderTarget = {
  armyId: string;
  draft?: ArmySelection | null;
};

const armyEntry = async (reference: ServedReference | null, id: string) =>
  (await reference?.bundle.readArmyIndex())?.armies.find(
    (army) => army.id === id,
  ) ?? null;

export const triumphBuilderMetadata = async (
  armyId: string | null,
): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const army = armyId === null ? null : await armyEntry(reference, armyId);
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

export async function TriumphBuilderPage({
  armyId,
  draft = null,
}: TriumphBuilderTarget) {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const army = await armyEntry(reference, armyId);
  if (!army) {
    notFound();
  }
  return (
    <BuilderStateProvider>
      <PageHeader
        back={{ href: armyUrl(armyId), label: army.name }}
        title={<ListTitle armyName={army.name} />}
        description={`${army.name} · ${formatYearSpan(army, locale)}`}
        action={
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <BuilderActions />
          </div>
        }
      />
      <Suspense fallback={<BuilderSkeleton />}>
        <ArmyBuilder armyId={armyId} draft={draft} />
      </Suspense>
    </BuilderStateProvider>
  );
}
