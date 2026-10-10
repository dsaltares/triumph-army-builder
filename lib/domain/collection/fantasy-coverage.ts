import type { Game } from '../../data/schema.ts';
import type { FantasySelection } from '../fantasy/selection-schema.ts';
import type { FantasySheet } from '../fantasy/sheet-data.ts';
import { coverDemands, type Demand, type DemandPin } from './coverage.ts';
import { belongsTo } from './entry.ts';
import {
  type CoverageOption,
  type CoverageSummary,
  coverageLine,
  coverageSummary,
  type LinedDemand,
  type NamedEntry,
} from './list-coverage.ts';
import { type TagWord, tagWords } from './tag-words.ts';

export type FantasyCoverage = CoverageSummary & {
  units: readonly CoverageOption[];
  heroes: readonly CoverageOption[];
};

export type FantasyCollected = NamedEntry & { games: readonly Game[] };

type FantasyDemand = Demand & LinedDemand & { id: string; shown: string };

const filled = (parts: readonly string[]) =>
  parts.filter((part) => part.trim() !== '');

const namedWithTags = (name: string, tags: readonly string[]) =>
  filled([name, ...tags]).join(', ');

export const fantasyUnitDemand = (unit: string) => `unit/${unit}`;

export const fantasyHeroDemand = (hero: string) => `hero/${hero}`;

const fantasyDemands = (
  selection: FantasySelection,
  sheet: FantasySheet,
): readonly FantasyDemand[] => [
  ...selection.units.map((unit, index) => {
    const line = sheet.units[index];
    return {
      key: fantasyUnitDemand(unit.id),
      id: unit.id,
      fielding: unit.troopType,
      name: line?.name ?? unit.name,
      stands: unit.stands,
      pointsPerStand: line?.pointsPerStand ?? 0,
      description: namedWithTags(unit.name, unit.tags),
      shown: filled([line?.troopTypeName ?? '', unit.tags.join(', ')]).join(
        ' · ',
      ),
      pin: null,
    };
  }),
  ...selection.heroes.map((hero, index) => ({
    key: fantasyHeroDemand(hero.id),
    id: hero.id,
    fielding: { kind: 'hero' as const },
    name: hero.name.trim(),
    stands: 1,
    pointsPerStand: sheet.heroes[index]?.points ?? 0,
    description: namedWithTags(hero.name, hero.tags),
    shown: hero.tags.join(', '),
    pin: null,
  })),
];

export const fantasyEntries = <Entry extends FantasyCollected>(
  collection: readonly Entry[],
) => collection.filter((entry) => belongsTo(entry, 'fantasy'));

export const fantasyCoverage = (
  selection: FantasySelection,
  sheet: FantasySheet,
  collection: readonly FantasyCollected[],
  pins: readonly DemandPin[] = [],
): FantasyCoverage => {
  const entries = fantasyEntries(collection);
  const covered = coverDemands(
    fantasyDemands(selection, sheet),
    entries,
    pins,
  ).map((demand) => ({
    id: demand.id,
    fielding: demand.fielding,
    description: demand.shown,
    lines: [coverageLine(demand, demand, entries)],
  }));
  const options = (hero: boolean) =>
    covered
      .filter(({ fielding }) => (typeof fielding !== 'string') === hero)
      .map(({ id, description, lines }) => ({ id, description, lines }));
  return {
    units: options(false),
    heroes: options(true),
    ...coverageSummary(
      covered.flatMap(({ lines }) => lines),
      collection.length,
    ),
  };
};

export const fantasyTagWords = ({
  units,
  heroes,
}: Pick<FantasySelection, 'units' | 'heroes'>): TagWord[] =>
  tagWords([
    ...units.map(({ name, troopType }) => ({
      description: name,
      troopTypes: [troopType],
    })),
    ...heroes.map(({ name }) => ({ description: name, troopTypes: [] })),
  ]);
