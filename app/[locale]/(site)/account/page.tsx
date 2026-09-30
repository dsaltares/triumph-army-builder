import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ConnectedAccounts } from '@/components/auth/connected-accounts';
import { PageHeader } from '@/components/layout/page-header';
import { Section } from '@/components/layout/section';
import { getAuth } from '@/lib/auth/auth';
import { connectedAccounts } from '@/lib/auth/connected-accounts';
import { redirectErrorKey } from '@/lib/auth/errors';
import { authUrl, errorParam } from '@/lib/auth/redirect';
import { isSignedIn } from '@/lib/auth/session';
import { configuredSocialProviders } from '@/lib/auth/social';
import { onlyParam, routes, type SearchParamsProps } from '@/lib/navigation';

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getTranslations('pages'))('account'),
});

export default async function AccountPage({ searchParams }: SearchParamsProps) {
  const t = await getTranslations('auth');
  const pages = await getTranslations('pages');
  const requestHeaders = await headers();
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!isSignedIn(session)) {
    redirect(authUrl(routes.signIn, routes.account));
  }

  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
  const rejected = onlyParam((await searchParams)[errorParam]);

  return (
    <>
      <PageHeader title={pages('account')} description={session.user.email} />
      <Section
        title={pages('waysToSignIn')}
        description={pages('waysToSignInDescription')}
      >
        <ConnectedAccounts
          email={session.user.email}
          accounts={connectedAccounts(accounts, configuredSocialProviders())}
          rejection={rejected ? t(redirectErrorKey(rejected)) : undefined}
        />
      </Section>
    </>
  );
}
