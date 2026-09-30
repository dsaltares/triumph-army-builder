import type { BattleCardCode, TroopTypeCode } from '../../data/schema.ts';
import {
  adjustStandCost,
  type BattleCardCostRule,
  costRulePoints,
  type StandCostEffect,
} from '../battle-cards/cost-rules.ts';
import {
  type BattleCardCosts,
  battleCardCosts,
  boughtForTheWholeTroopEntry,
  type PricedBattleCard,
  wholeTroopEntryCardsPerArmy,
} from '../battle-cards/costs.ts';
import { sum } from '../numbers.ts';
import { byKey } from '../ordering.ts';
import {
  type TroopTypeCost,
  type TroopTypeCosts,
  troopTypeCosts,
} from '../troop-types.ts';
import type {
  ArmyList,
  Contingent,
  ContingentId,
  TroopOptionId,
} from './army-list.ts';
import {
  type ArmySelection,
  selectedContingents,
  standCount,
} from './selection.ts';

export type PointCosts = {
  troopTypes: TroopTypeCosts;
  battleCards: BattleCardCosts;
};

export const pointCosts = (
  troopTypes: readonly TroopTypeCost[],
  battleCards: readonly PricedBattleCard[],
): PointCosts => ({
  troopTypes: troopTypeCosts(troopTypes),
  battleCards: battleCardCosts(battleCards),
});

export type StandLine = {
  contingent: ContingentId;
  kind: Contingent['kind'];
  option: TroopOptionId;
  troopType: TroopTypeCode;
  stands: number;
  pointsPerStand: number;
  points: number;
};

export type BattleCardLine = {
  code: BattleCardCode;
  purchases: number;
  stands: number;
  options: readonly TroopOptionId[];
  points: number;
};

export type ArmyPoints = {
  standPoints: number;
  allyStandPoints: number;
  battleCardPoints: number;
  total: number;
  standLines: readonly StandLine[];
  battleCardLines: readonly BattleCardLine[];
};

type CardApplication = {
  option: TroopOptionId;
  count: number;
};

type CardSelection = {
  copies: number;
  applications: readonly CardApplication[];
};

type StandCostModifier = {
  code: BattleCardCode;
  effect: StandCostEffect;
  stands: number;
};

const standLinesOf = (
  contingents: readonly Contingent[],
  selection: ArmySelection,
  costs: TroopTypeCosts,
): readonly StandLine[] =>
  contingents.flatMap(({ id: contingent, kind, troopOptions }) =>
    troopOptions.flatMap(({ id: option, troopEntries }) =>
      troopEntries
        .map(({ troopType }) => {
          const stands = standCount(selection, option, troopType);
          const pointsPerStand = costs[troopType];
          return {
            contingent,
            kind,
            option,
            troopType,
            stands,
            pointsPerStand,
            points: stands * pointsPerStand,
          };
        })
        .filter(({ stands }) => stands > 0),
    ),
  );

const selectedCards = (
  contingents: readonly Contingent[],
  selection: ArmySelection,
): ReadonlyMap<BattleCardCode, CardSelection> => {
  const inArmy = new Set(
    contingents.flatMap(({ troopOptions }) => troopOptions.map(({ id }) => id)),
  );
  const cards = new Map<
    BattleCardCode,
    { copies: number; applications: CardApplication[] }
  >();
  const cardFor = (code: BattleCardCode) => {
    const card = cards.get(code) ?? { copies: 0, applications: [] };
    cards.set(code, card);
    return card;
  };
  for (const [code, copies] of Object.entries(selection.armyBattleCards)) {
    if (copies > 0) {
      cardFor(code as BattleCardCode).copies += copies;
    }
  }
  const applied = Object.entries(selection.troopBattleCards)
    .filter(([option]) => inArmy.has(option as TroopOptionId))
    .sort(byKey);
  for (const [option, cardsOnOption] of applied) {
    for (const [code, count] of Object.entries(cardsOnOption)) {
      if (count > 0) {
        cardFor(code as BattleCardCode).applications.push({
          option: option as TroopOptionId,
          count,
        });
      }
    }
  }
  return cards;
};

const standsHeldBy = (
  standLines: readonly StandLine[],
): ReadonlyMap<TroopOptionId, number> => {
  const held = new Map<TroopOptionId, number>();
  for (const { option, stands } of standLines) {
    held.set(option, (held.get(option) ?? 0) + stands);
  }
  return held;
};

const standsUnder = (
  code: BattleCardCode,
  { option, count }: CardApplication,
  held: ReadonlyMap<TroopOptionId, number>,
) => (boughtForTheWholeTroopEntry(code) ? (held.get(option) ?? 0) : count);

const cardsOn = (code: BattleCardCode, { count }: CardApplication) =>
  wholeTroopEntryCardsPerArmy(code) === null ? Math.min(count, 1) : count;

const standCostsIn = (
  standLines: readonly StandLine[],
  option: TroopOptionId,
): readonly number[] =>
  standLines
    .filter((line) => line.option === option)
    .flatMap(({ stands, pointsPerStand }) =>
      Array.from({ length: stands }, () => pointsPerStand),
    )
    .sort((left, right) => right - left);

