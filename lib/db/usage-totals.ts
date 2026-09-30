import { type Kysely, type RawBuilder, sql } from 'kysely';
import type { EventAudience } from './activity-events.ts';
import type { Database } from './schema.ts';

export type AudienceSplit = { account: number; anonymous: number };

export type UsageTotals = {
  users: AudienceSplit;
  lists: AudienceSplit;
  shares: AudienceSplit;
  collectionEntries: AudienceSplit;
};

type AnonymousCount = { anonymous: number; total: number };

const userIsAnonymous = sql<number>`coalesce("users"."isAnonymous", 0)`;

const orphanIsAnonymous = sql<number>`coalesce("users"."isAnonymous", 1)`;

const toSplit = (
  { anonymous, total }: AnonymousCount,
  audience: EventAudience,
): AudienceSplit => ({
  account: audience === 'anonymous' ? 0 : Number(total) - Number(anonymous),
  anonymous: audience === 'account' ? 0 : Number(anonymous),
});

const countSplit = (anonymous: RawBuilder<number>) =>
  [
    sql<number>`coalesce(sum(${anonymous}), 0)`.as('anonymous'),
    sql<number>`count(*)`.as('total'),
  ] as const;

export const usageTotals = async (
  db: Kysely<Database>,
  audience: EventAudience,
): Promise<UsageTotals> => {
  const [users, lists, shares, collectionEntries] = await Promise.all([
    db
      .selectFrom('users')
      .select(countSplit(userIsAnonymous))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('armies')
      .innerJoin('users', 'users.id', 'armies.user_id')
      .select(countSplit(userIsAnonymous))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('shares')
      .leftJoin('users', 'users.id', 'shares.user_id')
      .select(countSplit(orphanIsAnonymous))
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('collection_entries')
      .innerJoin('users', 'users.id', 'collection_entries.user_id')
      .select(countSplit(userIsAnonymous))
      .executeTakeFirstOrThrow(),
  ]);
  return {
    users: toSplit(users, audience),
    lists: toSplit(lists, audience),
    shares: toSplit(shares, audience),
    collectionEntries: toSplit(collectionEntries, audience),
  };
};
