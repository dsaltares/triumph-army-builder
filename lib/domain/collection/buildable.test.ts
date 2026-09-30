import { beforeAll, describe, expect, it } from 'vitest';
import type { ArmyDetail } from '@/lib/data/bundle.ts';
import type { TroopTypeCode } from '@/lib/data/schema.ts';
import {
  allyContingent,
  armyDetail,
  battleCardEntry,
  entries as troopEntries,
  troopOption,
} from '@/test/fixtures/army.ts';
import {
  sampleArmyLists,
  sampleBattleCardCosts,
  sampleTroopTypes,
} from '@/test/sample.ts';
import {
  type ArmyList,
  buildArmyList,
  type TroopOptionId,
} from '../army/army-list';
import { armyPoints } from '../army/points';
import { troopOptionStandCount } from '../army/selection';
import { isLegal, validateArmy } from '../army/validation';
import { troopTypeCosts, troopTypeNames } from '../troop-types.ts';
import { type BuildableList, buildableLists } from './buildable';
import { type CollectionEntry, coverage } from './coverage';

const costs = {
  troopTypes: troopTypeCosts(sampleTroopTypes),
  battleCards: sampleBattleCardCosts,
};
const names = troopTypeNames(sampleTroopTypes);
const dataVersion = '2026-09-17.abcdef01';

const entry = (
  id: string,
  count: number,
  troopType: TroopTypeCode,
  tags: readonly string[] = [],
): CollectionEntry => ({ id, count, troopType, tags, status: 'painted' });

const army = (overrides: Partial<ArmyDetail> = {}) =>
  buildArmyList(
    armyDetail({
      troopOptions: [
        troopOption({ min: 0, max: 24, troopEntries: troopEntries('SPR') }),
      ],
      troopEntriesForGeneral: [{ troopEntries: troopEntries('SPR') }],
      battleCardEntries: [],
      allyOptions: [],
      allyContingents: [],
      ...overrides,
    }),
  );

const built = (
  armyLists: readonly ArmyList[],
  collection: readonly CollectionEntry[],
  pointsCap = 48,
) => buildableLists(armyLists, collection, costs, dataVersion, { pointsCap });

const onlyBuilt = (
  armyList: ArmyList,
  collection: readonly CollectionEntry[],
  pointsCap = 48,
) => {
  const [first, ...rest] = built([armyList], collection, pointsCap);
  if (!first || rest.length > 0) {
    throw new Error(`expected one buildable list, got ${rest.length + 1}`);
  }
  return first;
};

const standsOn = ({ selection }: BuildableList, option: string) =>
  selection.stands[option as TroopOptionId] ?? {};

