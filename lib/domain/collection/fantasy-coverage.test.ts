import { beforeAll, describe, expect, it } from 'vitest';
import type { Game, TroopTypeCode } from '@/lib/data/schema.ts';
import {
  fantasyHero,
  fantasySelection,
  fantasyUnit,
} from '@/test/fixtures/fantasy.ts';
import { sampleFantasyReference } from '@/test/sample.ts';
import type { FantasyReference } from '../fantasy/reference.ts';
import type { FantasySelection } from '../fantasy/selection-schema.ts';
import { fantasySheet } from '../fantasy/sheet-data.ts';
import type { DemandPin } from './coverage.ts';
import {
  type FantasyCollected,
  fantasyCoverage,
  fantasyHeroDemand,
  fantasyTagWords,
  fantasyUnitDemand,
} from './fantasy-coverage.ts';

let reference: FantasyReference;

beforeAll(async () => {
  reference = await sampleFantasyReference();
});

const stands = (
  id: string,
  count: number,
  troopType: TroopTypeCode,
  overrides: Partial<{
    tags: string[];
    games: Game[];
    status: FantasyCollected['status'];
  }> = {},
): FantasyCollected => ({
  id,
  name: id,
  count,
  troopType,
  tags: [],
  games: ['fantasy'],
  status: 'painted',
  ...overrides,
});

const hero = (
  id: string,
  overrides: Partial<{ tags: string[]; count: number }> = {},
): FantasyCollected => ({
  id,
  name: id,
  kind: 'hero',
  count: 1,
  tags: [],
  games: ['fantasy'],
  status: 'painted',
  ...overrides,
});

const covering = (
  selection: FantasySelection,
  entries: readonly FantasyCollected[],
  pins: readonly DemandPin[] = [],
) =>
  fantasyCoverage(
    selection,
    fantasySheet({ name: 'Goblin raid', selection }, reference),
    entries,
    pins,
  );

const raid = fantasySelection({
  units: [
    fantasyUnit('wargs', 'JCV', {
      name: 'Warg riders',
      tags: ['wolf'],
      stands: 3,
    }),
    fantasyUnit('boars', 'JCV', { name: 'Boar riders', stands: 2 }),
  ],
  heroes: [fantasyHero('shaman', { name: 'Goblin shaman', tags: ['staff'] })],
});

const sourcesOf = (
  result: ReturnType<typeof covering>,
  group: 'units' | 'heroes',
  id: string,
) =>
  result[group]
    .find((option) => option.id === id)
    ?.lines.flatMap(({ sources }) =>
      sources.map(({ entry, stands, fit }) => ({ entry, stands, fit })),
    );

