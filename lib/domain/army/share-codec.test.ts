import { beforeAll, describe, expect, it } from 'vitest';
import { type BattleCardCode, battleCardCodes } from '@/lib/data/schema.ts';
import { armyDetail } from '@/test/fixtures/army.ts';
import { randomSequence } from '@/test/random.ts';
import { sampleArmyLists } from '@/test/sample.ts';
import {
  type ArmyList,
  buildArmyList,
  type ContingentGroupId,
  type TroopOption,
  type TroopOptionId,
} from './army-list';
import {
  type ArmySelection,
  emptySelection,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withStands,
  withTroopBattleCard,
} from './selection';
import {
  decodeSelection,
  encodeSelection,
  shareCodeBudgetChars,
  shareCodecVersion,
  shareCodeMaxChars,
} from './share-codec';

const dataVersion = '2026-09-17.abcdef01';

const list = buildArmyList(armyDetail());

const spearmen = list.main.troopOptions[0];
const archers = list.main.troopOptions[1];
const optionalGroup = list.contingentGroups[0];
const allyGroup = list.contingentGroups[1];

if (!spearmen || !archers || !optionalGroup || !allyGroup) {
  throw new Error('the fixture army no longer has the options the tests need');
}

const allyOption = allyGroup.contingents[1]?.troopOptions[0];

if (!allyOption) {
  throw new Error(
    'the fixture army no longer has the contingents the tests need',
  );
}

type Step = (selection: ArmySelection) => ArmySelection;

const empty = emptySelection({ army: list.id, dataVersion, year: -2900 });

const applied = (steps: readonly Step[]) =>
  steps.reduce((selection, step) => step(selection), empty);

const full = applied([
  (selection) => withContingentGroup(selection, optionalGroup),
  (selection) => withContingentGroup(selection, allyGroup),
  (selection) => withStands(selection, spearmen, 'SPR', 6),
  (selection) => withStands(selection, archers, 'ARC', 2),
  (selection) => withStands(selection, archers, 'BLV', 1),
  (selection) => withStands(selection, allyOption, 'HBW', 3),
  (selection) =>
    withGeneral(selection, { option: spearmen.id, troopType: 'SPR' }),
  (selection) => withArmyBattleCard(selection, 'FC', 1),
  (selection) => withArmyBattleCard(selection, 'PD', 2),
  (selection) => withTroopBattleCard(selection, spearmen, 'HL', 4),
  (selection) => withTroopBattleCard(selection, archers, 'SS', 2),
]);

const roundTrip = (selection: ArmySelection) => {
  const decoded = decodeSelection(encodeSelection(selection));
  if (!decoded.ok) {
    throw new Error(`the share code did not decode: ${decoded.reason}`);
  }
  return decoded.selection;
};

const codeOf = (body: Buffer | string) =>
  `${shareCodecVersion}.${Buffer.from(body as Buffer).toString('base64url')}`;

const armyLists = async () => await sampleArmyLists();

