import type { BundledFantasyCard } from '../../data/bundle.ts';
import type { FantasyCardCode, TroopTypeCode } from '../../data/schema.ts';
import type {
  FantasyCardCategory,
  FantasyCardConstraint,
  FantasyFormat,
} from './battle-cards.ts';
import {
  anySelectorMatches,
  cardCostPoints,
  type FantasyCardBearerProfile,
} from './card-pricing.ts';
import {
  delayedEntryCode,
  heroBearer,
  mobileInfantryCode,
  unitBearer,
} from './points.ts';
import type { FantasyCatalogue } from './reference.ts';
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

export const notedCardCodes: readonly FantasyCardCode[] = ['terrainAffinity'];

export const takesNote = (code: FantasyCardCode) =>
  notedCardCodes.includes(code);

export const defaultTopography: FantasyListFormat['topography'] = 'Arable';

export const startFantasyList = (
  format: FantasyFormat,
  dataVersion: string,
  pointsTotal = format.points,
): FantasySelection => ({
  dataVersion,
  format: {
    pointsTotal,
    topography: defaultTopography,
    invasion: format.invasion.base,
    maneuver: format.maneuver.base,
  },
  units: [],
  heroes: [],
  armyCards: [],
  general: null,
});

export const withFormat = (
  selection: FantasySelection,
  change: Partial<FantasyListFormat>,
): FantasySelection => ({
  ...selection,
  format: { ...selection.format, ...change },
});

const newUnit = (id: FantasyUnitId, troopType: TroopTypeCode): FantasyUnit => ({
  id,
  name: '',
  tags: [],
  troopType,
  stands: 1,
  cards: [],
  marks: { delayedEntry: 0, transports: 0, eventCards: {} },
});

export const withUnitAdded = (
  selection: FantasySelection,
  id: FantasyUnitId,
  troopType: TroopTypeCode,
): FantasySelection => ({
  ...selection,
  units: [...selection.units, newUnit(id, troopType)],
  general: selection.general ?? id,
});

const withUnit = (
  selection: FantasySelection,
  id: FantasyUnitId,
  change: (unit: FantasyUnit) => FantasyUnit,
): FantasySelection => ({
  ...selection,
  units: selection.units.map((unit) => (unit.id === id ? change(unit) : unit)),
});

export const withUnitName = (
  selection: FantasySelection,
  id: FantasyUnitId,
  name: string,
) => withUnit(selection, id, (unit) => ({ ...unit, name }));

export const withUnitTags = (
  selection: FantasySelection,
  id: FantasyUnitId,
  tags: readonly string[],
) => withUnit(selection, id, (unit) => ({ ...unit, tags }));

const clampedMarks = (marks: FantasyUnit['marks'], stands: number) => ({
  ...marks,
  delayedEntry: Math.min(marks.delayedEntry, stands),
  transports: Math.min(marks.transports, stands),
});

export const withUnitStands = (
  selection: FantasySelection,
  id: FantasyUnitId,
  stands: number,
) =>
  withUnit(selection, id, (unit) => {
    const kept = Math.max(1, Math.floor(stands));
    return { ...unit, stands: kept, marks: clampedMarks(unit.marks, kept) };
  });

export const withoutUnit = (
  selection: FantasySelection,
  id: FantasyUnitId,
): FantasySelection => {
  const units = selection.units.filter((unit) => unit.id !== id);
  return {
    ...selection,
    units,
    general:
      selection.general === id ? (units[0]?.id ?? null) : selection.general,
  };
};

export const canSplit = (unit: FantasyUnit) => unit.stands > 1;

export const withUnitSplit = (
  selection: FantasySelection,
  id: FantasyUnitId,
  moved: number,
  newId: FantasyUnitId,
): FantasySelection => {
  const index = selection.units.findIndex((unit) => unit.id === id);
  const unit = selection.units[index];
  if (!unit || !canSplit(unit)) {
    return selection;
  }
  const taken = Math.min(Math.max(1, Math.floor(moved)), unit.stands - 1);
  const kept = unit.stands - taken;
  const split: FantasyUnit = {
    ...unit,
    id: newId,
    stands: taken,
    marks: { delayedEntry: 0, transports: 0, eventCards: {} },
  };
  return {
    ...selection,
    units: [
      ...selection.units.slice(0, index),
      { ...unit, stands: kept, marks: clampedMarks(unit.marks, kept) },
      split,
      ...selection.units.slice(index + 1),
    ],
  };
};

