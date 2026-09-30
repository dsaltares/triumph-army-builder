import type { Kysely } from 'kysely';
import { hasPasswordCredential } from '../db/accounts.ts';
import type { Database } from '../db/schema.ts';
import { readUserLocale } from '../db/user-locale.ts';
import { resetPasswordEmail } from '../email/templates/reset-password.tsx';
import type { SendEmail } from '../email/transport.ts';
import { defaultLocale } from '../i18n/locales.ts';
import { createAddressGuard } from './rate-limit.ts';

export const requestPasswordResetPath = '/request-password-reset';

export const tooManyResetRequestsCode = 'TOO_MANY_RESET_REQUESTS';

export const createResetRequestGuard = () =>
  createAddressGuard({
    code: tooManyResetRequestsCode,
    message: 'tooManyAttempts',
  });

export type SendResetPasswordOptions = {
  db: Kysely<Database>;
  sendEmail: SendEmail;
};

export const createSendResetPassword =
  ({ db, sendEmail }: SendResetPasswordOptions) =>
  async ({
    user,
    url,
  }: {
    user: { id: string; email: string };
    url: string;
  }) => {
    // An account that signs in only through a provider gets the link too, worded as adding a
    // password: following it creates the credential, and only the address's owner can (ADR 0038).
    const purpose = (await hasPasswordCredential(user.id, db))
      ? 'reset'
      : 'set';
    const locale = (await readUserLocale(db, user.id)) ?? defaultLocale;
    await sendEmail(
      await resetPasswordEmail({ to: user.email, url, locale, purpose }),
    );
  };
