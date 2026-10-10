import type { BundledFantasyCard } from '../../data/bundle.ts';
import type { FantasyCardCode } from '../../data/schema.ts';
import {
  type FindingReport,
  type FindingSeverity,
  findingReport,
} from '../findings.ts';
import { sum } from '../numbers.ts';
import type {
  FantasyCardCategory,
  FantasyCardConstraint,
} from './battle-cards.ts';
import {
  anySelectorMatches,
  type FantasyCardBearerProfile,
} from './card-pricing.ts';
import {
  delayedEntryCode,
  eventCardsOf,
  type FantasyPoints,
  fantasyPoints,
  fantasyTroopType,
  heroBearer,
  mobileInfantryCode,
  transportsMarked,
} from './points.ts';
import type { FantasyCatalogue } from './reference.ts';
import type {
  FantasyCardChoice,
  FantasyHero,
  FantasyHeroId,
  FantasySelection,
  FantasyUnit,
  FantasyUnitId,
} from './selection-schema.ts';

export type FantasyFindingTarget =
  | { kind: 'army' }
  | { kind: 'format' }
  | { kind: 'general' }
  | { kind: 'unit'; unit: FantasyUnitId }
  | { kind: 'hero'; hero: FantasyHeroId }
  | { kind: 'armyCard'; code: FantasyCardCode }
  | { kind: 'unitCard'; unit: FantasyUnitId; code: FantasyCardCode }
  | { kind: 'heroCard'; hero: FantasyHeroId; code: FantasyCardCode };

export type FantasyCardPlacement = 'unit' | 'hero' | 'event' | 'army';

export type FantasyArmyCountBearer = 'stands' | 'heroes';

export type FantasyMark = 'delayedEntry' | 'transports';

export type FantasyFindingParams = {
  overPointsTotal: { total: number; over: number; pointsTotal: number };
  underPointsTotal: { total: number; unspent: number; pointsTotal: number };
  tooFewStands: { stands: number; required: number; pointsTotal: number };
  tooManyHeroes: { heroes: number; max: number };
  heroPointsAboveMax: { points: number; max: number };
  generalMissing: Record<string, never>;
  generalIsHero: Record<string, never>;
  standCostRaisedToMinimum: { unclamped: number; minimum: number };
  marksExceedStands: { mark: FantasyMark; marked: number; stands: number };
  cardNotInPack: { card: FantasyCardCode };
  cardNotForPlacement: {
    card: FantasyCardCode;
    category: FantasyCardCategory;
    placement: FantasyCardPlacement;
  };
  cardMarkedNotBought: { card: FantasyCardCode };
  cardBoughtTwice: { card: FantasyCardCode };
  variantNotChosen: { card: FantasyCardCode; choice: string };
  cardCountAboveMax: { card: FantasyCardCode; count: number; max: number };
  cardNotEligible: { card: FantasyCardCode };
  cardsExcludeEachOther: { card: FantasyCardCode; other: FantasyCardCode };
  cardRequiresCard: {
    card: FantasyCardCode;
    requires: readonly FantasyCardCode[];
  };
  cardAboveArmyMax: {
    card: FantasyCardCode;
    bearer: FantasyArmyCountBearer;
    count: number;
    max: number;
  };
  cardMoreThanOncePerArmy: { card: FantasyCardCode; count: number };
  cardOnGeneral: { card: FantasyCardCode };
  cardOnHero: { card: FantasyCardCode };
  cardOnSeveralUnits: { card: FantasyCardCode; units: number };
  negativeCardOnHero: { card: FantasyCardCode; points: number };
};

export type FantasyFindingCode = keyof FantasyFindingParams;

export type FantasyFinding = {
  [Code in FantasyFindingCode]: {
    code: Code;
    severity: FindingSeverity;
    target: FantasyFindingTarget;
    params: FantasyFindingParams[Code];
  };
}[FantasyFindingCode];

export type FantasyValidationReport = FindingReport<FantasyFinding>;

