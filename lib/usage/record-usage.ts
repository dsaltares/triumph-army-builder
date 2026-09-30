import type { Kysely } from 'kysely';
import type { RateLimiter } from '../auth/rate-limit.ts';
import { type EventOrigin, recordEvent } from '../db/activity-events.ts';
import type { Database } from '../db/schema.ts';
import { usageEventSchema } from '../domain/usage/tracked.ts';
import { getLogger } from '../logger.ts';
import type { Caller } from '../trpc/context.ts';

export type UsageRequest = {
  request: Request;
  caller: () => Promise<Caller | null>;
  origin: EventOrigin;
  db: Kysely<Database>;
  limiter: RateLimiter;
  now: () => string;
};

const maxBodyBytes = 1024;

const unknownAddress = 'unknown';

const botAgent =
  /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|curl|wget|python|httpclient|okhttp|go-http|java\//i;

const isBot = (headers: Headers) => {
  const agent = headers.get('user-agent');
  return !agent || botAgent.test(agent);
};

const optedOut = (headers: Headers) =>
  headers.get('sec-gpc') === '1' || headers.get('dnt') === '1';

const accepted = () => new Response(null, { status: 204 });

const readEvent = async (request: Request) => {
  if (Number(request.headers.get('content-length')) > maxBodyBytes) {
    return undefined;
  }
  const body = await request.text();
  if (body.length > maxBodyBytes) {
    return undefined;
  }
  try {
    return usageEventSchema.safeParse(JSON.parse(body)).data;
  } catch {
    return undefined;
  }
};

export const recordUsageResponse = async ({
  request,
  caller,
  origin,
  db,
  limiter,
  now,
}: UsageRequest) => {
  const { headers } = request;
  if (optedOut(headers) || isBot(headers)) {
    return accepted();
  }
  const verdict = await limiter.consume(origin.ip ?? unknownAddress);
  if (!verdict.allowed) {
    return accepted();
  }
  const event = await readEvent(request);
  if (!event) {
    return accepted();
  }
  try {
    const actor = await caller();
    await recordEvent(db, {
      event,
      actor: actor && {
        userId: actor.userId,
        isAnonymous: actor.isAnonymous,
      },
      origin,
      now,
    });
  } catch (error) {
    getLogger('usage').error(
      { err: error, kind: event.kind },
      'Usage event could not be recorded',
    );
  }
  return accepted();
};
