import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { PageHeader } from '@/components/layout/page-header';
import { resolveCaller } from '@/lib/trpc/context';

const callerIsAdmin = cache(
  async () => (await resolveCaller(await headers()))?.isAdmin ?? false,
);

export const generateMetadata = async (): Promise<Metadata> =>
  (await callerIsAdmin())
    ? {
        title: (await getTranslations('pages'))('admin'),
        robots: { index: false },
      }
    : {};

export default async function AdminPage() {
  if (!(await callerIsAdmin())) {
    notFound();
  }
  const t = await getTranslations('pages');
  return (
    <>
      <PageHeader title={t('admin')} />
      <AdminDashboard />
    </>
  );
}
