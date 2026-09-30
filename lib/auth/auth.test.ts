import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { devBaseUrl } from '../base-url.ts';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import { alreadyRegisteredSubject } from '../email/templates/already-registered.tsx';
import type { EmailMessage } from '../email/transport.ts';
import { anonymousSignInPath } from './anonymous.ts';
import {
  type Auth,
  createAuth,
  missingBaseUrlMessage,
  sessionExpiresIn,
  sessionUpdateAge,
} from './auth.ts';
import {
  perAddressEmailLimit,
  perIpAnonymousLimit,
  perIpEmailLimit,
} from './rate-limit.ts';

let db: ReturnType<typeof createDatabase>;
let auth: Auth;
let sent: EmailMessage[];

const email = 'hannibal@example.test';
const password = 'elephants-over-the-alps';
const newPassword = 'the-alps-were-the-easy-part';

const capturing = (options: Parameters<typeof createAuth>[0] = {}) =>
  createAuth({
    db,
    secret: 'a-test-secret-nobody-signs-anything-real-with',
    baseUrl: 'http://localhost:3013',
    limitRequests: true,
    socialProviders: {},
    sendEmail: (message) => {
      sent.push(message);
      return Promise.resolve({ delivered: true, id: `msg_${sent.length}` });
    },
    ...options,
  });

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  sent = [];
  auth = capturing();
});

afterEach(async () => {
  await db.destroy();
});

const cookieFrom = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

const signUp = (body: { email: string; password: string }) =>
  auth.api.signUpEmail({ body: { ...body, name: 'Hannibal' } });

const signIn = (body: { email: string; password: string }) =>
  auth.api.signInEmail({ body, returnHeaders: true });

const errorCode = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { body?: { code?: string } }).body?.code;
  }
  return undefined;
};

