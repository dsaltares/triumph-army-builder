import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { PageHeader } from '@/components/layout/page-header';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('chooseANewPassword'),
});

export default async function ResetPasswordPage() {
  const t = await getTranslations('pages');
  return (
    <>
      <PageHeader title={t('chooseANewPassword')} />
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </>
  );
}
