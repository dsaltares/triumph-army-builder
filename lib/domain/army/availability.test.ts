import { beforeAll, describe, expect, it } from 'vitest';
import type { ArmyDetail } from '@/lib/data/bundle.ts';
import {
  armyDetail,
  builderArmyDetail,
  troopOption,
} from '@/test/fixtures/army.ts';
import { sampleArmyLists, sampleCuration } from '@/test/sample.ts';
import {
  type ArmyList,
  buildArmyList,
  type ContingentGroup,
  type DateRange,
} from './army-list';
import {
  availableBattleCards,
  availableContingentGroups,
  availableTroopOptions,
  coversYear,
  datedTroopOptions,
  isTroopOptionAvailable,
  resolveArmyList,
  ruleAllows,
  subFactionAllows,
  troopOptionWithholding,
} from './availability';

const cityStates = builderArmyDetail().subFactions;

const rule = (key: string, note: string) => {
  const found = sampleCuration.subFactions[key]?.rules[note];
  if (!found) {
    throw new Error(`${key} has no rule for "${note}"`);
  }
  return found;
};

const gated = (note: string, dateRanges: DateRange[] = []) => ({
  note,
  dateRanges,
});

describe('coversYear', () => {
  it('treats an option with no date ranges as always available', () => {
    expect(coversYear([], 1066)).toBe(true);
  });

  it('includes both ends of a range', () => {
    const ranges = [{ startDate: -3000, endDate: -2900 }];

    expect(coversYear(ranges, -3000)).toBe(true);
    expect(coversYear(ranges, -2900)).toBe(true);
    expect(coversYear(ranges, -2901)).toBe(true);
    expect(coversYear(ranges, -3001)).toBe(false);
    expect(coversYear(ranges, -2899)).toBe(false);
  });

  it('covers a year in any one of several ranges', () => {
    const ranges = [
      { startDate: -250, endDate: -71 },
      { startDate: 40, endDate: 100 },
    ];

    expect(coversYear(ranges, 50)).toBe(true);
    expect(coversYear(ranges, -70)).toBe(false);
  });
});

describe('ruleAllows', () => {
  it('admits only the variants a positive note names', () => {
    const summerOrWinter = rule('2a', 'Summer or Winter Court');

    expect(ruleAllows(summerOrWinter, 'summer', 0)).toBe(true);
    expect(ruleAllows(summerOrWinter, 'winter', 0)).toBe(true);
    expect(ruleAllows(summerOrWinter, 'other', 0)).toBe(false);
  });

  it('admits every variant a negative note leaves out', () => {
    const exceptSummerOrWinter = rule(
      '2a',
      'all except Summer or Winter Court',
    );
    const notTwilight = rule('2a', 'not Twilight Court');

    expect(ruleAllows(exceptSummerOrWinter, 'other', 0)).toBe(true);
    expect(ruleAllows(exceptSummerOrWinter, 'summer', 0)).toBe(false);
    expect(ruleAllows(notTwilight, 'summer', 0)).toBe(true);
    expect(ruleAllows(notTwilight, 'twilight', 0)).toBe(false);
  });

  it('applies the years a note attaches to one variant', () => {
    const ashenOrCinder = rule(
      '3a',
      'only Ashen after 1400; or Cinder after 1455',
    );

    expect(ruleAllows(ashenOrCinder, 'ashen', 1401)).toBe(true);
    expect(ruleAllows(ashenOrCinder, 'ashen', 1400)).toBe(false);
    expect(ruleAllows(ashenOrCinder, 'cinder', 1456)).toBe(true);
    expect(ruleAllows(ashenOrCinder, 'cinder', 1401)).toBe(false);
  });

  it('applies a closing year on its own', () => {
    const untilFourteenHundred = rule(
      '3a',
      'only Cinder, or Ashen until 1400 only',
    );

    expect(ruleAllows(untilFourteenHundred, 'ashen', 1400)).toBe(true);
    expect(ruleAllows(untilFourteenHundred, 'ashen', 1401)).toBe(false);
    expect(ruleAllows(untilFourteenHundred, 'cinder', 1500)).toBe(true);
  });

  it('mixes a dated variant with an undated one', () => {
    const beforeEightHundred = rule('4a', 'before 800, or except in the Deeps');

    expect(ruleAllows(beforeEightHundred, 'deeps', 799)).toBe(true);
    expect(ruleAllows(beforeEightHundred, 'deeps', 800)).toBe(false);
    expect(ruleAllows(beforeEightHundred, 'other', 1000)).toBe(true);
  });

  it('splits a note that hands one span to each of two rulers', () => {
    const graskThenUrm = rule(
      '6a',
      'only if  Grask before 1405 or his son Urm after',
    );

    expect(ruleAllows(graskThenUrm, 'grask', 1404)).toBe(true);
    expect(ruleAllows(graskThenUrm, 'grask', 1405)).toBe(false);
    expect(ruleAllows(graskThenUrm, 'urm', 1405)).toBe(true);
    expect(ruleAllows(graskThenUrm, 'urm', 1404)).toBe(false);
    expect(ruleAllows(graskThenUrm, 'other', 1420)).toBe(false);
  });
});

