import type { ActivityEvent, EventRecord } from '../db/activity-events.ts';
import type { Caller, Context } from './context.ts';

export type WriteContext = Pick<Context, 'origin'> & { caller: Caller };

export const writeEvent = (
  { caller, origin }: WriteContext,
  at: string,
  event: ActivityEvent,
  subjectId?: string,
): EventRecord => ({
  event,
  actor: { userId: caller.userId, isAnonymous: caller.isAnonymous },
  subjectId,
  origin,
  now: () => at,
});
