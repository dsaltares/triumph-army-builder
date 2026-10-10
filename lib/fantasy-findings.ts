import type { useTranslations } from 'next-intl';
import type { FantasyCardCode } from './data/schema.ts';
import type {
  FantasyFinding,
  FantasyFindingParams,
  FantasyFindingTarget,
} from './domain/fantasy/validation.ts';
import { formatPoints } from './format.ts';

export type FantasyFindingTranslator = ReturnType<
  typeof useTranslations<'fantasyFindings'>
>;

export type FantasyFindingNames = {
  card: (code: FantasyCardCode) => string;
  unit: (id: string) => string;
  hero: (id: string) => string;
  army: string;
  join: (items: readonly string[]) => string;
};

type Values = Record<string, string | number>;

const bearerOf = (target: FantasyFindingTarget, names: FantasyFindingNames) => {
  switch (target.kind) {
    case 'unit':
    case 'unitCard':
      return names.unit(target.unit);
    case 'hero':
    case 'heroCard':
      return names.hero(target.hero);
    case 'army':
    case 'format':
    case 'general':
    case 'armyCard':
      return names.army;
  }
};

const render: {
  [Code in FantasyFinding['code']]: (
    params: FantasyFindingParams[Code],
    names: FantasyFindingNames,
  ) => Values;
} = {
  overPointsTotal: ({ total, over, pointsTotal }) => ({
    total: formatPoints(total),
    over: formatPoints(over),
    pointsTotal: formatPoints(pointsTotal),
  }),
  underPointsTotal: ({ total, unspent, pointsTotal }) => ({
    total: formatPoints(total),
    unspent: formatPoints(unspent),
    pointsTotal: formatPoints(pointsTotal),
  }),
  tooFewStands: ({ stands, required, pointsTotal }) => ({
    stands,
    required,
    pointsTotal: formatPoints(pointsTotal),
  }),
  tooManyHeroes: (values) => values,
  heroPointsAboveMax: ({ points, max }) => ({
    points: formatPoints(points),
    max: formatPoints(max),
  }),
  generalMissing: () => ({}),
  generalIsHero: () => ({}),
  standCostRaisedToMinimum: ({ unclamped, minimum }) => ({
    unclamped: formatPoints(unclamped),
    minimum: formatPoints(minimum),
  }),
  marksExceedStands: (values) => values,
  cardNotInPack: ({ card }, names) => ({ card: names.card(card) }),
  cardNotForPlacement: ({ card, placement }, names) => ({
    card: names.card(card),
    placement,
  }),
  cardMarkedNotBought: ({ card }, names) => ({ card: names.card(card) }),
  cardBoughtTwice: ({ card }, names) => ({ card: names.card(card) }),
  variantNotChosen: ({ card }, names) => ({ card: names.card(card) }),
  cardCountAboveMax: ({ card, count, max }, names) => ({
    card: names.card(card),
    count,
    max,
  }),
  cardNotEligible: ({ card }, names) => ({ card: names.card(card) }),
  cardsExcludeEachOther: ({ card, other }, names) => ({
    card: names.card(card),
    other: names.card(other),
  }),
  cardRequiresCard: ({ card, requires }, names) => ({
    card: names.card(card),
    requires: names.join(requires.map(names.card)),
  }),
  cardAboveArmyMax: ({ card, bearer, count, max }, names) => ({
    card: names.card(card),
    kind: bearer,
    count,
    max,
  }),
  cardMoreThanOncePerArmy: ({ card, count }, names) => ({
    card: names.card(card),
    count,
  }),
  cardOnGeneral: ({ card }, names) => ({ card: names.card(card) }),
  cardOnHero: ({ card }, names) => ({ card: names.card(card) }),
  cardOnSeveralUnits: ({ card, units }, names) => ({
    card: names.card(card),
    units,
  }),
  negativeCardOnHero: ({ card }, names) => ({ card: names.card(card) }),
};

export const describeFantasyFinding = (
  finding: FantasyFinding,
  t: FantasyFindingTranslator,
  names: FantasyFindingNames,
) => {
  const values = (
    render[finding.code] as (
      params: FantasyFinding['params'],
      names: FantasyFindingNames,
    ) => Values
  )(finding.params, names);
  return t(finding.code, {
    ...values,
    bearer: bearerOf(finding.target, names),
  });
};
