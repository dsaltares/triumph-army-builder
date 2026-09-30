import type { GenericEndpointContext } from 'better-auth';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.ts';
import { readUserLocale, writeUserLocale } from '../db/user-locale.ts';
import {
  isLocale,
  localeCookieMaxAge,
  localeCookieName,
} from '../i18n/routing.ts';
import { getLogger } from '../logger.ts';

const logger = getLogger('auth');

export const createLocaleReconcile =
  ({ db }: { db: Kysely<Database> }) =>
  async (ctx: GenericEndpointContext) => {
    const session = ctx.context.newSession;
    if (!session) {
      return;
    }

    const userId = session.user.id;
    const fromCookie = ctx.getCookie(localeCookieName);

    try {
      const onAccount = await readUserLocale(db, userId);

      if (onAccount) {
        ctx.setCookie(localeCookieName, onAccount, {
          path: '/',
          sameSite: 'lax',
          maxAge: localeCookieMaxAge,
        });
        return;
      }

      if (isLocale(fromCookie)) {
        await writeUserLocale(db, userId, fromCookie);
      }
    } catch (error) {
      logger.error(
        { err: error, userId },
        'Locale could not be reconciled, leaving the cookie as it is',
      );
    }
  };
