import { beforeAll, describe, expect, it } from 'vitest';
import { formatYearSpan } from '@/lib/format.ts';
import {
  allyContingent,
  armyDetail,
  battleCardEntry,
  entries,
  troopOption,
} from '@/test/fixtures/army.ts';
import {
  sampleArmyLists,
  sampleBattleCardCosts,
  sampleTroopTypes,
} from '@/test/sample.ts';
import { troopTypeCosts, troopTypeNames } from '../troop-types.ts';
import { type ArmyList, buildArmyList, type TroopOptionId } from './army-list';
import {
  fillToCap,
  type GatingBucket,
  gatingBuckets,
  randomFill,
  shuffledBy,
} from './feasibility';
import { armyPoints } from './points';
import { type ArmySelection, emptySelection } from './selection';
import { isLegal, validateArmy } from './validation';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);
const dataVersion = '2026-09-17.abcdef01';

const fill = (
  armyList: ArmyList,
  { variant = null, year }: { variant?: string | null; year: number },
  pointsCap = 48,
) =>
  fillToCap(
    armyList,
    emptySelection({ army: armyList.id, dataVersion, year, variant }),
    costs,
    { pointsCap },
  );

const filledSelection = (
  armyList: ArmyList,
  gating: { variant?: string | null; year: number },
  pointsCap = 48,
) => {
  const filled = fill(armyList, gating, pointsCap);
  if (filled.kind !== 'filled') {
    throw new Error(`${armyList.name} could not be filled: ${filled.reason}`);
  }
  return filled.selection;
};

describe('fillToCap', () => {
  const list = buildArmyList(armyDetail());

  it('fills an army to exactly the points cap', () => {
    const selection = filledSelection(list, { year: -2900 });

    expect(armyPoints(list, selection, costs).total).toBe(48);
  });

  it('fills an army the validator then accepts', () => {
    const selection = filledSelection(list, { year: -2900 });

    expect(validateArmy(list, selection, costs, names)).toEqual([]);
  });

  it('designates a general the army is allowed', () => {
    const selection = filledSelection(list, { year: -2900 });

    expect(list.generalTroopTypes).toContain(selection.general?.troopType);
  });

  it('fills to any other cap the rules carry', () => {
    const selection = filledSelection(list, { year: -2900 }, 36);

    expect(armyPoints(list, selection, costs).total).toBe(36);
    expect(
      isLegal(validateArmy(list, selection, costs, names, { pointsCap: 36 })),
    ).toBe(true);
  });

  it('respects the gating the selection carries', () => {
    expect(
      Object.keys(filledSelection(list, { year: -2900 }, 30).stands),
    ).toContain('main/1');
    expect(
      Object.keys(filledSelection(list, { year: -2850 }, 30).stands),
    ).not.toContain('main/1');
  });

  it('draws a single-type option from one troop type', () => {
    const singleType = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({
            min: 2,
            max: 12,
            troopEntries: [
              { troopTypeCode: 'SPR', dismountTypeCode: null, note: 'all' },
              { troopTypeCode: 'BLV', dismountTypeCode: null, note: 'all' },
            ],
          }),
        ],
        allyOptions: [],
        allyContingents: [],
      }),
    );

    expect(
      Object.keys(
        filledSelection(singleType, { year: -2900 }).stands[
          'main/0' as TroopOptionId
        ] ?? {},
      ),
    ).toHaveLength(1);
  });

  it('buys battle cards when the stands alone cannot reach the cap', () => {
    const evenOnly = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({ min: 1, max: 23, troopEntries: entries('BLV') }),
        ],
        troopEntriesForGeneral: [{ troopEntries: entries('BLV') }],
        battleCardEntries: [battleCardEntry({ battleCardCode: 'SC' })],
        allyOptions: [],
        allyContingents: [],
      }),
    );

    const selection = filledSelection(evenOnly, { year: -2900 });

    expect(selection.armyBattleCards).toEqual({ SC: 1 });
    expect(armyPoints(evenOnly, selection, costs).total).toBe(48);
  });

  it('never makes an allied stand the general', () => {
    const allied = buildArmyList(
      armyDetail({
        troopOptions: [troopOption({ min: 1, max: 12 })],
        troopEntriesForGeneral: [{ troopEntries: entries('SPR', 'HBW') }],
        allyOptions: [
          {
            allyEntries: [
              { allyArmyList: 'contingent-ally', name: 'Horse archers' },
            ],
            dateRange: null,
            note: null,
          },
        ],
        allyContingents: [
          allyContingent({
            id: 'contingent-ally',
            name: 'Horse archers',
            internalContingent: false,
            troopOptions: [
              troopOption({ min: 3, max: 3, troopEntries: entries('HBW') }),
            ],
          }),
        ],
      }),
    );

    const selection = filledSelection(allied, { year: -2900 });

    expect(selection.general?.troopType).toBe('SPR');
  });

  it('reports an army with no stand its general may be drawn from', () => {
    const headless = buildArmyList(
      armyDetail({
        troopOptions: [troopOption({ min: 2, max: 12 })],
        troopEntriesForGeneral: [{ troopEntries: entries('ELE') }],
        allyOptions: [],
        allyContingents: [],
      }),
    );

    expect(fill(headless, { year: -2900 })).toEqual({
      kind: 'unfilled',
      reason: 'noGeneralStand',
    });
  });

  it('reports the closest total when the cap cannot be reached', () => {
    const short = buildArmyList(
      armyDetail({
        troopOptions: [troopOption({ min: 1, max: 5 })],
        battleCardEntries: [],
        allyOptions: [],
        allyContingents: [],
      }),
    );

    expect(fill(short, { year: -2900 })).toEqual({
      kind: 'unfilled',
      reason: 'pointsCapUnreachable',
      closest: 20,
    });
  });
});

