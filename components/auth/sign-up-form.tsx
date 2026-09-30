'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthForm } from '@/components/auth/auth-form';
import { CheckYourInbox } from '@/components/auth/check-your-inbox';
import { PasswordField, TextField } from '@/components/auth/fields';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { signUp } from '@/lib/auth/client';
import {
  displayNameFor,
  minPasswordLength,
  type SignUpCredentials,
  signUpSchema,
} from '@/lib/auth/credentials';
import { genericAuthKey } from '@/lib/auth/errors';
import { authUrl, nextParam } from '@/lib/auth/redirect';
import { routes } from '@/lib/navigation';

export function SignUpForm() {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const next = useSearchParams().get(nextParam);
  const [failure, setFailure] = useState<string>();
  const [awaiting, setAwaiting] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpCredentials>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFailure(undefined);

    const { error } = await signUp.email({
      email,
      password,
      name: displayNameFor(email),
      callbackURL: authUrl(routes.signIn, next),
    });
    if (error) {
      setFailure(message(genericAuthKey));
      return;
    }

    setAwaiting(email);
  });

  if (awaiting) {
    return <CheckYourInbox email={awaiting} next={next} />;
  }

  return (
    <AuthForm
      onSubmit={onSubmit}
      error={failure}
      submit={t('createAccount')}
      working={t('creatingAccount')}
      pending={isSubmitting}
      next={next}
      footer={{
        prompt: t('alreadyHaveAccount'),
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
        error={message(errors.email?.message)}
        {...register('email')}
      />
      <PasswordField
        label={t('password')}
        autoComplete="new-password"
        hint={t('passwordHint', { min: minPasswordLength })}
        error={message(errors.password?.message)}
        {...register('password')}
      />
      <PasswordField
        label={t('repeatPassword')}
        autoComplete="new-password"
        error={message(errors.confirmPassword?.message)}
        {...register('confirmPassword')}
      />
    </AuthForm>
  );
}
