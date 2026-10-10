import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ReferenceUnavailable } from '@/components/reference/reference-unavailable';
import { SaveSharedCopy } from '@/components/share/save-shared-copy';
import {
  SharedCopyBadge,
  SharedListView,
} from '@/components/share/shared-list-view';
import {
  type ServedReference,
  servedReference,
} from '@/lib/data/served-bundle';
import { getDatabase } from '@/lib/db/client';
import { savedSelectionOf } from '@/lib/domain/army/selection-schema';
import type { SharedView } from '@/lib/domain/army/shared-view';
import { armyUrl, type IdRouteProps } from '@/lib/navigation';
import { loadSharedView, sharedListSummary } from '@/lib/share/shared-view';

const sharedView = cache(async (reference: ServedReference, id: string) =>
  loadSharedView({ db: getDatabase(), bundle: reference.bundle, id }),
);

const backToArmy = (view: SharedView) =>
  view.game === 'triumph'
    ? { back: { href: armyUrl(view.sheet.armyId), label: view.sheet.armyName } }
    : {};

export const generateMetadata = async ({
  params,
}: IdRouteProps): Promise<Metadata> => {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  const view = reference && (await sharedView(reference, (await params).id));
  if (!view) {
    return { title: (await getTranslations('pages'))('sharedList') };
  }
  const description = sharedListSummary(view, locale);
  return {
    title: view.list.name,
    description,
    robots: { index: false, follow: true },
    openGraph: {
      type: 'article',
      title: view.list.name,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: view.list.name,
      description,
    },
  };
};

export default async function SharedListPage({ params }: IdRouteProps) {
  const locale = await getLocale();
  const reference = await servedReference(locale);
  if (!reference) {
    return <ReferenceUnavailable />;
  }
  const view = await sharedView(reference, (await params).id);
  if (!view) {
    notFound();
  }
  const { list } = view;
  return (
    <>
      <PageHeader
        {...backToArmy(view)}
        title={list.name}
        meta={<SharedCopyBadge />}
        description={sharedListSummary(view, locale)}
        action={
          <SaveSharedCopy name={list.name} list={savedSelectionOf(list)} />
        }
      />
      <SharedListView view={view} currentDataVersion={reference.dataVersion} />
    </>
  );
}
