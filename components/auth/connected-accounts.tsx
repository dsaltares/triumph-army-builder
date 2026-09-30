'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormError } from '@/components/auth/fields';
import { ProviderIcon } from '@/components/auth/provider-icon';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { Button } from '@/components/ui/button';
import {
  linkSocial,
  requestPasswordReset,
  unlinkAccount,
} from '@/lib/auth/client';
import type { ConnectedAccount } from '@/lib/auth/connected-accounts';
import { authErrorKey } from '@/lib/auth/errors';
import { credentialProviderId, isSocialProviderId } from '@/lib/auth/providers';
import { routes } from '@/lib/navigation';

export function ConnectedAccounts({
  email,
  accounts,
  rejection,
}: {
  email: string;
  accounts: readonly ConnectedAccount[];
  rejection: string | undefined;
}) {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const router = useRouter();
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [passwordLinkSent, setPasswordLinkSent] = useState(false);

  const onConnect = async (providerId: string) => {
    if (!isSocialProviderId(providerId)) {
      return;
    }
    setFailure(undefined);
    setPending(providerId);

    const { error } = await linkSocial({
      provider: providerId,
      callbackURL: routes.account,
      errorCallbackURL: routes.account,
    });
    if (error) {
      setFailure(message(authErrorKey(error)));
      setPending(undefined);
    }
  };

  const onDisconnect = async (providerId: string, accountId: string) => {
    setFailure(undefined);
    setPending(providerId);

    const { error } = await unlinkAccount({ accountId });
    setPending(undefined);
    if (error) {
      setFailure(message(authErrorKey(error)));
      return;
    }
    router.refresh();
  };

  // The same link a forgotten password gets, to the address the account already proved: adding
  // a password is a reset with no old one to replace (ADR 0038).
  const onSetPassword = async () => {
    setFailure(undefined);
    setPending(credentialProviderId);

    const { error } = await requestPasswordReset({
      email,
      redirectTo: routes.resetPassword,
    });
    setPending(undefined);
    if (error) {
      setFailure(message(authErrorKey(error)));
      return;
    }
    setPasswordLinkSent(true);
  };

  const reported = failure ?? rejection;

  return (
    <div className="flex max-w-reading flex-col gap-4">
      {reported ? <FormError>{reported}</FormError> : null}
      <ul className="flex flex-col divide-y rounded-md border">
        {accounts.map(({ providerId, name, connected, action }) => (
          <li
            key={providerId}
            className="flex min-h-16 items-center justify-between gap-3 px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <ProviderIcon providerId={providerId} />
              <span className="flex flex-col">
                <span className="text-sm font-medium">
                  {providerId === credentialProviderId
                    ? t('emailAndPassword')
                    : name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {connected ? t('connected') : t('notConnected')}
                </span>
              </span>
            </span>
            {action?.kind === 'connect' ? (
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!!pending}
                onClick={() => onConnect(providerId)}
              >
                {pending === providerId ? t('takingYouThere') : t('connect')}
              </Button>
            ) : null}
            {action?.kind === 'set-password' && !passwordLinkSent ? (
              <Button
                type="button"
                variant="outline"
                size="touch"
                disabled={!!pending}
                onClick={onSetPassword}
              >
                {pending === providerId ? t('sending') : t('setPassword')}
              </Button>
            ) : null}
            {action?.kind === 'disconnect' ? (
              <Button
                type="button"
                variant="destructive"
                size="touch"
                disabled={!!pending}
                onClick={() => onDisconnect(providerId, action.accountId)}
              >
                {pending === providerId ? t('disconnecting') : t('disconnect')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {passwordLinkSent ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t.rich('setPasswordSent', {
            email,
            address: (chunks) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </p>
      ) : null}
    </div>
  );
}