const ascendingNumbers = (left: number, right: number) => left - right;

const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
};

const seeds = Array.from({ length: 12 }, (_seed, index) => index + 1);

describe('shuffledBy', () => {
  it('reorders a copy and leaves every item in place once', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    const shuffled = shuffledBy(seeded(7))(items);

    expect(shuffled.toSorted(ascendingNumbers)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('randomFill', () => {
  const list = buildArmyList(armyDetail());
  const randomly = (seed: number) => {
    const filled = randomFill(
      list,
      emptySelection({ army: list.id, dataVersion, year: -2900 }),
      costs,
      seeded(seed),
    );
    if (filled.kind !== 'filled') {
      throw new Error(`${list.name} could not be filled: ${filled.reason}`);
    }
    return filled.selection;
  };

  it('fills an army to exactly the points cap whatever the draw', () => {
    expect(
      seeds.map((seed) => armyPoints(list, randomly(seed), costs).total),
    ).toEqual(seeds.map(() => 48));
  });

  it('fills an army the validator accepts whatever the draw', () => {
    expect(
      seeds.flatMap((seed) => validateArmy(list, randomly(seed), costs, names)),
    ).toEqual([]);
  });

  it('draws different armies from different seeds', () => {
    expect(
      new Set(seeds.map((seed) => JSON.stringify(randomly(seed)))).size,
    ).toBeGreaterThan(1);
  });

  it('draws the same army from the same seed', () => {
    expect(randomly(3)).toEqual(randomly(3));
  });
});

describe('gatingBuckets', () => {
  it('gives an ungated army a single bucket over its whole span', () => {
    const ungated = buildArmyList(
      armyDetail({
        troopOptions: [troopOption()],
        allyOptions: [],
        allyContingents: [],
      }),
    );

    expect(gatingBuckets(ungated)).toEqual([
      { variant: null, from: -3000, to: -2800 },
    ]);
  });

  it('splits on the years a troop option comes and goes', () => {
    expect(gatingBuckets(buildArmyList(armyDetail()))).toEqual([
      { variant: null, from: -3000, to: -2900 },
      { variant: null, from: -2899, to: -2800 },
    ]);
  });

  it('merges neighbouring years that offer the same options', () => {
    const repeated = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption({
            dateRanges: [
              { startDate: -3000, endDate: -2900 },
              { startDate: -2899, endDate: -2800 },
            ],
          }),
        ],
        allyOptions: [],
        allyContingents: [],
      }),
    );

    expect(gatingBuckets(repeated)).toEqual([
      { variant: null, from: -3000, to: -2800 },
    ]);
  });

  it('walks every variant of a sub-factioned army', () => {
    const noted = buildArmyList(
      armyDetail({
        troopOptions: [
          troopOption(),
          troopOption({ note: 'only Kish', dateRanges: [] }),
        ],
        allyOptions: [],
        allyContingents: [],
        subFactions: {
          army: 'Fixture Army',
          label: 'Sub-faction',
          variants: [
            { id: 'kish', name: 'Kish' },
            { id: 'other', name: 'Other city-states' },
          ],
          rules: { 'only Kish': { only: [{ variant: 'kish', from: -2900 }] } },
        },
      }),
    );

    expect(gatingBuckets(noted)).toEqual([
      { variant: 'kish', from: -3000, to: -2901 },
      { variant: 'kish', from: -2900, to: -2800 },
      { variant: 'other', from: -3000, to: -2800 },
    ]);
  });
});

const sampleGaps: Readonly<Record<string, string>> = {
  '5a Sunspire Dominion · 2200–2151 BC · noGeneralStand':
    'the general is Elite Cavalry, and the only Elite Cavalry option opens in 2150 BC',
  '5a Sunspire Dominion · 2050–2000 BC · pointsCapUnreachable · closest 47':
    'once the chariots and the levies close, every stand costs 3 points but the one to two Elite Cavalry at 4, so 48 needs a multiple of 3 of them',
};

const bucketLabel = ({ variant, from, to }: GatingBucket) =>
  [
    ...(variant === null ? [] : [variant]),
    formatYearSpan({ startDate: from, endDate: to }, 'en'),
  ].join(' · ');

