import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { currentListDataVersions } from '../../data/list-data-version.ts';
import { recordEvent, recordThrottledEvent } from '../../db/activity-events.ts';
import {
  countArmies,
  deleteArmies,
  deleteArmy,
  findArmy,
  insertArmy,
  listArmies,
  updateArmy,
} from '../../db/armies.ts';
import { listCollectionEntries } from '../../db/collection.ts';
import {
  type ArmyPinsOwner,
  listArmyPins,
  unpinEntries,
} from '../../db/collection-pins.ts';
import {
  anonymousArmyLimit,
  armyNameSchema,
  copyName,
  type SavedArmy,
} from '../../domain/army/saved-army.ts';
import {
  changedList,
  savedListChangeSchema,
  savedListInputSchema,
  savedSelectionOf,
} from '../../domain/army/selection-schema.ts';
import { stalePins } from '../../domain/collection/pins.ts';
import type { Caller, Context } from '../context.ts';
import { writeEvent } from '../events.ts';
import { publicProcedure, router, signedInProcedure } from '../trpc.ts';

const listChangeThrottleMs = 10 * 60 * 1000;

const armyIdSchema = z.object({ id: z.string().min(1) });

const capReached = () =>
  new TRPCError({
    code: 'FORBIDDEN',
    message: 'signInToKeepMore',
  });

const guardCap = async ({ db, caller }: Context & { caller: Caller }) => {
  if (!caller.isAnonymous) {
    return;
  }
  if ((await countArmies(db, caller.userId)) >= anonymousArmyLimit) {
    throw capReached();
  }
};

const forgetStalePins = async (
  db: Context['db'],
  owner: ArmyPinsOwner,
  list: SavedArmy,
) => {
  if (list.game !== 'triumph') {
    return;
  }
  const { selection } = list;
  const [pins, entries] = await Promise.all([
    listArmyPins(db, owner),
    listCollectionEntries(db, owner.userId),
  ]);
  await unpinEntries(db, owner, stalePins(selection, pins, entries));
};

const presented = async (db: Context['db'], army: SavedArmy) =>
  (await currentListDataVersions(db))(army);

const notFound = () =>
  new TRPCError({
    code: 'NOT_FOUND',
    message: 'notYourList',
  });

export const armyRouter = router({
  list: publicProcedure.query(async ({ ctx }) =>
    ctx.caller
      ? Promise.all(
          (await listArmies(ctx.db, ctx.caller.userId)).map(
            await currentListDataVersions(ctx.db),
          ),
        )
      : [],
  ),

  byId: signedInProcedure.input(armyIdSchema).query(async ({ ctx, input }) => {
    const army = await findArmy(ctx.db, {
      id: input.id,
      userId: ctx.caller.userId,
    });
    if (!army) {
      throw notFound();
    }
    return presented(ctx.db, army);
  }),

  create: signedInProcedure
    .input(z.object({ name: armyNameSchema }).and(savedListInputSchema))
    .mutation(async ({ ctx, input }) => {
      await guardCap(ctx);
      const at = ctx.now();
      return ctx.db.transaction().execute(async (trx) => {
        const army = await insertArmy(trx, {
          id: ctx.nextId(),
          userId: ctx.caller.userId,
          name: input.name,
          ...savedSelectionOf(input),
          at,
        });
        await recordEvent(
          trx,
          writeEvent(ctx, at, { kind: 'list.created' }, army.id),
        );
        return army;
      });
    }),

  update: signedInProcedure
    .input(
      armyIdSchema
        .extend({ name: armyNameSchema.optional() })
        .and(savedListChangeSchema),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      const list = changedList(input);
      const owner = { id, userId: ctx.caller.userId };
      const at = ctx.now();
      const army = await ctx.db.transaction().execute(async (trx) => {
        const before = await findArmy(trx, owner);
        if (!before) {
          return null;
        }
        const updated = await updateArmy(trx, owner, { name, list }, at);
        if (!updated) {
          return null;
        }
        if (name !== undefined && name !== before.name) {
          await recordThrottledEvent(
            trx,
            writeEvent(ctx, at, { kind: 'list.renamed' }, id),
            listChangeThrottleMs,
          );
        }
        if (list) {
          await forgetStalePins(
            trx,
            { armyId: id, userId: ctx.caller.userId },
            updated,
          );
          if (
            JSON.stringify(list.selection) !== JSON.stringify(before.selection)
          ) {
            await recordThrottledEvent(
              trx,
              writeEvent(ctx, at, { kind: 'list.edited' }, id),
              listChangeThrottleMs,
            );
          }
        }
        return updated;
      });
      if (!army) {
        throw notFound();
      }
      return presented(ctx.db, army);
    }),

  duplicate: signedInProcedure
    .input(armyIdSchema)
    .mutation(async ({ ctx, input }) => {
      await guardCap(ctx);
      const at = ctx.now();
      const copy = await ctx.db.transaction().execute(async (trx) => {
        const army = await findArmy(trx, {
          id: input.id,
          userId: ctx.caller.userId,
        });
        if (!army) {
          return null;
        }
        const duplicated = await insertArmy(trx, {
          id: ctx.nextId(),
          userId: ctx.caller.userId,
          name: copyName(army.name),
          ...savedSelectionOf(army),
          at,
        });
        await recordEvent(
          trx,
          writeEvent(ctx, at, { kind: 'list.duplicated' }, duplicated.id),
        );
        return duplicated;
      });
      if (!copy) {
        throw notFound();
      }
      return presented(ctx.db, copy);
    }),

  delete: signedInProcedure
    .input(armyIdSchema)
    .mutation(async ({ ctx, input }) => {
      const at = ctx.now();
      const deleted = await ctx.db.transaction().execute(async (trx) => {
        const removed = await deleteArmy(trx, {
          id: input.id,
          userId: ctx.caller.userId,
        });
        if (removed) {
          await recordEvent(
            trx,
            writeEvent(ctx, at, { kind: 'list.deleted' }, input.id),
          );
        }
        return removed;
      });
      if (!deleted) {
        throw notFound();
      }
      return { id: input.id };
    }),

  undoClaim: signedInProcedure
    .input(
      z.object({
        ids: z.array(z.string().min(1)).min(1).max(anonymousArmyLimit),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const at = ctx.now();
      const removed = await ctx.db.transaction().execute(async (trx) => {
        const ids = await deleteArmies(trx, {
          ids: input.ids,
          userId: ctx.caller.userId,
        });
        for (const id of ids) {
          await recordEvent(
            trx,
            writeEvent(ctx, at, { kind: 'list.deleted' }, id),
          );
        }
        return ids;
      });
      return { removed: removed.length };
    }),
});
