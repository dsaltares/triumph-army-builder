import { sql } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureSelection } from '@/test/fixtures/army.ts';
import { insertArmy } from '../db/armies.ts';
import { createDatabase } from '../db/client.ts';
import { migrateToLatest } from '../db/migrator.ts';
import { findShare, insertShare } from '../db/shares.ts';
import type { EmailMessage } from '../email/transport.ts';
import { type Auth, createAuth } from './auth.ts';
import { claimCookieName, claimedFrom } from './claim.ts';

let db: ReturnType<typeof createDatabase>;
let auth: Auth;
let sent: EmailMessage[];
let minted: number;

const email = 'hannibal@example.test';
const password = 'elephants-over-the-alps';

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  sent = [];
  minted = 0;
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

const cookieFrom = (headers: Headers) =>
  headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

const jar = (headers: Headers) => new Headers({ cookie: cookieFrom(headers) });

const signInAnonymously = async () => {
  const { headers, response } = await auth.api.signInAnonymous({
    returnHeaders: true,
  });
  if (!response) {
    throw new Error('the anonymous endpoint minted no session');
  }
  return { headers: jar(headers), userId: response.user.id };
};

const save = (userId: string, name: string) =>
  insertArmy(db, {
    id: `army-${++minted}`,
    userId,
    name,
    selection: fixtureSelection(),
    at: new Date(Date.UTC(2026, 8, 18, 10, minted)).toISOString(),
  });

const shareList = (userId: string, name: string) =>
  insertShare(db, {
    userId,
    name,
    selection: fixtureSelection(),
    at: new Date(Date.UTC(2026, 8, 18, 10, ++minted)).toISOString(),
  });

const shareOwners = async () =>
  (await db.selectFrom('shares').selectAll().orderBy('name').execute()).map(
    ({ name, user_id }) => ({ name, owner: user_id }),
  );