const severityOf: Readonly<Record<FantasyFindingCode, FindingSeverity>> = {
  overPointsTotal: 'error',
  underPointsTotal: 'warning',
  tooFewStands: 'error',
  tooManyHeroes: 'error',
  heroPointsAboveMax: 'error',
  generalMissing: 'error',
  generalIsHero: 'error',
  standCostRaisedToMinimum: 'info',
  marksExceedStands: 'warning',
  cardNotInPack: 'warning',
  cardNotForPlacement: 'error',
  cardMarkedNotBought: 'warning',
  cardBoughtTwice: 'error',
  variantNotChosen: 'warning',
  cardCountAboveMax: 'error',
  cardNotEligible: 'error',
  cardsExcludeEachOther: 'error',
  cardRequiresCard: 'error',
  cardAboveArmyMax: 'error',
  cardMoreThanOncePerArmy: 'error',
  cardOnGeneral: 'error',
  cardOnHero: 'error',
  cardOnSeveralUnits: 'error',
  negativeCardOnHero: 'error',
};

const finding = <Code extends FantasyFindingCode>(
  code: Code,
  target: FantasyFindingTarget,
  params: FantasyFindingParams[Code],
) =>
  ({
    code,
    severity: severityOf[code],
    target,
    params,
  }) as FantasyFinding;

const placementCategories: Readonly<
  Record<FantasyCardPlacement, readonly FantasyCardCategory[]>
> = {
  unit: ['stand', 'standOrHero'],
  hero: ['hero', 'standOrHero'],
  event: ['event'],
  army: ['army'],
};

const unitTarget = (unit: FantasyUnit, code: FantasyCardCode) =>
  ({ kind: 'unitCard', unit: unit.id, code }) as const;

const heroTarget = (hero: FantasyHero, code: FantasyCardCode) =>
  ({ kind: 'heroCard', hero: hero.id, code }) as const;

const markedStands = (unit: FantasyUnit, code: FantasyCardCode) => {
  if (code === delayedEntryCode) {
    return Math.min(unit.marks.delayedEntry, unit.stands);
  }
  if (code === mobileInfantryCode) {
    return Math.min(unit.marks.transports, unit.stands);
  }
  return 0;
};

export const unitCardCodes = (
  unit: FantasyUnit,
): readonly FantasyCardCode[] => [
  ...unit.cards.map(({ code }) => code),
  ...eventCardsOf(unit).map(([code]) => code),
  ...[delayedEntryCode, mobileInfantryCode].filter(
    (code) => markedStands(unit, code) > 0,
  ),
];

const heroCardCodes = (hero: FantasyHero): readonly FantasyCardCode[] => [
  ...hero.cards.map(({ code }) => code),
  ...(hero.delayedEntry ? [delayedEntryCode] : []),
];

type UnitHolding = { unit: FantasyUnit; stands: number };

type CardHoldings = {
  units: readonly UnitHolding[];
  heroes: readonly FantasyHero[];
  armyPurchases: number;
};

const holdingsOf = (
  code: FantasyCardCode,
  selection: FantasySelection,
): CardHoldings => ({
  units: selection.units.flatMap((unit) => {
    const stands = unitCardCodes(unit).includes(code)
      ? markedStands(unit, code) || unit.stands
      : 0;
    return stands > 0 ? [{ unit, stands }] : [];
  }),
  heroes: selection.heroes.filter((hero) => heroCardCodes(hero).includes(code)),
  armyPurchases: sum(
    selection.armyCards
      .filter((armyCard) => armyCard.code === code)
      .map(({ count }) => count ?? 1),
  ),
});

const unitProfile = (
  catalogue: FantasyCatalogue,
  unit: FantasyUnit,
): FantasyCardBearerProfile => ({
  kind: 'stand',
  troopType: fantasyTroopType(catalogue, unit.troopType),
  cards: unitCardCodes(unit),
});

const heroProfile = (hero: FantasyHero): FantasyCardBearerProfile => ({
  ...heroBearer(hero),
  cards: heroCardCodes(hero),
});

type Bearer = {
  profile: FantasyCardBearerProfile;
  target: FantasyFindingTarget;
};

