import { type BattleCardCode, battleCardCodes } from '../../data/schema.ts';
import {
  type BattleCardCostRule,
  type BattleCardPurchaseScope,
  type CostRuleContext,
  costRulePoints,
  type StandCostEffect,
} from './cost-rules.ts';

export type BattleCardCost = {
  name: string;
  purchasedPer: BattleCardPurchaseScope;
  rule: BattleCardCostRule;
};

export type BattleCardCosts = Readonly<Record<BattleCardCode, BattleCardCost>>;

export type PricedBattleCard = {
  permanentCode: BattleCardCode;
  displayName: string;
  purchasedPer: BattleCardPurchaseScope;
  rule: BattleCardCostRule;
};

export const battleCardCosts = (
  battleCards: readonly PricedBattleCard[],
): BattleCardCosts => {
  const byCode = new Map(
    battleCards.map(({ permanentCode, displayName, purchasedPer, rule }) => [
      permanentCode,
      { name: displayName, purchasedPer, rule },
    ]),
  );
  const missing = battleCardCodes.filter((code) => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(`no cost for battle cards ${missing.join(', ')}`);
  }
  return Object.fromEntries(
    battleCardCodes.map((code) => [code, byCode.get(code)]),
  ) as BattleCardCosts;
};

export const battleCardPoints = (
  costs: BattleCardCosts,
  code: BattleCardCode,
  context: Partial<CostRuleContext> = {},
): number => costRulePoints(costs[code].rule, context);

export const battleCardStandCostEffect = (
  costs: BattleCardCosts,
  code: BattleCardCode,
): StandCostEffect | null => {
  const { rule } = costs[code];
  return rule.kind === 'modifiesStandCost' ? rule.effect : null;
};

const cardsPerArmy = {
  HL: 3,
  CT: 2,
} as const satisfies Partial<Record<BattleCardCode, number>>;

const everyStandInTheTroopEntry = [
  'AC',
  'CC',
  'CH',
  'CT',
  'HL',
  'SF',
  'SS',
] as const satisfies readonly BattleCardCode[];

const appliedInPairs = ['SV'] as const satisfies readonly BattleCardCode[];

const holds = (codes: readonly BattleCardCode[], code: BattleCardCode) =>
  codes.includes(code);

export const boughtForTheWholeTroopEntry = (code: BattleCardCode): boolean =>
  holds(everyStandInTheTroopEntry, code);

export const wholeTroopEntryCardsPerArmy = (
  code: BattleCardCode,
): number | null => cardsPerArmy[code as keyof typeof cardsPerArmy] ?? null;

export const appliedToPairsOfStands = (code: BattleCardCode): boolean =>
  holds(appliedInPairs, code);

export const appliedPerStand = (
  costs: BattleCardCosts,
  code: BattleCardCode,
): boolean =>
  costs[code].purchasedPer === 'troopOption' &&
  !boughtForTheWholeTroopEntry(code);