describe('fantasyCoverage', () => {
  it('raises one demand per unit and one per hero', () => {
    const result = covering(raid, []);

    expect(
      result.units.map(({ id, lines }) =>
        lines.map(({ troopType, name, stands }) => ({
          id,
          troopType,
          name,
          stands,
        })),
      ),
    ).toEqual([
      [{ id: 'wargs', troopType: 'JCV', name: 'Warg riders', stands: 3 }],
      [{ id: 'boars', troopType: 'JCV', name: 'Boar riders', stands: 2 }],
    ]);
    expect(
      result.heroes.map(({ id, lines }) =>
        lines.map(({ troopType, name, stands }) => ({
          id,
          troopType,
          name,
          stands,
        })),
      ),
    ).toEqual([
      [{ id: 'shaman', troopType: null, name: 'Goblin shaman', stands: 1 }],
    ]);
    expect(result).toMatchObject({ stands: 6, covered: 0, toBuy: 6 });
  });

  it('allocates two units of one troop type by name and tags before troop type alone', () => {
    const result = covering(raid, [
      stands('boar-pack', 2, 'JCV', { tags: ['boar'] }),
      stands('wolf-pack', 3, 'JCV', { tags: ['wolf'] }),
      stands('spare-cavalry', 3, 'JCV'),
    ]);

    expect(sourcesOf(result, 'units', 'wargs')).toEqual([
      { entry: 'wolf-pack', stands: 3, fit: 'match' },
    ]);
    expect(sourcesOf(result, 'units', 'boars')).toEqual([
      { entry: 'boar-pack', stands: 2, fit: 'match' },
    ]);
  });

  it('matches a tag against the unit name as well as its tags', () => {
    const result = covering(raid, [
      stands('riders', 3, 'JCV', { tags: ['warg riders'] }),
    ]);

    expect(sourcesOf(result, 'units', 'wargs')).toEqual([
      { entry: 'riders', stands: 3, fit: 'match' },
    ]);
  });

  it('falls back to a stand-in of the troop type when no tag matches', () => {
    const result = covering(raid, [stands('cavalry', 5, 'JCV')]);

    expect(result).toMatchObject({ covered: 5, toBuy: 1 });
    expect(sourcesOf(result, 'units', 'wargs')).toEqual([
      { entry: 'cavalry', stands: 3, fit: 'standIn' },
    ]);
  });

  it('suggests a stand-in tags from the unit name', () => {
    const result = covering(raid, [stands('cavalry', 3, 'JCV')]);
    const [source] = result.units[0]?.lines[0]?.sources ?? [];

    expect(source?.suggestedTags).toEqual(['warg', 'riders', 'wolf']);
  });

  it('covers a hero only with a hero entry', () => {
    const shamanOnly = fantasySelection({
      heroes: [fantasyHero('shaman', { name: 'Goblin shaman' })],
    });

    expect(
      covering(shamanOnly, [stands('shaman-stand', 4, 'JCV')]),
    ).toMatchObject({ covered: 0, toBuy: 1 });
    expect(
      sourcesOf(
        covering(shamanOnly, [stands('cavalry', 4, 'JCV'), hero('wizard')]),
        'heroes',
        'shaman',
      ),
    ).toEqual([{ entry: 'wizard', stands: 1, fit: 'standIn' }]);
  });

  it('never covers a unit with a hero entry', () => {
    const result = covering(raid, [hero('wolf', { tags: ['wolf'], count: 3 })]);

    expect(
      result.units.flatMap(({ lines }) => lines.map(({ covered }) => covered)),
    ).toEqual([0, 0]);
    expect(result.covered).toBe(1);
  });

  it('prefers the hero entry whose tags appear in the hero name or tags', () => {
    const result = covering(raid, [
      hero('knight', { tags: ['knight'] }),
      hero('staff-bearer', { tags: ['staff'] }),
    ]);

    expect(sourcesOf(result, 'heroes', 'shaman')).toEqual([
      { entry: 'staff-bearer', stands: 1, fit: 'match' },
    ]);
  });

  it('offers only hero entries to pin to a hero', () => {
    const result = covering(raid, [
      stands('cavalry', 3, 'JCV'),
      hero('wizard'),
      hero('knight'),
    ]);

    expect(result.heroes[0]?.lines[0]?.candidates).toEqual([
      { entry: 'wizard', name: 'wizard', count: 1 },
      { entry: 'knight', name: 'knight', count: 1 },
    ]);
    expect(result.units[0]?.lines[0]?.candidates).toEqual([
      { entry: 'cavalry', name: 'cavalry', count: 3 },
    ]);
  });

  it('fixes a pinned entry first, unit or hero', () => {
    const result = covering(
      raid,
      [
        stands('wolf-pack', 3, 'JCV', { tags: ['wolf'] }),
        stands('unpainted-pack', 3, 'JCV', { status: 'unpainted' }),
        hero('staff-bearer', { tags: ['staff'] }),
        hero('knight'),
      ],
      [
        {
          demand: fantasyUnitDemand('wargs'),
          entry: 'unpainted-pack',
          count: 3,
        },
        { demand: fantasyHeroDemand('shaman'), entry: 'knight', count: 1 },
      ],
    );

    expect(sourcesOf(result, 'units', 'wargs')).toEqual([
      { entry: 'unpainted-pack', stands: 3, fit: 'match' },
    ]);
    expect(sourcesOf(result, 'heroes', 'shaman')).toEqual([
      { entry: 'knight', stands: 1, fit: 'match' },
    ]);
    expect(result.toPaint).toBe(3);
  });

  it('reads only the entries kept for Fantasy Triumph, but counts the whole collection', () => {
    const result = covering(raid, [
      stands('triumph-cavalry', 5, 'JCV', { games: ['triumph'] }),
      stands('shared-cavalry', 2, 'JCV', { games: ['triumph', 'fantasy'] }),
    ]);

    expect(result).toMatchObject({ entries: 2, covered: 2 });
  });

  it('counts the points of the stands and heroes it covers', () => {
    const sheet = fantasySheet(
      { name: 'Goblin raid', selection: raid },
      reference,
    );
    const perStand = sheet.units[0]?.pointsPerStand ?? 0;
    const heroPoints = sheet.heroes[0]?.points ?? 0;
    const result = covering(raid, [
      stands('wolf-pack', 3, 'JCV', { tags: ['wolf'] }),
      hero('staff-bearer'),
    ]);

    expect(result.points).toBe(5 * perStand + heroPoints);
    expect(result.coveredPoints).toBe(3 * perStand + heroPoints);
  });

  it('shows the troop type and tags under a unit, and the tags under a hero', () => {
    const result = covering(raid, []);

    expect(result.units[0]?.description).toBe('Javelin Cavalry · wolf');
    expect(result.heroes[0]?.description).toBe('staff');
  });
});

describe('fantasyTagWords', () => {
  it('offers the words of the list’s unit and hero names, with the troop types they field as', () => {
    expect(
      fantasyTagWords({
        units: [
          fantasyUnit('wargs', 'JCV', { name: 'Goblin wolf riders' }),
          fantasyUnit('archers', 'ARC', { name: 'Goblin archers' }),
        ],
        heroes: [fantasyHero('shaman', { name: 'Goblin shaman' })],
      }),
    ).toEqual([
      { word: 'goblin', troopTypes: ['ARC', 'JCV'], options: 3 },
      { word: 'archers', troopTypes: ['ARC'], options: 1 },
      { word: 'riders', troopTypes: ['JCV'], options: 1 },
      { word: 'shaman', troopTypes: [], options: 1 },
      { word: 'wolf', troopTypes: ['JCV'], options: 1 },
    ]);
  });
});