describe('subFactionAllows', () => {
  const sumerian = cityStates;

  it('withholds a gated note until a variant is chosen', () => {
    expect(
      subFactionAllows(sumerian, 'only Kish', { year: -2900, variant: null }),
    ).toBe(false);
    expect(
      subFactionAllows(sumerian, 'only Kish', { year: -2900, variant: 'uruk' }),
    ).toBe(false);
    expect(
      subFactionAllows(sumerian, 'only Kish', { year: -2900, variant: 'kish' }),
    ).toBe(true);
  });

  it('leaves an unnoted option alone whatever the variant', () => {
    expect(subFactionAllows(sumerian, '', { year: -2900, variant: null })).toBe(
      true,
    );
  });

  it('keeps an uncurated note available rather than blocking the army', () => {
    expect(
      subFactionAllows(sumerian, 'only Lagash', {
        year: -2900,
        variant: 'kish',
      }),
    ).toBe(true);
    expect(
      subFactionAllows(null, 'only Kish', { year: -2900, variant: null }),
    ).toBe(true);
  });
});

describe('isTroopOptionAvailable', () => {
  const sumerian = cityStates;

  it('withholds an option whose date ranges miss the year', () => {
    const kish = gated('only Kish', [{ startDate: -3000, endDate: -2800 }]);

    expect(
      isTroopOptionAvailable(kish, sumerian, { year: -2900, variant: 'kish' }),
    ).toBe(true);
    expect(
      isTroopOptionAvailable(kish, sumerian, { year: -2700, variant: 'kish' }),
    ).toBe(false);
  });

  it('withholds an option the variant is not entitled to', () => {
    const kish = gated('only Kish');

    expect(
      isTroopOptionAvailable(kish, sumerian, { year: -2900, variant: 'umma' }),
    ).toBe(false);
  });
});

describe('troopOptionWithholding', () => {
  const sumerian = cityStates;

  it('names the year when the date ranges miss it', () => {
    const kish = gated('only Kish', [{ startDate: -3000, endDate: -2800 }]);

    expect(
      troopOptionWithholding(kish, sumerian, {
        year: -2700,
        variant: 'kish',
      }),
    ).toBe('year');
  });

  it('names the sub-faction when the variant is not entitled to it', () => {
    expect(
      troopOptionWithholding(gated('only Kish'), sumerian, {
        year: -2900,
        variant: 'umma',
      }),
    ).toBe('subFaction');
  });

  it('names neither when the option is offered', () => {
    expect(
      troopOptionWithholding(gated('only Kish'), sumerian, {
        year: -2900,
        variant: 'kish',
      }),
    ).toBeNull();
  });
});

describe('availableTroopOptions', () => {
  it('keeps the options the year and the variant both admit', () => {
    const options = [
      gated(''),
      gated('only Kish'),
      gated('only Umma and Apishal'),
      gated('', [{ startDate: -3000, endDate: -2900 }]),
    ];

    expect(
      availableTroopOptions(options, cityStates, {
        year: -2850,
        variant: 'kish',
      }),
    ).toEqual([options[0], options[1]]);
  });
});

describe('datedTroopOptions', () => {
  it('gates on the year alone, whatever the note says', () => {
    const options = [
      gated('only Kish'),
      gated('only Kish', [{ startDate: -3000, endDate: -2900 }]),
    ];

    expect(datedTroopOptions(options, -2850)).toEqual([options[0]]);
  });
});

