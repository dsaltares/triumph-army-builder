import { beforeAll, describe, expect, it } from 'vitest';
import {
  allyContingent,
  armyDetail,
  troopOption,
} from '@/test/fixtures/army.ts';
import { sampleArmyLists, sampleCuration } from '@/test/sample.ts';
import {
  type ArmyList,
  buildArmyList,
  offeredContingentGroups,
} from './army-list';
import { resolveArmyList } from './availability';
import {
  availabilityLanes,
  type BoundaryChange,
  gatingBoundaries,
  largeYearStep,
  nearestOfferedYear,
  periodIndexAt,
  yearPeriods,
} from './gating-boundaries';

const plain = buildArmyList(armyDetail());

const bare = (overrides: Parameters<typeof armyDetail>[0] = {}) =>
  buildArmyList(
    armyDetail({
      troopOptions: [troopOption()],
      allyOptions: [],
      allyContingents: [],
      ...overrides,
    }),
  );

const changeName = (change: BoundaryChange) =>
  change.kind === 'troopOption'
    ? change.troopOption.id
    : (change.group.name as string);

const years = (armyList: ArmyList, variant: string | null = null) =>
  gatingBoundaries(armyList, variant).map(({ year }) => year);

const whatIsAvailable = (armyList: ArmyList, year: number) => {
  const resolved = resolveArmyList(armyList, { year, variant: null });
  return [
    ...resolved.main.troopOptions.map(({ id }) => id),
    ...offeredContingentGroups(resolved).map(({ id }) => id),
  ].join(' ');
};

describe('gatingBoundaries', () => {
  it('marks the year a troop option stops being offered', () => {
    expect(years(plain)).toEqual([-2899]);
  });

  it('marks the year a contingent group arrives', () => {
    const armyList = bare({
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-optional', name: 'Late friends' },
          ],
          dateRange: { startDate: -2950, endDate: -2800 },
          note: null,
        },
      ],
      allyContingents: [allyContingent()],
    });

    expect(years(armyList)).toEqual([-2950]);
  });

  it('leaves the track unmarked when nothing about the army changes', () => {
    expect(years(bare())).toEqual([]);
  });

  it('ignores a range that reaches past either end of the army', () => {
    const armyList = bare({
      troopOptions: [
        troopOption({ dateRanges: [{ startDate: -3100, endDate: -2800 }] }),
      ],
    });

    expect(years(armyList)).toEqual([]);
  });

  it('sorts the marks and keeps each year once', () => {
    const armyList = bare({
      troopOptions: [
        troopOption({ dateRanges: [{ startDate: -2900, endDate: -2850 }] }),
        troopOption({ dateRanges: [{ startDate: -2950, endDate: -2850 }] }),
      ],
    });

    expect(years(armyList)).toEqual([-2950, -2900, -2849]);
  });

  it('names what the year offers and what it withholds', () => {
    const armyList = bare({
      troopOptions: [
        troopOption({ dateRanges: [{ startDate: -3000, endDate: -2900 }] }),
        troopOption({ dateRanges: [{ startDate: -2899, endDate: -2800 }] }),
      ],
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-optional', name: 'Late friends' },
          ],
          dateRange: { startDate: -2899, endDate: -2800 },
          note: null,
        },
      ],
      allyContingents: [allyContingent()],
    });

    const [boundary, ...rest] = gatingBoundaries(armyList, null);

    expect(rest).toEqual([]);
    expect(boundary?.year).toBe(-2899);
    expect(boundary?.offered.map(changeName)).toEqual([
      'main/1',
      'Late friends',
    ]);
    expect(boundary?.withheld.map(changeName)).toEqual(['main/0']);
  });

  it('follows the years a sub-faction rule names, once that sub-faction is chosen', () => {
    const armyList = bare({
      startDate: 1290,
      endDate: 1500,
      subFactions: sampleCuration.subFactions['3a'] ?? null,
      troopOptions: [
        troopOption({ note: 'only Cinder, or Ashen until 1400 only' }),
      ],
    });

    expect(years(armyList)).toEqual([]);
    expect(years(armyList, 'cinder')).toEqual([]);
    expect(years(armyList, 'ashen')).toEqual([1401]);
  });

  it('leaves a single-year army nothing to mark', () => {
    const armyList = bare({
      startDate: -2900,
      endDate: -2900,
      troopOptions: [
        troopOption(),
        troopOption({ dateRanges: [{ startDate: -3000, endDate: -2900 }] }),
      ],
    });

    expect(years(armyList)).toEqual([]);
  });
});

