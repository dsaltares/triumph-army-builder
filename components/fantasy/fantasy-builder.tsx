'use client';

import { useTranslations } from 'next-intl';
import { useSavedArmy } from '@/components/army/use-saved-armies';
import { BuilderSkeleton } from '@/components/builder/builder-skeleton';
import { useSavedListId } from '@/components/builder/use-saved-list';
import { FantasyBuilderView } from '@/components/fantasy/fantasy-builder-view';
import { useFantasyReference } from '@/components/fantasy/use-fantasy-reference';
import { LoadFailure } from '@/components/load-failure';
import { useErrorMessage } from '@/components/use-error-message';
import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import { describeError } from '@/lib/errors';

export function FantasyBuilder({
  draft = null,
}: {
  draft?: FantasySelection | null;
}) {
  const t = useTranslations('fantasyBuilder');
  const errorMessage = useErrorMessage();
  const [listId] = useSavedListId();
  const saved = useSavedArmy(listId);
  const state = useFantasyReference();

  if (state.status === 'failed') {
    return (
      <LoadFailure
        title={t('packLoadFailed')}
        message={errorMessage(state.error) ?? ''}
      />
    );
  }

  if (listId !== null && saved.isError) {
    return (
      <LoadFailure
        title={t('savedListFailed')}
        message={describeError(saved.error)}
      />
    );
  }

  if (state.status === 'loading' || (listId !== null && saved.isPending)) {
    return <BuilderSkeleton label={t('loadingList')} />;
  }

  const fantasyList = saved.data?.game === 'fantasy' ? saved.data : null;
  return (
    <FantasyBuilderView
      key={fantasyList?.id ?? 'unsaved'}
      dataVersion={state.dataVersion}
      reference={state.reference}
      saved={fantasyList}
      draft={draft}
    />
  );
}
