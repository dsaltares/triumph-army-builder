import type { TroopTypeCode } from '../../data/schema.ts';
import {
  type ArmyList,
  allTroopOptions,
  allyTroopOptionGroups,
  type ContingentGroup,
  offeredContingentGroups,
  optionalContingentGroups,
  type TroopOption,
  type TroopOptionId,
} from '../army/army-list.ts';
import { resolveArmyList } from '../army/availability.ts';
import { gatingBuckets, withCardsTo } from '../army/feasibility.ts';
import { armyPoints, type PointCosts } from '../army/points.ts';
import {
  type ArmySelection,
  emptySelection,
  hasContingentGroup,
  type StandRef,
  withContingentGroup,
  withGeneral,
  withStands,
} from '../army/selection.ts';
import {
  isLegal,
  triumphRules,
  type ValidationRules,
  validateArmy,
} from '../army/validation.ts';
import { sum } from '../numbers.ts';
import { matchesAllTerms, searchTerms } from '../text-search.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import { type CollectionEntry, coverage } from './coverage.ts';
import { type TagMatcher, tagMatcher } from './description-words.ts';
import {
  addNode,
  connect,
  type FlowEdge,
  flowNetwork,
  flowThrough,
  minCostFlow,
} from './min-cost-flow.ts';

export type BuildableList = {
  army: string;
  name: string;
  year: number;
  variant: string | null;
  subFaction: string | null;
  selection: ArmySelection;
  pointsCovered: number;
  battleCardPoints: number;
  matched: number;
  standIns: number;
  matchShare: number;
};

type Package = {
  group: ContingentGroup | null;
  options: readonly TroopOption[];
  generalTypes: ReadonlySet<TroopTypeCode>;
};

type Stock = {
  count: number;
  troopType: TroopTypeCode;
  matches: ReadonlySet<TroopOptionId>;
};

type Gate = {
  troopType: TroopTypeCode;
  stock: Stock | null;
};

type Supply = {
  troopType: TroopTypeCode;
  stands: number;
  matched: number;
  general: boolean;
};

type Restrictions = {
  excluded: ReadonlySet<TroopOptionId>;
  onlyType: ReadonlyMap<TroopOptionId, TroopTypeCode>;
};

type Fill = {
  points: number;
  matched: number;
  general: StandRef | null;
  apply: (selection: ArmySelection) => ArmySelection;
};

type Draft = Fill & { stands: number };

type Candidate = {
  points: number;
  matched: number;
  selection: ArmySelection;
};

type Finish = (selection: ArmySelection) => ArmySelection | null;

const asIs: Finish = (selection) => selection;

const noGeneralTypes: ReadonlySet<TroopTypeCode> = new Set();

const noRestrictions: Restrictions = {
  excluded: new Set(),
  onlyType: new Map(),
};

const emptyFill: Fill = {
  points: 0,
  matched: 0,
  general: null,
  apply: (selection) => selection,
};

const counted = (value: number) => Math.max(0, Math.trunc(value));

const typesOf = (option: TroopOption, restrictions: Restrictions) => {
  const only = restrictions.onlyType.get(option.id);
  return option.troopEntries
    .map(({ troopType }) => troopType)
    .filter((troopType) => only === undefined || troopType === only);
};

const offeredOptions = (packages: readonly Package[]) => {
  const seen = new Set<TroopOptionId>();
  return packages.map((pack) => ({
    ...pack,
    options: pack.options.filter((option) => {
      if (seen.has(option.id)) {
        return false;
      }
      seen.add(option.id);
      return true;
    }),
  }));
};

const stocksFor = (
  entries: readonly CollectionEntry[],
  options: readonly TroopOption[],
  matcher: TagMatcher,
): readonly Stock[] => {
  const onOffer = new Set(
    options.flatMap(({ troopEntries }) =>
      troopEntries.map(({ troopType }) => troopType),
    ),
  );
  const matches = options.map((option) => matcher(option.description));
  const pooled = new Map<string, Stock>();
  entries.forEach((entry, index) => {
    const { troopType } = entry;
    const count = counted(entry.count);
    if (!onOffer.has(troopType) || count === 0) {
      return;
    }
    const matched = options
      .filter(
        (option, at) =>
          matches[at]?.[index] &&
          option.troopEntries.some(
            (offered) => offered.troopType === troopType,
          ),
      )
      .map(({ id }) => id);
    const key = `${troopType}|${matched.join()}`;
    const stock = pooled.get(key);
    pooled.set(key, {
      count: (stock?.count ?? 0) + count,
      troopType,
      matches: new Set(matched),
    });
  });
  return [...pooled.values()];
};

