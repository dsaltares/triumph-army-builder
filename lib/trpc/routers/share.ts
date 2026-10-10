import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { recordEvent } from '../../db/activity-events.ts';
import {
  countShares,
  findShare,
  insertShare,
  shareId,
} from '../../db/shares.ts';
import { armyNameSchema } from '../../domain/army/saved-army.ts';
import { savedListInputSchema } from '../../domain/army/selection-schema.ts';
import { anonymousShareLimit } from '../../domain/army/shared-list.ts';
import { writeEvent } from '../events.ts';
import { router, signedInProcedure } from '../trpc.ts';

const capReached = () =>
  new TRPCError({
    code: 'FORBIDDEN',
    message: 'signInToShareMore',
  });

export const shareRouter = router({
  create: signedInProcedure
    .input(z.object({ name: armyNameSchema }).and(savedListInputSchema))
    .mutation(({ ctx, input }) =>
      ctx.db.transaction().execute(async (trx) => {
        const shared = await findShare(trx, shareId(input));
        if (shared) {
          return shared;
        }
        if (
          ctx.caller.isAnonymous &&
          (await countShares(trx, ctx.caller.userId)) >= anonymousShareLimit
        ) {
          throw capReached();
        }
        const at = ctx.now();
        const minted = await insertShare(trx, {
          userId: ctx.caller.userId,
          ...input,
          at,
        });
        await recordEvent(
          trx,
          writeEvent(ctx, at, { kind: 'share.minted' }, minted.id),
        );
        return minted;
      }),
    ),
});
