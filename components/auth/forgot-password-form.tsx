'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { IconMail } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthForm, AuthOutcome } from '@/components/auth/auth-form';
import { TextField } from '@/components/auth/fields';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { requestPasswordReset } from '@/lib/auth/client';
import { type ResetRequest, resetRequestSchema } from '@/lib/auth/credentials';
import { authErrorKey } from '@/lib/auth/errors';
import { routes } from '@/lib/navigation';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetRequest>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFailure(undefined);

    const { error } = await requestPasswordReset({
      email,
      redirectTo: routes.resetPassword,
    });
    if (error) {
      setFailure(message(authErrorKey(error)));
      return;
    }

    setSent(true);
  });

  if (sent) {
    return (
      <AuthOutcome
        icon={<IconMail />}
        title={t('checkYourEmail')}
        link={{ href: routes.signIn, label: t('backToSignIn') }}
      >
        {t('resetLinkOnItsWay')}
      </AuthOutcome>
    );
  }

  return (
    <AuthForm
      onSubmit={onSubmit}
      error={failure}
      submit={t('emailMeALink')}
      working={t('sending')}
      pending={isSubmitting}
      next={null}
      footer={{
        prompt: t('rememberedIt'),
        href: routes.signIn,
        label: t('signIn'),
      }}
    >
      <TextField
        label={t('email')}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        hint={t('signUpAddressHint')}
        error={message(errors.email?.message)}
        {...register('email')}
      />
    </AuthForm>
  );
}
