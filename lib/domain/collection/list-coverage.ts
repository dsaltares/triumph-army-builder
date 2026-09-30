import type { TroopTypeCode } from '../../data/schema.ts';
import type { ContingentId, TroopOptionId } from '../army/army-list.ts';
import type { ArmySheet, SheetStandLine } from '../army/sheet.ts';
import { sum } from '../numbers.ts';
import type {
  Allocation,
  CollectionEntry,
  CollectionEntryId,
  Coverage,
  DemandCoverage,
  Fit,
  PaintStatus,
} from './coverage.ts';
import { tagSuggestions } from './description-words.ts';

export type CoverageSource = {
  entry: CollectionEntryId;
  name: string;
  stands: number;
  fit: Fit;
  pinned: boolean;
  status: PaintStatus;
  tags: readonly string[];
  suggestedTags: readonly string[];
};

export type CoverageCandidate = {
  entry: CollectionEntryId;
  name: string;
  count: number;
};

export type CoverageLine = {
  troopType: TroopTypeCode;
  name: string;
  stands: number;
  pointsPerStand: number;
  covered: number;
  toBuy: number;
  toPaint: number;
  sources: readonly CoverageSource[];
  candidates: readonly CoverageCandidate[];
};

export type CoverageOption = {
  id: TroopOptionId;
  description: string;
  lines: readonly CoverageLine[];
};

export type CoverageContingent = {
  id: ContingentId;
  name: string;
  options: readonly CoverageOption[];
};

export type ListCoverage = {
  contingents: readonly CoverageContingent[];
  entries: number;
  points: number;
  coveredPoints: number;
  stands: number;
  covered: number;
  toBuy: number;
  toPaint: number;
};

type NamedEntry = Pick<
  CollectionEntry,
  'id' | 'count' | 'troopType' | 'tags'
> & {
  name: string;
};

const demandKey = (option: TroopOptionId, troopType: TroopTypeCode) =>
  `${option}|${troopType}`;

const coverageSource = (
  { entry, stands, fit, pinned, status }: Allocation,
  description: string,
  byId: ReadonlyMap<CollectionEntryId, NamedEntry>,
): CoverageSource => {
  const tags = byId.get(entry)?.tags ?? [];
  return {
    entry,
    name: byId.get(entry)?.name ?? '',
    stands,
    fit,
    pinned,
    status,
    tags,
    suggestedTags: fit === 'standIn' ? tagSuggestions(description, tags) : [],
  };
};

const pinCandidates = (
  troopType: TroopTypeCode,
  sources: readonly CoverageSource[],
  entries: readonly NamedEntry[],
): readonly CoverageCandidate[] =>
  entries
    .filter(
      ({ id, troopType: fieldsAs }) =>
        fieldsAs === troopType &&
        !sources.some((source) => source.entry === id && source.pinned),
    )
    .map(({ id, name, count }) => ({ entry: id, name, count }));

const coverageLine = (
  { troopType, name, stands, pointsPerStand }: SheetStandLine,
  description: string,
  demand: DemandCoverage | undefined,
  entries: readonly NamedEntry[],
  byId: ReadonlyMap<CollectionEntryId, NamedEntry>,
): CoverageLine => {
  const sources = (demand?.allocations ?? []).map((allocation) =>
    coverageSource(allocation, description, byId),
  );
  return {
    troopType,
    name,
    stands,
    pointsPerStand,
    covered: demand?.covered ?? 0,
    toBuy: demand?.toBuy ?? stands,
    toPaint: demand?.toPaint ?? 0,
    sources,
    candidates: pinCandidates(troopType, sources, entries),
  };
};

export const listCoverage = (
  sheet: ArmySheet,
  { demands }: Coverage,
  entries: readonly NamedEntry[],
): ListCoverage => {
  const byDemand = new Map(
    demands.map((demand) => [
      demandKey(demand.option, demand.troopType),
      demand,
    ]),
  );
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const contingents = sheet.contingents.map(({ id, name, options }) => ({
    id,
    name,
    options: options.map(({ id: option, description, lines }) => ({
      id: option,
      description,
      lines: lines.map((line) =>
        coverageLine(
          line,
          description,
          byDemand.get(demandKey(option, line.troopType)),
          entries,
          byId,
        ),
      ),
    })),
  }));
  const lines = contingents.flatMap(({ options }) =>
    options.flatMap(({ lines }) => lines),
  );
  const total = (field: 'stands' | 'covered' | 'toBuy' | 'toPaint') =>
    sum(lines.map((line) => line[field]));
  return {
    contingents,
    entries: entries.length,
    points: sum(
      lines.map(({ stands, pointsPerStand }) => stands * pointsPerStand),
    ),
    coveredPoints: sum(
      lines.map(({ covered, pointsPerStand }) => covered * pointsPerStand),
    ),
    stands: total('stands'),
    covered: total('covered'),
    toBuy: total('toBuy'),
    toPaint: total('toPaint'),
  };
};
