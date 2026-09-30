import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ActivityEvent,
  type EventActor,
  type EventOrigin,
  recordEvent,
} from '@/lib/db/activity-events.ts';
import { insertArmy } from '@/lib/db/armies.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { insertCollectionEntry } from '@/lib/db/collection.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { UsersTable } from '@/lib/db/schema.ts';
import { insertShare } from '@/lib/db/shares.ts';
import type { SeriesPoint } from '@/lib/domain/usage/stats-window.ts';
import { defaultPhotoQuota } from '@/lib/photos/limits.ts';
import type { Caller } from '@/lib/trpc/context.ts';
import { createCaller } from '@/lib/trpc/root.ts';
import { absentBundles } from '@/test/bundle-source.ts';
import { carthage } from '@/test/events.ts';
import { fixtureSelection } from '@/test/fixtures/army.ts';
import { absentPhotoStore } from '@/test/photo-store.ts';

let db: ReturnType<typeof createDatabase>;

const callAs = (caller: Caller | null) =>
  createCaller({
    db,
    caller,
    origin: carthage,
    photos: absentPhotoStore(),
    photoQuota: defaultPhotoQuota,
    bundles: absentBundles(),
    now: () => new Date(Date.UTC(2026, 8, 29, 10, 0)).toISOString(),
    nextId: () => 'id-1',
  });

const admin: Caller = {
  userId: 'user-scipio',
  isAnonymous: false,
  isAdmin: true,
};

const player: Caller = {
  userId: 'user-hannibal',
  isAnonymous: false,
  isAdmin: false,
};

const anonymousBrowser: Caller = {
  userId: 'user-browser',
  isAnonymous: true,
  isAdmin: false,
};

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('admin.viewer', () => {
  it('says an admin is one', async () => {
    expect(await callAs(admin).admin.viewer()).toEqual({
      userId: 'user-scipio',
      isAdmin: true,
    });
  });

  it.each([
    ['a signed-in player', player],
    ['an anonymous browser', anonymousBrowser],
  ])('says %s is not', async (_, caller) => {
    expect(await callAs(caller).admin.viewer()).toEqual({
      userId: caller.userId,
      isAdmin: false,
    });
  });

  it('names nobody without a session', async () => {
    expect(await callAs(null).admin.viewer()).toBeNull();
  });
});

const hannibal: EventActor = { userId: 'user-hannibal', isAnonymous: false };

const scipio: EventActor = { userId: 'user-scipio', isAnonymous: false };

const browser: EventActor = { userId: 'user-browser', isAnonymous: true };

const utica: EventOrigin = {
  ip: '203.0.113.8',
  location: { country: 'TN', region: 'Bizerte', city: 'Utica' },
};

const rome: EventOrigin = {
  ip: '2001:db8::1',
  location: { country: 'IT', region: 'Lazio', city: 'Rome' },
};

const nowhere: EventOrigin = { ip: null, location: null };

const record = (
  event: ActivityEvent,
  actor: EventActor | null,
  day: number,
  origin: EventOrigin = carthage,
) =>
  recordEvent(db, {
    event,
    actor,
    origin,
    now: () => new Date(Date.UTC(2026, 8, day, 12)).toISOString(),
  });

const signedIn = (method: 'password' | 'google' | 'discord') =>
  ({ kind: 'account.signed_in', props: { method } }) as const;

const seedEvents = async () => {
  await record({ kind: 'account.signed_up' }, hannibal, 22);
  await record({ kind: 'account.signed_up' }, hannibal, 23);
  await record({ kind: 'account.signed_up' }, scipio, 28, rome);
  await record(signedIn('password'), hannibal, 24);
  await record(signedIn('google'), scipio, 24, rome);
  await record(signedIn('password'), hannibal, 29, utica);
  await record({ kind: 'list.created' }, hannibal, 23);
  await record({ kind: 'list.created' }, browser, 23, nowhere);
  await record({ kind: 'list.created' }, browser, 29, rome);
  await record({ kind: 'list.edited' }, hannibal, 24);
  await record({ kind: 'list.edited' }, hannibal, 24);
  await record({ kind: 'share.minted' }, browser, 25, rome);
  await record({ kind: 'page.viewed', props: { route: '/' } }, null, 26);
  await record({ kind: 'list.created' }, hannibal, 30);
};

const dailyDays = ['23', '24', '25', '26', '27', '28', '29'];

const daily = (
  counts: Record<string, [account: number, anonymous: number]> = {},
): SeriesPoint[] =>
  dailyDays.map((day) => {
    const [account, anonymous] = counts[day] ?? [0, 0];
    return { bucket: `2026-09-${day}`, account, anonymous };
  });

