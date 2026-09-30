import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { anonymous } from 'better-auth/plugins/anonymous';
import type { Kysely } from 'kysely';
import { devBaseUrl } from '../base-url.ts';
import { getDatabase } from '../db/client.ts';
import type { Database } from '../db/schema.ts';
import { sendEmail as sendEmailThroughTransport } from '../email/send.ts';
import type { SendEmail } from '../email/transport.ts';
import type { IpLookup } from '../geo/lookup.ts';
import {
  createRecordAuthEvent,
  createRecordSignIn,
  headersOf,
} from './activity.ts';
import { anonymousSignInPath, createClaim } from './anonymous.ts';
import { ipAddressOptions } from './client-ip.ts';
import { maxPasswordLength, minPasswordLength } from './credentials.ts';
import { createLocaleReconcile } from './locale.ts';
import {
  createResetRequestGuard,
  createSendResetPassword,
  requestPasswordResetPath,
} from './password-reset.ts';
import { perIpAnonymousLimit, perIpEmailLimit } from './rate-limit.ts';
import { createNotifyExistingUser } from './sign-up.ts';
import { type SocialProviders, socialProviders } from './social.ts';
import {
  createConfirmationRequestGuard,
  createConfirmOnPasswordReset,
  createSendVerificationEmail,
  sendVerificationEmailPath,
} from './verification.ts';

const isProduction = () => process.env.NODE_ENV === 'production';

const day = 60 * 60 * 24;

export const sessionExpiresIn = 400 * day;

export const sessionUpdateAge = day;

export const missingBaseUrlMessage =
  'BETTER_AUTH_URL must be set in production. Without it Better Auth takes its origin, and every link it mails, from the request Host header.';

const defaultBaseUrl = () => {
  const configured = process.env.BETTER_AUTH_URL;
  if (configured) {
    return configured;
  }
  if (isProduction()) {
    throw new Error(missingBaseUrlMessage);
  }
  return devBaseUrl;
};

const defaultLimitRequests = () =>
  process.env.DISABLE_AUTH_RATE_LIMIT !== '1' && isProduction();

export type AuthOptions = {
  db?: Kysely<Database>;
  secret?: string | undefined;
  baseUrl?: string | undefined;
  sendEmail?: SendEmail;
  socialProviders?: SocialProviders;
  limitRequests?: boolean;
  lookupIp?: IpLookup;
};

export const createAuth = ({
  db = getDatabase(),
  secret = process.env.BETTER_AUTH_SECRET,
  baseUrl = defaultBaseUrl(),
  sendEmail = sendEmailThroughTransport,
  socialProviders: providers = socialProviders(),
  limitRequests = defaultLimitRequests(),
  lookupIp,
}: AuthOptions = {}) => {
  const ipAddress = ipAddressOptions();
  const record = createRecordAuthEvent({ db, lookupIp });
  const reconcileLocale = createLocaleReconcile({ db });
  const recordSignIn = createRecordSignIn(record);
  const confirmOnPasswordReset = createConfirmOnPasswordReset(db);
  const guardResetRequest = createResetRequestGuard();
  const guardConfirmationRequest = createConfirmationRequestGuard();

  return betterAuth({
    database: { db, type: 'sqlite' },
    ...(secret ? { secret } : {}),
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    user: {
      modelName: 'users',
      additionalFields: {
        locale: { type: 'string', required: false, input: false },
      },
    },
    session: {
      modelName: 'sessions',
      expiresIn: sessionExpiresIn,
      updateAge: sessionUpdateAge,
    },
    account: {
      modelName: 'accounts',
      accountLinking: {
        enabled: true,
        disableImplicitLinking: false,
        trustedProviders: [],
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
      },
    },
    verification: { modelName: 'verifications' },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength,
      maxPasswordLength,
      sendResetPassword: createSendResetPassword({ db, sendEmail }),
      onPasswordReset: async ({ user }, request) => {
        await confirmOnPasswordReset({ user });
        await record(
          request?.headers,
          { userId: user.id, isAnonymous: false },
          { kind: 'account.password_reset' },
        );
      },
      onExistingUserSignUp: createNotifyExistingUser({ db, sendEmail }),
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      sendVerificationEmail: createSendVerificationEmail({ db, sendEmail }),
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      afterEmailVerification: (user, request) =>
        record(
          request?.headers,
          { userId: user.id, isAnonymous: false },
          { kind: 'account.email_verified' },
        ),
    },
    socialProviders: providers,
    databaseHooks: {
      user: {
        create: {
          after: async (user, ctx) => {
            if (!user.isAnonymous) {
              await record(
                headersOf(ctx),
                { userId: user.id, isAnonymous: false },
                { kind: 'account.signed_up' },
              );
            }
          },
        },
      },
    },
    ...(ipAddress ? { advanced: { ipAddress } } : {}),
    rateLimit: {
      enabled: limitRequests,
      customRules: {
        [requestPasswordResetPath]: perIpEmailLimit,
        [sendVerificationEmailPath]: perIpEmailLimit,
        [anonymousSignInPath]: perIpAnonymousLimit,
      },
    },
    plugins: [anonymous({ onLinkAccount: createClaim({ db, record }) })],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!limitRequests) {
          return;
        }
        if (ctx.path === requestPasswordResetPath) {
          await guardResetRequest(ctx.body);
        }
        if (ctx.path === sendVerificationEmailPath) {
          await guardConfirmationRequest(ctx.body);
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        await reconcileLocale(ctx);
        await recordSignIn(ctx);
      }),
    },
  });
};

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

export const getAuth = () => {
  instance ??= createAuth();
  return instance;
};
