import type { BattleCardCode, TroopTypeCode } from '../../data/schema.ts';
import type { SubFactionGroup } from '../../data/sub-factions.ts';
import {
  type BattleCardCosts,
  boughtForTheWholeTroopEntry,
} from '../battle-cards/costs.ts';
import { triumphRules } from '../games/triumph-rules.ts';
import {
  type ArmyList,
  allyTroopOptionGroups,
  type BattleCardAllowance,
  type ContingentGroup,
  type DateRange,
  offeredContingentGroups,
  optionalContingentGroups,
  type TroopOption,
} from './army-list.ts';
import { type Gating, resolveArmyList } from './availability.ts';
import type { PointCosts } from './points.ts';
import {
  type ArmySelection,
  type StandRef,
  selectedContingents,
  troopOptionStandCount,
  withArmyBattleCard,
  withContingentGroup,
  withGeneral,
  withStands,
  withTroopBattleCard,
} from './selection.ts';
import type { ValidationRules } from './validation.ts';

export type GatingBucket = {
  variant: string | null;
  from: number;
  to: number;
};

export type ArmyFill =
  | { kind: 'filled'; selection: ArmySelection }
  | { kind: 'unfilled'; reason: 'noGeneralStand' }
  | { kind: 'unfilled'; reason: 'pointsCapUnreachable'; closest: number };

type Fill = {
  points: number;
  general: StandRef | null;
  apply: (selection: ArmySelection) => ArmySelection;
};

type Allocation = {
  points: number;
  general: StandRef | null;
  counts: ReadonlyMap<TroopTypeCode, number>;
};

const emptyFill: Fill = {
  points: 0,
  general: null,
  apply: (selection) => selection,
};

const emptyAllocation: Allocation = {
  points: 0,
  general: null,
  counts: new Map(),
};

export type Order = <T>(items: readonly T[]) => readonly T[];

const asGiven: Order = (items) => items;

export const shuffledBy =
  (random: () => number): Order =>
  <T>(items: readonly T[]) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [
        shuffled[swap] as T,
        shuffled[index] as T,
      ];
    }
    return shuffled;
  };

const ascending = (left: number, right: number) => left - right;

const descendingPoints = (left: Fill, right: Fill) =>
  right.points - left.points;

const reachKey = ({
  points,
  general,
}: {
  points: number;
  general: StandRef | null;
}) => `${points}:${general ? 'general' : 'any'}`;

const merged = (left: Fill, right: Fill): Fill => ({
  points: left.points + right.points,
  general: left.general ?? right.general,
  apply: (selection) => right.apply(left.apply(selection)),
});

const combined = (
  units: readonly (readonly Fill[])[],
  cap: number,
  order: Order,
): readonly Fill[] => {
  let reached = new Map<string, Fill>([[reachKey(emptyFill), emptyFill]]);
  for (const unit of units) {
    const next = new Map<string, Fill>();
    for (const left of order([...reached.values()])) {
      for (const right of order(unit)) {
        if (left.points + right.points > cap) {
          continue;
        }
        const fill = merged(left, right);
        const key = reachKey(fill);
        if (!next.has(key)) {
          next.set(key, fill);
        }
      }
    }
    reached = next;
    if (reached.size === 0) {
      break;
    }
  }
  return [...reached.values()];
};

const standTypeChoices = (
  option: TroopOption,
): readonly (readonly TroopTypeCode[])[] => {
  const troopTypes = option.troopEntries.map(({ troopType }) => troopType);
  return option.mix === 'singleType'
    ? troopTypes.map((troopType) => [troopType])
    : [troopTypes];
};

const generalStand = (
  option: TroopOption,
  troopType: TroopTypeCode,
  eligible: ReadonlySet<TroopTypeCode>,
): StandRef | null =>
  eligible.has(troopType) ? { option: option.id, troopType } : null;