const adjacent = (left: GatingBucket, right: GatingBucket) =>
  left.variant === right.variant && left.to + 1 === right.from;

type Unfilled = { bucket: GatingBucket; reason: string };

type Filled = { bucket: GatingBucket; selection: ArmySelection };

type Swept = {
  armyList: ArmyList;
  unfilled: readonly Unfilled[];
  filled: readonly Filled[];
};

const coalesced = (unfilled: readonly Unfilled[]): readonly Unfilled[] => {
  const spans: Unfilled[] = [];
  for (const next of unfilled) {
    const previous = spans.at(-1);
    if (
      previous &&
      previous.reason === next.reason &&
      adjacent(previous.bucket, next.bucket)
    ) {
      spans[spans.length - 1] = {
        ...previous,
        bucket: { ...previous.bucket, to: next.bucket.to },
      };
      continue;
    }
    spans.push({ ...next, bucket: { ...next.bucket } });
  }
  return spans;
};

const swept = (armyList: ArmyList): Swept => {
  const unfilled: Unfilled[] = [];
  const filled: Filled[] = [];
  for (const bucket of gatingBuckets(armyList)) {
    const result = fillToCap(
      armyList,
      emptySelection({
        army: armyList.id,
        dataVersion,
        year: bucket.from,
        variant: bucket.variant,
      }),
      costs,
    );
    if (result.kind === 'filled') {
      filled.push({ bucket, selection: result.selection });
      continue;
    }
    unfilled.push({
      bucket,
      reason:
        result.reason === 'noGeneralStand'
          ? result.reason
          : `${result.reason} · closest ${result.closest}`,
    });
  }
  return { armyList, unfilled, filled };
};

describe('on the sample snapshot', () => {
  let lists: ArmyList[];
  let sweep: Swept[];

  beforeAll(async () => {
    lists = await sampleArmyLists();
    sweep = lists.map(swept);
  });

  it('asks about every army in the snapshot', () => {
    expect(lists).toHaveLength(8);
    expect(
      sweep.flatMap(({ unfilled, filled }) => [...unfilled, ...filled]),
    ).toHaveLength(36);
  });

  it('builds the armies gating and optional contingents were added for', () => {
    const filledBuckets = new Map(
      sweep.map(({ armyList, filled }) => [armyList.name, filled.length]),
    );

    expect(
      [
        'Sylvan Courts',
        'Tidewrack Corsairs',
        'Sunspire Dominion',
        'Hollow Necropolis',
      ].filter((name) => (filledBuckets.get(name) ?? 0) === 0),
    ).toEqual([]);
  });

  it('leaves no army without a buildable date bucket', () => {
    const unbuildable = sweep
      .filter(({ filled }) => filled.length === 0)
      .map(({ armyList }) => `${armyList.key} ${armyList.name}`);

    expect(unbuildable).toEqual([]);
  });

  it('leaves only the documented sample gaps unbuildable', () => {
    const gaps = sweep.flatMap(({ armyList, unfilled }) =>
      coalesced(unfilled).map(
        ({ bucket, reason }) =>
          `${armyList.key} ${armyList.name} · ${bucketLabel(bucket)} · ${reason}`,
      ),
    );

    expect(gaps.toSorted()).toEqual(Object.keys(sampleGaps).toSorted());
  });

  it('builds a legal 48 point army for every other date bucket and sub-faction', () => {
    const wrong = sweep.flatMap(({ armyList, filled }) =>
      filled.flatMap(({ bucket, selection }) => {
        const { total } = armyPoints(armyList, selection, costs);
        const findings = validateArmy(armyList, selection, costs, names);
        return total === 48 && isLegal(findings)
          ? []
          : [
              `${armyList.key} ${armyList.name} · ${bucketLabel(bucket)} · ${total} points · ${findings
                .filter(({ severity }) => severity === 'error')
                .map(({ code }) => code)
                .join(', ')}`,
            ];
      }),
    );

    expect(wrong).toEqual([]);
  });

  it('draws a legal 48 point army at random wherever the solver builds one', () => {
    const random = seeded(48);
    const wrong = sweep.flatMap(({ armyList, filled }) =>
      filled.flatMap(({ bucket }) => {
        const drawn = randomFill(
          armyList,
          emptySelection({
            army: armyList.id,
            dataVersion,
            year: bucket.from,
            variant: bucket.variant,
          }),
          costs,
          random,
        );
        if (drawn.kind !== 'filled') {
          return [`${armyList.key} · ${bucketLabel(bucket)} · ${drawn.reason}`];
        }
        const { total } = armyPoints(armyList, drawn.selection, costs);
        const findings = validateArmy(armyList, drawn.selection, costs, names);
        return total === 48 && isLegal(findings)
          ? []
          : [`${armyList.key} · ${bucketLabel(bucket)} · ${total} points`];
      }),
    );

    expect(wrong).toEqual([]);
  });
});
