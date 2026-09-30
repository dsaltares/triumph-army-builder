import type { BattleCardCode } from '../../data/schema.ts';
import type {
  BattleCardCostRule,
  BattleCardPurchaseScope,
} from '../battle-cards/cost-rules.ts';
import {
  appliedPerStand,
  type BattleCardCosts,
  boughtForTheWholeTroopEntry,
  wholeTroopEntryCardsPerArmy,
} from '../battle-cards/costs.ts';
import { sum } from '../numbers.ts';
import type {
  ArmyList,
  BattleCardAllowance,
  TroopOption,
} from './army-list.ts';
import { troopOptionWithholding, type Withholding } from './availability.ts';
import { type Bounds, boundsOf } from './bounds.ts';
import { armyPoints, type PointCosts } from './points.ts';
import {
  type ArmySelection,
  gatingOf,
  troopOptionStandCount,
  withArmyBattleCard,
  withTroopBattleCard,
} from './selection.ts';

export type BattleCardChoice = {
  code: BattleCardCode;
  name: string;
  count: number;
  min: number | null;
  max: number | null;
  limit: number;
  note: string | null;
  purchasedPer: BattleCardPurchaseScope;
  appliedPerStand: boolean;
  cardsPerArmy: number | null;
  rule: BattleCardCostRule;
  points: number;
  bounds: Bounds;
  exceedsStands: boolean;
  canAdd: boolean;
  canRemove: boolean;
};

export type TroopOptionBattleCards = {
  option: TroopOption;
  stands: number;
  withheldBy: Withholding | null;
  choices: readonly BattleCardChoice[];
};

export type BattleCardChoices = {
  army: readonly BattleCardChoice[];
  troopOptions: readonly TroopOptionBattleCards[];
  offered: number;
  taken: number;
  points: number;
};

type OfferedTroopOption = {
  option: TroopOption;
  stands: number;
  withheldBy: Withholding | null;
};

type Offer = {
  allowance: BattleCardAllowance;
  on: OfferedTroopOption | null;
  count: number;
};

const boughtOnce = 1;

const widened = (
  held: BattleCardAllowance,
  also: BattleCardAllowance,
): BattleCardAllowance => ({
  code: held.code,
  min:
    held.min === null || also.min === null
      ? null
      : Math.min(held.min, also.min),
  max:
    held.max === null || also.max === null
      ? null
      : Math.max(held.max, also.max),
  note: [held.note, also.note].filter(Boolean).join(' · ') || null,
});

const oncePerCode = (
  allowances: readonly BattleCardAllowance[],
): readonly BattleCardAllowance[] => {
  const offered = new Map<BattleCardCode, BattleCardAllowance>();
  for (const allowance of allowances) {
    const held = offered.get(allowance.code);
    offered.set(allowance.code, held ? widened(held, allowance) : allowance);
  }
  return [...offered.values()];
};

const limitOf = (
  costs: BattleCardCosts,
  { allowance, on, count }: Offer,
  elsewhere: number,
) => {
  const { code, max } = allowance;
  if (!on) {
    return max ?? boughtOnce;
  }
  if (on.stands === 0) {
    return 0;
  }
  if (boughtForTheWholeTroopEntry(code)) {
    const perArmy = wholeTroopEntryCardsPerArmy(code);
    return perArmy === null ? boughtOnce : Math.max(count, perArmy - elsewhere);
  }
  return appliedPerStand(costs, code)
    ? Math.min(max ?? on.stands, on.stands)
    : boughtOnce;
};

const withOfferCount = (
  selection: ArmySelection,
  { allowance, on }: Offer,
  count: number,
): ArmySelection =>
  on
    ? withTroopBattleCard(selection, on.option, allowance.code, count)
    : withArmyBattleCard(selection, allowance.code, count);

const battleCardPointsOf = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
) => armyPoints(armyList, selection, costs).battleCardPoints;

