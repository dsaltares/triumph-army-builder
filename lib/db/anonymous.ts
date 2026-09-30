import type { ExpressionBuilder, Kysely } from 'kysely';
import { getLogger } from '../logger.ts';
import { getDatabase } from './client.ts';
import type { Database } from './schema.ts';
import { deleteUnseenShares } from './shares.ts';

const day = 24 * 60 * 60 * 1000;

export type Retention = {
  emptyAfter: number;
  idleAfter: number;
};

export const anonymousRetention: Retention = {
  emptyAfter: 7 * day,
  idleAfter: 730 * day,
};

export const shareRetention = { unseenAfter: 730 * day };

export const sweepEvery = day;

export type SweepResult = {
  users: number;
  armies: number;
  shares: number;
};

export type SweepOptions = {
  now?: () => Date;
  retention?: Retention;
  shares?: { unseenAfter: number };
};

type Users = ExpressionBuilder<Database, 'users'>;

const ownsNoArmies = (eb: Users) =>
  eb.not(
    eb.exists(
      eb
        .selectFrom('armies')
        .select('armies.id')
        .whereRef('armies.user_id', '=', 'users.id'),
    ),
  );

const ownsNoShares = (eb: Users) =>
  eb.not(
    eb.exists(
      eb
        .selectFrom('shares')
        .select('shares.id')
        .whereRef('shares.user_id', '=', 'users.id'),
    ),
  );

const noArmyTouchedSince = (eb: Users, since: string) =>
  eb.not(
    eb.exists(
      eb
        .selectFrom('armies')
        .select('armies.id')
        .whereRef('armies.user_id', '=', 'users.id')
        .where('armies.updated_at', '>=', since),
    ),
  );

const noSessionSince = (eb: Users, since: string) =>
  eb.not(
    eb.exists(
      eb
        .selectFrom('sessions')
        .select('sessions.id')
        .whereRef('sessions.userId', '=', 'users.id')
        .where('sessions.updatedAt', '>=', since),
    ),
  );

const sweepable = async (
  db: Kysely<Database>,
  { emptyBefore, idleBefore }: { emptyBefore: string; idleBefore: string },
) =>
  (
    await db
      .selectFrom('users')
      .select('id')
      .where('isAnonymous', '=', 1)
      .where((eb) =>
        eb.or([
          eb.and([
            ownsNoArmies(eb),
            ownsNoShares(eb),
            noSessionSince(eb, emptyBefore),
            eb('users.createdAt', '<', emptyBefore),
          ]),
          eb.and([
            noArmyTouchedSince(eb, idleBefore),
            noSessionSince(eb, idleBefore),
            eb('users.createdAt', '<', idleBefore),
          ]),
        ]),
      )
      .execute()
  ).map(({ id }) => id);

export const sweepAnonymousUsers = async (
  db: Kysely<Database> = getDatabase(),
  {
    now = () => new Date(),
    retention = anonymousRetention,
    shares = shareRetention,
  }: SweepOptions = {},
): Promise<SweepResult> => {
  const at = now().getTime();
  const swept = await deleteUnseenShares(db, {
    unseenBefore: new Date(at - shares.unseenAfter).toISOString(),
  });
  const ids = await sweepable(db, {
    emptyBefore: new Date(at - retention.emptyAfter).toISOString(),
    idleBefore: new Date(at - retention.idleAfter).toISOString(),
  });
  if (ids.length === 0) {
    return { users: 0, armies: 0, shares: swept };
  }

  const { numDeletedRows: armies } = await db
    .deleteFrom('armies')
    .where('user_id', 'in', ids)
    .executeTakeFirst();
  const { numDeletedRows: users } = await db
    .deleteFrom('users')
    .where('id', 'in', ids)
    .executeTakeFirst();

  return { users: Number(users), armies: Number(armies), shares: swept };
};

export const startAnonymousSweep = (
  db: Kysely<Database> = getDatabase(),
  options: SweepOptions = {},
) => {
  const logger = getLogger('db');
  const sweep = async () => {
    try {
      const swept = await sweepAnonymousUsers(db, options);
      if (swept.users > 0 || swept.shares > 0) {
        logger.info(swept, 'Anonymous records swept');
      }
    } catch (error) {
      logger.error({ err: error }, 'Anonymous retention sweep failed');
    }
  };

  void sweep();
  const timer = setInterval(() => void sweep(), sweepEvery);
  timer.unref();
  return () => clearInterval(timer);
};
