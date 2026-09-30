import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { PageHeader } from '@/components/layout/page-header';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('resetYourPassword'),
});

export default async function ForgotPasswordPage() {
  const t = await getTranslations('pages');
  return (
    <>
      <PageHeader title={t('resetYourPassword')} />
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </>
  );
}