const allocated = (
  packages: readonly Package[],
  stocks: readonly Stock[],
  costs: PointCosts,
  restrictions: Restrictions,
  gate: Gate | null,
  { standIns, complete }: BuildableOptions,
): ReadonlyMap<TroopOptionId, readonly Supply[]> => {
  const totalStock = sum(stocks.map(({ count }) => count));
  const perPoint = totalStock + 1;
  const generalBonus =
    (totalStock * Math.max(...Object.values(costs.troopTypes)) + 1) * perPoint;
  const network = flowNetwork();
  const source = addNode(network);
  const sink = addNode(network);
  const gateIn = addNode(network);
  const gateOut = addNode(network);
  connect(network, gateIn, gateOut, 1, -generalBonus);
  const stockNodes = stocks.map((stock) => {
    const node = addNode(network);
    connect(network, source, node, stock.count, 0);
    if (
      gate &&
      stock.troopType === gate.troopType &&
      (gate.stock === null || gate.stock === stock)
    ) {
      connect(network, node, gateIn, Infinity, 0);
    }
    return node;
  });
  const edges = new Map<
    TroopOptionId,
    {
      troopType: TroopTypeCode;
      general: boolean;
      stands: FlowEdge;
      matched: FlowEdge[];
    }[]
  >();
  for (const { group, options, generalTypes } of packages) {
    for (const option of options) {
      if (restrictions.excluded.has(option.id)) {
        continue;
      }
      const optionNode = addNode(network);
      const minimum = complete && group === null ? option.min : 0;
      connect(network, optionNode, sink, minimum, -generalBonus);
      connect(network, optionNode, sink, option.max - minimum, 0);
      edges.set(
        option.id,
        typesOf(option, restrictions).flatMap((troopType) => {
          if (!stocks.some((stock) => stock.troopType === troopType)) {
            return [];
          }
          const demandNode = addNode(network);
          const general = generalTypes.has(troopType);
          if (
            general &&
            troopType === gate?.troopType &&
            (gate.stock === null || gate.stock.matches.has(option.id))
          ) {
            connect(network, gateOut, demandNode, 1, 0);
          }
          const matched = stocks.flatMap((stock, index) => {
            if (stock.troopType !== troopType) {
              return [];
            }
            const match = stock.matches.has(option.id);
            if (!(match || standIns)) {
              return [];
            }
            const edge = connect(
              network,
              stockNodes[index] as number,
              demandNode,
              Infinity,
              match ? -1 : 0,
            );
            return match ? [edge] : [];
          });
          return [
            {
              troopType,
              general,
              matched,
              stands: connect(
                network,
                demandNode,
                optionNode,
                Infinity,
                -costs.troopTypes[troopType] * perPoint,
              ),
            },
          ];
        }),
      );
    }
  }
  minCostFlow(network, source, sink);
  return new Map(
    [...edges].map(([option, demands]) => [
      option,
      demands.map(({ troopType, general, stands, matched }) => ({
        troopType,
        general,
        stands: flowThrough(stands),
        matched: sum(matched.map(flowThrough)),
      })),
    ]),
  );
};

const tightened = (
  packages: readonly Package[],
  supplies: ReadonlyMap<TroopOptionId, readonly Supply[]>,
  costs: PointCosts,
  restrictions: Restrictions,
): Restrictions | null => {
  const excluded = new Set(restrictions.excluded);
  const onlyType = new Map(restrictions.onlyType);
  for (const option of packages.flatMap(({ options }) => options)) {
    const flowing = (supplies.get(option.id) ?? []).filter(
      ({ stands }) => stands > 0,
    );
    const stands = sum(flowing.map((supply) => supply.stands));
    if (stands > 0 && stands < option.min) {
      excluded.add(option.id);
    } else if (option.mix === 'singleType' && flowing.length > 1) {
      const [kept] = flowing.toSorted(
        (left, right) =>
          right.stands * costs.troopTypes[right.troopType] -
          left.stands * costs.troopTypes[left.troopType],
      );
      if (kept) {
        onlyType.set(option.id, kept.troopType);
      }
    }
  }
  return excluded.size > restrictions.excluded.size ||
    onlyType.size > restrictions.onlyType.size
    ? { excluded, onlyType }
    : null;
};

type Score = Pick<Fill, 'points' | 'matched'>;

