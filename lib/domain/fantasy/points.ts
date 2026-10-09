import type { BundledFantasyCard } from '../../data/bundle.ts';
import type { FantasyCardCode, TroopTypeCode } from '../../data/schema.ts';
import { sum } from '../numbers.ts';
import {
  cappedAtValue,
  cardCostPoints,
  type FantasyCardBearerProfile,
} from './card-pricing.ts';
import type { FantasyCatalogue, FantasyTroopType } from './reference.ts';
import type {
  FantasyArmyCard,
  FantasyCardChoice,
  FantasyHero,
  FantasyHeroId,
  FantasyListFormat,
  FantasySelection,
  FantasyUnit,
  FantasyUnitId,
} from './selection-schema.ts';

export const delayedEntryCode: FantasyCardCode = 'delayedEntry';

export const mobileInfantryCode: FantasyCardCode = 'mobileInfantry';

export type FantasyCardPrice = {
  code: FantasyCardCode;
  variants?: Readonly<Record<string, string>>;
  points: number | null;
};

export type FantasyUnitPoints = {
  unit: FantasyUnitId;
  troopType: TroopTypeCode;
  stands: number;
  basePoints: number;
  cards: readonly FantasyCardPrice[];
  unclampedPointsPerStand: number;
  pointsPerStand: number;
  points: number;
};

export type FantasyHeroPoints = {
  hero: FantasyHeroId;
  basePoints: number;
  cards: readonly FantasyCardPrice[];
  points: number;
};

export type FantasyDelayedBearer =
  | { kind: 'unit'; unit: FantasyUnitId; stands: number }
  | { kind: 'hero'; hero: FantasyHeroId };

export type FantasyArmyLine =
  | { kind: 'invasion'; rating: number; points: number }
  | { kind: 'maneuver'; rating: number; points: number }
  | {
      kind: 'armyCard';
      code: FantasyCardCode;
      count: number;
      variants?: Readonly<Record<string, string>>;
      points: number | null;
    }
  | {
      kind: 'eventCard';
      code: FantasyCardCode;
      unit: FantasyUnitId;
      count: number;
      points: number | null;
    }
  | { kind: 'delayedEntry'; bearer: FantasyDelayedBearer; points: number };

export type FantasyPoints = {
  units: readonly FantasyUnitPoints[];
  heroes: readonly FantasyHeroPoints[];
  lines: readonly FantasyArmyLine[];
  standPoints: number;
  heroPoints: number;
  linePoints: number;
  victoryValue: number;
  total: number;
};

const pricedOrZero = (points: number | null) => points ?? 0;

export const fantasyTroopType = (
  catalogue: FantasyCatalogue,
  code: TroopTypeCode,
): FantasyTroopType => {
  const troopType = catalogue.troopTypes.get(code);
  if (!troopType) {
    throw new Error(`the Fantasy Triumph pack has no troop type ${code}`);
  }
  return troopType;
};

export const unitBearer = (
  catalogue: FantasyCatalogue,
  unit: FantasyUnit,
): FantasyCardBearerProfile => ({
  kind: 'stand',
  troopType: fantasyTroopType(catalogue, unit.troopType),
  cards: unit.cards.map(({ code }) => code),
});

export const heroBearer = (hero: FantasyHero): FantasyCardBearerProfile => ({
  kind: 'hero',
  cards: hero.cards.map(({ code }) => code),
});

const priceOf = (
  card: BundledFantasyCard | undefined,
  context: {
    bearer: FantasyCardBearerProfile | null;
    format: FantasyListFormat;
    catalogue: FantasyCatalogue;
    variants: Readonly<Record<string, string>> | undefined;
    count: number;
  },
) =>
  card === undefined
    ? null
    : cardCostPoints(card.cost, {
        bearer: context.bearer,
        topography: context.format.topography,
        denseTopographies: context.catalogue.format.denseTopographies,
        variants: context.variants,
        count: context.count,
      });

const cardPrices = (
  cards: readonly FantasyCardChoice[],
  bearer: FantasyCardBearerProfile,
  format: FantasyListFormat,
  catalogue: FantasyCatalogue,
): readonly FantasyCardPrice[] =>
  cards.map(({ code, variants }) => ({
    code,
    ...(variants === undefined ? {} : { variants }),
    points: priceOf(catalogue.cards.get(code), {
      bearer,
      format,
      catalogue,
      variants,
      count: 1,
    }),
  }));

export const unitPoints = (
  unit: FantasyUnit,
  format: FantasyListFormat,
  catalogue: FantasyCatalogue,
): FantasyUnitPoints => {
  const bearer = unitBearer(catalogue, unit);
  const basePoints = fantasyTroopType(catalogue, unit.troopType).cost;
  const cards = cardPrices(unit.cards, bearer, format, catalogue);
  const unclampedPointsPerStand =
    basePoints + sum(cards.map(({ points }) => pricedOrZero(points)));
  const pointsPerStand = Math.max(
    catalogue.format.minimumStandCost,
    unclampedPointsPerStand,
  );
  return {
    unit: unit.id,
    troopType: unit.troopType,
    stands: unit.stands,
    basePoints,
    cards,
    unclampedPointsPerStand,
    pointsPerStand,
    points: unit.stands * pointsPerStand,
  };
};