const stats = (
  input: Partial<Parameters<ReturnType<typeof callAs>['admin']['stats']>[0]>,
) =>
  callAs(admin).admin.stats({
    range: '7d',
    bucket: 'day',
    audience: 'all',
    ...input,
  });

describe('admin.stats', () => {
  it.each([
    ['a signed-in player', player],
    ['an anonymous browser', anonymousBrowser],
    ['a visitor with no session', null],
  ])('does not exist for %s', async (_, caller) => {
    await expect(
      callAs(caller).admin.stats({
        range: '7d',
        bucket: 'day',
        audience: 'all',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a range, a bucket or an audience it does not know', async () => {
    await expect(
      stats({ range: '1y' } as unknown as Parameters<typeof stats>[0]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      stats({ bucket: 'month' } as unknown as Parameters<typeof stats>[0]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(
      stats({ audience: 'admins' } as unknown as Parameters<typeof stats>[0]),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('returns every bucket as zero when nothing happened', async () => {
    const result = await stats({});

    expect(result.range).toEqual({
      from: '2026-09-23T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
    });
    expect(result.series).toEqual({
      signUps: daily(),
      signIns: [
        { method: 'password', points: daily() },
        { method: 'google', points: daily() },
        { method: 'discord', points: daily() },
      ],
      activeUsers: daily(),
      listsCreated: daily(),
      listsEdited: daily(),
      sharesMinted: daily(),
    });
    expect(result.countries).toEqual([]);
    expect(result.cities).toEqual([]);
  });

  it('draws each series a day over the last seven, split by account and anonymous', async () => {
    await seedEvents();

    expect((await stats({})).series).toEqual({
      signUps: daily({ '23': [1, 0], '28': [1, 0] }),
      signIns: [
        { method: 'password', points: daily({ '24': [1, 0], '29': [1, 0] }) },
        { method: 'google', points: daily({ '24': [1, 0] }) },
        { method: 'discord', points: daily() },
      ],
      activeUsers: daily({
        '23': [1, 1],
        '24': [2, 0],
        '25': [0, 1],
        '28': [1, 0],
        '29': [1, 1],
      }),
      listsCreated: daily({ '23': [1, 1], '29': [0, 1] }),
      listsEdited: daily({ '24': [2, 0] }),
      sharesMinted: daily({ '25': [0, 1] }),
    });
  });

  it('buckets a week from its Monday, widening the range to it', async () => {
    await seedEvents();

    const result = await stats({ bucket: 'week' });

    expect(result.range).toEqual({
      from: '2026-09-21T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
    });
    expect(result.series.signUps).toEqual([
      { bucket: '2026-09-21', account: 2, anonymous: 0 },
      { bucket: '2026-09-28', account: 1, anonymous: 0 },
    ]);
    expect(result.series.activeUsers).toEqual([
      { bucket: '2026-09-21', account: 2, anonymous: 1 },
      { bucket: '2026-09-28', account: 2, anonymous: 1 },
    ]);
    expect(result.series.listsCreated).toEqual([
      { bucket: '2026-09-21', account: 1, anonymous: 1 },
      { bucket: '2026-09-28', account: 0, anonymous: 1 },
    ]);
  });

  it('reaches back as far as the range asks', async () => {
    await seedEvents();

    const result = await stats({ range: '30d', bucket: 'week' });

    expect(result.range).toEqual({
      from: '2026-08-31T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
    });
    expect(result.series.signUps).toEqual([
      { bucket: '2026-08-31', account: 0, anonymous: 0 },
      { bucket: '2026-09-07', account: 0, anonymous: 0 },
      { bucket: '2026-09-14', account: 0, anonymous: 0 },
      { bucket: '2026-09-21', account: 2, anonymous: 0 },
      { bucket: '2026-09-28', account: 1, anonymous: 0 },
    ]);
  });

  it('counts only the audience asked for', async () => {
    await seedEvents();

    const anonymous = await stats({ audience: 'anonymous' });
    expect(anonymous.series.listsCreated).toEqual(
      daily({ '23': [0, 1], '29': [0, 1] }),
    );
    expect(anonymous.series.signUps).toEqual(daily());
    expect(anonymous.countries).toEqual([
      { country: 'IT', events: 2 },
      { country: 'TN', events: 1 },
    ]);

    const account = await stats({ audience: 'account' });
    expect(account.series.listsCreated).toEqual(daily({ '23': [1, 0] }));
    expect(account.series.activeUsers).toEqual(
      daily({ '23': [1, 0], '24': [2, 0], '28': [1, 0], '29': [1, 0] }),
    );
    expect(account.series.sharesMinted).toEqual(daily());
  });

  it('ranks where events came from, leaving out what resolved nowhere', async () => {
    await seedEvents();

    const { countries, cities } = await stats({});

    expect(countries).toEqual([
      { country: 'TN', events: 7 },
      { country: 'IT', events: 4 },
    ]);
    expect(cities).toEqual([
      { country: 'TN', region: 'Tunis', city: 'Carthage', events: 6 },
      { country: 'IT', region: 'Lazio', city: 'Rome', events: 4 },
      { country: 'TN', region: 'Bizerte', city: 'Utica', events: 1 },
    ]);
  });

  it('ranks the pages viewed and the filters chosen, under the audience asked for', async () => {
    const viewed = (route: string) =>
      ({ kind: 'page.viewed', props: { route } }) as const;
    const filtered = (key: string, value: string) =>
      ({ kind: 'filter.used', props: { key, value } }) as const;
    await seedEvents();
    await record(viewed('/armies'), browser, 27);
    await record(viewed('/armies'), hannibal, 27);
    await record(viewed('/armies/[id]'), null, 28);
    await record(viewed('/armies'), hannibal, 10);
    await record(filtered('armies.topography', 'Hilly'), browser, 27);
    await record(filtered('armies.topography', 'Hilly'), hannibal, 28);
    await record(filtered('collection.status', 'painted'), hannibal, 28);

    const all = await stats({});
    expect(all.pages).toEqual([
      { route: '/armies', events: 2 },
      { route: '/', events: 1 },
      { route: '/armies/[id]', events: 1 },
    ]);
    expect(all.filters).toEqual([
      { key: 'armies.topography', value: 'Hilly', events: 2 },
      { key: 'collection.status', value: 'painted', events: 1 },
    ]);

    const account = await stats({ audience: 'account' });
    expect(account.pages).toEqual([{ route: '/armies', events: 1 }]);
    expect(account.filters).toEqual([
      { key: 'armies.topography', value: 'Hilly', events: 1 },
      { key: 'collection.status', value: 'painted', events: 1 },
    ]);
  });

  describe('totals', () => {
    const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
      id,
      name: id,
      email: `${id}@example.test`,
      image: null,
      isAnonymous,
    });

    const at = new Date(Date.UTC(2026, 8, 20)).toISOString();

    const entry = (id: string, userId: string) =>
      insertCollectionEntry(db, {
        id,
        userId,
        name: id,
        count: 4,
        troopType: 'SPR',
        tags: [],
        status: 'painted',
        notes: '',
        at,
      });

    beforeEach(async () => {
      await db
        .insertInto('users')
        .values([
          user('user-hannibal'),
          user('user-scipio'),
          { ...user('user-legacy'), isAnonymous: null },
          user('user-browser', 1),
          user('user-pyrrhus', 1),
          user('user-gone', 1),
        ])
        .execute();
      const selection = fixtureSelection();
      for (const [id, userId] of [
        ['army-1', 'user-hannibal'],
        ['army-2', 'user-hannibal'],
        ['army-3', 'user-scipio'],
        ['army-4', 'user-browser'],
      ] as const) {
        await insertArmy(db, { id, userId, name: id, selection, at });
      }
      for (const [name, userId] of [
        ['Zama', 'user-scipio'],
        ['Heraclea', 'user-pyrrhus'],
        ['Asculum', 'user-gone'],
      ] as const) {
        await insertShare(db, { userId, name, selection, at });
      }
      await db.deleteFrom('users').where('id', '=', 'user-gone').execute();
      await entry('entry-1', 'user-hannibal');
      await entry('entry-2', 'user-scipio');
    });

    it('counts the real tables, whatever the log holds', async () => {
      expect((await stats({})).totals).toEqual({
        users: { account: 3, anonymous: 2 },
        lists: { account: 3, anonymous: 1 },
        shares: { account: 1, anonymous: 2 },
        collectionEntries: { account: 2, anonymous: 0 },
      });
    });

    it('counts only the audience asked for', async () => {
      expect((await stats({ audience: 'account' })).totals).toEqual({
        users: { account: 3, anonymous: 0 },
        lists: { account: 3, anonymous: 0 },
        shares: { account: 1, anonymous: 0 },
        collectionEntries: { account: 2, anonymous: 0 },
      });
      expect((await stats({ audience: 'anonymous' })).totals).toEqual({
        users: { account: 0, anonymous: 2 },
        lists: { account: 0, anonymous: 1 },
        shares: { account: 0, anonymous: 2 },
        collectionEntries: { account: 0, anonymous: 0 },
      });
    });
  });

  it('never returns a user id, an address or an email', async () => {
    await seedEvents();

    const returned = JSON.stringify(await stats({ range: '90d' }));

    for (const secret of [
      'user-hannibal',
      'user-scipio',
      'user-browser',
      '203.0.113',
      '2001:db8',
      '@',
    ]) {
      expect(returned).not.toContain(secret);
    }
  });
});
