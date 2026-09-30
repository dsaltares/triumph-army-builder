import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { adminEmails } from '@/lib/auth/admins.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { defaultPhotoQuota } from '@/lib/photos/limits.ts';
import {
  type Caller,
  type Context,
  createContext,
} from '@/lib/trpc/context.ts';
import {
  accountProcedure,
  adminProcedure,
  createCallerFactory,
  router,
} from '@/lib/trpc/trpc.ts';
import { absentBundles } from '@/test/bundle-source.ts';
import { carthage } from '@/test/events.ts';
import { absentPhotoStore } from '@/test/photo-store.ts';
import { createSessions } from '@/test/sessions.ts';

let db: ReturnType<typeof createDatabase>;

const guarded = router({
  whoAmI: accountProcedure.query(({ ctx }) => ctx.caller.userId),
  dashboard: adminProcedure.query(({ ctx }) => ctx.caller.userId),
});

const callerFor = (context: Context) => createCallerFactory(guarded)(context);

const callAs = (caller: Caller | null) =>
  callerFor({
    db,
    caller,
    origin: carthage,
    photos: absentPhotoStore(),
    photoQuota: defaultPhotoQuota,
    bundles: absentBundles(),
    now: () => new Date(Date.UTC(2026, 8, 24, 10, 0)).toISOString(),
    nextId: () => 'id-1',
  } satisfies Context).whoAmI();

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('accountProcedure', () => {
  it('runs the procedure for a signed-in caller', async () => {
    expect(
      await callAs({
        userId: 'user-hannibal',
        isAnonymous: false,
        isAdmin: false,
      }),
    ).toBe('user-hannibal');
  });

  it.each([
    ['there is no caller', null],
    [
      'the caller is anonymous',
      { userId: 'user-anonymous', isAnonymous: true, isAdmin: false },
    ],
  ])('asks for an account when %s', async (_, caller) => {
    await expect(callAs(caller)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'needsAccount',
    });
  });
});

describe('adminProcedure', () => {
  const admin = 'hannibal@example.test';
  const admins = adminEmails({ ADMIN_EMAILS: `Scipio@example.test, ${admin}` });
  let sessions: ReturnType<typeof createSessions>;

  beforeEach(() => {
    sessions = createSessions(db);
  });

  const dashboardAs = async (headers: Headers) =>
    callerFor(
      await createContext({
        headers,
        db,
        auth: sessions.auth,
        admins,
        photos: absentPhotoStore(),
        bundles: absentBundles(),
      }),
    ).dashboard();

  const idOf = async (email: string) =>
    (
      await db
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirstOrThrow()
    ).id;

  const refused = { code: 'NOT_FOUND', message: 'notFound' };

  it('runs the procedure for a verified account on the list', async () => {
    const headers = await sessions.signedIn(admin);

    expect(await dashboardAs(headers)).toBe(await idOf(admin));
  });

  it('matches the list whatever the case of the configured email', async () => {
    const headers = await sessions.signedIn('scipio@example.test');

    expect(await dashboardAs(headers)).toBe(await idOf('scipio@example.test'));
  });

  it('refuses a signed-in account that is not on the list', async () => {
    const headers = await sessions.signedIn('fabius@example.test');

    await expect(dashboardAs(headers)).rejects.toMatchObject(refused);
  });

  it('refuses an account on the list whose email is not verified', async () => {
    const headers = await sessions.signedIn(admin);
    await db
      .updateTable('users')
      .set({ emailVerified: 0 })
      .where('email', '=', admin)
      .execute();

    await expect(dashboardAs(headers)).rejects.toMatchObject(refused);
  });

  it('refuses an anonymous caller', async () => {
    const headers = await sessions.anonymous();

    await expect(dashboardAs(headers)).rejects.toMatchObject(refused);
  });

  it('refuses a caller with no session', async () => {
    await expect(dashboardAs(new Headers())).rejects.toMatchObject(refused);
  });
});
