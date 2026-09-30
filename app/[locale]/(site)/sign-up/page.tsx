import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { SocialButtons } from '@/components/auth/social-buttons';
import { PageHeader } from '@/components/layout/page-header';
import { getAuth } from '@/lib/auth/auth';
import { afterAuthPath, nextParam } from '@/lib/auth/redirect';
import { isSignedIn } from '@/lib/auth/session';
import { configuredSocialProviders } from '@/lib/auth/social';
import { onlyParam, type SearchParamsProps } from '@/lib/navigation';

export const dynamic = 'force-dynamic';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('signUp'),
});

export default async function SignUpPage({ searchParams }: SearchParamsProps) {
  const t = await getTranslations('pages');
  const parameters = await searchParams;
  const session = await getAuth().api.getSession({ headers: await headers() });

  if (isSignedIn(session)) {
    redirect(afterAuthPath(onlyParam(parameters[nextParam])));
  }

  return (
    <>
      <PageHeader title={t('signUp')} />
      <Suspense>
        <SocialButtons providers={configuredSocialProviders()} />
        <SignUpForm />
      </Suspense>
    </>
  );
}
