import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type JsonRecord = Record<string, unknown>;

const dateRange = { _id: 'd1', startDate: -3000, endDate: -2800 };

const troopEntry = {
  _id: 'e1',
  troopTypeCode: 'SPR',
  dismountTypeCode: null,
  note: null,
};

const troopOption = {
  _id: 'o1',
  min: 2,
  max: 6,
  core: 'all',
  description: 'Household spearmen',
  note: 'only Kish',
  troopEntries: [troopEntry],
  dateRanges: [dateRange],
  battleCardEntries: [],
};

export const rawArmyList = (overrides: JsonRecord = {}) => ({
  id: 'a1',
  listId: 1,
  sublistId: 'a',
  sortId: 1,
  name: 'Goblin Warrens ',
  status: 'Revised',
  keywords: ['Sumerian'],
  showTroopOptionDescriptions: true,
  derivedData: {
    extendedName: 'Goblin Warrens  3000 to 2800 BC',
    listStartDate: -3000,
    listEndDate: -2800,
  },
  dateRanges: [dateRange],
  invasionRatings: [{ _id: 'i1', value: 2, note: null }],
  maneuverRatings: [{ _id: 'm1', value: 1, note: 'Without Horde' }],
  homeTopographies: [{ _id: 'h1', values: [' Arable', 'Hilly '], note: '' }],
  troopOptions: [troopOption],
  troopEntriesForGeneral: [{ _id: 'g1', troopEntries: [troopEntry] }],
  allyOptions: [
    {
      _id: 'y1',
      allyEntries: [{ _id: 'y2', allyArmyList: 'c1', name: 'Sumerian allies' }],
      dateRange: null,
      note: null,
    },
  ],
  battleCardEntries: [{ _id: 'b1', battleCardCode: 'FC', note: null }],
  ...overrides,
});

export const rawAllyArmyList = (overrides: JsonRecord = {}) => ({
  id: 'c1',
  armyListId: 'a1',
  listId: 1,
  sublistId: 'a',
  name: 'Goblin Warrens',
  internalContingent: false,
  dateRange,
  troopOptions: [troopOption],
  ...overrides,
});

export const rawBattleCard = (overrides: JsonRecord = {}) => ({
  id: 'b1',
  permanentCode: 'FC',
  importName: 'Fortified Camp',
  listName: 'Fortified Camp',
  displayName: 'Fortified Camp',
  category: 'army',
  showInList: true,
  mdText: '#### Cost\n1 point\n',
  htmlText: '<h4>Cost</h4>\n<p>1 point</p>\n',
  ...overrides,
});

export const rawTroopType = (overrides: JsonRecord = {}) => ({
  id: 't1',
  permanentCode: 'SPR',
  importName: 'Spear',
  displayName: 'Spear',
  displayCode: 'Sp',
  description: 'Close-fighting infantry with long spears.',
  category: 'foot',
  order: 'Close',
  cost: 4,
  combatFactors: {
    closeCombat: { vsFoot: 4, vsMounted: 4 },
    rangedCombat: { shooting: 0, shotAt: 3 },
  },
  ...overrides,
});

export const rawThematicCategory = (overrides: JsonRecord = {}) => ({
  id: 'k1',
  name: 'Cradle of Civilization',
  ...overrides,
});

export const snapshotFixtureFiles = (): Record<string, unknown> => ({
  'armyLists.json': [rawArmyList()],
  'allyArmyLists.json': [rawAllyArmyList()],
  'battleCards.json': [rawBattleCard()],
  'troopTypes.json': [rawTroopType()],
  'thematicCategories.json': [rawThematicCategory()],
  'enemyArmyLists.json': { a1: [] },
  'thematicCategoryArmyLists.json': { k1: ['a1'] },
  'manifest.json': {
    source: 'https://meshwesh.wgcwar.com/api/v1',
    fetchedAt: '2026-09-17T00:00:00.000Z',
    dataVersion: '2026-09-17.abcdef01',
    contentHash: 'abcdef0123456789',
    files: [
      'allyArmyLists.json',
      'armyLists.json',
      'battleCards.json',
      'enemyArmyLists.json',
      'thematicCategories.json',
      'thematicCategoryArmyLists.json',
      'troopTypes.json',
    ].map((name) => ({ name, records: 1, bytes: 1, sha256: 'fixture' })),
  },
});

export const writeSnapshotFixture = async (
  files: Record<string, unknown> = snapshotFixtureFiles(),
) => {
  const directory = await mkdtemp(join(tmpdir(), 'meshwesh-fixture-'));
  for (const [name, contents] of Object.entries(files)) {
    await writeFile(join(directory, name), JSON.stringify(contents, null, 2));
  }
  return directory;
};