const bearersOf = (
  holdings: CardHoldings,
  code: FantasyCardCode,
  catalogue: FantasyCatalogue,
): readonly Bearer[] => [
  ...holdings.units.map(({ unit }) => ({
    profile: unitProfile(catalogue, unit),
    target: unitTarget(unit, code),
  })),
  ...holdings.heroes.map((hero) => ({
    profile: heroProfile(hero),
    target: heroTarget(hero, code),
  })),
];

const bearerFindings = (
  code: FantasyCardCode,
  constraint: FantasyCardConstraint,
  { profile, target }: Bearer,
): readonly FantasyFinding[] => {
  switch (constraint.kind) {
    case 'eligible':
      return anySelectorMatches(constraint.anyOf, profile)
        ? []
        : [finding('cardNotEligible', target, { card: code })];
    case 'ineligible':
      return anySelectorMatches(constraint.anyOf, profile)
        ? [finding('cardNotEligible', target, { card: code })]
        : [];
    case 'excludedWith':
      return constraint.cards
        .filter((other) => other !== code && profile.cards.includes(other))
        .map((other) =>
          finding('cardsExcludeEachOther', target, {
            card: code < other ? code : other,
            other: code < other ? other : code,
          }),
        );
    case 'requires': {
      const applies =
        constraint.bearer === undefined ||
        constraint.bearer === (profile.kind === 'hero' ? 'hero' : 'stand');
      return applies &&
        !constraint.cards.every((required) => profile.cards.includes(required))
        ? [
            finding('cardRequiresCard', target, {
              card: code,
              requires: constraint.cards,
            }),
          ]
        : [];
    }
    case 'notOnHeroes':
      return profile.kind === 'hero'
        ? [finding('cardOnHero', target, { card: code })]
        : [];
    case 'maxPerArmy':
    case 'oncePerArmy':
    case 'notOnGeneral':
    case 'oneClassPerArmy':
      return [];
  }
};

const armyFindings = (
  code: FantasyCardCode,
  constraint: FantasyCardConstraint,
  holdings: CardHoldings,
  selection: FantasySelection,
): readonly FantasyFinding[] => {
  const target = { kind: 'armyCard', code } as const;
  switch (constraint.kind) {
    case 'maxPerArmy': {
      const stands = sum(holdings.units.map(({ stands }) => stands));
      const heroes = holdings.heroes.length;
      return [
        ...(constraint.stands !== undefined && stands > constraint.stands
          ? [
              finding('cardAboveArmyMax', target, {
                card: code,
                bearer: 'stands',
                count: stands,
                max: constraint.stands,
              }),
            ]
          : []),
        ...(constraint.heroes !== undefined && heroes > constraint.heroes
          ? [
              finding('cardAboveArmyMax', target, {
                card: code,
                bearer: 'heroes',
                count: heroes,
                max: constraint.heroes,
              }),
            ]
          : []),
      ];
    }
    case 'oncePerArmy': {
      const count =
        holdings.armyPurchases + holdings.units.length + holdings.heroes.length;
      return count > 1
        ? [finding('cardMoreThanOncePerArmy', target, { card: code, count })]
        : [];
    }
    case 'notOnGeneral': {
      const general = holdings.units.find(
        ({ unit }) => unit.id === selection.general,
      );
      return general && general.stands >= general.unit.stands
        ? [
            finding('cardOnGeneral', unitTarget(general.unit, code), {
              card: code,
            }),
          ]
        : [];
    }
    case 'oneClassPerArmy':
      return holdings.units.length > 1
        ? [
            finding('cardOnSeveralUnits', target, {
              card: code,
              units: holdings.units.length,
            }),
          ]
        : [];
    case 'eligible':
    case 'ineligible':
    case 'excludedWith':
    case 'requires':
    case 'notOnHeroes':
      return [];
  }
};

const constraintFindings = (
  card: BundledFantasyCard,
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] => {
  const holdings = holdingsOf(card.code, selection);
  const bearers = bearersOf(holdings, card.code, catalogue);
  return card.constraints.flatMap((constraint) => [
    ...bearers.flatMap((bearer) =>
      bearerFindings(card.code, constraint, bearer),
    ),
    ...armyFindings(card.code, constraint, holdings, selection),
  ]);
};

