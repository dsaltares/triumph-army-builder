import type { TroopTypeCode } from '../../data/schema.ts';
import type { ContingentId, TroopOptionId } from '../army/army-list.ts';
import type { ArmySheet, SheetStandLine } from '../army/sheet.ts';
import { sum } from '../numbers.ts';
import {
  type Allocation,
  type CollectionEntryId,
  type CoverableEntry,
  type Coverage,
  type DemandCover,
  type Fielding,
  type Fit,
  fieldsAs,
  type PaintStatus,
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

export type CoveragePinKey = {
  option: TroopOptionId;
  troopType: TroopTypeCode;
};

export type CoverageLine = {
  troopType: TroopTypeCode | null;
  name: string;
  stands: number;
  pointsPerStand: number;
  covered: number;
  toBuy: number;
  toPaint: number;
  sources: readonly CoverageSource[];
  candidates: readonly CoverageCandidate[];
  pin: CoveragePinKey | null;
};

export type CoverageOption = {
  id: string;
  description: string;
  lines: readonly CoverageLine[];
};

export type CoverageContingent = {
  id: ContingentId;
  name: string;
  options: readonly CoverageOption[];
};

export type CoverageSummary = {
  entries: number;
  points: number;
  coveredPoints: number;
  stands: number;
  covered: number;
  toBuy: number;
  toPaint: number;
};

export type ListCoverage = CoverageSummary & {
  contingents: readonly CoverageContingent[];
};

export type NamedEntry = CoverableEntry & { name: string };

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
  fielding: Fielding,
  sources: readonly CoverageSource[],
  entries: readonly NamedEntry[],
): readonly CoverageCandidate[] =>
  entries
    .filter(
      (entry) =>
        fieldsAs(entry, fielding) &&
        !sources.some((source) => source.entry === entry.id && source.pinned),
    )
    .map(({ id, name, count }) => ({ entry: id, name, count }));

export type LinedDemand = {
  fielding: Fielding;
  name: string;
  stands: number;
  pointsPerStand: number;
  description: string;
  pin: CoveragePinKey | null;
};

export const coverageLine = (
  { fielding, name, stands, pointsPerStand, description, pin }: LinedDemand,
  demand: DemandCover | undefined,
  entries: readonly NamedEntry[],
): CoverageLine => {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const sources = (demand?.allocations ?? []).map((allocation) =>
    coverageSource(allocation, description, byId),
  );
  return {
    troopType: typeof fielding === 'string' ? fielding : null,
    name,
    stands,
    pointsPerStand,
    covered: demand?.covered ?? 0,
    toBuy: demand?.toBuy ?? stands,
    toPaint: demand?.toPaint ?? 0,
    sources,
    candidates: pinCandidates(fielding, sources, entries),
    pin,
  };
};

export const coverageSummary = (
  lines: readonly CoverageLine[],
  entries: number,
): CoverageSummary => {
  const total = (field: 'stands' | 'covered' | 'toBuy' | 'toPaint') =>
    sum(lines.map((line) => line[field]));
  return {
    entries,
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

const demandKey = (option: TroopOptionId, troopType: TroopTypeCode) =>
  `${option}|${troopType}`;

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
  const contingents = sheet.contingents.map(({ id, name, options }) => ({
    id,
    name,
    options: options.map(({ id: option, description, lines }) => ({
      id: option,
      description,
      lines: lines.map(
        ({ troopType, name, stands, pointsPerStand }: SheetStandLine) =>
          coverageLine(
            {
              fielding: troopType,
              name,
              stands,
              pointsPerStand,
              description,
              pin: { option, troopType },
            },
            byDemand.get(demandKey(option, troopType)),
            entries,
          ),
      ),
    })),
  }));
  return {
    contingents,
    ...coverageSummary(
      contingents.flatMap(({ options }) =>
        options.flatMap(({ lines }) => lines),
      ),
      entries.length,
    ),
  };
};