export type FantasyMarkKind = 'delayedEntry' | 'transports';

export const withUnitMark = (
  selection: FantasySelection,
  id: FantasyUnitId,
  mark: FantasyMarkKind,
  stands: number,
) =>
  withUnit(selection, id, (unit) => ({
    ...unit,
    marks: {
      ...unit.marks,
      [mark]: Math.min(unit.stands, Math.max(0, Math.floor(stands))),
    },
  }));

export const withUnitEventCard = (
  selection: FantasySelection,
  id: FantasyUnitId,
  code: FantasyCardCode,
  count: number,
) =>
  withUnit(selection, id, (unit) => {
    const { [code]: _dropped, ...rest } = unit.marks.eventCards;
    const kept = Math.max(0, Math.floor(count));
    return {
      ...unit,
      marks: {
        ...unit.marks,
        eventCards: kept > 0 ? { ...rest, [code]: kept } : rest,
      },
    };
  });

const withCard = (
  cards: readonly FantasyCardChoice[],
  code: FantasyCardCode,
): FantasyCardChoice[] =>
  cards.some((card) => card.code === code) ? [...cards] : [...cards, { code }];

const withoutCard = (
  cards: readonly FantasyCardChoice[],
  code: FantasyCardCode,
): FantasyCardChoice[] => cards.filter((card) => card.code !== code);

const withCardChange = (
  cards: readonly FantasyCardChoice[],
  code: FantasyCardCode,
  change: (card: FantasyCardChoice) => FantasyCardChoice,
): FantasyCardChoice[] =>
  cards.map((card) => (card.code === code ? change(card) : card));

const withChosenVariant = <
  Card extends { variants?: Readonly<Record<string, string>> },
>(
  card: Card,
  choice: string,
  option: string,
): Card => ({ ...card, variants: { ...card.variants, [choice]: option } });

export const withUnitCard = (
  selection: FantasySelection,
  id: FantasyUnitId,
  code: FantasyCardCode,
) =>
  withUnit(selection, id, (unit) => ({
    ...unit,
    cards: withCard(unit.cards, code),
  }));

export const withoutUnitCard = (
  selection: FantasySelection,
  id: FantasyUnitId,
  code: FantasyCardCode,
) =>
  withUnit(selection, id, (unit) => ({
    ...unit,
    cards: withoutCard(unit.cards, code),
  }));

export const withUnitCardVariant = (
  selection: FantasySelection,
  id: FantasyUnitId,
  code: FantasyCardCode,
  choice: string,
  option: string,
) =>
  withUnit(selection, id, (unit) => ({
    ...unit,
    cards: withCardChange(unit.cards, code, (card) =>
      withChosenVariant(card, choice, option),
    ),
  }));

export const withUnitCardNote = (
  selection: FantasySelection,
  id: FantasyUnitId,
  code: FantasyCardCode,
  note: string,
) =>
  withUnit(selection, id, (unit) => ({
    ...unit,
    cards: withCardChange(unit.cards, code, (card) => ({ ...card, note })),
  }));

export const withGeneral = (
  selection: FantasySelection,
  id: FantasyUnitId,
): FantasySelection => ({ ...selection, general: id });

export const canAddHero = (
  selection: FantasySelection,
  format: FantasyFormat,
) => selection.heroes.length < format.heroes.max;

export const withHeroAdded = (
  selection: FantasySelection,
  id: FantasyHeroId,
): FantasySelection => ({
  ...selection,
  heroes: [
    ...selection.heroes,
    { id, name: '', tags: [], cards: [], delayedEntry: false },
  ],
});