const grown = (
  layer: ReadonlyMap<string, Allocation>,
  option: TroopOption,
  troopTypes: readonly TroopTypeCode[],
  costs: PointCosts,
  cap: number,
  eligible: ReadonlySet<TroopTypeCode>,
  order: Order,
) => {
  const next = new Map<string, Allocation>();
  for (const allocation of order([...layer.values()])) {
    for (const troopType of order(troopTypes)) {
      const points = allocation.points + costs.troopTypes[troopType];
      if (points > cap) {
        continue;
      }
      const counts = new Map(allocation.counts);
      counts.set(troopType, (counts.get(troopType) ?? 0) + 1);
      const grownAllocation: Allocation = {
        points,
        counts,
        general:
          allocation.general ?? generalStand(option, troopType, eligible),
      };
      const key = reachKey(grownAllocation);
      if (!next.has(key)) {
        next.set(key, grownAllocation);
      }
    }
  }
  return next;
};

const allocationsOf = (
  option: TroopOption,
  costs: PointCosts,
  cap: number,
  eligible: ReadonlySet<TroopTypeCode>,
  order: Order,
): readonly Allocation[] => {
  const found = new Map<string, Allocation>();
  for (const troopTypes of order(standTypeChoices(option))) {
    let layer = new Map<string, Allocation>([
      [reachKey(emptyAllocation), emptyAllocation],
    ]);
    for (let stands = 0; stands <= option.max && layer.size > 0; stands += 1) {
      if (stands >= option.min) {
        for (const allocation of layer.values()) {
          const key = reachKey(allocation);
          if (!found.has(key)) {
            found.set(key, allocation);
          }
        }
      }
      layer = grown(layer, option, troopTypes, costs, cap, eligible, order);
    }
  }
  return [...found.values()];
};

const troopOptionFills = (
  option: TroopOption,
  costs: PointCosts,
  cap: number,
  eligible: ReadonlySet<TroopTypeCode>,
  order: Order,
): readonly Fill[] =>
  allocationsOf(option, costs, cap, eligible, order).map(
    ({ points, general, counts }) => ({
      points,
      general,
      apply: (selection: ArmySelection) =>
        [...counts].reduce(
          (filled, [troopType, stands]) =>
            withStands(filled, option, troopType, stands),
          selection,
        ),
    }),
  );

const contingentGroupFills = (
  group: ContingentGroup,
  costs: PointCosts,
  cap: number,
  eligible: ReadonlySet<TroopTypeCode>,
  order: Order,
): readonly Fill[] =>
  combined(
    [
      ...new Map(
        group.contingents.map((contingent) => [contingent.id, contingent]),
      ).values(),
    ].flatMap((contingent) =>
      contingent.troopOptions.map((option) =>
        troopOptionFills(
          option,
          costs,
          cap,
          contingent.kind === 'allied' ? new Set() : eligible,
          order,
        ),
      ),
    ),
    cap,
    order,
  ).map((fill) => ({
    ...fill,
    apply: (selection: ArmySelection) =>
      fill.apply(withContingentGroup(selection, group)),
  }));

const standUnits = (
  resolved: ArmyList,
  costs: PointCosts,
  cap: number,
  eligible: ReadonlySet<TroopTypeCode>,
  order: Order,
): readonly (readonly Fill[])[] => {
  const allies = allyTroopOptionGroups(resolved);
  return [
    ...resolved.main.troopOptions.map((option) =>
      troopOptionFills(option, costs, cap, eligible, order),
    ),
    ...optionalContingentGroups(resolved).map((group) => [
      emptyFill,
      ...contingentGroupFills(group, costs, cap, eligible, order),
    ]),
    ...(allies.length > 0
      ? [
          [
            emptyFill,
            ...allies.flatMap((group) =>
              contingentGroupFills(group, costs, cap, eligible, order),
            ),
          ],
        ]
      : []),
  ];
};