const confirmationTokenFor = (address: string) => {
  const message = sent.findLast(
    (candidate) => candidate.to.toLowerCase() === address.toLowerCase(),
  );
  const token = message?.html.match(/verify-email\?token=([^&"]+)/);
  if (!token?.[1]) {
    throw new Error(`no confirmation email was sent to ${address}`);
  }
  return token[1];
};

const confirm = (address: string) =>
  auth.api.verifyEmail({ query: { token: confirmationTokenFor(address) } });

const signUpAndConfirm = async (address = email) => {
  const created = await signUp({ email: address, password });
  await confirm(address);
  return created;
};

const usersTable = () => db.selectFrom('users').selectAll().execute();

const providerIds = async () =>
  (await db.selectFrom('accounts').selectAll().execute()).map(
    (account) => account.providerId,
  );

describe('createAuth', () => {
  it('does not sign a new player in, so a duplicate cannot be told from a first', async () => {
    const { headers } = await auth.api.signUpEmail({
      body: { email, password, name: 'Hannibal' },
      returnHeaders: true,
    });

    expect(headers.getSetCookie()).toEqual([]);
  });

  it('signs a player up against the app tables and leaves the address unverified', async () => {
    const { user } = await signUp({ email, password });

    const rows = await db.selectFrom('users').selectAll().execute();
    expect(rows).toEqual([
      expect.objectContaining({ id: user.id, email, emailVerified: 0 }),
    ]);
  });

  it('stores the password as a credential account, never on the user', async () => {
    const { user } = await signUp({ email, password });

    const accounts = await db.selectFrom('accounts').selectAll().execute();
    expect(accounts).toEqual([
      expect.objectContaining({ userId: user.id, providerId: 'credential' }),
    ]);
    expect(accounts[0]?.password).not.toContain(password);
  });

  it('lowercases the address, so casing cannot open a second account', async () => {
    await signUpAndConfirm('Hannibal@Example.Test');

    const { response } = await signIn({ email, password });

    expect(response.user.email).toBe(email);
  });

  it('answers a second sign-up exactly as it answers a first', async () => {
    const first = await signUp({ email, password });
    const second = await signUp({ email, password: 'a-different-password' });

    expect(second.user.email).toBe(first.user.email);
    expect(second.user.id).not.toBe(first.user.id);
    expect(await db.selectFrom('users').selectAll().execute()).toHaveLength(1);
  });

  it('leaves the first password alone when a second sign-up is refused', async () => {
    await signUpAndConfirm();
    await signUp({ email, password: 'a-different-password' });

    expect(
      await errorCode(
        auth.api.signInEmail({
          body: { email, password: 'a-different-password' },
        }),
      ),
    ).toBe('INVALID_EMAIL_OR_PASSWORD');
    const { response } = await signIn({ email, password });
    expect(response.user.email).toBe(email);
  });

  it('refuses a password shorter than the minimum', async () => {
    expect(await errorCode(signUp({ email, password: 'short' }))).toBe(
      'PASSWORD_TOO_SHORT',
    );
  });

  it('refuses the wrong password without saying which half was wrong', async () => {
    await signUpAndConfirm();

    expect(
      await errorCode(
        auth.api.signInEmail({
          body: { email, password: 'carthage-must-stand' },
        }),
      ),
    ).toBe('INVALID_EMAIL_OR_PASSWORD');
  });

  it('answers an unknown address the same way as a wrong password', async () => {
    expect(
      await errorCode(auth.api.signInEmail({ body: { email, password } })),
    ).toBe('INVALID_EMAIL_OR_PASSWORD');
  });

  it('drops the session it was signed out with, and no other', async () => {
    await signUpAndConfirm();
    const { headers } = await signIn({ email, password });
    const cookie = new Headers({ cookie: cookieFrom(headers) });
    const before = await db.selectFrom('sessions').selectAll().execute();

    await auth.api.signOut({ headers: cookie });

    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
    expect(await db.selectFrom('sessions').selectAll().execute()).toHaveLength(
      before.length - 1,
    );
  });
});

const requestReset = (address = email) =>
  auth.api.requestPasswordReset({
    body: { email: address, redirectTo: '/reset-password' },
  });

const resetLinkToken = () => {
  const link = sent.at(-1)?.html.match(/reset-password\/([^?"]+)/);
  if (!link?.[1]) {
    throw new Error('the last email carries no reset link');
  }
  return link[1];
};

const signUpWithoutTheConfirmation = async (address = email) => {
  const created = await signUp({ email: address, password });
  sent = [];
  return created;
};

const errorStatus = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { statusCode?: number }).statusCode;
  }
  return undefined;
};

describe('password reset', () => {
  it('mails a link that sets a new password the player can sign in with', async () => {
    await signUpWithoutTheConfirmation();

    await requestReset();
    await auth.api.resetPassword({
      body: { newPassword, token: resetLinkToken() },
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(email);
    const { response } = await signIn({ email, password: newPassword });
    expect(response.user.email).toBe(email);
    expect(
      await errorCode(auth.api.signInEmail({ body: { email, password } })),
    ).toBe('INVALID_EMAIL_OR_PASSWORD');
  });

  it('spends the link, so the same one cannot be used twice', async () => {
    await signUp({ email, password });
    await requestReset();
    const token = resetLinkToken();
    await auth.api.resetPassword({ body: { newPassword, token } });

    expect(
      await errorCode(
        auth.api.resetPassword({
          body: { newPassword: 'a-third-password-entirely', token },
        }),
      ),
    ).toBe('INVALID_TOKEN');
  });

  it('signs out every session that was open under the old password', async () => {
    await signUpAndConfirm();
    const { headers } = await signIn({ email, password });
    const cookie = new Headers({ cookie: cookieFrom(headers) });

    await requestReset();
    await auth.api.resetPassword({
      body: { newPassword, token: resetLinkToken() },
    });

    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
  });

  it('answers an address with no account exactly as it answers a known one', async () => {
    await signUpWithoutTheConfirmation();

    const known = await requestReset();
    const unknown = await requestReset('scipio@example.test');

    expect(unknown).toEqual(known);
    expect(sent.map((message) => message.to)).toEqual([email]);
  });

  it('mails an account with no password a link that adds one beside its provider', async () => {
    await signUpWithoutTheConfirmation();
    await db
      .updateTable('accounts')
      .set({ providerId: 'google', accountId: googleSubject, password: null })
      .execute();

    await expect(requestReset()).resolves.toMatchObject({ status: true });
    expect(sent.map((message) => message.subject)).toEqual([
      'Set a password for Triumph! Army Builder',
    ]);
    await auth.api.resetPassword({
      body: { newPassword, token: resetLinkToken() },
    });

    const { response } = await signIn({ email, password: newPassword });
    expect(response.user.email).toBe(email);
    expect(
      (
        await db
          .selectFrom('accounts')
          .select('providerId')
          .orderBy('providerId')
          .execute()
      ).map(({ providerId }) => providerId),
    ).toEqual(['credential', 'google']);
  });

  it('refuses a request once that address has spent its budget', async () => {
    await signUpWithoutTheConfirmation();
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await requestReset();
    }

    expect(await errorStatus(requestReset())).toBe(429);
    expect(sent).toHaveLength(perAddressEmailLimit.max);
  });

  it('counts an address with no account too, so a refusal names nobody', async () => {
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await requestReset('scipio@example.test');
    }

    expect(await errorStatus(requestReset('scipio@example.test'))).toBe(429);
  });

  it('limits the endpoint per IP as well as per address', () => {
    expect(
      auth.options.rateLimit.customRules['/request-password-reset'],
    ).toEqual(perIpEmailLimit);
  });

  it('leaves the token lifetime at the hour the email promises', () => {
    expect(Object.keys(auth.options.emailAndPassword)).not.toContain(
      'resetPasswordTokenExpiresIn',
    );
  });
});

const confirmationsTo = (address: string) =>
  sent.filter((message) => message.to === address);

describe('email verification', () => {
  it('sends one confirmation to the address that signed up', async () => {
    await signUp({ email, password });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(email);
    expect(sent[0]?.html).toContain('verify-email?token=');
  });

  it('sends no second confirmation for an address that already has an account', async () => {
    await signUp({ email, password });
    sent = [];

    await signUp({ email, password: 'a-different-password' });

    expect(sent.map(({ subject }) => subject)).toEqual([
      alreadyRegisteredSubject('en'),
    ]);
  });

  it('points the notice at signing in rather than at a new account', async () => {
    await signUp({ email, password });
    sent = [];

    await signUp({ email, password: 'a-different-password' });

    expect(sent[0]?.to).toBe(email);
    expect(sent[0]?.html).toContain('/sign-in');
    expect(sent[0]?.html).toContain('/forgot-password');
    expect(sent[0]?.html).not.toContain('verify-email?token=');
  });

  it('refuses to sign an unconfirmed player in, and names the reason', async () => {
    await signUp({ email, password });

    expect(await errorCode(signIn({ email, password }))).toBe(
      'EMAIL_NOT_VERIFIED',
    );
  });

  it('sends no mail on a refused sign-in, so the form is not a mailbomb', async () => {
    await signUp({ email, password });
    sent = [];

    await errorCode(signIn({ email, password }));
    await errorCode(signIn({ email, password }));

    expect(sent).toEqual([]);
  });

  it('confirms the address when the link in the email is followed', async () => {
    await signUp({ email, password });

    await confirm(email);

    expect((await usersTable())[0]?.emailVerified).toBe(1);
  });

  it('signs the player in from the link, so one click finishes the job', async () => {
    await signUp({ email, password });

    const { headers } = await auth.api.verifyEmail({
      query: { token: confirmationTokenFor(email) },
      returnHeaders: true,
    });

    const session = await auth.api.getSession({
      headers: new Headers({ cookie: cookieFrom(headers) }),
    });
    expect(session?.user.emailVerified).toBe(true);
  });

  it('lets the password through once the address is confirmed', async () => {
    await signUpAndConfirm();

    const { response } = await signIn({ email, password });

    expect(response.user.emailVerified).toBe(true);
  });

  it('refuses a token it did not mint', async () => {
    expect(
      await errorCode(
        auth.api.verifyEmail({ query: { token: 'not-a-token' } }),
      ),
    ).toBe('INVALID_TOKEN');
  });

  it('sends the confirmation again when a player asks for it', async () => {
    await signUp({ email, password });
    sent = [];

    await auth.api.sendVerificationEmail({ body: { email } });

    expect(confirmationsTo(email)).toHaveLength(1);
  });

  it('answers a resend for an unknown address without sending anything', async () => {
    const answer = await auth.api.sendVerificationEmail({
      body: { email: 'scipio@example.test' },
    });

    expect(answer).toEqual({ status: true });
    expect(sent).toEqual([]);
  });

  it('answers a resend for a confirmed address without sending anything', async () => {
    await signUpAndConfirm();
    sent = [];

    const answer = await auth.api.sendVerificationEmail({ body: { email } });

    expect(answer).toEqual({ status: true });
    expect(sent).toEqual([]);
  });

  it('refuses a resend once that address has spent its budget', async () => {
    await signUp({ email, password });
    sent = [];
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await auth.api.sendVerificationEmail({ body: { email } });
    }

    expect(
      await errorStatus(auth.api.sendVerificationEmail({ body: { email } })),
    ).toBe(429);
    expect(sent).toHaveLength(perAddressEmailLimit.max);
  });

  it('counts an address with no account too, so a refusal names nobody', async () => {
    const unknown = 'scipio@example.test';
    for (let attempt = 0; attempt < perAddressEmailLimit.max; attempt++) {
      await auth.api.sendVerificationEmail({ body: { email: unknown } });
    }

    expect(
      await errorStatus(
        auth.api.sendVerificationEmail({ body: { email: unknown } }),
      ),
    ).toBe(429);
  });

  it('limits the endpoint per IP as well as per address', () => {
    expect(
      auth.options.rateLimit.customRules['/send-verification-email'],
    ).toEqual(perIpEmailLimit);
  });

  it('never re-sends on a sign-in attempt, which is the amplification vector', () => {
    expect(auth.options.emailVerification.sendOnSignIn).toBe(false);
    expect(auth.options.emailVerification.sendOnSignUp).toBe(true);
    expect(auth.options.emailAndPassword.requireEmailVerification).toBe(true);
  });

  it('confirms the address a completed password reset already proved', async () => {
    await signUpWithoutTheConfirmation();
    expect((await usersTable())[0]?.emailVerified).toBe(0);

    await requestReset();
    await auth.api.resetPassword({
      body: { newPassword, token: resetLinkToken() },
    });

    expect((await usersTable())[0]?.emailVerified).toBe(1);
    const { response } = await signIn({ email, password: newPassword });
    expect(response.user.email).toBe(email);
  });
});

const googleClientId = 'a-test-google-client-id';
const googleSubject = 'google-subject-1';

const googleProfile = (profileEmail: string, verified: boolean) => ({
  aud: googleClientId,
  azp: googleClientId,
  email: profileEmail,
  email_verified: verified,
  exp: 0,
  family_name: 'Barca',
  given_name: 'Hannibal',
  iat: 0,
  iss: 'https://accounts.google.com',
  name: 'Hannibal Barca',
  picture: 'https://example.test/hannibal.png',
  sub: googleSubject,
});

const withGoogle = (profileEmail = email, verified = true) =>
  capturing({
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: 'a-test-google-client-secret',
        verifyIdToken: async () => true,
        getUserInfo: async () => ({
          user: {
            name: 'Hannibal Barca',
            email: profileEmail,
            emailVerified: verified,
          },
          data: googleProfile(profileEmail, verified),
        }),
      },
    },
  });

