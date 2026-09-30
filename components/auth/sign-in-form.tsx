'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthForm, AuthLink } from '@/components/auth/auth-form';
import { CheckYourInbox } from '@/components/auth/check-your-inbox';
import { PasswordField, TextField } from '@/components/auth/fields';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { signIn } from '@/lib/auth/client';
import { type SignInCredentials, signInSchema } from '@/lib/auth/credentials';
import { authErrorKey } from '@/lib/auth/errors';
import { afterAuthPath, nextParam } from '@/lib/auth/redirect';
import { routes } from '@/lib/navigation';

const unverified = 'EMAIL_NOT_VERIFIED';

export function SignInForm() {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const router = useRouter();
  const next = useSearchParams().get(nextParam);
  const [failure, setFailure] = useState<string>();
  const [awaiting, setAwaiting] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInCredentials>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async (credentials) => {
    setFailure(undefined);

    const { error } = await signIn.email(credentials);
    if (error?.code === unverified) {
      setAwaiting(credentials.email);
      return;
    }
    if (error) {
      setFailure(message(authErrorKey(error)));
      return;
    }

    router.replace(afterAuthPath(next));
    router.refresh();
  });

  if (awaiting) {
    return <CheckYourInbox email={awaiting} next={next} />;
  }

  return (
    <AuthForm
      onSubmit={onSubmit}
      error={failure}
      submit={t('signIn')}
      working={t('signingIn')}
      pending={isSubmitting}
      next={next}
      footer={{
        prompt: t('noAccountYet'),
        href: routes.signUp,
        label: t('createOne'),
      }}
    >
      <TextField
        label={t('email')}
        type="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        error={message(errors.email?.message)}
        {...register('email')}
      />
      <PasswordField
        label={t('password')}
        autoComplete="current-password"
        error={message(errors.password?.message)}
        {...register('password')}
      />
      <p className="text-xs text-muted-foreground">
        <AuthLink href={routes.forgotPassword}>{t('forgotPassword')}</AuthLink>
      </p>
    </AuthForm>
  );
}
