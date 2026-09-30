import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import { readUserLocale, writeUserLocale } from '../db/user-locale.ts';
import type { EmailMessage } from '../email/transport.ts';
import { localeCookieName } from '../i18n/routing.ts';
import { type Auth, createAuth } from './auth.ts';

let db: ReturnType<typeof createDatabase>;
let auth: Auth;
let sent: EmailMessage[];

const email = 'hannibal@example.test';
const password = 'elephants-over-the-alps';

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  sent = [];
  auth = createAuth({
    db,
    secret: 'a-test-secret-nobody-signs-anything-real-with',
    baseUrl: 'http://localhost:3013',
    limitRequests: false,
    socialProviders: {},
    sendEmail: (message) => {
      sent.push(message);
      return Promise.resolve({ delivered: true, id: `msg_${sent.length}` });
    },
  });
});

afterEach(async () => {
  await db.destroy();
});

const confirmationToken = () => {
  const token = sent.at(-1)?.html.match(/verify-email\?token=([^&"]+)/);
  if (!token?.[1]) {
    throw new Error('no confirmation email was sent');
  }
  return token[1];
};

const signUpAndConfirm = async () => {
  await auth.api.signUpEmail({ body: { email, password, name: 'Hannibal' } });
  await auth.api.verifyEmail({ query: { token: confirmationToken() } });
};

const signIn = (cookie?: string) =>
  auth.api.signInEmail({
    body: { email, password },
    ...(cookie ? { headers: new Headers({ cookie }) } : {}),
    returnHeaders: true,
  });

const localeCookie = (headers: Headers) =>
  headers
    .getSetCookie()
    .flatMap((cookie) => cookie.split(';').slice(0, 1))
    .find((cookie) => cookie.startsWith(`${localeCookieName}=`))
    ?.slice(localeCookieName.length + 1);

const accountId = async () =>
  (
    await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow()
  ).id;

describe('the locale a player signs in to', () => {
  it('comes back from the account, so it follows them to a new browser', async () => {
    await signUpAndConfirm();
    await writeUserLocale(db, await accountId(), 'es');

    const { headers } = await signIn();

    expect(localeCookie(headers)).toBe('es');
  });

  it('overrules the locale the new browser was already set to', async () => {
    await signUpAndConfirm();
    await writeUserLocale(db, await accountId(), 'es');

    const { headers } = await signIn(`${localeCookieName}=en`);

    expect(localeCookie(headers)).toBe('es');
  });

  it('is seeded from the browser when the account has never chosen one', async () => {
    await signUpAndConfirm();

    await signIn(`${localeCookieName}=es`);

    expect(await readUserLocale(db, await accountId())).toBe('es');
  });

  it('leaves the account alone when the browser carries no locale', async () => {
    await signUpAndConfirm();

    await signIn();

    expect(await readUserLocale(db, await accountId())).toBeNull();
  });

  it('ignores a locale the app does not ship', async () => {
    await signUpAndConfirm();

    await signIn(`${localeCookieName}=fr`);

    expect(await readUserLocale(db, await accountId())).toBeNull();
  });
});