const standCostModifiers = (
  costs: BattleCardCosts,
  cards: ReadonlyMap<BattleCardCode, CardSelection>,
  held: ReadonlyMap<TroopOptionId, number>,
): ReadonlyMap<TroopOptionId, readonly StandCostModifier[]> => {
  const modifiers = new Map<TroopOptionId, StandCostModifier[]>();
  for (const [code, { applications }] of [...cards].sort(byKey)) {
    const { rule } = costs[code];
    if (rule.kind !== 'modifiesStandCost') {
      continue;
    }
    for (const application of applications) {
      modifiers.set(application.option, [
        ...(modifiers.get(application.option) ?? []),
        {
          code,
          effect: rule.effect,
          stands: standsUnder(code, application, held),
        },
      ]);
    }
  }
  return modifiers;
};

const standCostModifierPoints = (
  costs: BattleCardCosts,
  standLines: readonly StandLine[],
  cards: ReadonlyMap<BattleCardCode, CardSelection>,
  held: ReadonlyMap<TroopOptionId, number>,
): ReadonlyMap<BattleCardCode, number> => {
  const points = new Map<BattleCardCode, number>();
  for (const [option, modifiers] of standCostModifiers(costs, cards, held)) {
    const standCosts = standCostsIn(standLines, option);
    let modified = 0;
    for (const { code, effect, stands } of modifiers) {
      const applied = standCosts.slice(modified, modified + stands);
      modified += applied.length;
      points.set(
        code,
        (points.get(code) ?? 0) +
          sum(applied.map((cost) => adjustStandCost(effect, cost) - cost)),
      );
    }
  }
  return points;
};

const countsCards = (rule: BattleCardCostRule) =>
  rule.kind === 'perCard' ||
  rule.kind === 'perCardCapped' ||
  (rule.kind === 'firstFreeThenFlat' && rule.countedIn === 'cards');

const standsPerPurchase = (
  costs: BattleCardCosts,
  code: BattleCardCode,
  { copies, applications }: CardSelection,
  held: ReadonlyMap<TroopOptionId, number>,
): readonly number[] => {
  const armyWide = costs[code].purchasedPer === 'army';
  const applied = applications.map((application) =>
    standsUnder(code, application, held),
  );
  const perCard = applications.flatMap((application) =>
    Array.from({ length: cardsOn(code, application) }, () =>
      standsUnder(code, application, held),
    ),
  );
  return [
    ...Array.from({ length: copies }, () => 0),
    ...(armyWide && applied.length > 0 ? [sum(applied)] : []),
    ...(armyWide ? [] : boughtForTheWholeTroopEntry(code) ? perCard : applied),
  ];
};

const battleCardPointsOf = (
  costs: BattleCardCosts,
  code: BattleCardCode,
  card: CardSelection,
  modifierPoints: ReadonlyMap<BattleCardCode, number>,
  held: ReadonlyMap<TroopOptionId, number>,
): number => {
  const { rule } = costs[code];
  if (rule.kind === 'modifiesStandCost') {
    return modifierPoints.get(code) ?? 0;
  }
  const purchases = standsPerPurchase(costs, code, card, held);
  return countsCards(rule)
    ? costRulePoints(rule, { copies: purchases.length })
    : sum(
        purchases.map((stands) =>
          costRulePoints(rule, {
            copies: 1,
            stands,
            declarations: Math.max(1, stands),
          }),
        ),
      );
};

const standsCoveredBy = (
  code: BattleCardCode,
  { applications }: CardSelection,
  held: ReadonlyMap<TroopOptionId, number>,
): number =>
  sum(applications.map((application) => standsUnder(code, application, held)));

const battleCardLinesOf = (
  costs: BattleCardCosts,
  cards: ReadonlyMap<BattleCardCode, CardSelection>,
  modifierPoints: ReadonlyMap<BattleCardCode, number>,
  held: ReadonlyMap<TroopOptionId, number>,
): readonly BattleCardLine[] =>
  [...cards].sort(byKey).map(([code, card]) => ({
    code,
    purchases: standsPerPurchase(costs, code, card, held).length,
    stands: standsCoveredBy(code, card, held),
    options: card.applications.map(({ option }) => option),
    points: battleCardPointsOf(costs, code, card, modifierPoints, held),
  }));

export const armyPoints = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
): ArmyPoints => {
  const contingents = selectedContingents(armyList, selection);
  const standLines = standLinesOf(contingents, selection, costs.troopTypes);
  const cards = selectedCards(contingents, selection);
  const held = standsHeldBy(standLines);
  const battleCardLines = battleCardLinesOf(
    costs.battleCards,
    cards,
    standCostModifierPoints(costs.battleCards, standLines, cards, held),
    held,
  );
  const standPoints = sum(standLines.map(({ points }) => points));
  const battleCardPoints = sum(battleCardLines.map(({ points }) => points));
  return {
    standPoints,
    allyStandPoints: sum(
      standLines
        .filter(({ kind }) => kind === 'allied')
        .map(({ points }) => points),
    ),
    battleCardPoints,
    total: standPoints + battleCardPoints,
    standLines,
    battleCardLines,
  };
};
