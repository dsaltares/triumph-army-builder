import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { FormError } from '@/components/auth/fields';
import { SignInForm } from '@/components/auth/sign-in-form';
import { SocialButtons } from '@/components/auth/social-buttons';
import { PageHeader } from '@/components/layout/page-header';
import { getAuth } from '@/lib/auth/auth';
import { redirectErrorKey } from '@/lib/auth/errors';
import { afterAuthPath, errorParam, nextParam } from '@/lib/auth/redirect';
import { isSignedIn } from '@/lib/auth/session';
import { configuredSocialProviders } from '@/lib/auth/social';
import type { SearchParamsProps } from '@/lib/navigation';
import { onlyParam } from '@/lib/navigation';

export const dynamic = 'force-dynamic';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('signIn'),
});

export default async function SignInPage({ searchParams }: SearchParamsProps) {
  const t = await getTranslations('auth');
  const pages = await getTranslations('pages');
  const parameters = await searchParams;
  const session = await getAuth().api.getSession({ headers: await headers() });

  if (isSignedIn(session)) {
    redirect(afterAuthPath(onlyParam(parameters[nextParam])));
  }

  const rejected = onlyParam(parameters[errorParam]);

  return (
    <>
      <PageHeader title={pages('signIn')} />
      {rejected ? <FormError>{t(redirectErrorKey(rejected))}</FormError> : null}
      <Suspense>
        <SocialButtons providers={configuredSocialProviders()} />
        <SignInForm />
      </Suspense>
    </>
  );
}
