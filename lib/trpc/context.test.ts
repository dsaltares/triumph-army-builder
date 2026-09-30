import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '@/lib/auth/auth.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { carthage, fromCarthage, lookupCarthage } from '@/test/events.ts';
import { createSessions } from '@/test/sessions.ts';
import { createContext } from './context';

let db: ReturnType<typeof createDatabase>;
let auth: Auth;
let sessions: ReturnType<typeof createSessions>;

const email = 'hannibal@example.test';

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  sessions = createSessions(db);
  auth = sessions.auth;
});

afterEach(async () => {
  await db.destroy();
});

describe('createContext', () => {
  it('names the caller behind a session cookie', async () => {
    const headers = await sessions.signedIn(email);

    const context = await createContext({ headers, db, auth });

    const owner = await db
      .selectFrom('users')
      .select('id')
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    expect(context.caller).toEqual({
      userId: owner.id,
      isAnonymous: false,
      isAdmin: false,
    });
  });

  it('has no caller with no cookie at all', async () => {
    const context = await createContext({ headers: new Headers(), db, auth });

    expect(context.caller).toBeNull();
  });

  it('has no caller behind a cookie that signs nothing', async () => {
    const context = await createContext({
      headers: new Headers({ cookie: 'better-auth.session_token=forged' }),
      db,
      auth,
    });

    expect(context.caller).toBeNull();
  });

  it('names the browser behind an anonymous session, and says which it is', async () => {
    const headers = await sessions.anonymous();

    const context = await createContext({ headers, db, auth });

    const browser = await db
      .selectFrom('users')
      .select('id')
      .where('isAnonymous', '=', 1)
      .executeTakeFirstOrThrow();
    expect(context.caller).toEqual({
      userId: browser.id,
      isAnonymous: true,
      isAdmin: false,
    });
  });

  it('mints a fresh id and an ISO timestamp for each write', async () => {
    const context = await createContext({ headers: new Headers(), db, auth });

    expect(context.nextId()).not.toBe(context.nextId());
    expect(context.now()).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });
});

describe('the origin a write is recorded from', () => {
  it('takes the client address from the request and looks up where it is', async () => {
    const context = await createContext({
      headers: fromCarthage(),
      db,
      auth,
      lookupIp: lookupCarthage,
    });

    expect(context.origin).toEqual(carthage);
  });

  it('keeps an address that resolves nowhere, with no place', async () => {
    const context = await createContext({
      headers: new Headers({ 'x-forwarded-for': '192.0.2.44' }),
      db,
      auth,
      lookupIp: lookupCarthage,
    });

    expect(context.origin).toEqual({ ip: '192.0.2.44', location: null });
  });
});
