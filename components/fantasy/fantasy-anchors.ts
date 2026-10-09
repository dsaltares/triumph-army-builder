import type { FantasySelection } from '@/lib/domain/fantasy/selection-schema';
import type { FantasyFindingTarget } from '@/lib/domain/fantasy/validation';

export const pointsAnchor = 'points';

export const formatAnchor = 'format';

export const generalAnchor = 'general';

export const armyCardsAnchor = 'army-cards';

export const heroesAnchor = 'heroes';

const safe = (id: string) => id.replace(/\W/g, '-');

export const unitAnchor = (id: string) => `unit-${safe(id)}`;

export const heroAnchor = (id: string) => `hero-${safe(id)}`;

export const fantasyFindingAnchor = (target: FantasyFindingTarget) => {
  switch (target.kind) {
    case 'army':
      return pointsAnchor;
    case 'format':
      return formatAnchor;
    case 'general':
      return generalAnchor;
    case 'unit':
    case 'unitCard':
      return unitAnchor(target.unit);
    case 'hero':
    case 'heroCard':
      return heroAnchor(target.hero);
    case 'armyCard':
      return armyCardsAnchor;
  }
};

export const fantasyAnchors = ({
  units,
  heroes,
}: FantasySelection): ReadonlySet<string> =>
  new Set([
    pointsAnchor,
    formatAnchor,
    generalAnchor,
    armyCardsAnchor,
    ...units.map(({ id }) => unitAnchor(id)),
    ...heroes.map(({ id }) => heroAnchor(id)),
  ]);
