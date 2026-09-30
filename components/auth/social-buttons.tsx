'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { FormError } from '@/components/auth/fields';
import { ProviderIcon } from '@/components/auth/provider-icon';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth/client';
import { authErrorKey } from '@/lib/auth/errors';
import {
  type SocialProviderId,
  socialProviderNames,
} from '@/lib/auth/providers';
import { afterAuthPath, authUrl, nextParam } from '@/lib/auth/redirect';
import { routes } from '@/lib/navigation';

export function SocialButtons({
  providers,
}: {
  providers: readonly SocialProviderId[];
}) {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const next = useSearchParams().get(nextParam);
  const [failure, setFailure] = useState<string>();
  const [pending, setPending] = useState<SocialProviderId>();

  if (providers.length === 0) {
    return null;
  }

  const onContinue = async (provider: SocialProviderId) => {
    setFailure(undefined);
    setPending(provider);

    const { error } = await signIn.social({
      provider,
      callbackURL: afterAuthPath(next),
      errorCallbackURL: authUrl(routes.signIn, next),
    });
    if (error) {
      setFailure(message(authErrorKey(error)));
      setPending(undefined);
    }
  };

  return (
    <div className="flex max-w-reading flex-col gap-4">
      {failure ? <FormError>{failure}</FormError> : null}
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="touch"
            disabled={!!pending}
            onClick={() => onContinue(provider)}
          >
            <ProviderIcon providerId={provider} />
            {pending === provider
              ? t('takingYouThere')
              : t('continueWith', { provider: socialProviderNames[provider] })}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t('or')}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
