import { z } from 'zod';
import {
  type ActivityEventKind,
  activeUserSeries,
  eventSeries,
  type SeriesWindow,
  signInMethods,
  signInSeries,
  topCities,
  topCountries,
  topFilters,
  topPages,
} from '../../db/activity-events.ts';
import { usageTotals } from '../../db/usage-totals.ts';
import {
  splitSeries,
  statsAudiences,
  statsBuckets,
  statsRanges,
  statsWindow,
} from '../../domain/usage/stats-window.ts';
import { adminProcedure, publicProcedure, router } from '../trpc.ts';

const topPlacesLimit = 10;

const topUsageLimit = 10;

const statsInput = z.object({
  range: z.enum(statsRanges),
  bucket: z.enum(statsBuckets),
  audience: z.enum(statsAudiences),
});

export const adminRouter = router({
  viewer: publicProcedure.query(({ ctx }) =>
    ctx.caller
      ? { userId: ctx.caller.userId, isAdmin: ctx.caller.isAdmin }
      : null,
  ),
  stats: adminProcedure
    .input(statsInput)
    .query(async ({ ctx: { db, now }, input: { range, bucket, audience } }) => {
      const { from, to, buckets } = statsWindow({ range, bucket, now: now() });
      const window: SeriesWindow = { range: { from, to }, bucket, audience };
      const countedSeries = async (kind: ActivityEventKind) =>
        splitSeries(buckets, await eventSeries(db, { ...window, kind }));

      const [
        totals,
        signUps,
        listsCreated,
        listsEdited,
        sharesMinted,
        signIns,
        activeUsers,
        countries,
        cities,
        pages,
        filters,
      ] = await Promise.all([
        usageTotals(db, audience),
        countedSeries('account.signed_up'),
        countedSeries('list.created'),
        countedSeries('list.edited'),
        countedSeries('share.minted'),
        signInSeries(db, window),
        activeUserSeries(db, window),
        topCountries(db, { ...window, limit: topPlacesLimit }),
        topCities(db, { ...window, limit: topPlacesLimit }),
        topPages(db, { ...window, limit: topUsageLimit }),
        topFilters(db, { ...window, limit: topUsageLimit }),
      ]);

      return {
        range: { from, to },
        bucket,
        audience,
        totals,
        series: {
          signUps,
          signIns: signInMethods.map((method) => ({
            method,
            points: splitSeries(
              buckets,
              signIns.filter((row) => row.method === method),
            ),
          })),
          activeUsers: splitSeries(
            buckets,
            activeUsers.map(({ users, ...row }) => ({ ...row, events: users })),
          ),
          listsCreated,
          listsEdited,
          sharesMinted,
        },
        countries,
        cities,
        pages,
        filters,
      };
    }),
});