describe('resolveArmyList', () => {
  const sumerian = (overrides: Partial<ArmyDetail> = {}) =>
    buildArmyList(armyDetail({ subFactions: cityStates, ...overrides }));

  const optionIds = (armyList: ArmyList) =>
    armyList.main.troopOptions.map(({ id }) => id);

  const contingentOptionIds = (groups: readonly ContingentGroup[]) =>
    groups.flatMap(({ contingents }) =>
      contingents.flatMap(({ troopOptions }) =>
        troopOptions.map(({ id }) => id),
      ),
    );

  it('withholds a dated option outside its years', () => {
    expect(
      optionIds(resolveArmyList(sumerian(), { year: -2850, variant: 'kish' })),
    ).toEqual(['main/0', 'main/2']);
  });

  it('withholds a noted option the variant is not entitled to', () => {
    expect(
      optionIds(resolveArmyList(sumerian(), { year: -2900, variant: 'kish' })),
    ).toEqual(['main/0', 'main/1', 'main/2']);
    expect(
      optionIds(resolveArmyList(sumerian(), { year: -2900, variant: 'umma' })),
    ).toEqual(['main/0', 'main/2']);
    expect(
      optionIds(resolveArmyList(sumerian(), { year: -2900, variant: null })),
    ).toEqual(['main/0', 'main/2']);
  });

  it('leaves a noted option alone on an army with no curated variants', () => {
    const uncurated = buildArmyList(armyDetail());

    expect(
      optionIds(resolveArmyList(uncurated, { year: -2900, variant: null })),
    ).toEqual(['main/0', 'main/1', 'main/2']);
  });

  it('withholds an ally option outside the years it may be taken', () => {
    const groups = (year: number) =>
      availableContingentGroups(sumerian(), { year, variant: 'kish' }).map(
        ({ id }) => id,
      );

    expect(groups(-3000)).toEqual(['group/0']);
    expect(groups(-2950)).toEqual(['group/0', 'group/1']);
    expect(groups(-2800)).toEqual(['group/0', 'group/1']);
  });

  it('dates a contingent troop option against the year it is taken in', () => {
    const list = sumerian({
      allyContingents: [
        {
          id: 'contingent-optional',
          name: 'Fixture Optional Contingent',
          internalContingent: true,
          dateRange: null,
          troopOptions: [
            troopOption({
              troopEntries: [
                { troopTypeCode: 'LFT', dismountTypeCode: null, note: null },
              ],
              dateRanges: [{ startDate: -3000, endDate: -2900 }],
            }),
          ],
        },
      ],
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-optional', name: 'Optional friends' },
          ],
          dateRange: null,
          note: null,
        },
      ],
    });

    expect(
      contingentOptionIds(
        availableContingentGroups(list, { year: -2900, variant: 'kish' }),
      ),
    ).toEqual(['contingent-optional/0']);
    expect(
      contingentOptionIds(
        availableContingentGroups(list, { year: -2850, variant: 'kish' }),
      ),
    ).toEqual([]);
  });

  it('never gates a contingent on the dates of the army it derives from', () => {
    const list = sumerian({
      allyContingents: [
        {
          id: 'contingent-optional',
          name: 'Fixture Optional Contingent',
          internalContingent: true,
          dateRange: { startDate: -2950, endDate: -2800 },
          troopOptions: [
            troopOption({
              troopEntries: [
                { troopTypeCode: 'LFT', dismountTypeCode: null, note: null },
              ],
            }),
          ],
        },
      ],
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-optional', name: 'Optional friends' },
          ],
          dateRange: null,
          note: null,
        },
      ],
    });

    expect(
      contingentOptionIds(
        availableContingentGroups(list, { year: -3000, variant: 'kish' }),
      ),
    ).toEqual(['contingent-optional/0']);
  });

  it('never gates a contingent on the sub-faction of the army taking it', () => {
    const list = sumerian({
      allyContingents: [
        {
          id: 'contingent-optional',
          name: 'Fixture Optional Contingent',
          internalContingent: true,
          dateRange: null,
          troopOptions: [
            troopOption({
              note: 'only Umma and Apishal',
              troopEntries: [
                { troopTypeCode: 'LFT', dismountTypeCode: null, note: null },
              ],
            }),
          ],
        },
      ],
      allyOptions: [
        {
          allyEntries: [
            { allyArmyList: 'contingent-optional', name: 'Optional friends' },
          ],
          dateRange: null,
          note: null,
        },
      ],
    });

    expect(
      contingentOptionIds(
        availableContingentGroups(list, { year: -2900, variant: 'kish' }),
      ),
    ).toEqual(['contingent-optional/0']);
  });
});

