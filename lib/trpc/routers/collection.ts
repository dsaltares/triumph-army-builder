import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { troopTypeCodes } from '../../data/schema.ts';
import { recordEvent } from '../../db/activity-events.ts';
import {
  deleteCollectionEntry,
  insertCollectionEntry,
  listCollectionEntries,
  updateCollectionEntry,
} from '../../db/collection.ts';
import {
  collectionPhotoCovers,
  deleteCollectionPhoto,
  listCollectionPhotos,
  reorderCollectionPhotos,
} from '../../db/collection-photos.ts';
import { pinEntry, unpinEntries } from '../../db/collection-pins.ts';
import { currentDataVersion } from '../../db/reference.ts';
import { buildArmyList } from '../../domain/army/army-list.ts';
import { pointCosts } from '../../domain/army/points.ts';
import { troopOptionIdSchema } from '../../domain/army/selection-schema.ts';
import {
  buildableListLimit,
  buildableLists,
} from '../../domain/collection/buildable.ts';
import {
  collectionEntryChangesSchema,
  collectionEntryFormSchema,
} from '../../domain/collection/entry-schema.ts';
import { triumphRules } from '../../domain/games/triumph-rules.ts';
import { locales } from '../../i18n/locales.ts';
import { writeEvent } from '../events.ts';
import { accountProcedure, router } from '../trpc.ts';

const idSchema = z.string().min(1).max(64);

const entryIdSchema = z.object({ id: z.string().min(1) });

const entryPhotosSchema = z.object({ entryId: idSchema });

const pinKeySchema = z.object({
  armyId: idSchema,
  option: troopOptionIdSchema,
  troopType: z.enum(troopTypeCodes),
  entryId: idSchema,
});

const pinSchema = pinKeySchema.extend({
  count: z.number().int().min(1).max(1000),
});

const notFound = () =>
  new TRPCError({
    code: 'NOT_FOUND',
    message: 'notYourEntry',
  });

const photosRouter = router({
  overview: accountProcedure.query(async ({ ctx }) => ({
    ...ctx.photoQuota,
    ...(await collectionPhotoCovers(ctx.db, ctx.caller.userId)),
  })),

  list: accountProcedure.input(entryPhotosSchema).query(({ ctx, input }) =>
    listCollectionPhotos(ctx.db, {
      entryId: input.entryId,
      userId: ctx.caller.userId,
    }),
  ),

  reorder: accountProcedure
    .input(entryPhotosSchema.extend({ ids: z.array(idSchema).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const owner = { entryId: input.entryId, userId: ctx.caller.userId };
      if (!(await reorderCollectionPhotos(ctx.db, owner, input.ids))) {
        throw new TRPCError({ code: 'CONFLICT', message: 'photosChanged' });
      }
      return listCollectionPhotos(ctx.db, owner);
    }),

  delete: accountProcedure
    .input(z.object({ id: idSchema }))
    .mutation(async ({ ctx, input }) => {
      const at = ctx.now();
      const deleted = await ctx.db.transaction().execute(async (trx) => {
        const removed = await deleteCollectionPhoto(trx, {
          id: input.id,
          userId: ctx.caller.userId,
        });
        if (removed) {
          await recordEvent(
            trx,
            writeEvent(ctx, at, { kind: 'collection.photo_removed' }, input.id),
          );
        }
        return removed;
      });
      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'notYourPhoto' });
      }
      await ctx.photos.remove(input.id);
      return { id: input.id };
    }),
});

export const collectionRouter = router({
  list: accountProcedure.query(({ ctx }) =>
    listCollectionEntries(ctx.db, ctx.caller.userId),
  ),

  create: accountProcedure
    .input(collectionEntryFormSchema)
    .mutation(({ ctx, input }) => {
      const at = ctx.now();
      return ctx.db.transaction().execute(async (trx) => {
        const entry = await insertCollectionEntry(trx, {
          ...input,
          id: ctx.nextId(),
          userId: ctx.caller.userId,
          at,
        });
        await recordEvent(
          trx,
          writeEvent(ctx, at, { kind: 'collection.entry_added' }, entry.id),
        );
        return entry;
      });
    }),

  update: accountProcedure
    .input(collectionEntryChangesSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      const at = ctx.now();
      const entry = await ctx.db.transaction().execute(async (trx) => {
        const updated = await updateCollectionEntry(
          trx,
          { id, userId: ctx.caller.userId },
          changes,
          at,
        );
        if (updated) {
          await recordEvent(
            trx,
            writeEvent(ctx, at, { kind: 'collection.entry_edited' }, id),
          );
        }
        return updated;
      });
      if (!entry) {
        throw notFound();
      }
      return entry;
    }),

  delete: accountProcedure
    .input(entryIdSchema)
    .mutation(async ({ ctx, input }) => {
      const owner = { id: input.id, userId: ctx.caller.userId };
      const at = ctx.now();
      const photos = await ctx.db.transaction().execute(async (trx) => {
        const held = await listCollectionPhotos(trx, {
          entryId: owner.id,
          userId: owner.userId,
        });
        if (!(await deleteCollectionEntry(trx, owner))) {
          return null;
        }
        await recordEvent(
          trx,
          writeEvent(ctx, at, { kind: 'collection.entry_removed' }, owner.id),
        );
        return held;
      });
      if (!photos) {
        throw notFound();
      }
      await Promise.all(photos.map(({ id }) => ctx.photos.remove(id)));
      return { id: input.id };
    }),

  pin: accountProcedure.input(pinSchema).mutation(async ({ ctx, input }) => {
    const { armyId, entryId, ...pin } = input;
    const pinned = await pinEntry(
      ctx.db,
      { armyId, userId: ctx.caller.userId },
      { ...pin, entry: entryId },
    );
    if (!pinned) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'notYourListOrEntry' });
    }
    return pinned;
  }),

  unpin: accountProcedure
    .input(pinKeySchema)
    .mutation(async ({ ctx, input }) => {
      const { armyId, entryId, ...pin } = input;
      await unpinEntries(ctx.db, { armyId, userId: ctx.caller.userId }, [
        { ...pin, entry: entryId },
      ]);
      return { armyId };
    }),

  buildable: accountProcedure
    .input(
      z.object({
        locale: z.enum(locales),
        standIns: z.boolean().default(true),
        complete: z.boolean().default(false),
        search: z.string().max(100).default(''),
      }),
    )
    .query(async ({ ctx, input }) => {
      const bundle = ctx.bundles(input.locale);
      const [entries, details, troopTypes, battleCards, dataVersion] =
        await Promise.all([
          listCollectionEntries(ctx.db, ctx.caller.userId),
          bundle.readArmyDetails(),
          bundle.readTroopTypes(),
          bundle.readBattleCards(),
          currentDataVersion(ctx.db),
        ]);
      return buildableLists(
        details.map(buildArmyList),
        entries,
        pointCosts(troopTypes, battleCards),
        dataVersion,
        triumphRules,
        {
          standIns: input.standIns,
          complete: input.complete,
          search: input.search,
        },
      ).slice(0, buildableListLimit);
    }),

  photos: photosRouter,
});
