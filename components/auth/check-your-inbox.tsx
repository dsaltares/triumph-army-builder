'use client';

import { IconMail } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AuthOutcome } from '@/components/auth/auth-form';
import { FormError } from '@/components/auth/fields';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { Button } from '@/components/ui/button';
import { sendVerificationEmail } from '@/lib/auth/client';
import { authErrorKey } from '@/lib/auth/errors';
import { authUrl } from '@/lib/auth/redirect';
import { routes } from '@/lib/navigation';

export function CheckYourInbox({
  email,
  next,
}: {
  email: string;
  next: string | null;
}) {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const [failure, setFailure] = useState<string>();
  const [resent, setResent] = useState(false);
  const [pending, setPending] = useState(false);

  const onResend = async () => {
    setFailure(undefined);
    setPending(true);

    const { error } = await sendVerificationEmail({
      email,
      callbackURL: authUrl(routes.signIn, next),
    });
    setPending(false);
    if (error) {
      setFailure(message(authErrorKey(error)));
      return;
    }
    setResent(true);
  };

  return (
    <div className="flex max-w-reading flex-col gap-4">
      {failure ? <FormError>{failure}</FormError> : null}
      <AuthOutcome
        icon={<IconMail />}
        title={t('confirmToFinish')}
        link={{ href: routes.signIn, label: t('backToSignIn') }}
        action={
          <Button
            type="button"
            variant="outline"
            size="touch"
            disabled={pending}
            onClick={onResend}
          >
            {pending ? t('sending') : t('sendItAgain')}
          </Button>
        }
      >
        {t.rich('verificationSent', {
          email,
          address: (chunks) => (
            <span className="font-medium text-foreground">{chunks}</span>
          ),
        })}
        {resent ? t('verificationResent') : null}
      </AuthOutcome>
    </div>
  );
}
