import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BuilderSkeleton } from '@/components/builder/builder-skeleton';
import { FantasyBuilder } from '@/components/fantasy/fantasy-builder';
import { FantasyBuilderActions } from '@/components/fantasy/fantasy-builder-actions';
import { FantasyBuilderStateProvider } from '@/components/fantasy/fantasy-builder-state';
import { FantasyListTitle } from '@/components/fantasy/fantasy-list-title';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { servedReference } from '@/lib/data/served-bundle';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import { fantasy } from '@/lib/domain/games/fantasy';
import { routes } from '@/lib/navigation';

export type FantasyBuilderTarget = {
  draft?: FantasySelection | null;
};

export async function FantasyBuilderPage({
  draft = null,
}: FantasyBuilderTarget) {
  const reference = await servedReference(await getLocale());
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  if (!(await reference.bundle.readGames()).includes(fantasy.game)) {
    notFound();
  }
  const t = await getTranslations('pages');
  const games = await getTranslations('games');
  return (
    <FantasyBuilderStateProvider>
      <PageHeader
        back={{ href: routes.myArmies, label: t('myArmies') }}
        title={<FantasyListTitle />}
        description={games('fantasy')}
        action={
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <FantasyBuilderActions />
          </div>
        }
      />
      <Suspense fallback={<BuilderSkeleton label={t('fantasyBuildTitle')} />}>
        <FantasyBuilder draft={draft} />
      </Suspense>
    </FantasyBuilderStateProvider>
  );
}
