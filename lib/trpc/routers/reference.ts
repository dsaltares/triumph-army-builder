import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { currentDataVersion, hasReferenceVersion } from '../../db/reference.ts';
import { locales } from '../../i18n/locales.ts';
import { publicProcedure, router } from '../trpc.ts';

const referenceInput = z.object({
  locale: z.enum(locales),
  dataVersion: z.string().min(1).optional(),
});

const referenceProcedure = publicProcedure
  .input(referenceInput)
  .use(async ({ ctx, input, next }) => {
    if (
      input.dataVersion !== undefined &&
      !(await hasReferenceVersion(ctx.db, input.dataVersion))
    ) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'notFound' });
    }
    return next({
      ctx: { ...ctx, reference: ctx.bundles(input.locale, input.dataVersion) },
    });
  });

export const referenceRouter = router({
  current: publicProcedure.query(({ ctx }) => currentDataVersion(ctx.db)),
  index: referenceProcedure.query(({ ctx }) => ctx.reference.readArmyIndex()),
  army: referenceProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const detail = await ctx.reference.readArmyDetail(input.id);
      if (!detail) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'notFound' });
      }
      return detail;
    }),
  troopTypes: referenceProcedure.query(({ ctx }) =>
    ctx.reference.readTroopTypes(),
  ),
  battleCards: referenceProcedure.query(({ ctx }) =>
    ctx.reference.readBattleCards(),
  ),
  battleCardText: referenceProcedure.query(({ ctx }) =>
    ctx.reference.readBattleCardText(),
  ),
  thematicCategories: referenceProcedure.query(({ ctx }) =>
    ctx.reference.readThematicCategories(),
  ),
  tagWords: referenceProcedure.query(({ ctx }) => ctx.reference.readTagWords()),
});