describe('encodeSelection', () => {
  it('announces the codec version ahead of the payload', () => {
    expect(encodeSelection(full).startsWith(`${shareCodecVersion}.`)).toBe(
      true,
    );
  });

  it('writes nothing a url would have to escape', () => {
    expect(encodeSelection(full)).toMatch(/^\d+\.[A-Za-z0-9_-]*$/);
  });

  it('encodes the same army the same way whatever order it was built in', () => {
    const reordered = applied([
      (selection) => withArmyBattleCard(selection, 'PD', 2),
      (selection) => withArmyBattleCard(selection, 'FC', 1),
      (selection) => withContingentGroup(selection, optionalGroup),
      (selection) => withContingentGroup(selection, allyGroup),
      (selection) => withStands(selection, allyOption, 'HBW', 3),
      (selection) => withStands(selection, archers, 'BLV', 1),
      (selection) => withStands(selection, archers, 'ARC', 2),
      (selection) => withStands(selection, spearmen, 'SPR', 6),
      (selection) =>
        withGeneral(selection, { option: spearmen.id, troopType: 'SPR' }),
      (selection) => withTroopBattleCard(selection, archers, 'SS', 2),
      (selection) => withTroopBattleCard(selection, spearmen, 'HL', 4),
    ]);

    expect(encodeSelection(reordered)).toBe(encodeSelection(full));
  });

  it('refuses a troop option the army list model would not mint', () => {
    expect(() =>
      encodeSelection({
        ...empty,
        stands: { ['no-such-option' as TroopOptionId]: { SPR: 2 } },
      }),
    ).toThrow('not a troop option');
  });

  it('refuses a contingent group the army list model would not mint', () => {
    expect(() =>
      encodeSelection({
        ...empty,
        contingentGroups: ['group' as ContingentGroupId],
      }),
    ).toThrow('not a contingent group');
  });

  it('refuses a general standing in a troop option the model would not mint', () => {
    expect(() =>
      encodeSelection({
        ...empty,
        general: {
          option: 'no-such-option' as TroopOptionId,
          troopType: 'SPR',
        },
      }),
    ).toThrow('not a troop option');
  });

  it('refuses a battle card the data does not have', () => {
    expect(() =>
      encodeSelection({
        ...empty,
        armyBattleCards: { ['ZZ' as BattleCardCode]: 1 },
      }),
    ).toThrow();
  });

  it('refuses a data version it could not have been built against', () => {
    expect(() =>
      encodeSelection({ ...empty, dataVersion: 'yesterday' }),
    ).toThrow('is not a data version');
  });
});