describe('buildableLists', () => {
  it('builds nothing from an empty collection', () => {
    expect(built([army()], [])).toEqual([]);
  });

  it('fields every owned stand an option has room for', () => {
    const list = onlyBuilt(army(), [entry('spears', 5, 'SPR')]);

    expect(list).toMatchObject({
      army: 'army-1',
      name: 'Fixture Army',
      year: -3000,
      variant: null,
      subFaction: null,
      pointsCovered: 20,
      matched: 0,
      standIns: 5,
      matchShare: 0,
    });
    expect(standsOn(list, 'main/0')).toEqual({ SPR: 5 });
    expect(list.selection.general).toEqual({
      option: 'main/0',
      troopType: 'SPR',
    });
  });

  it('stops at the points cap', () => {
    const list = onlyBuilt(army(), [entry('spears', 20, 'SPR')]);

    expect(list.pointsCovered).toBe(48);
    expect(standsOn(list, 'main/0')).toEqual({ SPR: 12 });
  });

  it('stops at any other cap the rules carry', () => {
    expect(
      onlyBuilt(army(), [entry('spears', 20, 'SPR')], 36).pointsCovered,
    ).toBe(36);
  });

  it('never takes an option past its maximum', () => {
    const narrow = army({
      troopOptions: [
        troopOption({ min: 0, max: 4, troopEntries: troopEntries('SPR') }),
      ],
    });

    expect(
      standsOn(onlyBuilt(narrow, [entry('spears', 20, 'SPR')]), 'main/0'),
    ).toEqual({ SPR: 4 });
  });

  it('spends an entry at most count times across the options it fits', () => {
    const twoSpearOptions = army({
      troopOptions: [
        troopOption({ min: 0, max: 6, troopEntries: troopEntries('SPR') }),
        troopOption({ min: 0, max: 6, troopEntries: troopEntries('SPR') }),
      ],
    });

    expect(
      onlyBuilt(twoSpearOptions, [entry('spears', 7, 'SPR')]).pointsCovered,
    ).toBe(28);
  });

  it('leaves out an option it cannot take to its minimum', () => {
    const withBlades = army({
      troopOptions: [
        troopOption({ min: 0, max: 6, troopEntries: troopEntries('SPR') }),
        troopOption({ min: 4, max: 6, troopEntries: troopEntries('WBD') }),
      ],
    });

    const list = onlyBuilt(withBlades, [
      entry('spears', 2, 'SPR'),
      entry('warband', 3, 'WBD'),
    ]);

    expect(standsOn(list, 'main/1')).toEqual({});
    expect(list.pointsCovered).toBe(8);
  });

  it('gives the stands of an option it cannot fill to one it can', () => {
    const hoplitesOrOtherFoot = army({
      troopOptions: [
        troopOption({ min: 0, max: 6, troopEntries: troopEntries('SPR') }),
        troopOption({
          min: 4,
          max: 6,
          description: 'Hoplites',
          troopEntries: troopEntries('HFT'),
        }),
        troopOption({ min: 0, max: 6, troopEntries: troopEntries('HFT') }),
      ],
    });

    const list = onlyBuilt(hoplitesOrOtherFoot, [
      entry('spears', 1, 'SPR'),
      entry('hoplites', 3, 'HFT', ['hoplite']),
    ]);

    expect(standsOn(list, 'main/1')).toEqual({});
    expect(standsOn(list, 'main/2')).toEqual({ HFT: 3 });
  });

  it('builds nothing without a stand the general may be drawn from', () => {
    expect(built([army()], [entry('hoplites', 8, 'HFT')])).toEqual([]);
  });

  it('spends a stand on the general when a pricier troop type would leave the army without one', () => {
    const hoplitesLead = army({
      troopOptions: [
        troopOption({ min: 0, max: 12, troopEntries: troopEntries('SPR') }),
        troopOption({ min: 0, max: 6, troopEntries: troopEntries('HFT') }),
      ],
      troopEntriesForGeneral: [{ troopEntries: troopEntries('HFT') }],
    });

    const list = onlyBuilt(hoplitesLead, [
      entry('spears', 12, 'SPR'),
      entry('hoplites', 1, 'HFT'),
    ]);

    expect(list.selection.general).toEqual({
      option: 'main/1',
      troopType: 'HFT',
    });
    expect(list.pointsCovered).toBe(47);
  });

  it('draws a single-type option from one troop type', () => {
    const eitherOr = army({
      troopOptions: [
        troopOption({
          min: 0,
          max: 12,
          troopEntries: [
            { troopTypeCode: 'SPR', dismountTypeCode: null, note: 'all' },
            { troopTypeCode: 'BLV', dismountTypeCode: null, note: 'all' },
          ],
        }),
      ],
    });

    const list = onlyBuilt(eitherOr, [
      entry('spears', 3, 'SPR'),
      entry('blades', 4, 'BLV'),
    ]);

    expect(standsOn(list, 'main/0')).toEqual({ SPR: 3 });
  });

  it('prefers matches to stand-ins when the points are the same', () => {
    const hoplites = army({
      troopOptions: [
        troopOption({
          min: 0,
          max: 24,
          description: 'Hoplites',
          troopEntries: troopEntries('SPR'),
        }),
      ],
    });

    const list = onlyBuilt(hoplites, [
      entry('levy', 12, 'SPR'),
      entry('hoplites', 12, 'SPR', ['hoplite']),
    ]);

    expect(list).toMatchObject({
      pointsCovered: 48,
      matched: 12,
      standIns: 0,
      matchShare: 1,
    });
  });

  it('builds only the armies whose name holds every search term', () => {
    const lists = buildableLists(
      [
        army({ id: 'army-iron-crown', name: 'Iron Crown Knights' }),
        army({ id: 'army-athens', name: 'Classical Athenian' }),
        army({ id: 'army-thebes', name: 'Later Hoplite Thebes' }),
      ],
      [entry('spears', 5, 'SPR')],
      costs,
      dataVersion,
      { pointsCap: 48 },
      { standIns: true, search: '  crown  knîghts ' },
    );

    expect(lists.map(({ army }) => army)).toEqual(['army-iron-crown']);
  });

  describe('without stand-ins', () => {
    const matchesOnly = (
      armyLists: readonly ArmyList[],
      collection: readonly CollectionEntry[],
    ) =>
      buildableLists(
        armyLists,
        collection,
        costs,
        dataVersion,
        { pointsCap: 48 },
        { standIns: false },
      );

    const hoplites = army({
      troopOptions: [
        troopOption({
          min: 0,
          max: 24,
          description: 'Hoplites',
          troopEntries: troopEntries('SPR'),
        }),
      ],
    });

    it('fields only the stands that match the troop description', () => {
      const [list, ...rest] = matchesOnly(
        [hoplites],
        [entry('levy', 12, 'SPR'), entry('hoplites', 5, 'SPR', ['hoplite'])],
      );

      expect(rest).toEqual([]);
      expect(list).toMatchObject({
        pointsCovered: 20,
        matched: 5,
        standIns: 0,
      });
    });

    it('builds nothing an army could only take as stand-ins', () => {
      expect(matchesOnly([hoplites], [entry('levy', 12, 'SPR')])).toEqual([]);
    });

    it('draws the general from a matching stand', () => {
      const hopliteGeneral = army({
        troopOptions: [
          troopOption({
            min: 0,
            max: 6,
            description: 'Hoplites',
            troopEntries: troopEntries('HFT'),
          }),
          troopOption({
            min: 0,
            max: 6,
            description: 'Spearmen',
            troopEntries: troopEntries('SPR'),
          }),
        ],
        troopEntriesForGeneral: [{ troopEntries: troopEntries('HFT') }],
      });

      const [list] = matchesOnly(
        [hopliteGeneral],
        [
          entry('hoplites', 1, 'HFT', ['hoplite']),
          entry('militia', 6, 'HFT', ['levy']),
          entry('spearmen', 6, 'SPR', ['spearman']),
        ],
      );

      expect(list?.selection.general).toEqual({
        option: 'main/0',
        troopType: 'HFT',
      });
      expect(list?.standIns).toBe(0);
    });
  });

  describe('complete armies only', () => {
    const completeOnly = (
      armyLists: readonly ArmyList[],
      collection: readonly CollectionEntry[],
    ) =>
      buildableLists(
        armyLists,
        collection,
        costs,
        dataVersion,
        { pointsCap: 48 },
        { complete: true },
      );

    const isComplete = (armyList: ArmyList, { selection }: BuildableList) =>
      armyPoints(armyList, selection, costs).total === 48 &&
      isLegal(validateArmy(armyList, selection, costs, names));

    it('keeps an army the collection fields to the cap on its own', () => {
      const spears = army();
      const [list, ...rest] = completeOnly(
        [spears],
        [entry('spears', 12, 'SPR')],
      );

      expect(rest).toEqual([]);
      expect(list).toMatchObject({ pointsCovered: 48, battleCardPoints: 0 });
      expect(isComplete(spears, list as BuildableList)).toBe(true);
    });

    it('buys battle cards to make up what the stands leave short', () => {
      const withCards = army({
        battleCardEntries: [battleCardEntry({ battleCardCode: 'SC' })],
      });
      const blades = army({
        troopOptions: [
          troopOption({ min: 0, max: 24, troopEntries: troopEntries('BLV') }),
        ],
        troopEntriesForGeneral: [{ troopEntries: troopEntries('BLV') }],
        battleCardEntries: [battleCardEntry({ battleCardCode: 'SC' })],
      });
      const [list, ...rest] = completeOnly(
        [withCards, blades],
        [entry('blades', 23, 'BLV'), entry('spears', 1, 'SPR')],
      );

      expect(rest).toEqual([]);
      expect(list).toMatchObject({ pointsCovered: 46, battleCardPoints: 2 });
      expect(list?.selection.armyBattleCards).toEqual({ SC: 1 });
      expect(isComplete(blades, list as BuildableList)).toBe(true);
    });

    it('leaves out an army the collection cannot take to the cap, cards and all', () => {
      const spears = army({
        battleCardEntries: [battleCardEntry({ battleCardCode: 'SC' })],
      });
      const collection = [entry('spears', 10, 'SPR')];

      expect(built([spears], collection)).toHaveLength(1);
      expect(completeOnly([spears], collection)).toEqual([]);
    });

    it('leaves out an army whose required troops the collection lacks', () => {
      const needsBlades = army({
        troopOptions: [
          troopOption({ min: 0, max: 24, troopEntries: troopEntries('SPR') }),
          troopOption({ min: 2, max: 4, troopEntries: troopEntries('BLV') }),
        ],
      });
      const collection = [entry('spears', 12, 'SPR')];

      expect(built([needsBlades], collection)).toHaveLength(1);
      expect(completeOnly([needsBlades], collection)).toEqual([]);
    });

    it('gives a required option its minimum before an optional one takes the same stands', () => {
      const twoSpearOptions = army({
        troopOptions: [
          troopOption({ min: 0, max: 12, troopEntries: troopEntries('SPR') }),
          troopOption({ min: 4, max: 8, troopEntries: troopEntries('SPR') }),
        ],
      });
      const [list] = completeOnly(
        [twoSpearOptions],
        [entry('spears', 12, 'SPR')],
      );

      expect(
        troopOptionStandCount(
          list?.selection ?? ({} as BuildableList['selection']),
          'main/1' as TroopOptionId,
        ),
      ).toBeGreaterThanOrEqual(4);
      expect(isComplete(twoSpearOptions, list as BuildableList)).toBe(true);
    });
  });

  it('names the sub-faction the list is built for', () => {
    const list = onlyBuilt(
      army({
        subFactions: {
          army: 'Fixture Army',
          label: 'Sub-faction',
          variants: [{ id: 'kish', name: 'Kish' }],
          rules: {},
        },
      }),
      [entry('spears', 5, 'SPR')],
    );

    expect(list).toMatchObject({ variant: 'kish', subFaction: 'Kish' });
  });

  describe('with an allied contingent', () => {
    const allied = army({
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
            troopOption({ min: 2, max: 4, troopEntries: troopEntries('HBW') }),
          ],
        }),
      ],
      troopEntriesForGeneral: [{ troopEntries: troopEntries('SPR', 'HBW') }],
    });

    it('takes it when owned stands can fill it', () => {
      const list = onlyBuilt(allied, [
        entry('spears', 4, 'SPR'),
        entry('horse archers', 3, 'HBW'),
      ]);

      expect(list.selection.contingentGroups).toEqual(['group/0']);
      expect(standsOn(list, 'contingent-ally/0')).toEqual({ HBW: 3 });
      expect(list.pointsCovered).toBe(28);
    });

    it('leaves it out when its minimum cannot be met', () => {
      const list = onlyBuilt(allied, [
        entry('spears', 4, 'SPR'),
        entry('horse archers', 1, 'HBW'),
      ]);

      expect(list.selection.contingentGroups).toEqual([]);
      expect(list.pointsCovered).toBe(16);
    });

    it('never draws the general from it', () => {
      expect(built([allied], [entry('horse archers', 4, 'HBW')])).toEqual([]);
    });
  });

  it('takes an optional contingent when owned stands can fill it', () => {
    const withLevy = army({
      allyOptions: [
        {
          allyEntries: [{ allyArmyList: 'contingent-optional', name: 'Levy' }],
          dateRange: null,
          note: null,
        },
      ],
      allyContingents: [allyContingent()],
    });

    const list = onlyBuilt(withLevy, [
      entry('spears', 4, 'SPR'),
      entry('peltasts', 2, 'LFT'),
    ]);

    expect(list.selection.contingentGroups).toEqual(['group/0']);
    expect(list.pointsCovered).toBe(22);
  });

  it('picks the year that fields the most of the collection', () => {
    const dated = army({
      troopOptions: [
        troopOption({ min: 0, max: 12, troopEntries: troopEntries('SPR') }),
        troopOption({
          min: 0,
          max: 4,
          troopEntries: troopEntries('ARC'),
          dateRanges: [{ startDate: -2850, endDate: -2800 }],
        }),
      ],
    });

    const list = onlyBuilt(dated, [
      entry('spears', 4, 'SPR'),
      entry('archers', 4, 'ARC'),
    ]);

    expect(list.year).toBe(-2850);
    expect(list.pointsCovered).toBe(32);
  });

  it('ranks by points covered, then by the share that are matches', () => {
    const named = (id: string, description: string, max: number) =>
      army({
        id,
        troopOptions: [
          troopOption({
            min: 0,
            max,
            description,
            troopEntries: troopEntries('SPR'),
          }),
        ],
      });

    expect(
      built(
        [
          named('few', 'Hoplites', 2),
          named('stand-ins', 'Spearmen', 6),
          named('matches', 'Hoplites', 6),
        ],
        [entry('hoplites', 6, 'SPR', ['hoplite'])],
      ).map(({ army: id, pointsCovered, matchShare }) => ({
        id,
        pointsCovered,
        matchShare,
      })),
    ).toEqual([
      { id: 'matches', pointsCovered: 24, matchShare: 1 },
      { id: 'stand-ins', pointsCovered: 24, matchShare: 0 },
      { id: 'few', pointsCovered: 8, matchShare: 1 },
    ]);
  });
});

