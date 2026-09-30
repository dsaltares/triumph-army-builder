import { type Kysely, type NotNull, sql } from 'kysely';
import { z } from 'zod';
import { socialProviderIds } from '../auth/providers.ts';
import type { IpLocation } from '../geo/lookup.ts';
import type { Database } from './schema.ts';

export const signInMethods = ['password', ...socialProviderIds] as const;

const kindsWithoutProps = [
  'account.signed_up',
  'account.email_verified',
  'account.claimed',
  'account.password_reset',
  'list.created',
  'list.edited',
  'list.renamed',
  'list.duplicated',
  'list.deleted',
  'share.minted',
  'collection.entry_added',
  'collection.entry_edited',
  'collection.entry_removed',
  'collection.photo_uploaded',
  'collection.photo_removed',
  'preferences.changed',
] as const;

export const activityEventKinds = [
  'account.signed_in',
  'page.viewed',
  'filter.used',
  ...kindsWithoutProps,
] as const;

export const activityEventKindSchema = z.enum(activityEventKinds);

export type ActivityEventKind = z.infer<typeof activityEventKindSchema>;

export const activityEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('account.signed_in'),
    props: z.strictObject({ method: z.enum(signInMethods) }),
  }),
  z.object({
    kind: z.literal('page.viewed'),
    props: z.strictObject({ route: z.string().startsWith('/') }),
  }),
  z.object({
    kind: z.literal('filter.used'),
    props: z.strictObject({
      key: z.string().min(1),
      value: z.string().min(1),
    }),
  }),
  z.object({
    kind: z.enum(kindsWithoutProps),
    props: z.strictObject({}).default({}),
  }),
]);

export type ActivityEvent = z.input<typeof activityEventSchema>;

export type EventActor = { userId: string; isAnonymous: boolean };

export type EventOrigin = { ip: string | null; location: IpLocation | null };

export type EventRecord = {
  event: ActivityEvent;
  actor: EventActor | null;
  subjectId?: string | null | undefined;
  origin: EventOrigin;
  now: () => string;
};

export const recordEvent = async (
  trx: Kysely<Database>,
  { event, actor, subjectId = null, origin, now }: EventRecord,
) => {
  const { kind, props } = activityEventSchema.parse(event);
  await trx
    .insertInto('activity_events')
    .values({
      occurred_at: now(),
      kind,
      user_id: actor?.userId ?? null,
      is_anonymous: actor && !actor.isAnonymous ? 0 : 1,
      subject_id: subjectId,
      props: JSON.stringify(props),
      ip: origin.ip,
      country: origin.location?.country ?? null,
      region: origin.location?.region ?? null,
      city: origin.location?.city ?? null,
    })
    .execute();
};

const recentlyRecorded = async (
  trx: Kysely<Database>,
  {
    kind,
    userId,
    subjectId,
    since,
  }: {
    kind: ActivityEventKind;
    userId: string;
    subjectId: string;
    since: string;
  },
) =>
  (await trx
    .selectFrom('activity_events')
    .select('id')
    .where('kind', '=', kind)
    .where('occurred_at', '>', since)
    .where('user_id', '=', userId)
    .where('subject_id', '=', subjectId)
    .limit(1)
    .executeTakeFirst()) !== undefined;

export const recordThrottledEvent = async (
  trx: Kysely<Database>,
  record: EventRecord,
  withinMs: number,
) => {
  const { actor, subjectId } = record;
  const at = record.now();
  if (
    actor &&
    subjectId &&
    (await recentlyRecorded(trx, {
      kind: activityEventSchema.parse(record.event).kind,
      userId: actor.userId,
      subjectId,
      since: new Date(Date.parse(at) - withinMs).toISOString(),
    }))
  ) {
    return;
  }
  await recordEvent(trx, { ...record, now: () => at });
};

export type EventRange = { from: string; to: string };

export type EventBucket = 'day' | 'week';

export type EventAudience = 'all' | 'account' | 'anonymous';

export type EventWindow = { range: EventRange; audience: EventAudience };

export type SeriesWindow = EventWindow & { bucket: EventBucket };

const bucketStart = (bucket: EventBucket) =>
  bucket === 'day'
    ? sql<string>`date(occurred_at)`
    : sql<string>`date(occurred_at, '-6 days', 'weekday 1')`;

const eventsIn = (db: Kysely<Database>, { range, audience }: EventWindow) =>
  db
    .selectFrom('activity_events')
    .where('occurred_at', '>=', range.from)
    .where('occurred_at', '<', range.to)
    .$if(audience !== 'all', (query) =>
      query.where('is_anonymous', '=', audience === 'anonymous' ? 1 : 0),
    );

