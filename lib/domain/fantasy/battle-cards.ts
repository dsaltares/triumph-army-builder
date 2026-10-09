import type {
  FantasyCardCode,
  FantasyTopography,
  TroopTypeCategory,
  TroopTypeCode,
  TroopTypeOrder,
} from '../../data/schema.ts';

export const fantasyCardCategories = [
  'army',
  'event',
  'stand',
  'hero',
  'standOrHero',
] as const;

export type FantasyCardCategory = (typeof fantasyCardCategories)[number];

export const fantasyCardBearers = ['stand', 'hero'] as const;

export type FantasyCardBearer = (typeof fantasyCardBearers)[number];

export type FantasyStandSelector = {
  troopTypes?: readonly TroopTypeCode[];
  order?: TroopTypeOrder;
  category?: TroopTypeCategory;
  minMovement?: number;
  cards?: readonly FantasyCardCode[];
};

export type FantasyCardVariants = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

export type FantasyCostOverride = {
  when: FantasyStandSelector;
  points: number;
};

export type FantasyCardCost =
  | { kind: 'flat'; points: number }
  | {
      kind: 'byTroopType';
      points: number;
      overrides: readonly FantasyCostOverride[];
    }
  | { kind: 'byTopography'; points: number; dense: number }
  | {
      kind: 'byVariant';
      choice: string;
      options: Readonly<Record<string, FantasyCardCost>>;
    }
  | { kind: 'perCount'; max: number; each: FantasyCardCost }
  | { kind: 'perMarkedCappedAtValue'; points: number }
  | { kind: 'byBearer'; stand: FantasyCardCost; hero: FantasyCardCost };

export type FantasyCardConstraint =
  | { kind: 'eligible'; anyOf: readonly FantasyStandSelector[] }
  | { kind: 'ineligible'; anyOf: readonly FantasyStandSelector[] }
  | { kind: 'excludedWith'; cards: readonly FantasyCardCode[] }
  | {
      kind: 'requires';
      cards: readonly FantasyCardCode[];
      bearer?: FantasyCardBearer;
    }
  | { kind: 'maxPerArmy'; stands?: number; heroes?: number }
  | { kind: 'oncePerArmy' }
  | { kind: 'notOnGeneral' }
  | { kind: 'notOnHeroes' }
  | { kind: 'oneClassPerArmy' };

export type FantasyCard = {
  name: string;
  category: FantasyCardCategory;
  variants?: FantasyCardVariants;
  cost: FantasyCardCost;
  constraints: readonly FantasyCardConstraint[];
};

export type FantasyRatingCosts = {
  base: number;
  costs: Readonly<Record<'0' | '1' | '2' | '3' | '4', number>>;
};

export type FantasyFormat = {
  points: number;
  pointsPerRequiredStand: number;
  minimumStandCost: number;
  heroes: {
    max: number;
    maxPoints: number;
    cost: number;
    mayTakeNegativeCostCards: boolean;
  };
  invasion: FantasyRatingCosts;
  maneuver: FantasyRatingCosts;
  denseTopographies: readonly FantasyTopography[];
  victory: { numerator: number; denominator: number };
};

export const variantChoicesOf = (
  cost: FantasyCardCost,
): readonly { choice: string; options: readonly string[] }[] => {
  switch (cost.kind) {
    case 'byVariant':
      return [
        { choice: cost.choice, options: Object.keys(cost.options) },
        ...Object.values(cost.options).flatMap(variantChoicesOf),
      ];
    case 'perCount':
      return variantChoicesOf(cost.each);
    case 'byBearer':
      return [...variantChoicesOf(cost.stand), ...variantChoicesOf(cost.hero)];
    case 'flat':
    case 'byTroopType':
    case 'byTopography':
    case 'perMarkedCappedAtValue':
      return [];
  }
};

export const unpricedVariantProblems = ({
  variants = {},
  cost,
}: Pick<FantasyCard, 'variants' | 'cost'>): string[] =>
  variantChoicesOf(cost).flatMap(({ choice, options }) => {
    const offered = variants[choice];
    if (!offered) {
      return [`prices by the variant ${choice}, which the card does not offer`];
    }
    const expected = Object.keys(offered).sort();
    const priced = [...options].sort();
    return expected.join() === priced.join()
      ? []
      : [
          `prices ${choice} as ${priced.join(', ')} but offers ${expected.join(', ')}`,
        ];
  });