const changeId = (change: BoundaryChange) =>
  change.kind === 'troopOption' ? change.troopOption.id : change.group.id;

const periodsOf = (armyList: ArmyList) =>
  yearPeriods(armyList.dateRange, gatingBoundaries(armyList, null)).map(
    ({ startDate, endDate, boundary }) => [
      startDate,
      endDate,
      boundary?.year ?? null,
    ],
  );

const lanesOf = (armyList: ArmyList, variant: string | null = null) =>
  availabilityLanes(armyList, variant).map(({ change, spans }) => [
    changeName(change),
    spans.map(({ startDate, endDate }) => [startDate, endDate]),
  ]);

describe('yearPeriods', () => {
  it('cuts the span at every boundary, each period ending the year before the next', () => {
    const armyList = bare({
      troopOptions: [
        troopOption({ dateRanges: [{ startDate: -2900, endDate: -2850 }] }),
      ],
    });

    expect(periodsOf(armyList)).toEqual([
      [-3000, -2901, null],
      [-2900, -2850, -2900],
      [-2849, -2800, -2849],
    ]);
  });

  it('leaves an army that never changes one period', () => {
    expect(periodsOf(bare())).toEqual([[-3000, -2800, null]]);
  });
});

describe('periodIndexAt', () => {
  const periods = yearPeriods({ startDate: 0, endDate: 99 }, [
    { year: 50, offered: [], withheld: [] },
  ]);

  it('finds the period a year falls in', () => {
    expect(periodIndexAt(periods, 0)).toBe(0);
    expect(periodIndexAt(periods, 49)).toBe(0);
    expect(periodIndexAt(periods, 50)).toBe(1);
    expect(periodIndexAt(periods, 99)).toBe(1);
  });

  it('takes a year outside the span to the period nearest it', () => {
    expect(periodIndexAt(periods, -10)).toBe(0);
    expect(periodIndexAt(periods, 500)).toBe(1);
  });
});

describe('availabilityLanes', () => {
  it('gives a lane only to what changes with the year', () => {
    const armyList = bare({
      troopOptions: [
        troopOption(),
        troopOption({ dateRanges: [{ startDate: -2900, endDate: -2850 }] }),
      ],
    });

    expect(lanesOf(armyList)).toEqual([['main/1', [[-2900, -2850]]]]);
  });

  it('leaves an army that never changes no lanes', () => {
    expect(lanesOf(bare())).toEqual([]);
  });

  it('joins the periods an option is offered in, and splits it where it is not', () => {
    const armyList = bare({
      troopOptions: [
        troopOption({
          dateRanges: [
            { startDate: -3000, endDate: -2950 },
            { startDate: -2900, endDate: -2800 },
          ],
        }),
        troopOption({ dateRanges: [{ startDate: -2920, endDate: -2910 }] }),
      ],
    });

    expect(lanesOf(armyList)).toEqual([
      [
        'main/0',
        [
          [-3000, -2950],
          [-2900, -2800],
        ],
      ],
      ['main/1', [[-2920, -2910]]],
    ]);
  });

  it('orders the lanes by the year each is first offered', () => {
    const armyList = bare({
      troopOptions: [
        troopOption({ dateRanges: [{ startDate: -2850, endDate: -2800 }] }),
        troopOption({ dateRanges: [{ startDate: -3000, endDate: -2900 }] }),
      ],
    });

    expect(lanesOf(armyList).map(([name]) => name)).toEqual([
      'main/1',
      'main/0',
    ]);
  });

  it('gives a contingent group a lane of its own', () => {
    const armyList = bare({
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-optional', name: 'Late friends' },
          ],
          dateRange: { startDate: -2950, endDate: -2800 },
          note: null,
        },
      ],
      allyContingents: [allyContingent()],
    });

    expect(lanesOf(armyList)).toEqual([['Late friends', [[-2950, -2800]]]]);
  });

  it('follows the chosen sub-faction', () => {
    const armyList = bare({
      startDate: 1290,
      endDate: 1500,
      subFactions: sampleCuration.subFactions['3a'] ?? null,
      troopOptions: [
        troopOption({ note: 'only Cinder, or Ashen until 1400 only' }),
      ],
    });

    expect(lanesOf(armyList, 'cinder')).toEqual([]);
    expect(lanesOf(armyList, 'ashen')).toEqual([['main/0', [[1290, 1400]]]]);
  });
});

