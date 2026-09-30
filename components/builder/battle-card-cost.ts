import type {
  BattleCardCostRule,
  BattleCardPurchaseScope,
} from '@/lib/domain/battle-cards/cost-rules';
import { formatPoints, formatPointsWithUnit } from '@/lib/format';
import type { Locale } from '@/lib/i18n/locales';
import { wordsFor } from '@/lib/i18n/translator';

export const describeCost = (
  rule: BattleCardCostRule,
  locale: Locale,
): string => {
  const w = wordsFor(locale, 'builder');
  switch (rule.kind) {
    case 'free':
      return w('costNoPoints');
    case 'flat':
      return formatPointsWithUnit(rule.points, locale);
    case 'perStand':
      return w('costPerStand', {
        points: formatPointsWithUnit(rule.pointsPerStand, locale),
      });
    case 'perCard':
      return w('costPerCard', {
        points: formatPointsWithUnit(rule.pointsPerCard, locale),
      });
    case 'perCardCapped':
      return w('costPerCardCapped', {
        points: formatPointsWithUnit(rule.pointsPerCard, locale),
        max: formatPoints(rule.maxPoints),
      });
    case 'firstFreeThenFlat':
      return w(
        rule.countedIn === 'cards'
          ? 'costFirstFreeThenCard'
          : 'costFirstFreeThenStand',
        { points: formatPointsWithUnit(rule.pointsAfterFirst, locale) },
      );
    case 'modifiesStandCost':
      return rule.effect.kind === 'reduceBy'
        ? w('costReduceStand', {
            points: formatPointsWithUnit(rule.effect.points, locale),
          })
        : w('costSetStand', { points: formatPoints(rule.effect.points) });
    case 'conditional':
      return w('costPerDeclaration', {
        points: formatPointsWithUnit(rule.pointsPerDeclaration, locale),
      });
  }
};

export const purchaseHints = {
  army: 'purchaseArmy',
  troopOption: 'purchaseTroopOption',
} as const satisfies Record<BattleCardPurchaseScope, string>;
