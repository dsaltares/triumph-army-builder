import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ActivityEvent,
  activeUserSeries,
  type EventActor,
  type EventOrigin,
  eventSeries,
  recordEvent,
  recordThrottledEvent,
  topCities,
  topCountries,
} from './activity-events.ts';
import { createDatabase } from './client.ts';
import { migrateToLatest } from './migrator.ts';

let db: ReturnType<typeof createDatabase>;

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
});

afterEach(async () => {
  await db.destroy();
});

const hannibal: EventActor = { userId: 'user-hannibal', isAnonymous: false };

const scipio: EventActor = { userId: 'user-scipio', isAnonymous: false };

const browser: EventActor = { userId: 'user-pyrrhus', isAnonymous: true };

const carthage: EventOrigin = {
  ip: '203.0.113.7',
  location: { country: 'TN', region: 'Tunis', city: 'Carthage' },
};

const rome: EventOrigin = {
  ip: '2001:db8::1',
  location: { country: 'IT', region: 'Lazio', city: 'Rome' },
};

const nowhere: EventOrigin = { ip: null, location: null };

const at = (day: number, hour = 12) =>
  new Date(Date.UTC(2026, 8, day, hour)).toISOString();

const record = (
  event: ActivityEvent,
  {
    actor = hannibal,
    origin = carthage,
    day = 20,
    subjectId,
  }: {
    actor?: EventActor | null;
    origin?: EventOrigin;
    day?: number;
    subjectId?: string;
  } = {},
) => recordEvent(db, { event, actor, origin, subjectId, now: () => at(day) });

const created: ActivityEvent = { kind: 'list.created' };

const recorded = () =>
  db.selectFrom('activity_events').selectAll().orderBy('id').execute();

const september = { from: at(1, 0), to: at(30, 0) };

describe('recordEvent', () => {
  it('records who did what to which subject, when and from where', async () => {
    await record(created, { subjectId: 'army-1' });

    expect(await recorded()).toEqual([
      {
        id: 1,
        occurred_at: '2026-09-20T12:00:00.000Z',
        kind: 'list.created',
        user_id: 'user-hannibal',
        is_anonymous: 0,
        subject_id: 'army-1',
        props: '{}',
        ip: '203.0.113.7',
        country: 'TN',
        region: 'Tunis',
        city: 'Carthage',
      },
    ]);
  });

  it('keeps the props a kind carries', async () => {
    await record({
      kind: 'account.signed_in',
      props: { method: 'discord' },
    });

    const [event] = await recorded();
    expect(JSON.parse(event?.props ?? '')).toEqual({ method: 'discord' });
  });

  it('marks an anonymous player, and a visitor with no session, as anonymous', async () => {
    await record(created, { actor: browser });
    await record(
      { kind: 'page.viewed', props: { route: '/armies/[id]' } },
      { actor: null },
    );

    expect(
      (await recorded()).map(({ user_id, is_anonymous }) => ({
        user_id,
        is_anonymous,
      })),
    ).toEqual([
      { user_id: 'user-pyrrhus', is_anonymous: 1 },
      { user_id: null, is_anonymous: 1 },
    ]);
  });

  it('records an address that resolves nowhere, and one it never had', async () => {
    await record(created, {
      origin: { ip: '192.168.1.10', location: null },
    });
    await record(created, { origin: nowhere });

    expect(
      (await recorded()).map(({ ip, country, region, city }) => ({
        ip,
        country,
        region,
        city,
      })),
    ).toEqual([
      { ip: '192.168.1.10', country: null, region: null, city: null },
      { ip: null, country: null, region: null, city: null },
    ]);
  });

  it('refuses a kind the code does not know', async () => {
    await expect(
      record({ kind: 'list.exploded' } as unknown as ActivityEvent),
    ).rejects.toThrow();
    expect(await recorded()).toEqual([]);
  });

  it('refuses props a kind does not carry', async () => {
    await expect(
      record({
        kind: 'list.created',
        props: { email: 'hannibal@example.test' },
      } as unknown as ActivityEvent),
    ).rejects.toThrow();
    await expect(
      record({
        kind: 'account.signed_in',
        props: { method: 'carrier-pigeon' },
      } as unknown as ActivityEvent),
    ).rejects.toThrow();
    await expect(
      record({
        kind: 'page.viewed',
        props: { route: '/armies/66c', query: '?era=ancient' },
      } as unknown as ActivityEvent),
    ).rejects.toThrow();
    expect(await recorded()).toEqual([]);
  });

  it('records nothing when the write it belongs to fails', async () => {
    await expect(
      db.transaction().execute(async (trx) => {
        await recordEvent(trx, {
          event: created,
          actor: hannibal,
          origin: carthage,
          now: () => at(20),
        });
        throw new Error('the list did not save');
      }),
    ).rejects.toThrow('the list did not save');

    expect(await recorded()).toEqual([]);
  });

  it('records alongside the write when it commits', async () => {
    await db.transaction().execute((trx) =>
      recordEvent(trx, {
        event: created,
        actor: hannibal,
        origin: carthage,
        now: () => at(20),
      }),
    );

    expect(await recorded()).toHaveLength(1);
  });
});