const signInWithGoogle = async (withAuth: Auth) => {
  const result = await withAuth.api.signInSocial({
    body: { provider: 'google', idToken: { token: 'a-stub-id-token' } },
  });
  return 'user' in result ? result.user : undefined;
};

describe('social sign-in', () => {
  it('registers the providers it is handed, and nothing else', () => {
    expect(Object.keys(auth.options.socialProviders)).toEqual([]);
    expect(Object.keys(withGoogle().options.socialProviders)).toEqual([
      'google',
    ]);
  });

  it('creates an account for an address nobody has signed up with', async () => {
    const signedIn = await signInWithGoogle(withGoogle());

    expect(signedIn?.email).toBe(email);
    expect(await providerIds()).toEqual(['google']);
  });

  it('takes the provider at its word, so no confirmation is asked for', async () => {
    await signInWithGoogle(withGoogle());

    expect((await usersTable())[0]?.emailVerified).toBe(1);
    expect(sent).toEqual([]);
  });

  it('attaches Google to the confirmed password account on the same address', async () => {
    const { user } = await signUpAndConfirm();

    const signedIn = await signInWithGoogle(withGoogle());

    expect(signedIn?.id).toBe(user.id);
    expect(await usersTable()).toHaveLength(1);
    expect(await providerIds()).toEqual(['credential', 'google']);
  });

  it('refuses to attach Google to an account that never confirmed its address', async () => {
    await signUp({ email, password });

    expect(await errorCode(signInWithGoogle(withGoogle()))).toBe(
      'OAUTH_LINK_ERROR',
    );
    expect(await providerIds()).toEqual(['credential']);
  });

  it('leaves the password working after Google has been attached', async () => {
    await signUpAndConfirm();
    await signInWithGoogle(withGoogle());

    const { response } = await signIn({ email, password });

    expect(response.user.email).toBe(email);
  });

  it('refuses to link a provider that reports the address as unconfirmed', async () => {
    await signUpAndConfirm();

    expect(await errorCode(signInWithGoogle(withGoogle(email, false)))).toBe(
      'OAUTH_LINK_ERROR',
    );
    expect(await providerIds()).toEqual(['credential']);
  });

  it('opens a separate account for a provider address of its own', async () => {
    await signUpAndConfirm();

    await signInWithGoogle(withGoogle('barca@example.test'));

    expect(await usersTable()).toHaveLength(2);
  });
});