const outscores = (candidate: Score, rival: Score | null | undefined) =>
  !rival ||
  candidate.points > rival.points ||
  (candidate.points === rival.points && candidate.matched > rival.matched);

const slot = (points: number, general: StandRef | null) =>
  points * 2 + (general ? 1 : 0);

const present = <Item>(slots: readonly (Item | undefined)[]): Item[] =>
  slots.filter((item): item is Item => item !== undefined);

const optionFills = (
  option: TroopOption,
  supplies: readonly Supply[],
  costs: PointCosts,
  cap: number,
  mustFill: boolean,
): readonly Fill[] => {
  const pickSlot = ({ points, general, stands }: Draft) =>
    slot(points, general) * (option.min + 1) + Math.min(stands, option.min);
  let layer: readonly Draft[] = [{ ...emptyFill, stands: 0 }];
  for (const supply of supplies) {
    const next: (Draft | undefined)[] = [];
    for (const pick of layer) {
      for (let stands = 0; stands <= supply.stands; stands += 1) {
        const points =
          pick.points + stands * costs.troopTypes[supply.troopType];
        if (points > cap) {
          break;
        }
        const grown: Draft = {
          points,
          matched: pick.matched + Math.min(stands, supply.matched),
          stands: pick.stands + stands,
          general:
            pick.general ??
            (stands > 0 && supply.general
              ? { option: option.id, troopType: supply.troopType }
              : null),
          apply: pick.apply,
        };
        const at = pickSlot(grown);
        if (outscores(grown, next[at])) {
          next[at] =
            stands === 0
              ? grown
              : {
                  ...grown,
                  apply: (selection) =>
                    withStands(
                      pick.apply(selection),
                      option,
                      supply.troopType,
                      stands,
                    ),
                };
        }
      }
    }
    layer = present(next);
  }
  return layer.filter(({ stands }) =>
    stands === 0 ? !mustFill : stands >= option.min,
  );
};

type Knapsack = {
  units: readonly (readonly Fill[])[];
  matched: Float64Array;
  trail: readonly Int32Array[];
  width: number;
};

const unreached = -1;

const knapsack = (
  units: readonly (readonly Fill[])[],
  cap: number,
): Knapsack => {
  const width = (cap + 1) * 2;
  let matched = new Float64Array(width).fill(unreached);
  matched[0] = 0;
  const trail: Int32Array[] = [];
  for (const unit of units) {
    const next = new Float64Array(width).fill(unreached);
    const via = new Int32Array(width);
    for (let state = 0; state < width; state += 1) {
      const reached = matched[state] as number;
      if (reached === unreached) {
        continue;
      }
      const points = state >> 1;
      const led = state & 1;
      for (let index = 0; index < unit.length; index += 1) {
        const fill = unit[index] as Fill;
        const total = points + fill.points;
        if (total > cap) {
          continue;
        }
        const at = total * 2 + (fill.general ? 1 : led);
        const value = reached + fill.matched;
        if (value > (next[at] as number)) {
          next[at] = value;
          via[at] = index * width + state;
        }
      }
    }
    matched = next;
    trail.push(via);
  }
  return { units, matched, trail, width };
};

const fillAt = ({ units, trail, width }: Knapsack, state: number): Fill => {
  const picks: Fill[] = [];
  let at = state;
  for (let unit = units.length - 1; unit >= 0; unit -= 1) {
    const via = trail[unit]?.[at] ?? 0;
    const pick = units[unit]?.[Math.floor(via / width)];
    if (pick) {
      picks.unshift(pick);
    }
    at = via % width;
  }
  return picks.reduce(merged, emptyFill);
};

const reachedFills = (reach: Knapsack): readonly Fill[] =>
  [...reach.matched.keys()]
    .filter((state) => reach.matched[state] !== unreached)
    .map((state) => fillAt(reach, state));

function* ledFills(reach: Knapsack, cap: number): Generator<Fill> {
  for (let points = cap; points >= 0; points -= 1) {
    const state = points * 2 + 1;
    if (reach.matched[state] !== unreached) {
      yield fillAt(reach, state);
    }
  }
}

const inGroup =
  (group: ContingentGroup | null) =>
  (fill: Fill): Fill =>
    group
      ? {
          ...fill,
          apply: (selection) =>
            fill.apply(withContingentGroup(selection, group)),
        }
      : fill;

