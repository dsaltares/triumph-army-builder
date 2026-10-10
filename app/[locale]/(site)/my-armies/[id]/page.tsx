import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { ListViewActions } from '@/components/share/list-view-actions';
import { SharedListView } from '@/components/share/shared-list-view';
import { getAuth } from '@/lib/auth/auth';
import { isAnonymousSession } from '@/lib/auth/session';
import { readFantasyReference } from '@/lib/data/game-reference';
import {
  type ServedReference,
  servedReference,
} from '@/lib/data/served-bundle';
import { getDatabase } from '@/lib/db/client';
import { type IdRouteProps, routes } from '@/lib/navigation';
import { loadSavedView, sharedListSummary } from '@/lib/share/shared-view';

const savedView = cache(async (reference: ServedReference, id: string) => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return loadSavedView({
    db: getDatabase(),
    bundle: reference.bundle,
    id,
    userId: session.user.id,
    isAnonymous: isAnonymousSession(session),
  });
});

export const generateMetadata = async ({
  params,
}: IdRouteProps): Promise<Metadata> => {
  const reference = await servedReference(await getLocale());
  const view = reference && (await savedView(reference, (await params).id));
  return {
    ...(view ? { title: view.list.name } : {}),
    robots: { index: false, follow: false },
  };
};

export default async function SavedListPage({ params }: IdRouteProps) {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const view = await savedView(reference, (await params).id);
  if (!view) {
    notFound();
  }
  const nav = await getTranslations('nav');
  const fantasyReference =
    view.game === 'fantasy'
      ? await readFantasyReference(reference.bundle)
      : null;
  return (
    <>
      <PageHeader
        back={{ href: routes.myArmies, label: nav('myArmies') }}
        title={view.list.name}
        description={sharedListSummary(view, locale)}
        action={
          <ListViewActions
            list={view.list}
            sheet={view}
            collection={view.collection}
            fantasyReference={fantasyReference}
          />
        }
      />
      <SharedListView view={view} currentDataVersion={reference.dataVersion} />
    </>
  );
}