describe('availableBattleCards', () => {
  it('keeps the army wide cards and the cards on the options that survive', () => {
    const list = buildArmyList(
      armyDetail({
        subFactions: cityStates,
        troopOptions: [
          troopOption({
            battleCardEntries: [
              { battleCardCode: 'HL', min: 0, max: 2, note: null },
            ],
          }),
          troopOption({
            note: 'only Kish',
            dateRanges: [{ startDate: -3000, endDate: -2900 }],
            battleCardEntries: [
              { battleCardCode: 'SS', min: null, max: null, note: null },
            ],
          }),
        ],
      }),
    );

    expect(
      availableBattleCards(list, { year: -2900, variant: 'kish' }),
    ).toEqual([
      { scope: 'army', code: 'FC', min: null, max: null, note: null },
      {
        scope: 'troopOption',
        option: 'main/0',
        code: 'HL',
        min: 0,
        max: 2,
        note: null,
      },
      {
        scope: 'troopOption',
        option: 'main/1',
        code: 'SS',
        min: null,
        max: null,
        note: null,
      },
    ]);
    expect(
      availableBattleCards(list, { year: -2850, variant: 'kish' }).map(
        ({ code }) => code,
      ),
    ).toEqual(['FC', 'HL']);
  });
});

const contingentBreakpoints = (armyList: ArmyList, group: ContingentGroup) => {
  const startDate = Math.max(
    group.dateRange?.startDate ?? armyList.dateRange.startDate,
    armyList.dateRange.startDate,
  );
  const endDate = Math.min(
    group.dateRange?.endDate ?? armyList.dateRange.endDate,
    armyList.dateRange.endDate,
  );
  const years = [startDate, endDate];
  for (const { troopOptions } of group.contingents) {
    for (const { dateRanges } of troopOptions) {
      for (const range of dateRanges) {
        years.push(
          range.startDate - 1,
          range.startDate,
          range.endDate,
          range.endDate + 1,
        );
      }
    }
  }
  return [
    ...new Set(years.filter((year) => year >= startDate && year <= endDate)),
  ];
};

describe('on the sample snapshot', () => {
  let lists: ArmyList[];

  beforeAll(async () => {
    lists = await sampleArmyLists();
  });

  const armyListFor = (key: string) => {
    const found = lists.find((list) => list.key === key);
    if (!found) {
      throw new Error(`${key} is not in the snapshot`);
    }
    return found;
  };

  it('gates an ally option on its dates alone, because none carries a note', () => {
    const noted = lists.flatMap(({ name, contingentGroups }) =>
      contingentGroups
        .filter(({ note }) => note !== null)
        .map(({ note }) => `${name}: ${note}`),
    );

    expect(noted).toEqual([]);
  });

  it('resolves Sylvan Courts down to the options one court may take', () => {
    const sylvan = armyListFor('2a');
    const options = (variant: string | null) =>
      resolveArmyList(sylvan, { year: 0, variant }).main.troopOptions.length;

    expect(sylvan.main.troopOptions).toHaveLength(7);
    expect(options(null)).toBe(3);
    expect(options('summer')).toBe(5);
    expect(options('twilight')).toBe(4);
    expect(options('other')).toBe(5);
  });

  it('leaves every contingent a troop option to offer, bar one upstream slip', () => {
    const empty = lists.flatMap((list) =>
      list.contingentGroups.flatMap((group) =>
        contingentBreakpoints(list, group).flatMap((year) =>
          group.contingents
            .filter(
              ({ troopOptions }) =>
                troopOptions.length > 0 &&
                datedTroopOptions(troopOptions, year).length === 0,
            )
            .map(
              ({ name }) => `${list.name} | ${group.name} | ${name} at ${year}`,
            ),
        ),
      ),
    );

    expect(empty).toEqual([
      'Hollow Necropolis | Bog-risen or (later) Barrow-kin | Bog-risen or Barrow-kin at -70',
    ]);
  });
});
