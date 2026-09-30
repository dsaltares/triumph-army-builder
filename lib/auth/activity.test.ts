import type { GenericEndpointContext } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  carthage,
  fromCarthage,
  lookupCarthage,
  recordedEvents,
} from '@/test/events.ts';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import type { EmailMessage } from '../email/transport.ts';
import { createRecordAuthEvent, createRecordSignIn } from './activity.ts';
import { type Auth, createAuth } from './auth.ts';

let db: ReturnType<typeof createDatabase>;
let sent: EmailMessage[];

const email = 'hannibal@example.test';
const password = 'elephants-over-the-alps';
const newPassword = 'the-alps-were-the-easy-part';
const baseUrl = 'http://localhost:3013';
const googleClientId = 'a-test-google-client-id';

const withAuth = (options: Parameters<typeof createAuth>[0] = {}) =>
  createAuth({
    db,
    secret: 'a-test-secret-nobody-signs-anything-real-with',
    baseUrl,
    limitRequests: false,
    socialProviders: {},
    lookupIp: lookupCarthage,
    sendEmail: (message) => {
      sent.push(message);
      return Promise.resolve({ delivered: true, id: `msg_${sent.length}` });
    },
    ...options,
  });

let auth: Auth;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  sent = [];
  auth = withAuth();
});

afterEach(async () => {
  await db.destroy();
});

const requestFromCarthage = (path: string) =>
  new Request(`${baseUrl}/api/auth${path}`, { headers: fromCarthage() });

const linkToken = (pattern: RegExp) => {
  const token = sent.at(-1)?.html.match(pattern)?.[1];
  if (!token) {
    throw new Error('the last email carries no link');
  }
  return token;
};

const cookieFrom = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

const signUp = async () =>
  (
    await auth.api.signUpEmail({
      body: { email, password, name: 'Hannibal' },
      headers: fromCarthage(),
    })
  ).user;