const variantFindings = (
  card: BundledFantasyCard,
  variants: Readonly<Record<string, string>> | undefined,
  target: FantasyFindingTarget,
): readonly FantasyFinding[] => {
  const unchosen = Object.entries(card.variants ?? {}).find(
    ([choice, options]) => {
      const chosen = variants?.[choice];
      return chosen === undefined || !(chosen in options);
    },
  );
  return unchosen
    ? [
        finding('variantNotChosen', target, {
          card: card.code,
          choice: unchosen[0],
        }),
      ]
    : [];
};

const countMax = (card: BundledFantasyCard) =>
  card.cost.kind === 'perCount' ? card.cost.max : 1;

const countFindings = (
  card: BundledFantasyCard,
  count: number,
  target: FantasyFindingTarget,
): readonly FantasyFinding[] =>
  count > countMax(card)
    ? [
        finding('cardCountAboveMax', target, {
          card: card.code,
          count,
          max: countMax(card),
        }),
      ]
    : [];

const duplicateCodes = (codes: readonly FantasyCardCode[]) =>
  [...new Set(codes)].filter(
    (code) => codes.filter((other) => other === code).length > 1,
  );

const placementFindings = (
  code: FantasyCardCode,
  placement: FantasyCardPlacement,
  target: FantasyFindingTarget,
  catalogue: FantasyCatalogue,
  check: (card: BundledFantasyCard) => readonly FantasyFinding[],
): readonly FantasyFinding[] => {
  const card = catalogue.cards.get(code);
  if (card === undefined) {
    return [finding('cardNotInPack', target, { card: code })];
  }
  if (!placementCategories[placement].includes(card.category)) {
    return [
      finding('cardNotForPlacement', target, {
        card: code,
        category: card.category,
        placement,
      }),
    ];
  }
  return check(card);
};

const chosenCardFindings = (
  choices: readonly FantasyCardChoice[],
  placement: 'unit' | 'hero',
  targetOf: (code: FantasyCardCode) => FantasyFindingTarget,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] => [
  ...duplicateCodes(choices.map(({ code }) => code)).map((code) =>
    finding('cardBoughtTwice', targetOf(code), { card: code }),
  ),
  ...choices.flatMap(({ code, variants }) =>
    placementFindings(code, placement, targetOf(code), catalogue, (card) =>
      variantFindings(card, variants, targetOf(code)),
    ),
  ),
];

const unitFindings = (
  unit: FantasyUnit,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] => [
  ...chosenCardFindings(
    unit.cards,
    'unit',
    (code) => unitTarget(unit, code),
    catalogue,
  ),
  ...eventCardsOf(unit).flatMap(([code, count]) =>
    placementFindings(
      code,
      'event',
      unitTarget(unit, code),
      catalogue,
      (card) => countFindings(card, count, unitTarget(unit, code)),
    ),
  ),
  ...(['delayedEntry', 'transports'] as const)
    .filter((mark) => unit.marks[mark] > unit.stands)
    .map((mark) =>
      finding(
        'marksExceedStands',
        { kind: 'unit', unit: unit.id },
        { mark, marked: unit.marks[mark], stands: unit.stands },
      ),
    ),
];

const heroFindings = (
  hero: FantasyHero,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] =>
  chosenCardFindings(
    hero.cards,
    'hero',
    (code) => heroTarget(hero, code),
    catalogue,
  );