const armyCardFills = (
  costs: BattleCardCosts,
  { code, max }: BattleCardAllowance,
  cap: number,
): readonly Fill[] => {
  const { rule } = costs[code];
  if (rule.kind !== 'flat' || rule.points === 0) {
    return [];
  }
  return Array.from({ length: max ?? 1 }, (_allowed, index) => index + 1)
    .map((copies) => ({
      points: rule.points * copies,
      general: null,
      apply: (selection: ArmySelection) =>
        withArmyBattleCard(selection, code, copies),
    }))
    .filter(({ points }) => points <= cap);
};

const troopCardFills = (
  costs: BattleCardCosts,
  option: TroopOption,
  { code, max }: BattleCardAllowance,
  stands: number,
): readonly Fill[] => {
  const { rule } = costs[code];
  const applicable = Math.min(stands, max ?? stands);
  const applied = (points: number, appliedStands: number): Fill => ({
    points,
    general: null,
    apply: (selection: ArmySelection) =>
      withTroopBattleCard(selection, option, code, appliedStands),
  });
  if (boughtForTheWholeTroopEntry(code)) {
    return rule.kind === 'perStand' && stands > 0
      ? [applied(rule.pointsPerStand * stands, 1)]
      : [];
  }
  if (rule.kind === 'flat' && rule.points > 0 && applicable >= 1) {
    return [applied(rule.points, 1)];
  }
  if (rule.kind === 'perStand') {
    return Array.from(
      { length: applicable },
      (_allowed, index) => index + 1,
    ).map((appliedStands) =>
      applied(rule.pointsPerStand * appliedStands, appliedStands),
    );
  }
  if (
    rule.kind === 'firstFreeThenFlat' &&
    rule.countedIn === 'stands' &&
    !rule.cumulative &&
    applicable >= 2
  ) {
    return [applied(rule.pointsAfterFirst, 2)];
  }
  return [];
};

const cardUnits = (
  resolved: ArmyList,
  selection: ArmySelection,
  costs: BattleCardCosts,
  cap: number,
): readonly (readonly Fill[])[] => {
  const priced = new Set<BattleCardCode>();
  const unit = (code: BattleCardCode, fills: readonly Fill[]) => {
    const sharedAcrossApplications = costs[code].purchasedPer === 'army';
    if (fills.length === 0 || (sharedAcrossApplications && priced.has(code))) {
      return [];
    }
    if (sharedAcrossApplications) {
      priced.add(code);
    }
    return [[emptyFill, ...fills.filter(({ points }) => points <= cap)]];
  };
  return [
    ...[
      ...new Map(
        resolved.battleCards.map((allowance) => [allowance.code, allowance]),
      ).values(),
    ].flatMap((allowance) =>
      unit(allowance.code, armyCardFills(costs, allowance, cap)),
    ),
    ...selectedContingents(resolved, selection).flatMap(({ troopOptions }) =>
      troopOptions.flatMap((option) => {
        const stands = troopOptionStandCount(selection, option.id);
        return stands === 0
          ? []
          : option.battleCards.flatMap((allowance) =>
              unit(
                allowance.code,
                troopCardFills(costs, option, allowance, stands),
              ),
            );
      }),
    ),
  ];
};

export const withCardsTo = (
  resolved: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  points: number,
): ArmySelection | null => {
  const topUp = combined(
    cardUnits(resolved, selection, costs.battleCards, points),
    points,
    asGiven,
  ).find((fill) => fill.points === points);
  return topUp ? topUp.apply(selection) : null;
};

