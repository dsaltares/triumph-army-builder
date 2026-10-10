import type { TroopTypeCode } from '../../data/schema.ts';
import type {
  ArmyList,
  ContingentId,
  TroopOptionId,
} from '../army/army-list.ts';
import {
  type ArmySelection,
  selectedContingents,
  standCount,
} from '../army/selection.ts';
import { sum } from '../numbers.ts';
import { type TagMatcher, tagMatcher } from './description-words.ts';
import { type HeroKind, isHeroEntry } from './entry.ts';
import { minCostMaxFlow } from './min-cost-flow.ts';

export type CollectionEntryId = string;

export type PaintStatus = 'unpainted' | 'inProgress' | 'painted';

export type CollectionEntry = {
  id: CollectionEntryId;
  count: number;
  troopType: TroopTypeCode;
  tags: readonly string[];
  status: PaintStatus;
};

export type HeroCollectionEntry = Omit<CollectionEntry, 'troopType'> & HeroKind;

export type CoverableEntry = CollectionEntry | HeroCollectionEntry;

export type CollectionPin = {
  option: TroopOptionId;
  troopType: TroopTypeCode;
  entry: CollectionEntryId;
  count: number;
};

export type Fit = 'match' | 'standIn';

export type Allocation = {
  entry: CollectionEntryId;
  stands: number;
  fit: Fit;
  pinned: boolean;
  status: PaintStatus;
};

export type DemandCoverage = {
  contingent: ContingentId;
  option: TroopOptionId;
  troopType: TroopTypeCode;
  stands: number;
  allocations: readonly Allocation[];
  covered: number;
  toBuy: number;
  toPaint: number;
};

export type Coverage = {
  demands: readonly DemandCoverage[];
  stands: number;
  covered: number;
  toBuy: number;
  toPaint: number;
};

export type Fielding = TroopTypeCode | HeroKind;

export type DemandKey = string;

export type Demand = {
  key: DemandKey;
  fielding: Fielding;
  stands: number;
  description: string;
};

export type DemandPin = {
  demand: DemandKey;
  entry: CollectionEntryId;
  count: number;
};

export type DemandCover = {
  allocations: readonly Allocation[];
  covered: number;
  toBuy: number;
  toPaint: number;
};

export const fieldsAs = (entry: CoverableEntry, fielding: Fielding) =>
  typeof fielding === 'string'
    ? !isHeroEntry(entry) && entry.troopType === fielding
    : isHeroEntry(entry);

const isPinnedTo = (
  pins: readonly DemandPin[],
  entry: CoverableEntry,
  { key }: Demand,
) => pins.some((pin) => pin.entry === entry.id && pin.demand === key);

type FitOf = (entry: CoverableEntry, demand: Demand) => Fit;

const fitter = (
  entries: readonly CoverableEntry[],
  pins: readonly DemandPin[],
  tagged: TagMatcher,
): FitOf => {
  const indexOf = new Map(entries.map((entry, index) => [entry, index]));
  return (entry, demand) =>
    isPinnedTo(pins, entry, demand) ||
    tagged(demand.description)[indexOf.get(entry) ?? -1]
      ? 'match'
      : 'standIn';
};

const paintCost: Record<PaintStatus, number> = {
  painted: 0,
  inProgress: 1,
  unpainted: 2,
};

const worstPaintCost = Math.max(...Object.values(paintCost));

type Stock = {
  entry: CoverableEntry;
  left: number;
};

const counted = (value: number) => Math.max(0, Math.trunc(value));

const spend = (stock: Stock, need: Need<Demand>, stands: number) => {
  stock.left -= stands;
  need.left -= stands;
  need.spent.set(stock, (need.spent.get(stock) ?? 0) + stands);
};

const applyPins = (
  stocks: readonly Stock[],
  needs: readonly Need<Demand>[],
  pins: readonly DemandPin[],
) => {
  for (const pin of pins) {
    const stock = stocks.find(({ entry }) => entry.id === pin.entry);
    const need = needs.find(({ demand }) => demand.key === pin.demand);
    if (!stock || !need || !fieldsAs(stock.entry, need.demand.fielding)) {
      continue;
    }
    need.pinned.add(stock);
    spend(stock, need, Math.min(counted(pin.count), stock.left, need.left));
  }
};

