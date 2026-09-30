import { describe, expect, it } from 'vitest';
import {
  bucketFor,
  isQuiet,
  pointsByMethod,
  seriesTotal,
} from './dashboard.ts';

describe('bucketFor', () => {
  it.each([
    ['7d', 'day'],
    ['30d', 'day'],
    ['90d', 'week'],
    ['12m', 'week'],
  ] as const)('buckets %s by %s', (range, bucket) => {
    expect(bucketFor(range)).toBe(bucket);
  });
});

describe('pointsByMethod', () => {
  it('stacks each method per bucket, account and anonymous together', () => {
    expect(
      pointsByMethod([
        {
          method: 'password',
          points: [
            { bucket: '2026-09-28', account: 2, anonymous: 1 },
            { bucket: '2026-09-29', account: 0, anonymous: 0 },
          ],
        },
        {
          method: 'google',
          points: [
            { bucket: '2026-09-28', account: 0, anonymous: 0 },
            { bucket: '2026-09-29', account: 4, anonymous: 0 },
          ],
        },
      ]),
    ).toEqual([
      { bucket: '2026-09-28', password: 3, google: 0 },
      { bucket: '2026-09-29', password: 0, google: 4 },
    ]);
  });

  it('has no buckets without methods', () => {
    expect(pointsByMethod([])).toEqual([]);
  });
});

describe('seriesTotal', () => {
  it('adds account and anonymous across every bucket', () => {
    expect(
      seriesTotal([
        { bucket: '2026-09-28', account: 2, anonymous: 1 },
        { bucket: '2026-09-29', account: 3, anonymous: 0 },
      ]),
    ).toBe(6);
  });
});

describe('isQuiet', () => {
  const empty = [{ bucket: '2026-09-29', account: 0, anonymous: 0 }];

  it('is quiet when every series is zero throughout', () => {
    expect(isQuiet([empty, empty])).toBe(true);
  });

  it('is not quiet when any series counted something', () => {
    expect(
      isQuiet([empty, [{ bucket: '2026-09-29', account: 0, anonymous: 1 }]]),
    ).toBe(false);
  });
});