const armyCardFindings = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] => {
  const target = (code: FantasyCardCode) =>
    ({ kind: 'armyCard', code }) as const;
  const transports = transportsMarked(selection.units);
  const transportsBought = selection.armyCards.some(
    ({ code }) => code === mobileInfantryCode,
  );
  return [
    ...duplicateCodes(selection.armyCards.map(({ code }) => code)).map((code) =>
      finding('cardBoughtTwice', target(code), { card: code }),
    ),
    ...selection.armyCards.flatMap(({ code, count, variants }) =>
      code === delayedEntryCode
        ? [finding('cardMarkedNotBought', target(code), { card: code })]
        : placementFindings(code, 'army', target(code), catalogue, (card) => [
            ...variantFindings(card, variants, target(code)),
            ...countFindings(
              card,
              code === mobileInfantryCode ? transports : (count ?? 1),
              target(code),
            ),
          ]),
    ),
    ...(transports > 0 && !transportsBought
      ? [
          finding('variantNotChosen', target(mobileInfantryCode), {
            card: mobileInfantryCode,
            choice:
              Object.keys(
                catalogue.cards.get(mobileInfantryCode)?.variants ?? {},
              )[0] ?? '',
          }),
        ]
      : []),
  ];
};

const pointsFindings = (
  selection: FantasySelection,
  points: FantasyPoints,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] => {
  const { pointsTotal } = selection.format;
  const { total } = points;
  const army = { kind: 'army' } as const;
  const stands = sum(selection.units.map((unit) => unit.stands));
  const required = Math.floor(
    pointsTotal / catalogue.format.pointsPerRequiredStand,
  );
  const heroRules = catalogue.format.heroes;
  return [
    ...(total > pointsTotal
      ? [
          finding('overPointsTotal', army, {
            total,
            over: total - pointsTotal,
            pointsTotal,
          }),
        ]
      : []),
    ...(total < pointsTotal
      ? [
          finding('underPointsTotal', army, {
            total,
            unspent: pointsTotal - total,
            pointsTotal,
          }),
        ]
      : []),
    ...(stands < required
      ? [finding('tooFewStands', army, { stands, required, pointsTotal })]
      : []),
    ...(selection.heroes.length > heroRules.max
      ? [
          finding('tooManyHeroes', army, {
            heroes: selection.heroes.length,
            max: heroRules.max,
          }),
        ]
      : []),
    ...(points.heroPoints > heroRules.maxPoints
      ? [
          finding('heroPointsAboveMax', army, {
            points: points.heroPoints,
            max: heroRules.maxPoints,
          }),
        ]
      : []),
    ...points.units.flatMap((unit) =>
      unit.unclampedPointsPerStand < unit.pointsPerStand
        ? [
            finding(
              'standCostRaisedToMinimum',
              { kind: 'unit', unit: unit.unit },
              {
                unclamped: unit.unclampedPointsPerStand,
                minimum: unit.pointsPerStand,
              },
            ),
          ]
        : [],
    ),
    ...(heroRules.mayTakeNegativeCostCards
      ? []
      : points.heroes.flatMap(({ hero, cards }) =>
          cards.flatMap(({ code, points: cardPoints }) =>
            cardPoints !== null && cardPoints < 0
              ? [
                  finding(
                    'negativeCardOnHero',
                    { kind: 'heroCard', hero, code },
                    { card: code, points: cardPoints },
                  ),
                ]
              : [],
          ),
        )),
  ];
};

const generalFindings = (
  selection: FantasySelection,
): readonly FantasyFinding[] => {
  const target = { kind: 'general' } as const;
  if (selection.heroes.some(({ id }) => id === selection.general)) {
    return [finding('generalIsHero', target, {})];
  }
  return selection.units.some(({ id }) => id === selection.general)
    ? []
    : [finding('generalMissing', target, {})];
};

export const validateFantasyList = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): readonly FantasyFinding[] => [
  ...pointsFindings(selection, fantasyPoints(selection, catalogue), catalogue),
  ...generalFindings(selection),
  ...selection.units.flatMap((unit) => unitFindings(unit, catalogue)),
  ...selection.heroes.flatMap((hero) => heroFindings(hero, catalogue)),
  ...armyCardFindings(selection, catalogue),
  ...[...catalogue.cards.values()].flatMap((card) =>
    constraintFindings(card, selection, catalogue),
  ),
];

export const fantasyValidationReport = (
  selection: FantasySelection,
  catalogue: FantasyCatalogue,
): FantasyValidationReport =>
  findingReport(validateFantasyList(selection, catalogue));
