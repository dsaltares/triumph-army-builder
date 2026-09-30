export const statsRanges = ['7d', '30d', '90d', '12m'] as const;

export type StatsRange = (typeof statsRanges)[number];

export const statsBuckets = ['day', 'week'] as const;

export type StatsBucket = (typeof statsBuckets)[number];

export const statsAudiences = ['all', 'account', 'anonymous'] as const;

export type StatsAudience = (typeof statsAudiences)[number];

export type StatsWindow = { from: string; to: string; buckets: string[] };

export type Split = { account: number; anonymous: number };

export type SeriesPoint = Split & { bucket: string };

export type SplitRow = { bucket: string; isAnonymous: boolean; events: number };

const dayInMs = 24 * 60 * 60 * 1000;

const daysPerBucket: Record<StatsBucket, number> = { day: 1, week: 7 };

const trailingDays: Record<Exclude<StatsRange, '12m'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const monthsInAYear = 12;

const startOfDay = (instant: Date) =>
  new Date(
    Date.UTC(
      instant.getUTCFullYear(),
      instant.getUTCMonth(),
      instant.getUTCDate(),
    ),
  );

const addDays = (day: Date, days: number) =>
  new Date(day.getTime() + days * dayInMs);

const dateOf = (day: Date) => day.toISOString().slice(0, 10);

const firstDayOf = (range: StatsRange, end: Date) => {
  if (range === '12m') {
    return new Date(
      Date.UTC(
        end.getUTCFullYear(),
        end.getUTCMonth() - monthsInAYear,
        end.getUTCDate(),
      ),
    );
  }
  return addDays(end, -trailingDays[range]);
};

const mondayOnOrBefore = (day: Date) =>
  addDays(day, -((day.getUTCDay() + 6) % 7));

export const statsWindow = ({
  range,
  bucket,
  now,
}: {
  range: StatsRange;
  bucket: StatsBucket;
  now: string;
}): StatsWindow => {
  const end = addDays(startOfDay(new Date(now)), 1);
  const firstDay = firstDayOf(range, end);
  const start = bucket === 'week' ? mondayOnOrBefore(firstDay) : firstDay;
  const buckets: string[] = [];
  for (let day = start; day < end; day = addDays(day, daysPerBucket[bucket])) {
    buckets.push(dateOf(day));
  }
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    buckets,
  };
};

export const splitSeries = (
  buckets: string[],
  rows: SplitRow[],
): SeriesPoint[] => {
  const points = new Map(
    buckets.map((bucket) => [bucket, { bucket, account: 0, anonymous: 0 }]),
  );
  for (const { bucket, isAnonymous, events } of rows) {
    const point = points.get(bucket);
    if (point) {
      point[isAnonymous ? 'anonymous' : 'account'] += events;
    }
  }
  return [...points.values()];
};
