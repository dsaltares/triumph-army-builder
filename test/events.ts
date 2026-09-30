import { type Kysely, sql } from 'kysely';
import type { EventOrigin } from '@/lib/db/activity-events.ts';
import type { Database } from '@/lib/db/schema.ts';
import type { IpLookup } from '@/lib/geo/lookup.ts';

export const carthage = {
  ip: '203.0.113.7',
  location: { country: 'TN', region: 'Tunis', city: 'Carthage' },
} satisfies EventOrigin;

export const lookupCarthage: IpLookup = (ip) =>
  ip === carthage.ip ? carthage.location : null;

export const fromCarthage = () =>
  new Headers({ 'x-forwarded-for': carthage.ip });

export const recordedEvents = (db: Kysely<Database>) =>
  db
    .selectFrom('activity_events')
    .select([
      'kind',
      'user_id',
      'is_anonymous',
      'subject_id',
      'props',
      'ip',
      'country',
      'region',
      'city',
    ])
    .orderBy('id')
    .execute();

export const recordedKinds = async (db: Kysely<Database>) =>
  (await recordedEvents(db)).map(({ kind }) => kind);

export const eventLogFull = 'the log is full';

export const blockEvents = (db: Kysely<Database>) =>
  sql`create trigger block_events before insert on activity_events begin select raise(abort, ${sql.lit(eventLogFull)}); end`.execute(
    db,
  );
