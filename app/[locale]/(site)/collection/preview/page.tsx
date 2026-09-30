import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { DraftViewActions } from '@/components/share/draft-view-actions';
import { SharedListView } from '@/components/share/shared-list-view';
import { getAuth } from '@/lib/auth/auth';
import { isAnonymousSession } from '@/lib/auth/session';
import {
  type ServedReference,
  servedReference,
} from '@/lib/data/served-bundle';
import { getDatabase } from '@/lib/db/client';
import { onlyParam, routes, type SearchParamsProps } from '@/lib/navigation';
import { loadDraftView, sharedListSummary } from '@/lib/share/shared-view';

const draftView = cache(
  async (reference: ServedReference, code: string | null) => {
    if (code === null) {
      return null;
    }
    const session = await getAuth().api.getSession({
      headers: await headers(),
    });
    const { readArmyDetail, readBattleCards, readTroopTypes } =
      reference.bundle;
    return loadDraftView({
      db: getDatabase(),
      bundle: { readArmyDetail, readBattleCards, readTroopTypes },
      code,
      userId: session && !isAnonymousSession(session) ? session.user.id : null,
    });
  },
);

const codeOf = async ({ searchParams }: SearchParamsProps) =>
  onlyParam((await searchParams).s);

export const generateMetadata = async (
  props: SearchParamsProps,
): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const view = reference && (await draftView(reference, await codeOf(props)));
  return {
    ...(view ? { title: view.list.name } : {}),
    robots: { index: false, follow: false },
  };
};

export default async function UnsavedListPage(props: SearchParamsProps) {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const view = await draftView(reference, await codeOf(props));
  if (!view) {
    notFound();
  }
  const pages = await getTranslations('pages');
  return (
    <>
      <PageHeader
        back={{ href: routes.collection, label: pages('collection') }}
        title={view.list.name}
        description={sharedListSummary(view, locale)}
        action={
          <DraftViewActions
            list={view.list}
            sheet={view.sheet}
            collection={view.collection}
          />
        }
      />
      <SharedListView view={view} currentDataVersion={reference.dataVersion} />
    </>
  );
}
