import type { FantasyCardCode, FantasyTopography } from '../../data/schema.ts';
import type { FantasyCardCost, FantasyStandSelector } from './battle-cards.ts';
import type { FantasyTroopType } from './reference.ts';

export type FantasyCardBearerProfile =
  | {
      kind: 'stand';
      troopType: FantasyTroopType;
      cards: readonly FantasyCardCode[];
    }
  | { kind: 'hero'; cards: readonly FantasyCardCode[] };

export type FantasyPricingContext = {
  bearer: FantasyCardBearerProfile | null;
  topography: FantasyTopography;
  denseTopographies: readonly FantasyTopography[];
  variants: Readonly<Record<string, string>> | undefined;
  count: number;
};

const standMatches = (
  { troopTypes, order, category, minMovement }: FantasyStandSelector,
  troopType: FantasyTroopType,
) =>
  (troopTypes === undefined || troopTypes.includes(troopType.permanentCode)) &&
  (order === undefined || order === troopType.order) &&
  (category === undefined || category === troopType.category) &&
  (minMovement === undefined ||
    (troopType.movement !== undefined && troopType.movement >= minMovement));

const asksForTroopType = ({
  troopTypes,
  order,
  category,
  minMovement,
}: FantasyStandSelector) =>
  troopTypes !== undefined ||
  order !== undefined ||
  category !== undefined ||
  minMovement !== undefined;

export const selectorMatches = (
  selector: FantasyStandSelector,
  bearer: FantasyCardBearerProfile | null,
) => {
  if (bearer === null) {
    return false;
  }
  const cardsMatch =
    selector.cards === undefined ||
    selector.cards.some((code) => bearer.cards.includes(code));
  if (bearer.kind === 'hero') {
    return cardsMatch && !asksForTroopType(selector);
  }
  return cardsMatch && standMatches(selector, bearer.troopType);
};

export const anySelectorMatches = (
  selectors: readonly FantasyStandSelector[],
  bearer: FantasyCardBearerProfile | null,
) => selectors.some((selector) => selectorMatches(selector, bearer));

export const cardCostPoints = (
  cost: FantasyCardCost,
  context: FantasyPricingContext,
): number | null => {
  switch (cost.kind) {
    case 'flat':
    case 'perMarkedCappedAtValue':
      return cost.points;
    case 'byTroopType':
      return (
        cost.overrides.find(({ when }) => selectorMatches(when, context.bearer))
          ?.points ?? cost.points
      );
    case 'byTopography':
      return context.denseTopographies.includes(context.topography)
        ? cost.dense
        : cost.points;
    case 'byVariant': {
      const option = context.variants?.[cost.choice];
      const priced = option === undefined ? undefined : cost.options[option];
      return priced === undefined ? null : cardCostPoints(priced, context);
    }
    case 'perCount': {
      const each = cardCostPoints(cost.each, context);
      return each === null ? null : each * context.count;
    }
    case 'byBearer':
      return cardCostPoints(
        context.bearer?.kind === 'hero' ? cost.hero : cost.stand,
        context,
      );
  }
};

export const cappedAtValue = (points: number, value: number) =>
  Math.sign(points) * Math.min(Math.abs(points), Math.max(0, value));
