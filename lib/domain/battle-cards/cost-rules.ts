export const battleCardCategories = ['army', 'troop'] as const;

export type BattleCardCategory = (typeof battleCardCategories)[number];

export const battleCardPurchaseScopes = ['army', 'troopOption'] as const;

export type BattleCardPurchaseScope = (typeof battleCardPurchaseScopes)[number];

export type StandCostEffect =
  | { kind: 'reduceBy'; points: number }
  | { kind: 'setTo'; points: number };

export type BattleCardCostRule =
  | { kind: 'free' }
  | { kind: 'flat'; points: number }
  | { kind: 'perStand'; pointsPerStand: number }
  | { kind: 'perCard'; pointsPerCard: number }
  | { kind: 'perCardCapped'; pointsPerCard: number; maxPoints: number }
  | {
      kind: 'firstFreeThenFlat';
      countedIn: 'cards' | 'stands';
      pointsAfterFirst: number;
      cumulative: boolean;
    }
  | { kind: 'modifiesStandCost'; effect: StandCostEffect }
  | { kind: 'conditional'; pointsPerDeclaration: number };

export type CostRuleContext = {
  copies: number;
  stands: number;
  standCost: number;
  declarations: number;
};

const emptyContext: CostRuleContext = {
  copies: 1,
  stands: 0,
  standCost: 0,
  declarations: 0,
};

export const adjustStandCost = (
  effect: StandCostEffect,
  standCost: number,
): number => {
  switch (effect.kind) {
    case 'reduceBy':
      return Math.max(0, standCost - effect.points);
    case 'setTo':
      return effect.points;
  }
};

export const costRulePoints = (
  rule: BattleCardCostRule,
  context: Partial<CostRuleContext> = {},
): number => {
  const { copies, stands, standCost, declarations } = {
    ...emptyContext,
    ...context,
  };
  switch (rule.kind) {
    case 'free':
      return 0;
    case 'flat':
      return rule.points * copies;
    case 'perStand':
      return rule.pointsPerStand * stands;
    case 'perCard':
      return rule.pointsPerCard * copies;
    case 'perCardCapped':
      return Math.min(rule.pointsPerCard * copies, rule.maxPoints);
    case 'firstFreeThenFlat': {
      const beyondFirst = Math.max(
        0,
        (rule.countedIn === 'cards' ? copies : stands) - 1,
      );
      const charged = rule.cumulative ? beyondFirst : Math.min(beyondFirst, 1);
      return charged * rule.pointsAfterFirst;
    }
    case 'modifiesStandCost':
      return (adjustStandCost(rule.effect, standCost) - standCost) * stands;
    case 'conditional':
      return rule.pointsPerDeclaration * declarations;
  }
};