const withHero = (
  selection: FantasySelection,
  id: FantasyHeroId,
  change: (hero: FantasyHero) => FantasyHero,
): FantasySelection => ({
  ...selection,
  heroes: selection.heroes.map((hero) =>
    hero.id === id ? change(hero) : hero,
  ),
});

export const withHeroName = (
  selection: FantasySelection,
  id: FantasyHeroId,
  name: string,
) => withHero(selection, id, (hero) => ({ ...hero, name }));

export const withHeroTags = (
  selection: FantasySelection,
  id: FantasyHeroId,
  tags: readonly string[],
) => withHero(selection, id, (hero) => ({ ...hero, tags }));

export const withHeroDelayedEntry = (
  selection: FantasySelection,
  id: FantasyHeroId,
  delayedEntry: boolean,
) => withHero(selection, id, (hero) => ({ ...hero, delayedEntry }));

export const withoutHero = (
  selection: FantasySelection,
  id: FantasyHeroId,
): FantasySelection => ({
  ...selection,
  heroes: selection.heroes.filter((hero) => hero.id !== id),
});

export const withHeroCard = (
  selection: FantasySelection,
  id: FantasyHeroId,
  code: FantasyCardCode,
) =>
  withHero(selection, id, (hero) => ({
    ...hero,
    cards: withCard(hero.cards, code),
  }));

export const withoutHeroCard = (
  selection: FantasySelection,
  id: FantasyHeroId,
  code: FantasyCardCode,
) =>
  withHero(selection, id, (hero) => ({
    ...hero,
    cards: withoutCard(hero.cards, code),
  }));

export const withHeroCardVariant = (
  selection: FantasySelection,
  id: FantasyHeroId,
  code: FantasyCardCode,
  choice: string,
  option: string,
) =>
  withHero(selection, id, (hero) => ({
    ...hero,
    cards: withCardChange(hero.cards, code, (card) =>
      withChosenVariant(card, choice, option),
    ),
  }));

export const withArmyCard = (
  selection: FantasySelection,
  code: FantasyCardCode,
): FantasySelection =>
  selection.armyCards.some((card) => card.code === code)
    ? selection
    : { ...selection, armyCards: [...selection.armyCards, { code }] };

export const withoutArmyCard = (
  selection: FantasySelection,
  code: FantasyCardCode,
): FantasySelection => ({
  ...selection,
  armyCards: selection.armyCards.filter((card) => card.code !== code),
});

const withArmyCardChange = (
  selection: FantasySelection,
  code: FantasyCardCode,
  change: (card: FantasyArmyCard) => FantasyArmyCard,
): FantasySelection => ({
  ...selection,
  armyCards: selection.armyCards.map((card) =>
    card.code === code ? change(card) : card,
  ),
});

export const withArmyCardCount = (
  selection: FantasySelection,
  code: FantasyCardCode,
  count: number,
) =>
  withArmyCardChange(selection, code, (card) => ({
    ...card,
    count: Math.max(1, Math.floor(count)),
  }));

export const withArmyCardVariant = (
  selection: FantasySelection,
  code: FantasyCardCode,
  choice: string,
  option: string,
) =>
  withArmyCardChange(selection, code, (card) =>
    withChosenVariant(card, choice, option),
  );

export const cardCountMax = (card: BundledFantasyCard) =>
  card.cost.kind === 'perCount' ? card.cost.max : 1;

export type FantasyCardOffer = {
  card: BundledFantasyCard;
  points: number | null;
};

const offeredCategories = {
  unit: ['stand', 'standOrHero'],
  hero: ['hero', 'standOrHero'],
  event: ['event'],
} as const satisfies Record<string, readonly FantasyCardCategory[]>;

const constraintAdmits = (
  code: FantasyCardCode,
  constraint: FantasyCardConstraint,
  bearer: FantasyCardBearerProfile,
): boolean => {
  switch (constraint.kind) {
    case 'eligible':
      return anySelectorMatches(constraint.anyOf, bearer);
    case 'ineligible':
      return !anySelectorMatches(constraint.anyOf, bearer);
    case 'excludedWith':
      return !constraint.cards.some(
        (other) => other !== code && bearer.cards.includes(other),
      );
    case 'notOnHeroes':
      return bearer.kind !== 'hero';
    case 'requires':
    case 'maxPerArmy':
    case 'oncePerArmy':
    case 'notOnGeneral':
    case 'oneClassPerArmy':
      return true;
  }
};

