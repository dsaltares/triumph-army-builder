import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRateLimiter, type RateLimiter } from '@/lib/auth/rate-limit.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { resolveCaller } from '@/lib/trpc/context.ts';
import {
  blockEvents,
  carthage,
  recordedEvents,
  recordedKinds,
} from '@/test/events.ts';
import { createSessions } from '@/test/sessions.ts';
import { recordUsageResponse } from './record-usage.ts';

let db: ReturnType<typeof createDatabase>;
let sessions: ReturnType<typeof createSessions>;

const browserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const pageView = { kind: 'page.viewed', props: { route: '/armies/[id]' } };

const generousLimiter = () => createRateLimiter({ window: 3600, max: 100 });

const beacon = (body: unknown, headers: HeadersInit = {}) =>
  new Request('http://localhost:3013/api/events', {
    method: 'POST',
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
      'user-agent': browserAgent,
      ...Object.fromEntries(new Headers(headers)),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const send = (request: Request, limiter: RateLimiter = generousLimiter()) =>
  recordUsageResponse({
    request,
    caller: () => resolveCaller(request.headers, sessions.auth),
    origin: carthage,
    db,
    limiter,
    now: () => '2026-09-30T10:00:00.000Z',
  });

const countUsers = async () =>
  Number(
    (
      await db
        .selectFrom('users')
        .select(({ fn }) => fn.countAll<number>().as('users'))
        .executeTakeFirstOrThrow()
    ).users,
  );

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  sessions = createSessions(db);
});

afterEach(async () => {
  await db.destroy();
});

describe('recordUsageResponse', () => {
  it('records a page view with no cookie, and mints no session for it', async () => {
    const response = await send(beacon(pageView));

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await countUsers()).toBe(0);
    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'page.viewed',
        user_id: null,
        is_anonymous: 1,
        subject_id: null,
        props: JSON.stringify({ route: '/armies/[id]' }),
        ip: carthage.ip,
        country: 'TN',
        region: 'Tunis',
        city: 'Carthage',
      },
    ]);
  });

  it('names the player behind a session that already exists', async () => {
    const signedIn = await sessions.signedIn('hannibal@example.test');
    const anonymous = await sessions.anonymous();

    await send(beacon(pageView, signedIn));
    await send(
      beacon(
        {
          kind: 'filter.used',
          props: { key: 'collection.status', value: 'painted' },
        },
        anonymous,
      ),
    );

    const users = await db
      .selectFrom('users')
      .select(['id', 'isAnonymous'])
      .orderBy('isAnonymous')
      .execute();
    expect(
      (await recordedEvents(db))
        .filter(({ kind }) => kind === 'page.viewed' || kind === 'filter.used')
        .map(({ kind, user_id, is_anonymous }) => ({
          kind,
          user_id,
          is_anonymous,
        })),
    ).toEqual([
      { kind: 'page.viewed', user_id: users[0]?.id, is_anonymous: 0 },
      { kind: 'filter.used', user_id: users[1]?.id, is_anonymous: 1 },
    ]);
  });

  it('limits a flood with the same answer it gives a beacon it keeps', async () => {
    const limiter = createRateLimiter({ window: 3600, max: 2 });

    const statuses = [];
    for (let sent = 0; sent < 5; sent += 1) {
      const response = await send(beacon(pageView), limiter);
      statuses.push([response.status, await response.text()]);
    }

    expect(statuses).toEqual(Array.from({ length: 5 }, () => [204, '']));
    expect(await recordedKinds(db)).toEqual(['page.viewed', 'page.viewed']);
  });

  it.each([
    ['Sec-GPC', { 'sec-gpc': '1' }],
    ['DNT', { dnt: '1' }],
  ])('records nothing when the browser sends %s', async (_, headers) => {
    const response = await send(beacon(pageView, headers));

    expect(response.status).toBe(204);
    expect(await recordedKinds(db)).toEqual([]);
  });

  it.each([
    'Googlebot/2.1 (+http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0)',
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/129.0 Safari/537.36',
    'curl/8.7.1',
    '',
  ])('drops a beacon from the agent %j', async (agent) => {
    const response = await send(beacon(pageView, { 'user-agent': agent }));

    expect(response.status).toBe(204);
    expect(await recordedKinds(db)).toEqual([]);
  });

  it.each([
    ['a full url', { kind: 'page.viewed', props: { route: '/armies?q=a' } }],
    ['a write', { kind: 'list.created', props: {} }],
    [
      'a search',
      { kind: 'filter.used', props: { key: 'armies.search', value: 'rome' } },
    ],
    ['something that is not JSON', 'page.viewed /armies'],
    [
      'a body too large to be a beacon',
      { ...pageView, padding: 'x'.repeat(2048) },
    ],
  ])('records nothing for %s', async (_, body) => {
    const response = await send(beacon(body));

    expect(response.status).toBe(204);
    expect(await recordedKinds(db)).toEqual([]);
  });

  it('answers the same when the event cannot be recorded', async () => {
    await blockEvents(db);

    const response = await send(beacon(pageView));

    expect(response.status).toBe(204);
  });
});