const pikeCollection = [
  entry('pike-blocks', 12, 'PIK', ['pike']),
  entry('lords', 2, 'ECV', ['lords']),
  entry('knights', 2, 'KNT', ['knights']),
  entry('runners', 3, 'SKM', ['runners']),
];

const fiftyEntryCollection = [
  entry('hoplites-a', 8, 'HFT', ['hoplite', 'greek']),
  entry('hoplites-b', 8, 'SPR', ['hoplite', 'greek']),
  entry('spartans', 4, 'EFT', ['spartan', 'hoplite']),
  entry('peltasts', 4, 'LFT', ['peltast', 'thracian']),
  entry('psiloi', 3, 'SKM', ['psiloi', 'slinger']),
  entry('greek-horse', 2, 'JCV', ['greek', 'horsemen']),
  entry('phalangites-a', 6, 'PIK', ['phalanx', 'macedonian']),
  entry('phalangites-b', 6, 'PIK', ['phalanx', 'macedonian']),
  entry('companions', 3, 'KNT', ['companion', 'xystophoroi']),
  entry('tarentines', 2, 'JCV', ['tarentine']),
  entry('elephants', 2, 'ELE', ['elephant']),
  entry('thureophoroi', 3, 'RDR', ['thureophoroi']),
  entry('cretans', 2, 'SKM', ['cretan']),
  entry('bolt-shooters', 1, 'ART', ['bolt']),
  entry('hastati', 6, 'HFT', ['hastati', 'legionaries']),
  entry('principes', 6, 'HFT', ['principes', 'legionaries']),
  entry('legionaries', 8, 'EFT', ['legionaries', 'roman']),
  entry('velites', 3, 'SKM', ['velites']),
  entry('equites', 2, 'JCV', ['roman', 'cavalry']),
  entry('auxilia', 4, 'LFT', ['auxilia']),
  entry('roman-archers', 2, 'ARC', ['archers']),
  entry('gallic-warriors-a', 6, 'WRR', ['gallic', 'warriors']),
  entry('gallic-warriors-b', 6, 'WBD', ['gallic', 'warriors']),
  entry('gallic-cavalry', 3, 'BAD', ['gallic', 'cavalry']),
  entry('chariots', 3, 'CHT', ['chariots']),
  entry('celtic-skirmishers', 3, 'SKM', ['skirmishers']),
  entry('knights-a', 4, 'KNT', ['knights']),
  entry('knights-b', 4, 'KNT', ['knights']),
  entry('men-at-arms', 4, 'EFT', ['men-at-arms']),
  entry('longbowmen-a', 6, 'ARC', ['longbowmen']),
  entry('longbowmen-b', 6, 'ARC', ['longbowmen']),
  entry('billmen', 4, 'HFT', ['billmen']),
  entry('crossbowmen', 4, 'PAV', ['crossbowmen']),
  entry('hobilars', 2, 'JCV', ['hobilars']),
  entry('welsh-spears', 4, 'LSP', ['welsh', 'spearmen']),
  entry('handgunners', 2, 'SKM', ['handgunners']),
  entry('bombards', 1, 'ART', ['artillery']),
  entry('horse-archers-a', 6, 'HBW', ['horse archers', 'mongol']),
  entry('horse-archers-b', 6, 'HBW', ['horse archers', 'mongol']),
  entry('mongol-lancers', 4, 'ECV', ['mongol', 'heavy cavalry']),
  entry('levy', 6, 'RBL', ['levy']),
  entry('peasants', 4, 'RBL', ['peasants']),
  entry('camelry', 2, 'BAD', ['camel']),
  entry('cataphracts', 3, 'CAT', ['cataphract']),
  entry('saracen-archers', 4, 'ARC', ['archers']),
  entry('javelinmen', 4, 'SKM', ['javelinmen']),
  entry('battle-wagons', 2, 'WWG', ['wagons']),
  entry('pavisiers', 3, 'PAV', ['pavise']),
  entry('raiders', 4, 'RDR', ['raiders']),
  entry('blades', 4, 'BLV', ['blade']),
];

