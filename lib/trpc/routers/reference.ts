import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { games } from '../../data/schema.ts';
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

const absent = <Value>(value: Value | null): Value => {
  if (value === null) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'notFound' });
  }
  return value;
};

const gamesWithSections = ['fantasy'] as const;

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
  games: referenceProcedure.query(({ ctx }) => ctx.reference.readGames()),
  troopTypes: referenceProcedure
    .input(z.object({ game: z.enum(games).optional() }))
    .query(async ({ ctx, input }) =>
      input.game === 'fantasy'
        ? absent(await ctx.reference.readFantasyTroopTypes())
        : ctx.reference.readTroopTypes(),
    ),
  game: referenceProcedure
    .input(z.object({ game: z.enum(gamesWithSections) }))
    .query(async ({ ctx }) => {
      const [battleCards, format] = await Promise.all([
        ctx.reference.readFantasyBattleCards(),
        ctx.reference.readFantasyFormat(),
      ]);
      return { battleCards: absent(battleCards), format: absent(format) };
    }),
  gameBattleCardText: referenceProcedure
    .input(z.object({ game: z.enum(gamesWithSections) }))
    .query(async ({ ctx }) =>
      absent(await ctx.reference.readFantasyBattleCardText()),
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