const bearerMayTake = (
  card: BundledFantasyCard,
  bearer: FantasyCardBearerProfile,
) =>
  card.constraints.every((constraint) =>
    constraintAdmits(card.code, constraint, bearer),
  );

export const cardPoints = (
  card: BundledFantasyCard,
  bearer: FantasyCardBearerProfile | null,
  format: FantasyListFormat,
  catalogue: FantasyCatalogue,
  variants?: Readonly<Record<string, string>>,
  count = 1,
) =>
  cardCostPoints(card.cost, {
    bearer,
    topography: format.topography,
    denseTopographies: catalogue.format.denseTopographies,
    variants,
    count,
  });

const offers = (
  catalogue: FantasyCatalogue,
  categories: readonly FantasyCardCategory[],
  bearer: FantasyCardBearerProfile,
  format: FantasyListFormat,
  taken: readonly FantasyCardCode[],
  admits: (card: BundledFantasyCard, points: number | null) => boolean = () =>
    true,
): readonly FantasyCardOffer[] =>
  [...catalogue.cards.values()].flatMap((card) => {
    if (
      !categories.includes(card.category) ||
      taken.includes(card.code) ||
      !bearerMayTake(card, bearer)
    ) {
      return [];
    }
    const points = cardPoints(card, bearer, format, catalogue);
    return admits(card, points) ? [{ card, points }] : [];
  });

export const unitCardOffers = (
  catalogue: FantasyCatalogue,
  unit: FantasyUnit,
  format: FantasyListFormat,
) =>
  offers(
    catalogue,
    offeredCategories.unit,
    unitBearer(catalogue, unit),
    format,
    unit.cards.map(({ code }) => code),
  );

export const unitEventCardOffers = (
  catalogue: FantasyCatalogue,
  unit: FantasyUnit,
  format: FantasyListFormat,
) =>
  offers(
    catalogue,
    offeredCategories.event,
    unitBearer(catalogue, unit),
    format,
    [],
  );

const mayCarry = (
  catalogue: FantasyCatalogue,
  unit: FantasyUnit,
  code: FantasyCardCode,
) => {
  const card = catalogue.cards.get(code);
  return card !== undefined && bearerMayTake(card, unitBearer(catalogue, unit));
};

export const unitMayBeDelayed = (
  catalogue: FantasyCatalogue,
  unit: FantasyUnit,
) => mayCarry(catalogue, unit, delayedEntryCode);

export const unitMayRide = (catalogue: FantasyCatalogue, unit: FantasyUnit) =>
  mayCarry(catalogue, unit, mobileInfantryCode);

export const heroCardOffers = (
  catalogue: FantasyCatalogue,
  hero: FantasyHero,
  format: FantasyListFormat,
) =>
  offers(
    catalogue,
    offeredCategories.hero,
    heroBearer(hero),
    format,
    hero.cards.map(({ code }) => code),
    (_card, points) =>
      catalogue.format.heroes.mayTakeNegativeCostCards ||
      points === null ||
      points >= 0,
  );

export const armyCardOffers = (
  catalogue: FantasyCatalogue,
  selection: FantasySelection,
): readonly FantasyCardOffer[] =>
  [...catalogue.cards.values()].flatMap((card) =>
    card.category === 'army' &&
    card.code !== delayedEntryCode &&
    !selection.armyCards.some(({ code }) => code === card.code)
      ? [
          {
            card,
            points: cardPoints(card, null, selection.format, catalogue),
          },
        ]
      : [],
  );

export const fantasyRatings = [0, 1, 2, 3, 4] as const;

export type FantasyRating = (typeof fantasyRatings)[number];

export const ratingPoints = (
  format: FantasyFormat,
  kind: 'invasion' | 'maneuver',
  rating: FantasyRating,
) => format[kind].costs[`${rating}`];