describe('recordThrottledEvent', () => {
  const tenMinutes = 10 * 60 * 1000;

  const edit = ({
    actor = hannibal,
    subjectId = 'army-1',
    minute,
  }: {
    actor?: EventActor | null;
    subjectId?: string | null;
    minute: number;
  }) =>
    recordThrottledEvent(
      db,
      {
        event: { kind: 'list.edited' },
        actor,
        subjectId,
        origin: carthage,
        now: () => new Date(Date.UTC(2026, 8, 20, 12, minute)).toISOString(),
      },
      tenMinutes,
    );

  it('records one event a window for the same player and subject', async () => {
    await edit({ minute: 0 });
    await edit({ minute: 4 });
    await edit({ minute: 9 });
    await edit({ minute: 11 });

    expect((await recorded()).map(({ occurred_at }) => occurred_at)).toEqual([
      '2026-09-20T12:00:00.000Z',
      '2026-09-20T12:11:00.000Z',
    ]);
  });

  it('throttles each subject and each player apart', async () => {
    await edit({ minute: 0 });
    await edit({ minute: 1, subjectId: 'army-2' });
    await edit({ minute: 2, actor: scipio });

    expect(
      (await recorded()).map(({ user_id, subject_id }) => ({
        user_id,
        subject_id,
      })),
    ).toEqual([
      { user_id: 'user-hannibal', subject_id: 'army-1' },
      { user_id: 'user-hannibal', subject_id: 'army-2' },
      { user_id: 'user-scipio', subject_id: 'army-1' },
    ]);
  });

  it('does not count another kind against the window', async () => {
    await record({ kind: 'list.created' }, { subjectId: 'army-1', day: 20 });
    await edit({ minute: 1 });

    expect((await recorded()).map(({ kind }) => kind)).toEqual([
      'list.created',
      'list.edited',
    ]);
  });

  it('records every time when there is no player or subject to throttle by', async () => {
    await edit({ minute: 0, actor: null });
    await edit({ minute: 1, actor: null });
    await edit({ minute: 2, subjectId: null });
    await edit({ minute: 3, subjectId: null });

    expect(await recorded()).toHaveLength(4);
  });
});

describe('eventSeries', () => {
  beforeEach(async () => {
    await record(created, { day: 14 });
    await record(created, { day: 20 });
    await record(created, { day: 20, actor: scipio });
    await record(created, { day: 20, actor: browser });
    await record(created, { day: 21 });
    await record({ kind: 'list.deleted' }, { day: 21 });
    await record(created, { day: 30 });
  });

  it('counts one kind a day, split by account and anonymous', async () => {
    expect(
      await eventSeries(db, {
        kind: 'list.created',
        range: september,
        bucket: 'day',
        audience: 'all',
      }),
    ).toEqual([
      { bucket: '2026-09-14', isAnonymous: false, events: 1 },
      { bucket: '2026-09-20', isAnonymous: false, events: 2 },
      { bucket: '2026-09-20', isAnonymous: true, events: 1 },
      { bucket: '2026-09-21', isAnonymous: false, events: 1 },
    ]);
  });

  it('buckets a week from its Monday', async () => {
    expect(
      await eventSeries(db, {
        kind: 'list.created',
        range: september,
        bucket: 'week',
        audience: 'all',
      }),
    ).toEqual([
      { bucket: '2026-09-14', isAnonymous: false, events: 3 },
      { bucket: '2026-09-14', isAnonymous: true, events: 1 },
      { bucket: '2026-09-21', isAnonymous: false, events: 1 },
    ]);
  });

  it('counts only the audience asked for', async () => {
    expect(
      await eventSeries(db, {
        kind: 'list.created',
        range: september,
        bucket: 'week',
        audience: 'anonymous',
      }),
    ).toEqual([{ bucket: '2026-09-14', isAnonymous: true, events: 1 }]);
    expect(
      await eventSeries(db, {
        kind: 'list.created',
        range: september,
        bucket: 'week',
        audience: 'account',
      }),
    ).toEqual([
      { bucket: '2026-09-14', isAnonymous: false, events: 3 },
      { bucket: '2026-09-21', isAnonymous: false, events: 1 },
    ]);
  });
});

describe('activeUserSeries', () => {
  it('counts each player once a bucket, and never a visitor with no session', async () => {
    await record(created, { day: 20 });
    await record({ kind: 'list.edited' }, { day: 20 });
    await record(created, { day: 20, actor: scipio });
    await record(created, { day: 20, actor: browser });
    await record(
      { kind: 'page.viewed', props: { route: '/' } },
      { day: 20, actor: null },
    );
    await record(created, { day: 21 });

    expect(
      await activeUserSeries(db, {
        range: september,
        bucket: 'day',
        audience: 'all',
      }),
    ).toEqual([
      { bucket: '2026-09-20', isAnonymous: false, users: 2 },
      { bucket: '2026-09-20', isAnonymous: true, users: 1 },
      { bucket: '2026-09-21', isAnonymous: false, users: 1 },
    ]);
  });
});

describe('where players come from', () => {
  beforeEach(async () => {
    await record(created, { origin: carthage });
    await record(created, { origin: carthage, actor: browser });
    await record(created, { origin: rome, actor: scipio });
    await record(created, { origin: nowhere });
    await record(created, { origin: rome, day: 30 });
  });

  it('ranks countries by events, leaving out what resolved nowhere', async () => {
    expect(
      await topCountries(db, { range: september, audience: 'all', limit: 5 }),
    ).toEqual([
      { country: 'TN', events: 2 },
      { country: 'IT', events: 1 },
    ]);
  });

  it('ranks cities within the audience and the limit', async () => {
    expect(
      await topCities(db, { range: september, audience: 'account', limit: 1 }),
    ).toEqual([{ country: 'IT', region: 'Lazio', city: 'Rome', events: 1 }]);
  });
});
