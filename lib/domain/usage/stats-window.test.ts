import { describe, expect, it } from 'vitest';
import { splitSeries, statsWindow } from './stats-window.ts';

const now = '2026-09-29T10:00:00.000Z';

describe('statsWindow', () => {
  it('ends at the close of today and counts today as the range last day', () => {
    expect(statsWindow({ range: '7d', bucket: 'day', now })).toEqual({
      from: '2026-09-23T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
      buckets: [
        '2026-09-23',
        '2026-09-24',
        '2026-09-25',
        '2026-09-26',
        '2026-09-27',
        '2026-09-28',
        '2026-09-29',
      ],
    });
  });

  it.each([
    ['30d', '2026-08-31T00:00:00.000Z', 30],
    ['90d', '2026-07-02T00:00:00.000Z', 90],
    ['12m', '2025-09-30T00:00:00.000Z', 365],
  ] as const)('reaches %s back to %s, a bucket a day', (range, from, days) => {
    const window = statsWindow({ range, bucket: 'day', now });

    expect(window.from).toBe(from);
    expect(window.buckets).toHaveLength(days);
    expect(window.buckets.at(-1)).toBe('2026-09-29');
  });

  it('widens a weekly range back to the Monday of its first week', () => {
    expect(statsWindow({ range: '12m', bucket: 'week', now })).toMatchObject({
      from: '2025-09-29T00:00:00.000Z',
      to: '2026-09-30T00:00:00.000Z',
    });
    const { buckets } = statsWindow({ range: '90d', bucket: 'week', now });
    expect(buckets[0]).toBe('2026-06-29');
    expect(buckets.at(-1)).toBe('2026-09-28');
    expect(buckets).toHaveLength(14);
  });

  it('keeps a range starting on a Monday where it is', () => {
    expect(
      statsWindow({ range: '7d', bucket: 'week', now: '2026-09-27T23:59:59Z' }),
    ).toEqual({
      from: '2026-09-21T00:00:00.000Z',
      to: '2026-09-28T00:00:00.000Z',
      buckets: ['2026-09-21'],
    });
  });
});

describe('splitSeries', () => {
  it('fills every bucket, zero where nothing happened', () => {
    expect(
      splitSeries(
        ['2026-09-21', '2026-09-22', '2026-09-23'],
        [
          { bucket: '2026-09-21', isAnonymous: false, events: 2 },
          { bucket: '2026-09-21', isAnonymous: true, events: 1 },
          { bucket: '2026-09-23', isAnonymous: true, events: 4 },
        ],
      ),
    ).toEqual([
      { bucket: '2026-09-21', account: 2, anonymous: 1 },
      { bucket: '2026-09-22', account: 0, anonymous: 0 },
      { bucket: '2026-09-23', account: 0, anonymous: 4 },
    ]);
  });

  it('drops a row outside the buckets it was given', () => {
    expect(
      splitSeries(
        ['2026-09-21'],
        [{ bucket: '2026-09-14', isAnonymous: false, events: 3 }],
      ),
    ).toEqual([{ bucket: '2026-09-21', account: 0, anonymous: 0 }]);
  });
});
