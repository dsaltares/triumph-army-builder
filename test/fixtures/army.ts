import type {
  AllyContingent,
  ArmyDetail,
  ArmyIndexEntry,
} from '@/lib/data/bundle.ts';
import type {
  MeshweshBattleCardEntry,
  MeshweshTroopOption,
  TroopTypeCode,
} from '@/lib/data/schema.ts';
import { buildArmyList } from '@/lib/domain/army/army-list.ts';
import {
  type ArmySelection,
  emptySelection,
  withStands,
} from '@/lib/domain/army/selection.ts';
import type {
  RelatedArmies,
  RelatedArmy,
} from '@/lib/domain/related-armies.ts';

export const troopOption = (
  overrides: Partial<MeshweshTroopOption> = {},
): MeshweshTroopOption => ({
  min: 2,
  max: 6,
  core: 'all',
  description: '',
  note: '',
  troopEntries: [{ troopTypeCode: 'SPR', dismountTypeCode: null, note: null }],
  dateRanges: [],
  battleCardEntries: [],
  ...overrides,
});

export const entries = (...troopTypeCodes: TroopTypeCode[]) =>
  troopTypeCodes.map((troopTypeCode) => ({
    troopTypeCode,
    dismountTypeCode: null,
    note: null,
  }));

export const battleCardEntry = (
  overrides: Partial<MeshweshBattleCardEntry> = {},
): MeshweshBattleCardEntry => ({
  battleCardCode: 'FC',
  min: null,
  max: null,
  note: null,
  ...overrides,
});

export const allyContingent = (
  overrides: Partial<AllyContingent> = {},
): AllyContingent => ({
  id: 'contingent-optional',
  name: 'Fixture Optional Contingent',
  internalContingent: true,
  dateRange: null,
  troopOptions: [troopOption({ min: 1, max: 2, troopEntries: entries('LFT') })],
  ...overrides,
});

export const armyDetail = (
  overrides: Partial<ArmyDetail> = {},
): ArmyDetail => ({
  id: 'army-1',
  key: '1a',
  name: 'Fixture Army',
  extendedName: 'Fixture Army 3000 to 2800 BC',
  startDate: -3000,
  endDate: -2800,
  showTroopOptionDescriptions: true,
  invasionRatings: [{ value: 2, note: null }],
  maneuverRatings: [{ value: 1, note: null }],
  homeTopographies: [{ values: ['Arable'], note: '' }],
  troopOptions: [
    troopOption({
      battleCardEntries: [
        battleCardEntry({ battleCardCode: 'HL', min: 0, max: 2 }),
      ],
    }),
    troopOption({
      min: 0,
      max: 4,
      core: '',
      note: 'only Kish',
      troopEntries: entries('ARC', 'BLV'),
      dateRanges: [{ startDate: -3000, endDate: -2900 }],
    }),
    troopOption({ min: 0, max: 2, core: 'half', troopEntries: entries('KNT') }),
  ],
  troopEntriesForGeneral: [
    { troopEntries: entries('SPR') },
    { troopEntries: entries('SPR', 'KNT') },
  ],
  battleCardEntries: [battleCardEntry()],
  allyOptions: [
    {
      allyEntries: [
        { allyArmyList: 'contingent-optional', name: 'Optional friends' },
      ],
      dateRange: null,
      note: null,
    },
    {
      allyEntries: [
        { allyArmyList: 'contingent-bundled', name: 'Bundled optional' },
        { allyArmyList: 'contingent-ally', name: 'Bundled ally' },
      ],
      dateRange: { startDate: -2950, endDate: -2800 },
      note: 'only Kish',
    },
  ],
  allyContingents: [
    allyContingent(),
    allyContingent({
      id: 'contingent-bundled',
      name: 'Fixture Bundled Contingent',
      troopOptions: [
        troopOption({ min: 1, max: 3, troopEntries: entries('WBD') }),
      ],
    }),
    allyContingent({
      id: 'contingent-ally',
      name: 'Fixture Allied Contingent',
      internalContingent: false,
      dateRange: { startDate: -2950, endDate: -2800 },
      troopOptions: [
        troopOption({ min: 2, max: 4, troopEntries: entries('HBW') }),
      ],
    }),
  ],
  enemies: [],
  subFactions: null,
  ...overrides,
});

