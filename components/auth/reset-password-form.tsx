'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { IconCheck, IconLinkOff } from '@tabler/icons-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { AuthForm, AuthOutcome } from '@/components/auth/auth-form';
import { PasswordField } from '@/components/auth/fields';
import { useAuthMessage } from '@/components/auth/use-auth-message';
import { resetPassword } from '@/lib/auth/client';
import {
  minPasswordLength,
  type NewPassword,
  newPasswordSchema,
} from '@/lib/auth/credentials';
import { authErrorKey, expiredResetLinkKey } from '@/lib/auth/errors';
import { routes } from '@/lib/navigation';

const invalidToken = 'INVALID_TOKEN';

export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const message = useAuthMessage();
  const params = useSearchParams();
  const token = params.get('token');
  const [spent, setSpent] = useState(!token || !!params.get('error'));
  const [changed, setChanged] = useState(false);
  const [failure, setFailure] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPassword>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFailure(undefined);

    const { error } = await resetPassword({
      newPassword: password,
      token: token ?? '',
    });
    if (error) {
      if (error.code === invalidToken) {
        setSpent(true);
        return;
      }
      setFailure(message(authErrorKey(error)));
      return;
    }

    setChanged(true);
  });

  if (spent) {
    return (
      <AuthOutcome
        icon={<IconLinkOff />}
        title={t('linkNoLongerWorks')}
        link={{ href: routes.forgotPassword, label: t('askForANewLink') }}
      >
        {message(expiredResetLinkKey)}
      </AuthOutcome>
    );
  }

  if (changed) {
    return (
      <AuthOutcome
        icon={<IconCheck />}
        title={t('passwordChanged')}
        link={{ href: routes.signIn, label: t('signIn') }}
      >
        {t('passwordChangedBody')}
      </AuthOutcome>
    );
  }

  return (
    <AuthForm
      onSubmit={onSubmit}
      error={failure}
      submit={t('saveNewPassword')}
      working={t('saving')}
      pending={isSubmitting}
      next={null}
      footer={{
        prompt: t('rememberedTheOldOne'),
        href: routes.signIn,
        label: t('signIn'),
      }}
    >
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