const packageUnits = (
  { group, options }: Package,
  supplies: ReadonlyMap<TroopOptionId, readonly Supply[]>,
  costs: PointCosts,
  cap: number,
  complete: boolean,
): readonly (readonly Fill[])[] => {
  const supplied = (option: TroopOption) =>
    (supplies.get(option.id) ?? []).some(({ stands }) => stands > 0);
  const mustFill = (option: TroopOption) => complete && option.min > 0;
  if (options.some((option) => mustFill(option) && !supplied(option))) {
    return group ? [[emptyFill]] : [[]];
  }
  const fills = options
    .filter(supplied)
    .map((option) =>
      optionFills(
        option,
        supplies.get(option.id) ?? [],
        costs,
        cap,
        mustFill(option),
      ),
    );
  return group
    ? [
        [
          emptyFill,
          ...reachedFills(knapsack(fills, cap))
            .filter(({ points }) => points > 0)
            .map(inGroup(group)),
        ],
      ]
    : fills;
};

const wholeFill = (
  packages: readonly Package[],
  supplies: ReadonlyMap<TroopOptionId, readonly Supply[]>,
  costs: PointCosts,
): Fill =>
  packages.reduce((whole, { group, options }) => {
    const taken = options.flatMap((option) =>
      (supplies.get(option.id) ?? [])
        .filter(({ stands }) => stands > 0)
        .map((supply) => ({ option, ...supply })),
    );
    if (taken.length === 0) {
      return whole;
    }
    const general = taken.find((supply) => supply.general);
    return merged(
      whole,
      inGroup(group)({
        points: sum(
          taken.map(
            ({ troopType, stands }) => stands * costs.troopTypes[troopType],
          ),
        ),
        matched: sum(taken.map(({ matched }) => matched)),
        general: general
          ? { option: general.option.id, troopType: general.troopType }
          : null,
        apply: (selection) =>
          taken.reduce(
            (filled, { option, troopType, stands }) =>
              withStands(filled, option, troopType, stands),
            selection,
          ),
      }),
    );
  }, emptyFill);

const merged = (left: Fill, right: Fill): Fill => ({
  points: left.points + right.points,
  matched: left.matched + right.matched,
  general: left.general ?? right.general,
  apply: (selection) => right.apply(left.apply(selection)),
});

const ledFillsOf = (
  packages: readonly Package[],
  supplies: ReadonlyMap<TroopOptionId, readonly Supply[]>,
  costs: PointCosts,
  cap: number,
  complete: boolean,
) =>
  ledFills(
    knapsack(
      packages.flatMap((pack) =>
        packageUnits(pack, supplies, costs, cap, complete),
      ),
      cap,
    ),
    cap,
  );

const candidateFills = (
  packages: readonly Package[],
  supplies: ReadonlyMap<TroopOptionId, readonly Supply[]>,
  costs: PointCosts,
  cap: number,
  complete: boolean,
): Iterable<Fill> => {
  if (complete) {
    return ledFillsOf(packages, supplies, costs, cap, complete);
  }
  const whole = wholeFill(packages, supplies, costs);
  if (whole.general && whole.points <= cap) {
    return [whole];
  }
  const [best] = ledFillsOf(packages, supplies, costs, cap, complete);
  return best ? [best] : [];
};

const solved = (
  packages: readonly Package[],
  stocks: readonly Stock[],
  costs: PointCosts,
  cap: number,
  selection: ArmySelection,
  gate: Gate | null,
  options: BuildableOptions,
  finish: Finish,
): Candidate | null => {
  const allocate = (restrictions: Restrictions) =>
    allocated(packages, stocks, costs, restrictions, gate, options);
  let restrictions = noRestrictions;
  let supplies = allocate(restrictions);
  for (
    let next = tightened(packages, supplies, costs, restrictions);
    next;
    next = tightened(packages, supplies, costs, restrictions)
  ) {
    restrictions = next;
    supplies = allocate(restrictions);
  }
  for (const led of candidateFills(
    packages,
    supplies,
    costs,
    cap,
    options.complete,
  )) {
    const finished = finish(withGeneral(led.apply(selection), led.general));
    if (finished) {
      return {
        points: led.points,
        matched: led.matched,
        selection: finished,
      };
    }
  }
  return null;
};

const groupOptions = (group: ContingentGroup) => ({
  options: group.contingents.flatMap(({ troopOptions }) => troopOptions),
});