export const eventSeries = async (
  db: Kysely<Database>,
  { kind, bucket, ...window }: SeriesWindow & { kind: ActivityEventKind },
) =>
  (
    await eventsIn(db, window)
      .where('kind', '=', kind)
      .select(({ fn }) => [
        bucketStart(bucket).as('bucket'),
        'is_anonymous',
        fn.countAll<number>().as('events'),
      ])
      .groupBy([bucketStart(bucket), 'is_anonymous'])
      .orderBy('bucket')
      .orderBy('is_anonymous')
      .execute()
  ).map((row) => ({
    bucket: row.bucket,
    isAnonymous: row.is_anonymous === 1,
    events: Number(row.events),
  }));

export const activeUserSeries = async (
  db: Kysely<Database>,
  { bucket, ...window }: SeriesWindow,
) =>
  (
    await eventsIn(db, window)
      .where('user_id', 'is not', null)
      .select(({ fn }) => [
        bucketStart(bucket).as('bucket'),
        'is_anonymous',
        fn.count<number>('user_id').distinct().as('users'),
      ])
      .groupBy([bucketStart(bucket), 'is_anonymous'])
      .orderBy('bucket')
      .orderBy('is_anonymous')
      .execute()
  ).map((row) => ({
    bucket: row.bucket,
    isAnonymous: row.is_anonymous === 1,
    users: Number(row.users),
  }));

export const topCountries = async (
  db: Kysely<Database>,
  { limit, ...window }: EventWindow & { limit: number },
) =>
  (
    await eventsIn(db, window)
      .where('country', 'is not', null)
      .select(({ fn }) => ['country', fn.countAll<number>().as('events')])
      .$narrowType<{ country: NotNull }>()
      .groupBy('country')
      .orderBy('events', 'desc')
      .orderBy('country')
      .limit(limit)
      .execute()
  ).map((row) => ({ country: row.country, events: Number(row.events) }));

export const topCities = async (
  db: Kysely<Database>,
  { limit, ...window }: EventWindow & { limit: number },
) =>
  (
    await eventsIn(db, window)
      .where('city', 'is not', null)
      .select(({ fn }) => [
        'country',
        'region',
        'city',
        fn.countAll<number>().as('events'),
      ])
      .$narrowType<{ country: NotNull; city: NotNull }>()
      .groupBy(['country', 'region', 'city'])
      .orderBy('events', 'desc')
      .orderBy('country')
      .orderBy('city')
      .limit(limit)
      .execute()
  ).map((row) => ({
    country: row.country,
    region: row.region,
    city: row.city,
    events: Number(row.events),
  }));

const signInMethod = sql<string>`json_extract(props, '$.method')`;

export const signInSeries = async (
  db: Kysely<Database>,
  { bucket, ...window }: SeriesWindow,
) =>
  (
    await eventsIn(db, window)
      .where('kind', '=', 'account.signed_in')
      .select(({ fn }) => [
        signInMethod.as('method'),
        bucketStart(bucket).as('bucket'),
        'is_anonymous',
        fn.countAll<number>().as('events'),
      ])
      .groupBy([signInMethod, bucketStart(bucket), 'is_anonymous'])
      .orderBy('method')
      .orderBy('bucket')
      .orderBy('is_anonymous')
      .execute()
  ).map((row) => ({
    method: row.method,
    bucket: row.bucket,
    isAnonymous: row.is_anonymous === 1,
    events: Number(row.events),
  }));

const viewedRoute = sql<string>`json_extract(props, '$.route')`;

export const topPages = async (
  db: Kysely<Database>,
  { limit, ...window }: EventWindow & { limit: number },
) =>
  (
    await eventsIn(db, window)
      .where('kind', '=', 'page.viewed')
      .select(({ fn }) => [
        viewedRoute.as('route'),
        fn.countAll<number>().as('events'),
      ])
      .groupBy(viewedRoute)
      .orderBy('events', 'desc')
      .orderBy('route')
      .limit(limit)
      .execute()
  ).map((row) => ({ route: row.route, events: Number(row.events) }));

const filterKey = sql<string>`json_extract(props, '$.key')`;

const filterValue = sql<string>`json_extract(props, '$.value')`;

export const topFilters = async (
  db: Kysely<Database>,
  { limit, ...window }: EventWindow & { limit: number },
) =>
  (
    await eventsIn(db, window)
      .where('kind', '=', 'filter.used')
      .select(({ fn }) => [
        filterKey.as('key'),
        filterValue.as('value'),
        fn.countAll<number>().as('events'),
      ])
      .groupBy([filterKey, filterValue])
      .orderBy('events', 'desc')
      .orderBy('key')
      .orderBy('value')
      .limit(limit)
      .execute()
  ).map((row) => ({
    key: row.key,
    value: row.value,
    events: Number(row.events),
  }));