describe('the origin every mailed link is built from', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('takes the configured origin when there is one', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_URL', 'https://triumph.example.test');

    expect(createAuth({ db, secret: 'x'.repeat(32) }).options.baseURL).toBe(
      'https://triumph.example.test',
    );
  });

  it('refuses to start in production without one, rather than trusting the Host header', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_URL', '');

    expect(() => createAuth({ db })).toThrow(missingBaseUrlMessage);
  });

  it('falls back to the dev origin outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BETTER_AUTH_URL', '');

    expect(createAuth({ db }).options.baseURL).toBe(devBaseUrl);
  });
});

describe('client ip resolution', () => {
  const optionsWith = (environment: Record<string, string>) => {
    for (const [key, value] of Object.entries(environment)) {
      vi.stubEnv(key, value);
    }
    return capturing().options.advanced;
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('leaves Better Auth to its own default when nothing is configured', () => {
    expect(capturing().options.advanced).toBeUndefined();
  });

  it('reads the client address from the headers the deployment names', () => {
    expect(
      optionsWith({ IP_ADDRESS_HEADERS: 'CF-Connecting-IP, x-forwarded-for' }),
    ).toEqual({
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] },
    });
  });

  it('walks a forwarded chain past the proxies it is told to trust', () => {
    expect(
      optionsWith({ TRUSTED_PROXIES: '10.0.0.0/8, 172.16.0.0/12' }),
    ).toEqual({
      ipAddress: { trustedProxies: ['10.0.0.0/8', '172.16.0.0/12'] },
    });
  });

  it('ignores an empty setting rather than configuring an empty list', () => {
    expect(
      optionsWith({ TRUSTED_PROXIES: '', IP_ADDRESS_HEADERS: ' , ' }),
    ).toBeUndefined();
  });
});