describe('nearestOfferedYear', () => {
  const lane = (...spans: [number, number][]) => ({
    spans: spans.map(([startDate, endDate]) => ({ startDate, endDate })),
  });
  const twice = lane([0, 10], [50, 60]);

  it('keeps a year the lane is already offered in', () => {
    expect(nearestOfferedYear(twice, 5)).toBe(5);
  });

  it('takes a year to the closest end of the closest span', () => {
    expect(nearestOfferedYear(twice, 20)).toBe(10);
    expect(nearestOfferedYear(twice, 40)).toBe(50);
    expect(nearestOfferedYear(twice, 99)).toBe(60);
  });

  it('keeps the year when the lane is never offered', () => {
    expect(nearestOfferedYear(lane(), 7)).toBe(7);
  });
});

describe('largeYearStep', () => {
  it('crosses a long span in a score of jumps', () => {
    expect(largeYearStep({ startDate: -1015, endDate: 1970 })).toBe(149);
  });

  it('never drops below five years on a short span', () => {
    expect(largeYearStep({ startDate: 307, endDate: 408 })).toBe(5);
    expect(largeYearStep({ startDate: 400, endDate: 402 })).toBe(5);
  });
});

describe('every army list in the sample snapshot', () => {
  let armyLists: ArmyList[];

  beforeAll(async () => {
    armyLists = await sampleArmyLists();
  });

  it('marks only years inside its own span', () => {
    for (const armyList of armyLists) {
      const { startDate, endDate } = armyList.dateRange;
      for (const year of years(armyList)) {
        expect(year).toBeGreaterThan(startDate);
        expect(year).toBeLessThanOrEqual(endDate);
      }
    }
  });

  it('marks a year only where what the army offers really changes', () => {
    for (const armyList of armyLists) {
      for (const year of years(armyList)) {
        expect(whatIsAvailable(armyList, year)).not.toEqual(
          whatIsAvailable(armyList, year - 1),
        );
      }
    }
  });

  it('draws each lane offered in exactly the years its spans cover', () => {
    const offered = (armyList: ArmyList, year: number) =>
      whatIsAvailable(armyList, year).split(' ');

    for (const armyList of armyLists) {
      const { dateRange } = armyList;
      for (const { change, spans } of availabilityLanes(armyList, null)) {
        const id = changeId(change);
        for (const { startDate, endDate } of spans) {
          expect(offered(armyList, startDate)).toContain(id);
          expect(offered(armyList, endDate)).toContain(id);
          if (startDate > dateRange.startDate) {
            expect(offered(armyList, startDate - 1)).not.toContain(id);
          }
          if (endDate < dateRange.endDate) {
            expect(offered(armyList, endDate + 1)).not.toContain(id);
          }
        }
      }
    }
  });
});