export const contingentArmyDetail = (): ArmyDetail =>
  armyDetail({
    allyOptions: [
      {
        allyEntries: [
          { allyArmyList: 'contingent-optional', name: 'Optional friends' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-dated', name: 'Late arrivals' },
        ],
        dateRange: { startDate: -2900, endDate: -2800 },
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-hill', name: 'Hill levy' },
          { allyArmyList: 'contingent-river', name: 'River levy' },
        ],
        dateRange: null,
        note: 'taken together',
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Allied horse' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [{ allyArmyList: 'contingent-foot', name: 'Allied foot' }],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-north', name: 'Northern allies' },
          { allyArmyList: 'contingent-south', name: 'Southern allies' },
        ],
        dateRange: null,
        note: 'taken together',
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Allied horse' },
          { allyArmyList: 'contingent-foot', name: 'Allied foot' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-late-ally', name: 'Late allies' },
        ],
        dateRange: { startDate: -2900, endDate: -2800 },
        note: null,
      },
    ],
    allyContingents: [
      allyContingent(),
      allyContingent({
        id: 'contingent-dated',
        name: 'Fixture Late Contingent',
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('WBD') }),
        ],
      }),
      allyContingent({
        id: 'contingent-hill',
        name: 'Fixture Hill Contingent',
        troopOptions: [
          troopOption({ min: 0, max: 2, troopEntries: entries('RBL') }),
          troopOption({
            min: 1,
            max: 2,
            troopEntries: entries('ARC'),
            dateRanges: [{ startDate: -3000, endDate: -2900 }],
          }),
        ],
      }),
      allyContingent({
        id: 'contingent-river',
        name: 'Fixture River Contingent',
        troopOptions: [
          troopOption({ min: 1, max: 1, troopEntries: entries('HRD') }),
        ],
      }),
      allyContingent({
        id: 'contingent-ally',
        name: 'Fixture Allied Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 2, max: 4, troopEntries: entries('HBW') }),
        ],
      }),
      allyContingent({
        id: 'contingent-foot',
        name: 'Fixture Allied Foot Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 3, troopEntries: entries('SPR') }),
        ],
      }),
      allyContingent({
        id: 'contingent-north',
        name: 'Fixture Northern Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('ARC') }),
        ],
      }),
      allyContingent({
        id: 'contingent-south',
        name: 'Fixture Southern Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('LFT') }),
        ],
      }),
      allyContingent({
        id: 'contingent-late-ally',
        name: 'Fixture Late Allied Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('KNT') }),
        ],
      }),
    ],
  });

export const relatedArmy = (
  overrides: Partial<RelatedArmy> = {},
): RelatedArmy => ({
  id: 'army-2',
  key: '1b',
  name: 'Fixture Rival',
  startDate: -2900,
  endDate: -2700,
  ...overrides,
});

export const related = (
  overrides: Partial<RelatedArmies> = {},
): RelatedArmies => ({
  enemies: [relatedArmy()],
  sublists: [],
  facesItself: false,
  ...overrides,
});

export const armyIndexEntry = (
  overrides: Partial<ArmyIndexEntry> = {},
): ArmyIndexEntry => ({
  id: 'army-1',
  key: '1a',
  name: 'Fixture Army',
  extendedName: 'Fixture Army  3000 to 2800 BC',
  status: 'Revised',
  keywords: ['Sumerian'],
  startDate: -3000,
  endDate: -2800,
  invasion: [2],
  maneuver: [1],
  topographies: ['Arable'],
  categories: ['category-cradle'],
  ...overrides,
});

export const fixtureDataVersion = '2026-09-17.abcdef01';

export const fixtureSelection = ({
  dataVersion = fixtureDataVersion,
  stands = 4,
}: {
  dataVersion?: string;
  stands?: number;
} = {}): ArmySelection => {
  const list = buildArmyList(armyDetail());
  const spearmen = list.main.troopOptions[0];
  if (!spearmen) {
    throw new Error('the fixture army no longer has a first troop option');
  }
  return withStands(
    emptySelection({ army: list.id, dataVersion, year: -2900 }),
    spearmen,
    'SPR',
    stands,
  );
};

