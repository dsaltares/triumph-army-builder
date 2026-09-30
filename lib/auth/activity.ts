import type { GenericEndpointContext } from 'better-auth';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import {
  type ActivityEvent,
  type EventActor,
  recordEvent,
  signInMethods,
} from '../db/activity-events.ts';
import type { Database } from '../db/schema.ts';
import type { IpLookup } from '../geo/lookup.ts';
import { getLogger } from '../logger.ts';
import { requestOrigin } from './client-ip.ts';

const logger = getLogger('auth');

const signInMethodSchema = z.enum(signInMethods);

const callbackPathPrefix = '/callback/';

export type RecordAuthEvent = (
  headers: Headers | null | undefined,
  actor: EventActor,
  event: ActivityEvent,
) => Promise<void>;

export const createRecordAuthEvent =
  ({
    db,
    lookupIp,
  }: {
    db: Kysely<Database>;
    lookupIp?: IpLookup | undefined;
  }): RecordAuthEvent =>
  async (headers, actor, event) => {
    try {
      await recordEvent(db, {
        event,
        actor,
        origin: requestOrigin(headers, lookupIp),
        now: () => new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        { err: error, kind: event.kind },
        'Account event could not be recorded, the write it describes stands',
      );
    }
  };

export const headersOf = (ctx: GenericEndpointContext | null | undefined) =>
  ctx?.headers ?? ctx?.request?.headers;

const signInMethodOf = (ctx: GenericEndpointContext) => {
  if (ctx.path === '/sign-in/email') {
    return 'password';
  }
  if (ctx.path === '/sign-in/social') {
    return signInMethodSchema.safeParse(ctx.body?.provider).data;
  }
  if (ctx.path.startsWith(callbackPathPrefix)) {
    return signInMethodSchema.safeParse(ctx.params?.id).data;
  }
  return undefined;
};

export const createRecordSignIn =
  (record: RecordAuthEvent) => async (ctx: GenericEndpointContext) => {
    const session = ctx.context.newSession;
    const method = signInMethodOf(ctx);
    if (!session || !method || session.user.isAnonymous) {
      return;
    }
    await record(
      headersOf(ctx),
      { userId: session.user.id, isAnonymous: false },
      { kind: 'account.signed_in', props: { method } },
    );
  };
