import type { Kysely } from 'kysely';
import { serverBaseUrl } from '../base-url.ts';
import type { Database } from '../db/schema.ts';
import { readUserLocaleByEmail } from '../db/user-locale.ts';
import { alreadyRegisteredEmail } from '../email/templates/already-registered.tsx';
import type { SendEmail } from '../email/transport.ts';
import { defaultLocale } from '../i18n/locales.ts';
import { getLogger } from '../logger.ts';
import { routes } from '../navigation.ts';
import {
  createRateLimiter,
  perAddressEmailLimit,
  type RateLimitRule,
} from './rate-limit.ts';

export const dailyNoticeBudget: RateLimitRule = { window: 86_400, max: 40 };

const budgetKey = 'sign-up-notices';

const logger = getLogger('auth');

export type NotifyExistingUser = (data: {
  user: { email: string };
}) => Promise<void>;

export type NotifyExistingUserOptions = {
  db: Kysely<Database>;
  sendEmail: SendEmail;
  baseUrl?: () => string;
  perAddress?: RateLimitRule;
  budget?: RateLimitRule;
};

export const createNotifyExistingUser = ({
  db,
  sendEmail,
  baseUrl = serverBaseUrl,
  perAddress = perAddressEmailLimit,
  budget = dailyNoticeBudget,
}: NotifyExistingUserOptions): NotifyExistingUser => {
  const perAddressLimiter = createRateLimiter(perAddress);
  const budgetLimiter = createRateLimiter(budget);

  return async ({ user }) => {
    const to = user.email.trim().toLowerCase();

    if (!(await perAddressLimiter.consume(to)).allowed) {
      logger.warn(
        { to },
        'Sign-up notice not sent, that address has had its share',
      );
      return;
    }
    if (!(await budgetLimiter.consume(budgetKey)).allowed) {
      logger.warn(
        { to },
        "Sign-up notice not sent, today's notice budget is spent",
      );
      return;
    }

    const site = baseUrl();
    await sendEmail(
      await alreadyRegisteredEmail({
        to,
        signInUrl: `${site}${routes.signIn}`,
        resetUrl: `${site}${routes.forgotPassword}`,
        locale: (await readUserLocaleByEmail(db, to)) ?? defaultLocale,
      }),
    );
  };
};