export const fillToCap = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  rules: ValidationRules = triumphRules,
  order: Order = asGiven,
): ArmyFill => {
  const { pointsCap } = rules;
  const resolved = resolveArmyList(armyList, {
    year: selection.year,
    variant: selection.variant,
  });
  const eligible = new Set(armyList.generalTroopTypes);
  const fills = combined(
    standUnits(resolved, costs, pointsCap, eligible, order),
    pointsCap,
    order,
  );
  const led = fills
    .filter(({ general }) => general !== null)
    .sort(descendingPoints);
  if (led.length === 0) {
    return { kind: 'unfilled', reason: 'noGeneralStand' };
  }
  let closest = 0;
  for (const fill of led) {
    const stands = fill.apply(selection);
    const remaining = pointsCap - fill.points;
    const topUps = combined(
      cardUnits(resolved, stands, costs.battleCards, remaining),
      remaining,
      order,
    );
    for (const topUp of topUps) {
      if (topUp.points === remaining) {
        return {
          kind: 'filled',
          selection: withGeneral(topUp.apply(stands), fill.general),
        };
      }
      closest = Math.max(closest, fill.points + topUp.points);
    }
  }
  return { kind: 'unfilled', reason: 'pointsCapUnreachable', closest };
};

const dateRangeBoundaries = (dateRanges: readonly DateRange[]) =>
  dateRanges.flatMap(({ startDate, endDate }) => [startDate, endDate + 1]);

const subFactionBoundaries = (subFactions: SubFactionGroup | null) =>
  Object.values(subFactions?.rules ?? {}).flatMap((rule) =>
    'only' in rule
      ? rule.only.flatMap((clause) =>
          typeof clause === 'string'
            ? []
            : [
                ...(clause.from === undefined ? [] : [clause.from]),
                ...(clause.to === undefined ? [] : [clause.to + 1]),
              ],
        )
      : [],
  );

const boundaryYears = (armyList: ArmyList): readonly number[] => {
  const { startDate, endDate } = armyList.dateRange;
  const years = [
    startDate,
    ...dateRangeBoundaries(
      armyList.main.troopOptions.flatMap(({ dateRanges }) => dateRanges),
    ),
    ...armyList.contingentGroups.flatMap((group) => [
      ...dateRangeBoundaries(group.dateRange ? [group.dateRange] : []),
      ...group.contingents.flatMap(({ troopOptions }) =>
        dateRangeBoundaries(
          troopOptions.flatMap(({ dateRanges }) => dateRanges),
        ),
      ),
    ]),
    ...subFactionBoundaries(armyList.subFactions),
  ];
  return [
    ...new Set(years.filter((year) => year >= startDate && year <= endDate)),
  ].sort(ascending);
};

const availabilitySignature = (armyList: ArmyList, gating: Gating) => {
  const resolved = resolveArmyList(armyList, gating);
  return [
    resolved.main.troopOptions.map(({ id }) => id).join(','),
    ...offeredContingentGroups(resolved).map(
      ({ id, contingents }) =>
        `${id}(${contingents
          .map(({ troopOptions }) =>
            troopOptions.map((option) => option.id).join('+'),
          )
          .join('/')})`,
    ),
  ].join('|');
};

const variantBuckets = (
  armyList: ArmyList,
  variant: string | null,
  years: readonly number[],
): readonly GatingBucket[] => {
  const buckets: GatingBucket[] = [];
  let signature: string | null = null;
  years.forEach((from, index) => {
    const to =
      index + 1 < years.length
        ? (years[index + 1] as number) - 1
        : armyList.dateRange.endDate;
    const next = availabilitySignature(armyList, { year: from, variant });
    const current = buckets.at(-1);
    if (current && next === signature) {
      current.to = to;
      return;
    }
    signature = next;
    buckets.push({ variant, from, to });
  });
  return buckets;
};

export const gatingBuckets = (armyList: ArmyList): readonly GatingBucket[] => {
  const years = boundaryYears(armyList);
  const variants = armyList.subFactions
    ? armyList.subFactions.variants.map(({ id }) => id)
    : [null];
  return variants.flatMap((variant) =>
    variantBuckets(armyList, variant, years),
  );
};

export const randomFill = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  random: () => number,
  rules: ValidationRules = triumphRules,
): ArmyFill => fillToCap(armyList, selection, costs, rules, shuffledBy(random));