const confirmationToken = () => {
  const token = sent.at(-1)?.html.match(/verify-email\?token=([^&"]+)/);
  if (!token?.[1]) {
    throw new Error('no confirmation email was sent');
  }
  return token[1];
};

const signUp = () =>
  auth.api.signUpEmail({ body: { email, password, name: 'Hannibal' } });

const confirm = (headers?: Headers) =>
  auth.api.verifyEmail({
    query: { token: confirmationToken() },
    ...(headers ? { headers } : {}),
    returnHeaders: true,
  });

const signIn = (headers?: Headers) =>
  auth.api.signInEmail({
    body: { email, password },
    ...(headers ? { headers } : {}),
    returnHeaders: true,
  });

const signUpAndConfirm = async () => {
  await signUp();
  await confirm();
};

const owners = async () =>
  (await db.selectFrom('armies').selectAll().orderBy('id').execute()).map(
    ({ name, user_id }) => ({ name, owner: user_id }),
  );

const accountId = async () =>
  (
    await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow()
  ).id;

const userIds = async () =>
  (await db.selectFrom('users').select('id').execute()).map(({ id }) => id);

const claimCookie = (headers: Headers) =>
  claimedFrom(
    headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .join('; '),
  );

const errorCode = async (call: Promise<unknown>) => {
  try {
    await call;
  } catch (error) {
    return (error as { body?: { code?: string } }).body?.code;
  }
  return undefined;
};

describe('anonymous sign-in', () => {
  it('gives a logged-out player a session of their own', async () => {
    const { headers, userId } = await signInAnonymously();

    const session = await auth.api.getSession({ headers });
    expect(session?.user.id).toBe(userId);
    expect(session?.user.isAnonymous).toBe(true);
  });

  it('flags the record, so nothing mistakes it for an account', async () => {
    const { userId } = await signInAnonymously();

    const user = await db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();
    expect(user.isAnonymous).toBe(1);
    expect(user.emailVerified).toBe(0);
    expect(user.email).toContain('@anonymous.placeholder.invalid');
  });

  it('sends no mail to the address it invents', async () => {
    await signInAnonymously();

    expect(sent).toEqual([]);
  });

  it('refuses a second one while the first is still in play', async () => {
    const { headers } = await signInAnonymously();

    expect(await errorCode(auth.api.signInAnonymous({ headers }))).toBe(
      'ANONYMOUS_USERS_CANNOT_SIGN_IN_AGAIN_ANONYMOUSLY',
    );
    expect(await userIds()).toHaveLength(1);
  });
});

describe('claiming on sign-up', () => {
  it('moves every list to the account the browser signs up with', async () => {
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Cannae');
    await save(anonymous.userId, 'Trebia');

    await signUp();
    await confirm(anonymous.headers);

    const owner = await accountId();
    expect(await owners()).toEqual([
      { name: 'Cannae', owner },
      { name: 'Trebia', owner },
    ]);
  });

  it('deletes the anonymous record once its lists have moved', async () => {
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Cannae');

    await signUp();
    await confirm(anonymous.headers);

    expect(await userIds()).not.toContain(anonymous.userId);
  });

  it('tells the browser what moved, so the page can say so', async () => {
    const anonymous = await signInAnonymously();
    const first = await save(anonymous.userId, 'Cannae');
    const second = await save(anonymous.userId, 'Trebia');

    await signUp();
    const { headers } = await confirm(anonymous.headers);

    expect(claimCookie(headers)).toEqual([first.id, second.id]);
  });

  it('moves the links the browser handed out, so re-sharing a list keeps its owner', async () => {
    const anonymous = await signInAnonymously();
    await shareList(anonymous.userId, 'Cannae');

    await signUp();
    await confirm(anonymous.headers);

    expect(await shareOwners()).toEqual([
      { name: 'Cannae', owner: await accountId() },
    ]);
  });

  it('keeps a link working when the browser had shared but saved nothing', async () => {
    const anonymous = await signInAnonymously();
    const shared = await shareList(anonymous.userId, 'Cannae');

    await signUp();
    await confirm(anonymous.headers);

    expect(await userIds()).not.toContain(anonymous.userId);
    expect(await findShare(db, shared.id)).toMatchObject({ name: 'Cannae' });
  });

  it('says nothing when the browser was holding nothing', async () => {
    const anonymous = await signInAnonymously();

    await signUp();
    const { headers } = await confirm(anonymous.headers);

    expect(claimCookie(headers)).toEqual([]);
  });

  it('claims nothing at all when there was no anonymous session', async () => {
    await signUp();
    const { headers } = await confirm();

    expect(headers.getSetCookie().join()).not.toContain(claimCookieName);
  });
});

describe('claiming on sign-in', () => {
  it('moves the links into an account that already existed', async () => {
    await signUpAndConfirm();
    const anonymous = await signInAnonymously();
    await shareList(anonymous.userId, 'Cannae');

    await signIn(anonymous.headers);

    expect(await shareOwners()).toEqual([
      { name: 'Cannae', owner: await accountId() },
    ]);
  });

  it('moves lists into an account that already existed', async () => {
    await signUpAndConfirm();
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Zama');

    await signIn(anonymous.headers);

    expect(await owners()).toEqual([
      { name: 'Zama', owner: await accountId() },
    ]);
    expect(await userIds()).not.toContain(anonymous.userId);
  });

  it('leaves a list that was already on the account alone', async () => {
    const { user } = await signUp();
    await confirm();
    await save(user.id, 'Cannae');
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Zama');

    await signIn(anonymous.headers);

    expect(await owners()).toEqual([
      { name: 'Cannae', owner: user.id },
      { name: 'Zama', owner: user.id },
    ]);
  });
});

const googleClientId = 'a-test-google-client-id';

const withGoogle = () =>
  createAuth({
    db,
    secret: 'a-test-secret-nobody-signs-anything-real-with',
    baseUrl: 'http://localhost:3013',
    limitRequests: false,
    sendEmail: () => Promise.resolve({ delivered: true, id: 'msg_google' }),
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

describe('claiming through a provider', () => {
  it('moves the lists when the way in is Google rather than a password', async () => {
    auth = withGoogle();
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Zama');

    await auth.api.signInSocial({
      body: { provider: 'google', idToken: { token: 'a-stub-id-token' } },
      headers: anonymous.headers,
    });

    expect(await owners()).toEqual([
      { name: 'Zama', owner: await accountId() },
    ]);
    expect(await userIds()).not.toContain(anonymous.userId);
  });
});

describe('a claim that cannot be made', () => {
  const blockReassignment = () =>
    sql`create trigger block_reassignment before update of user_id on armies
      begin select raise(abort, 'the reassignment is blocked'); end`.execute(
      db,
    );

  it('leaves the lists with the anonymous record rather than losing them', async () => {
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Cannae');
    await blockReassignment();

    await signUp();
    await confirm(anonymous.headers);

    expect(await owners()).toEqual([
      { name: 'Cannae', owner: anonymous.userId },
    ]);
    expect(await userIds()).toContain(anonymous.userId);
  });

  it('still signs the player in, and tells the browser nothing moved', async () => {
    const anonymous = await signInAnonymously();
    await save(anonymous.userId, 'Cannae');
    await blockReassignment();

    await signUp();
    const { headers } = await confirm(anonymous.headers);

    const session = await auth.api.getSession({ headers: jar(headers) });
    expect(session?.user.email).toBe(email);
    expect(claimCookie(headers)).toEqual([]);
  });
});