export const heroPoints = (
  hero: FantasyHero,
  format: FantasyListFormat,
  catalogue: FantasyCatalogue,
): FantasyHeroPoints => {
  const basePoints = catalogue.format.heroes.cost;
  const cards = cardPrices(hero.cards, heroBearer(hero), format, catalogue);
  return {
    hero: hero.id,
    basePoints,
    cards,
    points: basePoints + sum(cards.map(({ points }) => pricedOrZero(points))),
  };
};

const ratingKeys = ['0', '1', '2', '3', '4'] as const;

const ratingKey = (rating: number) => {
  const key = ratingKeys[rating];
  if (key === undefined) {
    throw new Error(`${rating} is not a Fantasy Triumph rating`);
  }
  return key;
};

const ratingLines = (
  { invasion, maneuver }: FantasyListFormat,
  catalogue: FantasyCatalogue,
): readonly FantasyArmyLine[] => [
  {
    kind: 'invasion',
    rating: invasion,
    points: catalogue.format.invasion.costs[ratingKey(invasion)],
  },
  {
    kind: 'maneuver',
    rating: maneuver,
    points: catalogue.format.maneuver.costs[ratingKey(maneuver)],
  },
];

export const transportsMarked = (units: readonly FantasyUnit[]) =>
  sum(units.map(({ stands, marks }) => Math.min(marks.transports, stands)));

const armyCardCount = (
  { code, count }: FantasyArmyCard,
  units: readonly FantasyUnit[],
) => (code === mobileInfantryCode ? transportsMarked(units) : (count ?? 1));

const armyCardLines = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): readonly FantasyArmyLine[] => {
  const bought = selection.armyCards.filter(
    ({ code }) => code !== delayedEntryCode,
  );
  const unboughtTransports =
    transportsMarked(selection.units) > 0 &&
    !bought.some(({ code }) => code === mobileInfantryCode);
  const priced: readonly FantasyArmyCard[] = [
    ...bought,
    ...(unboughtTransports ? [{ code: mobileInfantryCode }] : []),
  ];
  return priced.map((armyCard): FantasyArmyLine => {
    const count = armyCardCount(armyCard, selection.units);
    return {
      kind: 'armyCard',
      code: armyCard.code,
      count,
      ...(armyCard.variants === undefined
        ? {}
        : { variants: armyCard.variants }),
      points: priceOf(catalogue.cards.get(armyCard.code), {
        bearer: null,
        format: selection.format,
        catalogue,
        variants: armyCard.variants,
        count,
      }),
    };
  });
};

const eventCardLines = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): readonly FantasyArmyLine[] =>
  selection.units.flatMap((unit) =>
    eventCardsOf(unit).map(([code, count]) => ({
      kind: 'eventCard' as const,
      code,
      unit: unit.id,
      count,
      points: priceOf(catalogue.cards.get(code), {
        bearer: unitBearer(catalogue, unit),
        format: selection.format,
        catalogue,
        variants: undefined,
        count,
      }),
    })),
  );

export const eventCardsOf = (unit: FantasyUnit) =>
  (Object.entries(unit.marks.eventCards) as [FantasyCardCode, number][]).filter(
    ([, count]) => count > 0,
  );

const delayedEntryLines = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
  units: readonly FantasyUnitPoints[],
  heroes: readonly FantasyHeroPoints[],
): readonly FantasyArmyLine[] => {
  const card = catalogue.cards.get(delayedEntryCode);
  if (card === undefined) {
    return [];
  }
  const refundPer = (value: number) =>
    cappedAtValue(
      pricedOrZero(
        cardCostPoints(card.cost, {
          bearer: null,
          topography: selection.format.topography,
          denseTopographies: catalogue.format.denseTopographies,
          variants: undefined,
          count: 1,
        }),
      ),
      value,
    );
  const unitLines = selection.units.flatMap((unit, index) => {
    const stands = Math.min(unit.marks.delayedEntry, unit.stands);
    const priced = units[index];
    return stands > 0 && priced
      ? [
          {
            kind: 'delayedEntry' as const,
            bearer: { kind: 'unit' as const, unit: unit.id, stands },
            points: stands * refundPer(priced.pointsPerStand),
          },
        ]
      : [];
  });
  const heroLines = selection.heroes.flatMap((hero, index) => {
    const priced = heroes[index];
    return hero.delayedEntry && priced
      ? [
          {
            kind: 'delayedEntry' as const,
            bearer: { kind: 'hero' as const, hero: hero.id },
            points: refundPer(priced.points),
          },
        ]
      : [];
  });
  return [...unitLines, ...heroLines];
};

export const linePoints = (line: FantasyArmyLine) => pricedOrZero(line.points);

export const fantasyPoints = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): FantasyPoints => {
  const units = selection.units.map((unit) =>
    unitPoints(unit, selection.format, catalogue),
  );
  const heroes = selection.heroes.map((hero) =>
    heroPoints(hero, selection.format, catalogue),
  );
  const lines = [
    ...ratingLines(selection.format, catalogue),
    ...armyCardLines(selection, catalogue),
    ...eventCardLines(selection, catalogue),
    ...delayedEntryLines(selection, catalogue, units, heroes),
  ];
  const standPoints = sum(units.map(({ points }) => points));
  const heroTotal = sum(heroes.map(({ points }) => points));
  const lineTotal = sum(lines.map(linePoints));
  const victoryValue = standPoints + heroTotal;
  return {
    units,
    heroes,
    lines,
    standPoints,
    heroPoints: heroTotal,
    linePoints: lineTotal,
    victoryValue,
    total: victoryValue + lineTotal,
  };
};
