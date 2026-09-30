import type { AnonymousOptions } from 'better-auth/plugins/anonymous';
import type { Kysely } from 'kysely';
import { reassignArmies } from '../db/armies.ts';
import type { Database } from '../db/schema.ts';
import { reassignShares } from '../db/shares.ts';
import { getLogger } from '../logger.ts';
import { headersOf, type RecordAuthEvent } from './activity.ts';
import { claimCookieMaxAge, claimCookieName, encodeClaimed } from './claim.ts';

export const anonymousSignInPath = '/sign-in/anonymous';

const logger = getLogger('auth');

const claimShares = async (
  db: Kysely<Database>,
  { from, to }: { from: string; to: string },
) => {
  try {
    const claimed = await reassignShares(db, { from, to });
    if (claimed > 0) {
      logger.info({ claimed }, 'Anonymous share links claimed');
    }
  } catch (error) {
    logger.error(
      { err: error, anonymousUserId: from },
      'Anonymous share links could not be claimed, leaving them unowned',
    );
  }
};

export const createClaim = ({
  db,
  record,
}: {
  db: Kysely<Database>;
  record: RecordAuthEvent;
}): NonNullable<AnonymousOptions['onLinkAccount']> => {
  return async ({ anonymousUser, newUser, ctx }) => {
    const from = anonymousUser.user.id;
    const to = newUser.user.id;
    if (from === to) {
      return;
    }

    await record(
      headersOf(ctx),
      { userId: to, isAnonymous: false },
      { kind: 'account.claimed' },
    );
    await claimShares(db, { from, to });

    try {
      const claimed = await reassignArmies(db, { from, to });
      if (claimed.length === 0) {
        return;
      }
      ctx.setCookie(claimCookieName, encodeClaimed(claimed), {
        ...ctx.context.authCookies.sessionToken.attributes,
        httpOnly: false,
        maxAge: claimCookieMaxAge,
      });
      logger.info({ claimed: claimed.length }, 'Anonymous lists claimed');
    } catch (error) {
      logger.error(
        { err: error, anonymousUserId: from },
        'Anonymous lists could not be claimed, leaving them where they are',
      );
    }
  };
};
