import type { TroopTypeCode } from '../../data/schema.ts';
import type {
  ArmyList,
  ContingentId,
  TroopOption,
  TroopOptionId,
} from '../army/army-list.ts';
import {
  type ArmySelection,
  selectedContingents,
  standCount,
} from '../army/selection.ts';
import { sum } from '../numbers.ts';
import { type TagMatcher, tagMatcher } from './description-words.ts';
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

type Demand = {
  contingent: ContingentId;
  troopOption: TroopOption;
  troopType: TroopTypeCode;
  stands: number;
};

const demandsOf = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly Demand[] =>
  selectedContingents(armyList, selection).flatMap((contingent) =>
    contingent.troopOptions.flatMap((troopOption) =>
      troopOption.troopEntries
        .map(({ troopType }) => ({
          contingent: contingent.id,
          troopOption,
          troopType,
          stands: standCount(selection, troopOption.id, troopType),
        }))
        .filter(({ stands }) => stands > 0),
    ),
  );

const fieldsAs = (entry: CollectionEntry, { troopType }: Demand) =>
  entry.troopType === troopType;

const isPinnedTo = (
  pins: readonly CollectionPin[],
  entry: CollectionEntry,
  { troopOption, troopType }: Demand,
) =>
  pins.some(
    (pin) =>
      pin.entry === entry.id &&
      pin.option === troopOption.id &&
      pin.troopType === troopType,
  );

type FitOf = (entry: CollectionEntry, demand: Demand) => Fit;

const fitter = (
  entries: readonly CollectionEntry[],
  pins: readonly CollectionPin[],
  tagged: TagMatcher,
): FitOf => {
  const indexOf = new Map(entries.map((entry, index) => [entry, index]));
  return (entry, demand) =>
    isPinnedTo(pins, entry, demand) ||
    tagged(demand.troopOption.description)[indexOf.get(entry) ?? -1]
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
  entry: CollectionEntry;
  left: number;
};

type Need = {
  demand: Demand;
  left: number;
  spent: Map<Stock, number>;
  pinned: Set<Stock>;
};

const counted = (value: number) => Math.max(0, Math.trunc(value));

const spend = (stock: Stock, need: Need, stands: number) => {
  stock.left -= stands;
  need.left -= stands;
  need.spent.set(stock, (need.spent.get(stock) ?? 0) + stands);
};

const applyPins = (
  stocks: readonly Stock[],
  needs: readonly Need[],
  pins: readonly CollectionPin[],
) => {
  for (const pin of pins) {
    const stock = stocks.find(({ entry }) => entry.id === pin.entry);
    const need = needs.find(
      ({ demand }) =>
        demand.troopOption.id === pin.option &&
        demand.troopType === pin.troopType,
    );
    if (!stock || !need || !fieldsAs(stock.entry, need.demand)) {
      continue;
    }
    need.pinned.add(stock);
    spend(stock, need, Math.min(counted(pin.count), stock.left, need.left));
  }
};

const allocateTheRest = (
  stocks: readonly Stock[],
  needs: readonly Need[],
  fitOf: FitOf,
) => {
  const standInCost =
    (worstPaintCost + 1) * (sum(needs.map(({ left }) => left)) + 1);
  const arcs = stocks.flatMap(({ entry }, supply) =>
    needs.flatMap(({ demand }, index) =>
      fieldsAs(entry, demand)
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

const demandCoverage = (
  stocks: readonly Stock[],
  { demand, spent, pinned }: Need,
  fitOf: FitOf,
): DemandCoverage => {
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
    contingent: demand.contingent,
    option: demand.troopOption.id,
    troopType: demand.troopType,
    stands: demand.stands,
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

export const coverage = (
  selection: ArmySelection,
  armyList: ArmyList,
  entries: readonly CollectionEntry[],
  pins: readonly CollectionPin[],
  tagged: TagMatcher = tagMatcher(entries.map(({ tags }) => tags)),
): Coverage => {
  const stocks = entries.map((entry) => ({
    entry,
    left: counted(entry.count),
  }));
  const needs = demandsOf(armyList, selection).map((demand) => ({
    demand,
    left: demand.stands,
    spent: new Map<Stock, number>(),
    pinned: new Set<Stock>(),
  }));
  const fitOf = fitter(entries, pins, tagged);
  applyPins(stocks, needs, pins);
  allocateTheRest(stocks, needs, fitOf);
  const demands = needs.map((need) => demandCoverage(stocks, need, fitOf));
  const total = (field: 'stands' | 'covered' | 'toBuy' | 'toPaint') =>
    sum(demands.map((demand) => demand[field]));
  return {
    demands,
    stands: total('stands'),
    covered: total('covered'),
    toBuy: total('toBuy'),
    toPaint: total('toPaint'),
  };
};