const attributedPoints = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
  offers: readonly Offer[],
): ReadonlyMap<Offer, number> => {
  let taken = offers.reduce(
    (current, offer) => withOfferCount(current, offer, 0),
    selection,
  );
  let running = battleCardPointsOf(armyList, taken, costs);
  return new Map(
    offers.map((offer) => {
      taken = withOfferCount(taken, offer, offer.count);
      const points = battleCardPointsOf(armyList, taken, costs);
      const attributed = points - running;
      running = points;
      return [offer, attributed];
    }),
  );
};

const armyOffers = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly Offer[] =>
  oncePerCode(armyList.battleCards).map((allowance) => ({
    allowance,
    on: null,
    count: selection.armyBattleCards[allowance.code] ?? 0,
  }));

const troopOptionOffers = (
  on: OfferedTroopOption,
  selection: ArmySelection,
): readonly Offer[] =>
  oncePerCode(on.option.battleCards).map((allowance) => ({
    allowance,
    on,
    count: selection.troopBattleCards[on.option.id]?.[allowance.code] ?? 0,
  }));

const takesCards = (selection: ArmySelection, option: TroopOption) =>
  Object.values(selection.troopBattleCards[option.id] ?? {}).some(
    (count) => count > 0,
  );

const offeringTroopOptions = (
  armyList: ArmyList,
  selection: ArmySelection,
): readonly OfferedTroopOption[] => {
  const gating = gatingOf(selection);
  return armyList.main.troopOptions
    .filter(({ battleCards }) => battleCards.length > 0)
    .map((option) => ({
      option,
      stands: troopOptionStandCount(selection, option.id),
      withheldBy: troopOptionWithholding(option, armyList.subFactions, gating),
    }))
    .filter(
      ({ option, withheldBy }) =>
        withheldBy === null || takesCards(selection, option),
    );
};

const choiceOf = (
  costs: BattleCardCosts,
  offer: Offer,
  points: number,
  elsewhere: number,
): BattleCardChoice => {
  const { allowance, count, on } = offer;
  const { name, purchasedPer, rule } = costs[allowance.code];
  const perStand = appliedPerStand(costs, allowance.code);
  const limit = limitOf(costs, offer, elsewhere);
  return {
    code: allowance.code,
    name,
    count,
    min: allowance.min,
    max: allowance.max,
    limit,
    note: allowance.note,
    purchasedPer,
    appliedPerStand: perStand,
    cardsPerArmy: wholeTroopEntryCardsPerArmy(allowance.code),
    rule,
    points,
    bounds: boundsOf(count, allowance.min, allowance.max),
    exceedsStands:
      on !== null &&
      count > 0 &&
      (perStand ? count > on.stands : on.stands === 0),
    canAdd: !on?.withheldBy && count < limit,
    canRemove: count > 0,
  };
};

export const battleCardChoices = (
  armyList: ArmyList,
  selection: ArmySelection,
  costs: PointCosts,
): BattleCardChoices => {
  const offeredOn = offeringTroopOptions(armyList, selection).map((on) => ({
    on,
    offers: troopOptionOffers(on, selection),
  }));
  const armyWide = armyOffers(armyList, selection);
  const allOffers = [...armyWide, ...offeredOn.flatMap(({ offers }) => offers)];
  const points = attributedPoints(armyList, selection, costs, allOffers);
  const takenPerCode = new Map<BattleCardCode, number>();
  for (const { allowance, count } of allOffers) {
    takenPerCode.set(
      allowance.code,
      (takenPerCode.get(allowance.code) ?? 0) + count,
    );
  }
  const choicesOf = (offers: readonly Offer[]) =>
    offers.map((offer) =>
      choiceOf(
        costs.battleCards,
        offer,
        points.get(offer) ?? 0,
        (takenPerCode.get(offer.allowance.code) ?? 0) - offer.count,
      ),
    );
  const army = choicesOf(armyWide);
  const troopOptions = offeredOn.map(({ on, offers }) => ({
    ...on,
    choices: choicesOf(offers),
  }));
  const all = [...army, ...troopOptions.flatMap(({ choices }) => choices)];
  return {
    army,
    troopOptions,
    offered: all.length,
    taken: all.filter(({ count }) => count > 0).length,
    points: sum(all.map((choice) => choice.points)),
  };
};