describe('on the sample snapshot', () => {
  let lists: ArmyList[];

  beforeAll(async () => {
    lists = await sampleArmyLists();
  });

  const armyNamed = (name: string) => {
    const found = lists.find((list) => list.name === name);
    if (!found) {
      throw new Error(`no army named ${name}`);
    }
    return found;
  };

  it('ranks the pike armies above the armies without pikes for a pike collection', () => {
    const ranked = built(lists, pikeCollection).map(({ army: id }) => id);
    const rank = (name: string) => ranked.indexOf(armyNamed(name).id);
    const pikeArmies = ['Ember Principalities', 'Iron Crown Knights'].map(rank);
    const pikeless = [
      'Sylvan Courts',
      'Mammoth Clans',
      'Sunspire Dominion',
    ].map(rank);

    expect([...pikeArmies, ...pikeless]).not.toContain(-1);
    expect(Math.max(...pikeArmies)).toBeLessThan(Math.min(...pikeless));
  });

  it('builds every list from owned stands alone, and legally but for what the collection lacks', () => {
    const wrong = built(lists, fiftyEntryCollection).flatMap((list) => {
      const armyList = lists.find(({ id }) => id === list.army) as ArmyList;
      const { toBuy } = coverage(
        list.selection,
        armyList,
        fiftyEntryCollection,
        [],
      );
      const errors = validateArmy(armyList, list.selection, costs, names)
        .filter(({ severity }) => severity === 'error')
        .filter(
          (finding) =>
            finding.code !== 'troopOptionBelowMin' ||
            troopOptionStandCount(
              list.selection,
              finding.target.kind === 'troopOption'
                ? finding.target.option
                : ('' as TroopOptionId),
            ) > 0,
        )
        .map(({ code }) => code);
      return toBuy === 0 && errors.length === 0
        ? []
        : [`${armyList.key} ${armyList.name} · ${toBuy} to buy · ${errors}`];
    });

    expect(wrong).toEqual([]);
  });

  it('builds every complete army legally, at the cap, from owned stands alone', () => {
    const complete = buildableLists(
      lists,
      fiftyEntryCollection,
      costs,
      dataVersion,
      { pointsCap: 48 },
      { complete: true },
    );
    const wrong = complete.flatMap((list) => {
      const armyList = lists.find(({ id }) => id === list.army) as ArmyList;
      const { toBuy } = coverage(
        list.selection,
        armyList,
        fiftyEntryCollection,
        [],
      );
      const { total } = armyPoints(armyList, list.selection, costs);
      const legal = isLegal(
        validateArmy(armyList, list.selection, costs, names),
      );
      return toBuy === 0 && total === 48 && legal
        ? []
        : [`${armyList.key} ${armyList.name} · ${toBuy} to buy · ${total}`];
    });

    expect(complete.length).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});