const packagesOf = (
  resolved: ArmyList,
  ally: ContingentGroup | null,
): readonly Package[] => {
  const generalTypes = new Set(resolved.generalTroopTypes);
  const groupPackage = (group: ContingentGroup): Package => ({
    group,
    ...groupOptions(group),
    generalTypes: group.contingents.every(({ kind }) => kind === 'allied')
      ? noGeneralTypes
      : generalTypes,
  });
  return offeredOptions([
    { group: null, options: resolved.main.troopOptions, generalTypes },
    ...optionalContingentGroups(resolved).map(groupPackage),
    ...(ally ? [groupPackage(ally)] : []),
  ]);
};

const fieldable = (
  { options }: Pick<Package, 'options'>,
  owned: ReadonlySet<TroopTypeCode>,
) =>
  options.some(({ troopEntries }) =>
    troopEntries.some(({ troopType }) => owned.has(troopType)),
  );

const generalTypesOnOffer = (
  packages: readonly Package[],
  owned: ReadonlySet<TroopTypeCode>,
) =>
  new Set(
    packages.flatMap(({ options, generalTypes }) =>
      options.flatMap(({ troopEntries }) =>
        troopEntries
          .map(({ troopType }) => troopType)
          .filter(
            (troopType) => generalTypes.has(troopType) && owned.has(troopType),
          ),
      ),
    ),
  );

type Search = {
  entries: readonly CollectionEntry[];
  owned: ReadonlySet<TroopTypeCode>;
  matcher: TagMatcher;
  costs: PointCosts;
  cap: number;
  dataVersion: string;
  options: BuildableOptions;
};

const fieldableOffer = (
  resolved: ArmyList,
  owned: ReadonlySet<TroopTypeCode>,
): ReadonlySet<string> =>
  new Set(
    [
      { id: 'main', options: resolved.main.troopOptions },
      ...offeredContingentGroups(resolved).map((group) => ({
        id: group.id,
        ...groupOptions(group),
      })),
    ].flatMap(({ id, options }) =>
      options
        .filter((option) => fieldable({ options: [option] }, owned))
        .map((option) => `${id}/${option.id}`),
    ),
  );

const isWithin = (offer: ReadonlySet<string>, wider: ReadonlySet<string>) =>
  [...offer].every((key) => wider.has(key));

const gatesFor = (
  generalTypes: ReadonlySet<TroopTypeCode>,
  stocks: readonly Stock[],
  { standIns }: BuildableOptions,
): readonly Gate[] =>
  [...generalTypes].flatMap<Gate>((troopType) =>
    standIns
      ? [{ troopType, stock: null }]
      : stocks
          .filter((stock) => stock.troopType === troopType)
          .map((stock) => ({ troopType, stock })),
  );

const bestWith = (
  resolved: ArmyList,
  ally: ContingentGroup | null,
  selection: ArmySelection,
  stocks: readonly Stock[],
  { owned, costs, cap, options }: Search,
  finish: Finish,
): Candidate | null => {
  const packages = packagesOf(resolved, ally);
  const generalTypes = generalTypesOnOffer(packages, owned);
  if (generalTypes.size === 0) {
    return null;
  }
  const solve = (gate: Gate | null) =>
    solved(packages, stocks, costs, cap, selection, gate, options, finish);
  return (
    solve(null) ?? bestOf(gatesFor(generalTypes, stocks, options).map(solve))
  );
};

const bestOf = (candidates: readonly (Candidate | null)[]) =>
  candidates.reduce<Candidate | null>(
    (best, candidate) =>
      candidate && outscores(candidate, best) ? candidate : best,
    null,
  );

const bestInBucket = (
  resolved: ArmyList,
  selection: ArmySelection,
  stocks: readonly Stock[],
  search: Search,
  finish: Finish,
): Candidate | null => {
  const allies = allyTroopOptionGroups(resolved).filter((group) =>
    fieldable(groupOptions(group), search.owned),
  );
  const allied = allies.map((ally) => ({
    ally,
    candidate: bestWith(resolved, ally, selection, stocks, search, finish),
  }));
  const alliesAlwaysTaken =
    allied.length > 0 &&
    allied.every(
      ({ ally, candidate }) =>
        candidate && hasContingentGroup(candidate.selection, ally),
    );
  return bestOf([
    ...allied.map(({ candidate }) => candidate),
    ...(alliesAlwaysTaken
      ? []
      : [bestWith(resolved, null, selection, stocks, search, finish)]),
  ]);
};

const codesAsNames = (costs: PointCosts) =>
  Object.fromEntries(
    Object.keys(costs.troopTypes).map((code) => [code, code]),
  ) as TroopTypeNames;