export const builderArmyDetail = (
  overrides: Partial<ArmyDetail> = {},
): ArmyDetail =>
  armyDetail({
    id: 'army-builder',
    key: '1b',
    name: 'Fixture Builder Army',
    extendedName: 'Fixture Builder Army 3000 to 2800 BC',
    subFactions: {
      army: 'Fixture Builder Army',
      label: 'Sub-faction',
      variants: [
        { id: 'kish', name: 'Kish' },
        { id: 'umma', name: 'Umma' },
        { id: 'apishal', name: 'Apishal' },
        { id: 'other', name: 'Other city-states' },
      ],
      rules: {
        'only Kish': { only: ['kish'] },
        'only Umma and Apishal': { only: ['umma', 'apishal'] },
        'not Umma and Apishal': { except: ['umma', 'apishal'] },
      },
    },
    troopOptions: [
      troopOption({
        min: 2,
        max: 5,
        core: 'all',
        description: 'Chariots with 2 crew',
        troopEntries: entries('CHT'),
        battleCardEntries: [
          battleCardEntry({ battleCardCode: 'SS', min: 0, max: null }),
        ],
      }),
      troopOption({
        min: 0,
        max: 2,
        core: '',
        description: 'Hill and marsh dwellers',
        troopEntries: entries('LFT', 'RBL'),
      }),
      troopOption({
        min: 0,
        max: 3,
        core: '',
        description: 'Seasonal raiders',
        troopEntries: entries('RDR'),
        dateRanges: [{ startDate: -2900, endDate: -2800 }],
      }),
      troopOption({
        min: 0,
        max: 4,
        core: 'half',
        description: 'Noble knights',
        note: 'only Kish',
        troopEntries: entries('KNT'),
        battleCardEntries: [
          battleCardEntry({ battleCardCode: 'SF', min: 0, max: null }),
          battleCardEntry({ battleCardCode: 'DD', min: 0, max: null }),
        ],
      }),
    ],
    troopEntriesForGeneral: [
      { troopEntries: entries('CHT') },
      { troopEntries: entries('KNT') },
    ],
    battleCardEntries: [battleCardEntry({ battleCardCode: 'FC' })],
    allyOptions: [
      {
        allyEntries: [
          { allyArmyList: 'contingent-optional', name: 'Optional friends' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-militia', name: 'Town militia' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-winter', name: 'Winter levy' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-dated', name: 'Late arrivals' },
        ],
        dateRange: { startDate: -2900, endDate: -2800 },
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-ally', name: 'Allied horse' },
        ],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [{ allyArmyList: 'contingent-foot', name: 'Allied foot' }],
        dateRange: null,
        note: null,
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-north', name: 'Northern allies' },
          { allyArmyList: 'contingent-south', name: 'Southern allies' },
        ],
        dateRange: null,
        note: 'taken together',
      },
      {
        allyEntries: [
          { allyArmyList: 'contingent-late-ally', name: 'Late allies' },
        ],
        dateRange: { startDate: -2900, endDate: -2800 },
        note: null,
      },
    ],
    allyContingents: [
      allyContingent(),
      allyContingent({
        id: 'contingent-militia',
        name: 'Fixture Militia Contingent',
        troopOptions: [
          troopOption({ min: 2, max: 4, troopEntries: entries('HRD') }),
        ],
      }),
      allyContingent({
        id: 'contingent-winter',
        name: 'Fixture Winter Contingent',
        troopOptions: [
          troopOption({
            min: 1,
            max: 2,
            troopEntries: entries('BLV'),
            dateRanges: [{ startDate: -2900, endDate: -2800 }],
          }),
        ],
      }),
      allyContingent({
        id: 'contingent-dated',
        name: 'Fixture Late Contingent',
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('WBD') }),
        ],
      }),
      allyContingent({
        id: 'contingent-ally',
        name: 'Fixture Allied Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 2, max: 4, troopEntries: entries('HBW') }),
        ],
      }),
      allyContingent({
        id: 'contingent-foot',
        name: 'Fixture Allied Foot Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 3, troopEntries: entries('SPR') }),
        ],
      }),
      allyContingent({
        id: 'contingent-north',
        name: 'Fixture Northern Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('ARC') }),
        ],
      }),
      allyContingent({
        id: 'contingent-south',
        name: 'Fixture Southern Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('LFT') }),
        ],
      }),
      allyContingent({
        id: 'contingent-late-ally',
        name: 'Fixture Late Allied Contingent',
        internalContingent: false,
        troopOptions: [
          troopOption({ min: 1, max: 2, troopEntries: entries('KNT') }),
        ],
      }),
    ],
    ...overrides,
  });

export const triumphList = <List extends { game: string }>(
  list: List,
): Extract<List, { game: 'triumph' }> => {
  if (list.game !== 'triumph') {
    throw new Error(`expected a Triumph! list, got a ${list.game} one`);
  }
  return list as Extract<List, { game: 'triumph' }>;
};