describe('decodeSelection', () => {
  it('round trips an empty selection', () => {
    expect(roundTrip(empty)).toEqual(empty);
  });

  it('round trips groups, stands, a general and battle cards', () => {
    expect(roundTrip(full)).toEqual(full);
  });

  it('round trips a sub-faction variant and a year after Christ', () => {
    const selection = { ...full, variant: 'kish', year: 1066 };

    expect(roundTrip(selection)).toEqual(selection);
  });

  it('round trips a troop option carrying battle cards but no stands', () => {
    const selection = withTroopBattleCard(empty, archers, 'SS', 2);

    expect(roundTrip(selection)).toEqual(selection);
  });

  it('reports a version it does not know rather than guessing', () => {
    expect(decodeSelection('9.e30')).toEqual({
      ok: false,
      reason: 'unsupportedVersion',
      version: 9,
    });
  });

  it.each([
    ['nothing at all', ''],
    ['a code with no version', 'e30'],
    ['a payload that is not base64url', `${shareCodecVersion}.****`],
    ['an empty payload', `${shareCodecVersion}.`],
    ['a payload that is not utf-8', codeOf(Buffer.from([0xff, 0xfe]))],
    ['a payload that is not json', codeOf('not json at all')],
    ['a selection missing half its fields', codeOf('{"army":"army-1"}')],
    [
      'a troop option the army list model would not mint',
      codeOf(
        JSON.stringify({
          army: 'army-1',
          dataVersion,
          year: -2900,
          variant: null,
          contingentGroups: [],
          stands: { 'no-such-option': { SPR: 2 } },
          general: null,
          armyBattleCards: {},
          troopBattleCards: {},
        }),
      ),
    ],
    [
      'a stand count that is not a count',
      codeOf(
        JSON.stringify({
          army: 'army-1',
          dataVersion,
          year: -2900,
          variant: null,
          contingentGroups: [],
          stands: { 'main/0': { SPR: -2 } },
          general: null,
          armyBattleCards: {},
          troopBattleCards: {},
        }),
      ),
    ],
  ])('refuses %s', (_case, code) => {
    expect(decodeSelection(code)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('a realistic army', () => {
  let lists: ArmyList[] = [];

  beforeAll(async () => {
    lists = await armyLists();
  });

  const firstTroopType = (troopOption: TroopOption) =>
    troopOption.troopEntries[0].troopType;

  const realistic = (armyList: ArmyList) => {
    const group = armyList.contingentGroups[0];
    const options = [
      ...armyList.main.troopOptions.slice(0, 8),
      ...(group?.contingents.flatMap(({ troopOptions }) =>
        troopOptions.slice(0, 2),
      ) ?? []),
    ];
    const general = options[0];
    const steps: Step[] = [
      ...(group
        ? [(selection: ArmySelection) => withContingentGroup(selection, group)]
        : []),
      ...options.map(
        (troopOption): Step =>
          (selection) =>
            withStands(selection, troopOption, firstTroopType(troopOption), 2),
      ),
      ...(general
        ? [
            (selection: ArmySelection) =>
              withGeneral(selection, {
                option: general.id,
                troopType: firstTroopType(general),
              }),
            (selection: ArmySelection) =>
              withTroopBattleCard(selection, general, 'HL', 2),
          ]
        : []),
      (selection: ArmySelection) => withArmyBattleCard(selection, 'FC', 1),
    ];
    return steps.reduce(
      (selection, step) => step(selection),
      emptySelection({
        army: armyList.id,
        dataVersion,
        year: armyList.dateRange.startDate,
      }),
    );
  };

  it('round trips for every sample army', () => {
    for (const armyList of lists) {
      const selection = realistic(armyList);

      expect(roundTrip(selection)).toEqual(selection);
    }
  });
});

describe('a randomly built selection', () => {
  let lists: ArmyList[] = [];

  beforeAll(async () => {
    lists = await armyLists();
  });

  const pick = <Item>(items: readonly Item[], random: () => number) => {
    const item = items[Math.floor(random() * items.length)];
    if (item === undefined) {
      throw new Error('there is nothing to pick from');
    }
    return item;
  };

  const built = (random: () => number) => {
    const armyList = pick(lists, random);
    const { startDate, endDate } = armyList.dateRange;
    const groups = armyList.contingentGroups.filter(() => random() < 0.5);
    const allocations = [
      ...armyList.main.troopOptions,
      ...groups.flatMap(({ contingents }) =>
        contingents.flatMap(({ troopOptions }) => troopOptions),
      ),
    ]
      .filter(() => random() < 0.4)
      .map((troopOption) => ({
        troopOption,
        troopType: pick(troopOption.troopEntries, random).troopType,
        stands: 1 + Math.floor(random() * 12),
        card: random() < 0.3 ? pick(battleCardCodes, random) : null,
      }));
    const general = allocations.filter(() => random() < 0.5)[0] ?? null;
    const steps: Step[] = [
      ...groups.map(
        (group): Step =>
          (selection) =>
            withContingentGroup(selection, group),
      ),
      ...allocations.flatMap(
        ({ troopOption, troopType, stands, card }): Step[] => [
          (selection) => withStands(selection, troopOption, troopType, stands),
          ...(card
            ? [
                (selection: ArmySelection) =>
                  withTroopBattleCard(selection, troopOption, card, 2),
              ]
            : []),
        ],
      ),
      ...(general
        ? [
            (selection: ArmySelection) =>
              withGeneral(selection, {
                option: general.troopOption.id,
                troopType: general.troopType,
              }),
          ]
        : []),
      ...(random() < 0.5
        ? [
            (selection: ArmySelection) =>
              withArmyBattleCard(
                selection,
                pick(battleCardCodes, random),
                1 + Math.floor(random() * 3),
              ),
          ]
        : []),
    ];
    return steps.reduce(
      (selection, step) => step(selection),
      emptySelection({
        army: armyList.id,
        dataVersion,
        year: startDate + Math.floor(random() * (endDate - startDate + 1)),
        variant:
          armyList.subFactions && random() < 0.5
            ? pick(armyList.subFactions.variants, random).id
            : null,
      }),
    );
  };

  it.each(Array.from({ length: 200 }, (_run, seed) => seed))(
    'survives the round trip in run %i',
    (seed) => {
      const selection = built(randomSequence(seed + 1));

      expect(roundTrip(selection)).toEqual(selection);
    },
  );
});

describe('a code longer than any list can produce', () => {
  it('is rejected before anything tries to decode it', () => {
    const code = `1.${'A'.repeat(shareCodeMaxChars)}`;

    expect(decodeSelection(code)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('leaves room above the budget a real list is held to', () => {
    expect(shareCodeMaxChars).toBeGreaterThan(shareCodeBudgetChars);
  });
});
