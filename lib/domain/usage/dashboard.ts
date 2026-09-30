import type { SeriesPoint, StatsBucket, StatsRange } from './stats-window.ts';

const bucketsByRange: Record<StatsRange, StatsBucket> = {
  '7d': 'day',
  '30d': 'day',
  '90d': 'week',
  '12m': 'week',
};

export const bucketFor = (range: StatsRange): StatsBucket =>
  bucketsByRange[range];

export type MethodSeries<Method extends string> = {
  method: Method;
  points: readonly SeriesPoint[];
};

export type MethodPoint<Method extends string> = { bucket: string } & Record<
  Method,
  number
>;

export const pointsByMethod = <Method extends string>(
  series: readonly MethodSeries<Method>[],
): MethodPoint<Method>[] => {
  const points = new Map<string, Record<string, number | string>>();
  for (const { method, points: methodPoints } of series) {
    for (const { bucket, account, anonymous } of methodPoints) {
      const point = points.get(bucket) ?? { bucket };
      point[method] = account + anonymous;
      points.set(bucket, point);
    }
  }
  return [...points.values()] as MethodPoint<Method>[];
};

export const seriesTotal = (points: readonly SeriesPoint[]) =>
  points.reduce((sum, { account, anonymous }) => sum + account + anonymous, 0);

export const isQuiet = (series: readonly (readonly SeriesPoint[])[]) =>
  series.every((points) => seriesTotal(points) === 0);