describe('account linking policy', () => {
  const linking = () => auth.options.account.accountLinking;

  it('links implicitly, so a confirmed player needs no settings detour', () => {
    expect(linking().enabled).toBe(true);
    expect(linking().disableImplicitLinking).toBe(false);
  });

  it('leaves the local-confirmation gate at the default, rather than opening it', () => {
    expect(linking()).not.toHaveProperty('requireLocalEmailVerified');
  });

  it('trusts no provider, so no provider may claim an address on its word', () => {
    expect(linking().trustedProviders).toEqual([]);
  });

  it('refuses to link an address the account does not already hold', () => {
    expect(linking().allowDifferentEmails).toBe(false);
  });

  it('keeps the last way in', () => {
    expect(linking().allowUnlinkingAll).toBe(false);
  });
});

describe('anonymous sessions', () => {
  it('registers the plugin that mints them', () => {
    expect(auth.options.plugins.map(({ id }) => id)).toContain('anonymous');
  });

  it('limits the endpoint that creates rows for nobody in particular', () => {
    expect(auth.options.rateLimit.customRules[anonymousSignInPath]).toEqual(
      perIpAnonymousLimit,
    );
  });

  it('outlives a browsing session by a wide margin, and rolls forward', () => {
    expect(auth.options.session.expiresIn).toBe(sessionExpiresIn);
    expect(auth.options.session.updateAge).toBe(sessionUpdateAge);
    expect(sessionExpiresIn).toBeGreaterThan(sessionUpdateAge * 100);
  });

  it('mints nothing on its own when a player signs out', async () => {
    const { headers } = await auth.api.signInAnonymous({
      returnHeaders: true,
    });
    const cookie = new Headers({ cookie: cookieFrom(headers) });

    await auth.api.signOut({ headers: cookie });

    expect(await auth.api.getSession({ headers: cookie })).toBeNull();
    expect(
      await db
        .selectFrom('users')
        .select('id')
        .where('isAnonymous', '=', 1)
        .execute(),
    ).toHaveLength(1);
  });
});