const completed =
  (armyList: ArmyList, resolved: ArmyList, { costs, cap }: Search): Finish =>
  (selection) => {
    const { total } = armyPoints(armyList, selection, costs);
    const withCards = withCardsTo(resolved, selection, costs, cap - total);
    return withCards &&
      armyPoints(armyList, withCards, costs).total === cap &&
      isLegal(
        validateArmy(armyList, withCards, costs, codesAsNames(costs), {
          pointsCap: cap,
        }),
      )
      ? withCards
      : null;
  };

const bestForArmy = (armyList: ArmyList, search: Search) => {
  const stocks = stocksFor(
    search.entries,
    allTroopOptions(armyList),
    search.matcher,
  );
  const buckets = gatingBuckets(armyList)
    .map((bucket) => {
      const gating = { year: bucket.from, variant: bucket.variant };
      const resolved = resolveArmyList(armyList, gating);
      return {
        gating,
        resolved,
        offer: fieldableOffer(resolved, search.owned),
      };
    })
    .toSorted((left, right) => right.offer.size - left.offer.size);
  const solvedOffers: ReadonlySet<string>[] = [];
  let best: Candidate | null = null;
  for (const { gating, resolved, offer } of buckets) {
    if (solvedOffers.some((wider) => isWithin(offer, wider))) {
      continue;
    }
    solvedOffers.push(offer);
    const selection = emptySelection({
      army: armyList.id,
      dataVersion: search.dataVersion,
      ...gating,
    });
    const candidate = bestInBucket(
      resolved,
      selection,
      stocks,
      search,
      search.options.complete ? completed(armyList, resolved, search) : asIs,
    );
    if (candidate && outscores(candidate, best)) {
      best = candidate;
    }
  }
  return best;
};

const variantName = (armyList: ArmyList, variant: string | null) =>
  armyList.subFactions?.variants.find(({ id }) => id === variant)?.name ?? null;

const scored = (
  armyList: ArmyList,
  selection: ArmySelection,
  { entries, costs, matcher }: Search,
): BuildableList => {
  const { demands, covered } = coverage(
    selection,
    armyList,
    entries,
    [],
    matcher,
  );
  const { battleCardPoints } = armyPoints(armyList, selection, costs);
  const matched = sum(
    demands.flatMap(({ allocations }) =>
      allocations
        .filter(({ fit }) => fit === 'match')
        .map(({ stands }) => stands),
    ),
  );
  return {
    army: armyList.id,
    name: armyList.name,
    year: selection.year,
    variant: selection.variant,
    subFaction: variantName(armyList, selection.variant),
    selection,
    pointsCovered: sum(
      demands.map(
        ({ troopType, covered: stands }) =>
          stands * costs.troopTypes[troopType],
      ),
    ),
    battleCardPoints,
    matched,
    standIns: covered - matched,
    matchShare: covered === 0 ? 0 : matched / covered,
  };
};

const ranked = (left: BuildableList, right: BuildableList) =>
  right.pointsCovered - left.pointsCovered ||
  right.matchShare - left.matchShare;

export const buildableListLimit = 20;

export type BuildableOptions = {
  standIns: boolean;
  complete: boolean;
  search?: string;
};

export const withStandIns: BuildableOptions = {
  standIns: true,
  complete: false,
};

const namedLike = (
  armyLists: readonly ArmyList[],
  search: string,
): readonly ArmyList[] => {
  const terms = searchTerms(search);
  return terms.length === 0
    ? armyLists
    : armyLists.filter(({ name }) => matchesAllTerms([name], terms));
};

export const buildableLists = (
  armyLists: readonly ArmyList[],
  entries: readonly CollectionEntry[],
  costs: PointCosts,
  dataVersion: string,
  rules: ValidationRules = triumphRules,
  options: Partial<BuildableOptions> = withStandIns,
): readonly BuildableList[] => {
  const search: Search = {
    entries,
    owned: new Set(
      entries
        .filter(({ count }) => counted(count) > 0)
        .map(({ troopType }) => troopType),
    ),
    matcher: tagMatcher(entries.map(({ tags }) => tags)),
    costs,
    cap: rules.pointsCap,
    dataVersion,
    options: { ...withStandIns, ...options },
  };
  return namedLike(armyLists, options.search ?? '')
    .flatMap((armyList) => {
      const best = bestForArmy(armyList, search);
      return best ? [scored(armyList, best.selection, search)] : [];
    })
    .sort(ranked);
};
