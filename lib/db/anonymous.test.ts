import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fixtureSelection } from '@/test/fixtures/army.ts';
import {
  anonymousRetention,
  shareRetention,
  sweepAnonymousUsers,
} from './anonymous.ts';
import { insertArmy } from './armies.ts';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';
import type { SessionsTable, UsersTable } from './schema.ts';
import { insertShare } from './shares.ts';

let db: ReturnType<typeof createDatabase>;
let minted: number;

const now = new Date(Date.UTC(2026, 8, 19, 12));

const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

const day = 24 * 60 * 60 * 1000;

const recently = ago(day);

const longAgo = ago(anonymousRetention.idleAfter + day);

const beforeTheGrace = ago(anonymousRetention.emptyAfter + day);

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  minted = 0;
});

afterEach(async () => {
  await db.destroy();
});

type UserChanges = Partial<Insertable<UsersTable>>;

const user = (
  id: string,
  { isAnonymous = 1, createdAt = beforeTheGrace }: UserChanges = {},
): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
  isAnonymous,
  createdAt,
  updatedAt: createdAt,
});

const givenUser = async (id: string, changes: UserChanges = {}) => {
  await db.insertInto('users').values(user(id, changes)).execute();
  return id;
};

const givenArmy = (userId: string, at: string) =>
  insertArmy(db, {
    id: `army-${++minted}`,
    userId,
    name: `List ${minted}`,
    selection: fixtureSelection(),
    at,
  });

const givenSession = (userId: string, at: string) =>
  db
    .insertInto('sessions')
    .values({
      id: `session-${userId}`,
      userId,
      token: `token-${userId}`,
      expiresAt: at,
      ipAddress: null,
      userAgent: null,
      createdAt: at,
      updatedAt: at,
    } satisfies Insertable<SessionsTable>)
    .execute();

const givenShare = async (userId: string, seenAt: string) =>
  (
    await insertShare(db, {
      userId,
      name: `Copy ${++minted}`,
      selection: fixtureSelection(),
      at: seenAt,
    })
  ).id;

const sweep = () => sweepAnonymousUsers(db, { now: () => now });

const shareIds = async () =>
  (await db.selectFrom('shares').select('id').orderBy('id').execute()).map(
    ({ id }) => id,
  );

const shareAuthors = async () =>
  (await db.selectFrom('shares').select('user_id').execute()).map(
    ({ user_id }) => user_id,
  );

const survivors = async () =>
  (await db.selectFrom('users').select('id').orderBy('id').execute()).map(
    ({ id }) => id,
  );

const armyOwners = async () =>
  (await db.selectFrom('armies').select('user_id').execute()).map(
    ({ user_id }) => user_id,
  );

describe('sweepAnonymousUsers', () => {
  it('deletes an anonymous record that never held a list', async () => {
    await givenUser('empty');

    expect(await sweep()).toEqual({ users: 1, armies: 0, shares: 0 });
    expect(await survivors()).toEqual([]);
  });

  it('keeps an empty record that is younger than the grace period', async () => {
    await givenUser('fresh', { createdAt: recently });

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 0 });
    expect(await survivors()).toEqual(['fresh']);
  });

  it('keeps an empty record whose browser was here this week', async () => {
    await givenUser('browsing');
    await givenSession('browsing', recently);

    await sweep();

    expect(await survivors()).toEqual(['browsing']);
  });

  it('keeps a record whose lists were touched inside the window', async () => {
    await givenUser('active');
    await givenArmy('active', recently);

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 0 });
    expect(await survivors()).toEqual(['active']);
  });

  it('deletes a record untouched for the whole retention window, lists and all', async () => {
    await givenUser('forgotten', { createdAt: longAgo });
    await givenArmy('forgotten', longAgo);
    await givenArmy('forgotten', longAgo);
    await givenSession('forgotten', longAgo);

    expect(await sweep()).toEqual({ users: 1, armies: 2, shares: 0 });
    expect(await survivors()).toEqual([]);
  });

  it('keeps an old record whose browser came back recently', async () => {
    await givenUser('returning', { createdAt: longAgo });
    await givenArmy('returning', longAgo);
    await givenSession('returning', recently);

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 0 });
    expect(await survivors()).toEqual(['returning']);
  });

  it('never touches an account, however long it has been idle', async () => {
    await givenUser('account', { isAnonymous: 0, createdAt: longAgo });
    await givenArmy('account', longAgo);

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 0 });
    expect(await survivors()).toEqual(['account']);
    expect(await armyOwners()).toEqual(['account']);
  });

  it('spares a browser that shared a copy but saved no list', async () => {
    await givenUser('sharer');
    await givenShare('sharer', recently);

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 0 });
    expect(await survivors()).toEqual(['sharer']);
  });

  it('deletes a copy nobody has opened for the whole retention window', async () => {
    await givenUser('account', { isAnonymous: 0, createdAt: longAgo });
    await givenShare('account', ago(shareRetention.unseenAfter + day));

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 1 });
    expect(await shareIds()).toEqual([]);
  });

  it('keeps a copy somebody opened inside the window, however old it is', async () => {
    await givenUser('account', { isAnonymous: 0, createdAt: longAgo });
    const kept = await givenShare('account', recently);

    expect(await sweep()).toEqual({ users: 0, armies: 0, shares: 0 });
    expect(await shareIds()).toEqual([kept]);
  });

  it('outlives the anonymous author it loses to the idle sweep', async () => {
    await givenUser('forgotten', { createdAt: longAgo });
    await givenArmy('forgotten', longAgo);
    await givenSession('forgotten', longAgo);
    const kept = await givenShare('forgotten', recently);

    expect(await sweep()).toEqual({ users: 1, armies: 1, shares: 0 });
    expect(await survivors()).toEqual([]);
    expect(await shareIds()).toEqual([kept]);
    expect(await shareAuthors()).toEqual([null]);
  });

  it('leaves the lists of the records it spares exactly where they are', async () => {
    await givenUser('forgotten', { createdAt: longAgo });
    await givenArmy('forgotten', longAgo);
    await givenUser('active');
    await givenArmy('active', recently);

    await sweep();

    expect(await armyOwners()).toEqual(['active']);
  });
});
