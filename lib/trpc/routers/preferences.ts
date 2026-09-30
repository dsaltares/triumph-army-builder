import { z } from 'zod';
import { recordEvent } from '../../db/activity-events.ts';
import { writeUserLocale } from '../../db/user-locale.ts';
import { locales } from '../../i18n/routing.ts';
import { writeEvent } from '../events.ts';
import { router, signedInProcedure } from '../trpc.ts';

export const preferencesRouter = router({
  setLocale: signedInProcedure
    .input(z.object({ locale: z.enum(locales) }))
    .mutation(async ({ ctx, input }) => {
      const at = ctx.now();
      await ctx.db.transaction().execute(async (trx) => {
        await writeUserLocale(trx, ctx.caller.userId, input.locale);
        await recordEvent(
          trx,
          writeEvent(ctx, at, { kind: 'preferences.changed' }),
        );
      });
      return { locale: input.locale };
    }),
});
