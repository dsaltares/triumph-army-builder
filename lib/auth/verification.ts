import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import { readUserLocaleByEmail } from '../db/user-locale.ts';
import { confirmAddress } from '../db/users.ts';
import { verifyAddressEmail } from '../email/templates/verify-address.tsx';
import type { SendEmail } from '../email/transport.ts';
import { defaultLocale } from '../i18n/locales.ts';
import { getLogger } from '../logger.ts';
import {
  createAddressGuard,
  createRateLimiter,
  type RateLimitRule,
} from './rate-limit.ts';

export const sendVerificationEmailPath = '/send-verification-email';

export const dailyBudget: RateLimitRule = { window: 86_400, max: 80 };

export const tooManyConfirmationsCode = 'TOO_MANY_CONFIRMATION_REQUESTS';

const budgetKey = 'confirmations';

const logger = getLogger('auth');

export const createConfirmationRequestGuard = () =>
  createAddressGuard({
    code: tooManyConfirmationsCode,
    message: 'tooManyAttempts',
  });

export type SendVerificationEmail = (request: {
  user: { email: string };
  url: string;
}) => Promise<void>;

export const createSendVerificationEmail = ({
  db,
  sendEmail,
  budget = dailyBudget,
}: {
  db: Kysely<Database>;
  sendEmail: SendEmail;
  budget?: RateLimitRule;
}): SendVerificationEmail => {
  const limiter = createRateLimiter(budget);

  return async ({ user, url }) => {
    const verdict = await limiter.consume(budgetKey);
    if (!verdict.allowed) {
      logger.warn(
        { to: user.email },
        "Confirmation email not sent, today's send budget is spent",
      );
      return;
    }

    const locale =
      (await readUserLocaleByEmail(db, user.email)) ?? defaultLocale;
    await sendEmail(await verifyAddressEmail({ to: user.email, url, locale }));
  };
};

export const createConfirmOnPasswordReset =
  (db: Kysely<Database>) =>
  async ({ user }: { user: { id: string } }) => {
    await confirmAddress(user.id, db);
  };