const allocateTheRest = (
  stocks: readonly Stock[],
  needs: readonly Need<Demand>[],
  fitOf: FitOf,
) => {
  const standInCost =
    (worstPaintCost + 1) * (sum(needs.map(({ left }) => left)) + 1);
  const arcs = stocks.flatMap(({ entry }, supply) =>
    needs.flatMap(({ demand }, index) =>
      fieldsAs(entry, demand.fielding)
        ? [
            {
              supply,
              demand: index,
              cost:
                (fitOf(entry, demand) === 'match' ? 0 : standInCost) +
                paintCost[entry.status],
            },
          ]
        : [],
    ),
  );
  const flows = minCostMaxFlow({
    supplies: stocks.map(({ left }) => left),
    demands: needs.map(({ left }) => left),
    arcs,
  });
  flows.forEach((stands, index) => {
    const arc = arcs[index];
    const stock = arc && stocks[arc.supply];
    const need = arc && needs[arc.demand];
    if (stock && need && stands > 0) {
      spend(stock, need, stands);
    }
  });
};

type Need<D extends Demand> = {
  demand: D;
  left: number;
  spent: Map<Stock, number>;
  pinned: Set<Stock>;
};

const demandCover = <D extends Demand>(
  stocks: readonly Stock[],
  { demand, spent, pinned }: Need<D>,
  fitOf: FitOf,
): D & DemandCover => {
  const allocations = stocks.flatMap((stock) => {
    const stands = spent.get(stock) ?? 0;
    return stands > 0 || pinned.has(stock)
      ? [
          {
            entry: stock.entry.id,
            stands,
            fit: fitOf(stock.entry, demand),
            pinned: pinned.has(stock),
            status: stock.entry.status,
          },
        ]
      : [];
  });
  const covered = sum(allocations.map(({ stands }) => stands));
  return {
    ...demand,
    allocations,
    covered,
    toBuy: demand.stands - covered,
    toPaint: sum(
      allocations
        .filter(({ status }) => status !== 'painted')
        .map(({ stands }) => stands),
    ),
  };
};

export const coverDemands = <D extends Demand>(
  demands: readonly D[],
  entries: readonly CoverableEntry[],
  pins: readonly DemandPin[],
  tagged: TagMatcher = tagMatcher(entries.map(({ tags }) => tags)),
): readonly (D & DemandCover)[] => {
  const stocks = entries.map((entry) => ({
    entry,
    left: counted(entry.count),
  }));
  const needs = demands.map(
    (demand): Need<D> => ({
      demand,
      left: demand.stands,
      spent: new Map<Stock, number>(),
      pinned: new Set<Stock>(),
    }),
  );
  const fitOf = fitter(entries, pins, tagged);
  applyPins(stocks, needs, pins);
  allocateTheRest(stocks, needs, fitOf);
  return needs.map((need) => demandCover(stocks, need, fitOf));
};

type TriumphDemand = Demand & {
  contingent: ContingentId;
  option: TroopOptionId;
  troopType: TroopTypeCode;
};

const triumphDemandKey = (option: TroopOptionId, troopType: TroopTypeCode) =>
  `${option}|${troopType}`;

const triumphDemands = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly TriumphDemand[] =>
  selectedContingents(armyList, selection).flatMap((contingent) =>
    contingent.troopOptions.flatMap((troopOption) =>
      troopOption.troopEntries
        .map(({ troopType }) => ({
          key: triumphDemandKey(troopOption.id, troopType),
          fielding: troopType,
          description: troopOption.description,
          contingent: contingent.id,
          option: troopOption.id,
          troopType,
          stands: standCount(selection, troopOption.id, troopType),
        }))
        .filter(({ stands }) => stands > 0),
    ),
  );

const triumphPin = ({ option, troopType, entry, count }: CollectionPin) => ({
  demand: triumphDemandKey(option, troopType),
  entry,
  count,
});

export const coverageTotals = <
  Covered extends Pick<
    DemandCoverage,
    'stands' | 'covered' | 'toBuy' | 'toPaint'
  >,
>(
  demands: readonly Covered[],
) => {
  const total = (field: 'stands' | 'covered' | 'toBuy' | 'toPaint') =>
    sum(demands.map((demand) => demand[field]));
  return {
    stands: total('stands'),
    covered: total('covered'),
    toBuy: total('toBuy'),
    toPaint: total('toPaint'),
  };
};

export const coverage = (
  selection: ArmySelection,
  armyList: ArmyList,
  entries: readonly CollectionEntry[],
  pins: readonly CollectionPin[],
  tagged?: TagMatcher,
): Coverage => {
  const covered = coverDemands(
    triumphDemands(armyList, selection),
    entries,
    pins.map(triumphPin),
    tagged,
  ).map(({ key, fielding, description, ...demand }): DemandCoverage => demand);
  return { demands: covered, ...coverageTotals(covered) };
};