const confirm = (headers?: Headers) =>
  auth.api.verifyEmail({
    query: { token: linkToken(/verify-email\?token=([^&"]+)/) },
    request: requestFromCarthage('/verify-email'),
    ...(headers ? { headers } : {}),
  });

const fromCarthageWith = (cookies: Headers) => {
  const headers = fromCarthage();
  headers.set('cookie', cookieFrom(cookies));
  return headers;
};

const inCarthage = {
  is_anonymous: 0,
  ip: carthage.ip,
  country: 'TN',
  region: 'Tunis',
  city: 'Carthage',
};

const withGoogle = () =>
  withAuth({
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: 'a-test-google-client-secret',
        verifyIdToken: async () => true,
        getUserInfo: async () => ({
          user: { name: 'Hannibal Barca', email, emailVerified: true },
          data: {
            aud: googleClientId,
            azp: googleClientId,
            email,
            email_verified: true,
            exp: 0,
            family_name: 'Barca',
            given_name: 'Hannibal',
            iat: 0,
            iss: 'https://accounts.google.com',
            name: 'Hannibal Barca',
            picture: 'https://example.test/hannibal.png',
            sub: 'google-subject-1',
          },
        }),
      },
    },
  });

describe('the events an account records', () => {
  it('records a sign-up with its player, address and place', async () => {
    const user = await signUp();

    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'account.signed_up',
        user_id: user.id,
        subject_id: null,
        props: '{}',
        ...inCarthage,
      },
    ]);
  });

  it('records a confirmed address, and then a password sign-in', async () => {
    const user = await signUp();
    await confirm();

    await auth.api.signInEmail({
      body: { email, password },
      headers: fromCarthage(),
    });

    expect(
      (await recordedEvents(db)).map(({ kind, user_id, props, ip, city }) => ({
        kind,
        user_id,
        props: JSON.parse(props),
        ip,
        city,
      })),
    ).toEqual([
      {
        kind: 'account.signed_up',
        user_id: user.id,
        props: {},
        ip: carthage.ip,
        city: 'Carthage',
      },
      {
        kind: 'account.email_verified',
        user_id: user.id,
        props: {},
        ip: carthage.ip,
        city: 'Carthage',
      },
      {
        kind: 'account.signed_in',
        user_id: user.id,
        props: { method: 'password' },
        ip: carthage.ip,
        city: 'Carthage',
      },
    ]);
  });

  it('records nothing for a sign-in it refused, or a second sign-up for the address', async () => {
    await signUp();

    await expect(
      auth.api.signInEmail({
        body: { email, password },
        headers: fromCarthage(),
      }),
    ).rejects.toThrow();
    await expect(
      auth.api.signInEmail({
        body: { email, password: 'not-the-password-at-all' },
        headers: fromCarthage(),
      }),
    ).rejects.toThrow();
    await auth.api.signUpEmail({
      body: { email, password, name: 'Hannibal' },
      headers: fromCarthage(),
    });

    expect((await recordedEvents(db)).map(({ kind }) => kind)).toEqual([
      'account.signed_up',
    ]);
  });

  it('records a sign-up and a sign-in through Google, with the provider as the method', async () => {
    const google = withGoogle();

    const result = await google.api.signInSocial({
      body: { provider: 'google', idToken: { token: 'a-stub-id-token' } },
      headers: fromCarthage(),
    });

    const userId = 'user' in result ? result.user.id : undefined;
    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'account.signed_up',
        user_id: userId,
        subject_id: null,
        props: '{}',
        ...inCarthage,
      },
      {
        kind: 'account.signed_in',
        user_id: userId,
        subject_id: null,
        props: JSON.stringify({ method: 'google' }),
        ...inCarthage,
      },
    ]);
  });

  it('records nothing for an anonymous session, and a claim when it becomes an account', async () => {
    const { headers } = await auth.api.signInAnonymous({
      headers: fromCarthage(),
      returnHeaders: true,
    });
    expect(await recordedEvents(db)).toEqual([]);

    const user = await signUp();
    await confirm(fromCarthageWith(headers));

    expect(
      (await recordedEvents(db)).map(({ kind, user_id, ip, country }) => ({
        kind,
        user_id,
        ip,
        country,
      })),
    ).toEqual([
      {
        kind: 'account.signed_up',
        user_id: user.id,
        ip: carthage.ip,
        country: 'TN',
      },
      {
        kind: 'account.email_verified',
        user_id: user.id,
        ip: carthage.ip,
        country: 'TN',
      },
      {
        kind: 'account.claimed',
        user_id: user.id,
        ip: carthage.ip,
        country: 'TN',
      },
    ]);
  });

  it('records a completed password reset, and not the request for one', async () => {
    const user = await signUp();
    await confirm();
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: '/reset-password' },
      headers: fromCarthage(),
    });

    await auth.api.resetPassword({
      body: { newPassword, token: linkToken(/reset-password\/([^?"]+)/) },
      request: requestFromCarthage('/reset-password'),
    });

    expect((await recordedEvents(db)).at(-1)).toEqual({
      kind: 'account.password_reset',
      user_id: user.id,
      subject_id: null,
      props: '{}',
      ...inCarthage,
    });
    expect((await recordedEvents(db)).map(({ kind }) => kind)).toEqual([
      'account.signed_up',
      'account.email_verified',
      'account.password_reset',
    ]);
  });
});

describe('createRecordSignIn', () => {
  const record = () =>
    createRecordSignIn(createRecordAuthEvent({ db, lookupIp: lookupCarthage }));

  const endpoint = (
    path: string,
    {
      isAnonymous = false,
      params = {},
    }: { isAnonymous?: boolean; params?: Record<string, string> } = {},
  ) =>
    ({
      path,
      params,
      body: {},
      headers: fromCarthage(),
      context: {
        newSession: { user: { id: 'user-hannibal', isAnonymous } },
      },
    }) as unknown as GenericEndpointContext;

  it('takes the provider from an OAuth callback as the method', async () => {
    await record()(
      endpoint('/callback/discord', { params: { id: 'discord' } }),
    );

    expect(await recordedEvents(db)).toEqual([
      expect.objectContaining({
        kind: 'account.signed_in',
        user_id: 'user-hannibal',
        props: JSON.stringify({ method: 'discord' }),
        ip: carthage.ip,
        city: 'Carthage',
      }),
    ]);
  });

  it('records nothing for an anonymous session, a provider it does not know, or a path that is no sign-in', async () => {
    await record()(endpoint('/sign-in/email', { isAnonymous: true }));
    await record()(
      endpoint('/callback/myspace', { params: { id: 'myspace' } }),
    );
    await record()(endpoint('/verify-email'));

    expect(await recordedEvents(db)).toEqual([]);
  });
});
