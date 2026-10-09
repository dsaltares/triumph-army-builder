import type { BundledFantasyCard, FantasyCardText } from '../../data/bundle.ts';
import type {
  FantasyCardCode,
  FantasyTopography,
  TroopTypeCategory,
  TroopTypeOrder,
} from '../../data/schema.ts';
import { by } from '../ordering.ts';
import type { TroopTypeNames } from '../troop-types.ts';
import {
  type FantasyCardBearer,
  type FantasyCardCategory,
  type FantasyCardConstraint,
  type FantasyCardCost,
  type FantasyStandSelector,
  fantasyCardCategories,
  variantChoicesOf,
} from './battle-cards.ts';
import { fantasyCardName } from './naming.ts';

export type DescribedSelectorTerm =
  | { kind: 'troopTypes'; names: readonly string[] }
  | { kind: 'order'; order: TroopTypeOrder }
  | { kind: 'category'; category: TroopTypeCategory }
  | { kind: 'minMovement'; distance: number }
  | { kind: 'cards'; names: readonly string[] };

export type DescribedSelector = readonly DescribedSelectorTerm[];

export type CostQualifier =
  | { kind: 'variant'; name: string }
  | { kind: 'bearer'; bearer: FantasyCardBearer }
  | { kind: 'denseTopography'; topographies: readonly FantasyTopography[] }
  | { kind: 'otherTopography' }
  | { kind: 'stand'; when: DescribedSelector }
  | { kind: 'otherwise' };

export type CostBasis =
  | { kind: 'once' }
  | { kind: 'perCount'; max: number }
  | { kind: 'perMarked' };

export type CostLine = {
  points: number;
  basis: CostBasis;
  qualifiers: readonly CostQualifier[];
};

export type DescribedConstraint =
  | { kind: 'eligible'; anyOf: readonly DescribedSelector[] }
  | { kind: 'ineligible'; anyOf: readonly DescribedSelector[] }
  | { kind: 'excludedWith'; cards: readonly string[] }
  | {
      kind: 'requires';
      cards: readonly string[];
      bearer: FantasyCardBearer | null;
    }
  | { kind: 'maxStandsPerArmy'; max: number }
  | { kind: 'maxHeroesPerArmy'; max: number }
  | { kind: 'oncePerArmy' }
  | { kind: 'notOnGeneral' }
  | { kind: 'notOnHeroes' }
  | { kind: 'oneClassPerArmy' };

export type FantasyReferenceCard = {
  code: FantasyCardCode;
  name: string;
  cost: readonly CostLine[];
  choices: readonly (readonly string[])[];
  constraints: readonly DescribedConstraint[];
  text: string;
};

export type FantasyReferenceCardGroup = {
  category: FantasyCardCategory;
  cards: readonly FantasyReferenceCard[];
};

export type FantasyCardNaming = {
  troopTypeNames: TroopTypeNames;
  cards: readonly BundledFantasyCard[];
  denseTopographies: readonly FantasyTopography[];
};

const unpricedChoices = ({ variants = {}, cost }: BundledFantasyCard) => {
  const priced = new Set(variantChoicesOf(cost).map(({ choice }) => choice));
  return Object.entries(variants)
    .filter(([choice]) => !priced.has(choice))
    .map(([, options]) => Object.values(options));
};

const describer = ({
  troopTypeNames,
  cards,
  denseTopographies,
}: FantasyCardNaming) => {
  const byCode = new Map(cards.map((card) => [card.code, card]));
  const cardNames = (codes: readonly FantasyCardCode[]) =>
    codes.map((code) => fantasyCardName(code, byCode.get(code)));

  const selector = ({
    troopTypes,
    order,
    category,
    minMovement,
    cards: carried,
  }: FantasyStandSelector): DescribedSelector => [
    ...(order === undefined ? [] : [{ kind: 'order', order } as const]),
    ...(category === undefined
      ? []
      : [{ kind: 'category', category } as const]),
    ...(troopTypes === undefined
      ? []
      : [
          {
            kind: 'troopTypes',
            names: troopTypes.map((code) => troopTypeNames[code]),
          } as const,
        ]),
    ...(minMovement === undefined
      ? []
      : [{ kind: 'minMovement', distance: minMovement } as const]),
    ...(carried === undefined
      ? []
      : [{ kind: 'cards', names: cardNames(carried) } as const]),
  ];

  const costLines = (
    cost: FantasyCardCost,
    card: BundledFantasyCard,
    basis: CostBasis,
    qualifiers: readonly CostQualifier[],
  ): readonly CostLine[] => {
    switch (cost.kind) {
      case 'flat':
        return [{ points: cost.points, basis, qualifiers }];
      case 'perMarkedCappedAtValue':
        return [
          { points: cost.points, basis: { kind: 'perMarked' }, qualifiers },
        ];
      case 'byTroopType':
        return [
          ...cost.overrides.map(({ when, points }) => ({
            points,
            basis,
            qualifiers: [
              ...qualifiers,
              { kind: 'stand', when: selector(when) } as const,
            ],
          })),
          {
            points: cost.points,
            basis,
            qualifiers: [...qualifiers, { kind: 'otherwise' } as const],
          },
        ];
      case 'byTopography':
        return [
          {
            points: cost.dense,
            basis,
            qualifiers: [
              ...qualifiers,
              { kind: 'denseTopography', topographies: denseTopographies },
            ],
          },
          {
            points: cost.points,
            basis,
            qualifiers: [...qualifiers, { kind: 'otherTopography' }],
          },
        ];
      case 'byVariant':
        return Object.entries(cost.options).flatMap(([option, priced]) =>
          costLines(priced, card, basis, [
            ...qualifiers,
            {
              kind: 'variant',
              name: card.variants?.[cost.choice]?.[option] ?? option,
            },
          ]),
        );
      case 'perCount':
        return costLines(
          cost.each,
          card,
          { kind: 'perCount', max: cost.max },
          qualifiers,
        );
      case 'byBearer':
        return [
          ...costLines(cost.stand, card, basis, [
            ...qualifiers,
            { kind: 'bearer', bearer: 'stand' },
          ]),
          ...costLines(cost.hero, card, basis, [
            ...qualifiers,
            { kind: 'bearer', bearer: 'hero' },
          ]),
        ];
    }
  };

  const constraint = (
    described: FantasyCardConstraint,
  ): readonly DescribedConstraint[] => {
    switch (described.kind) {
      case 'eligible':
      case 'ineligible':
        return [{ kind: described.kind, anyOf: described.anyOf.map(selector) }];
      case 'excludedWith':
        return [{ kind: 'excludedWith', cards: cardNames(described.cards) }];
      case 'requires':
        return [
          {
            kind: 'requires',
            cards: cardNames(described.cards),
            bearer: described.bearer ?? null,
          },
        ];
      case 'maxPerArmy':
        return [
          ...(described.stands === undefined
            ? []
            : [{ kind: 'maxStandsPerArmy', max: described.stands } as const]),
          ...(described.heroes === undefined
            ? []
            : [{ kind: 'maxHeroesPerArmy', max: described.heroes } as const]),
        ];
      case 'oncePerArmy':
      case 'notOnGeneral':
      case 'notOnHeroes':
      case 'oneClassPerArmy':
        return [{ kind: described.kind }];
    }
  };

  return {
    cost: (card: BundledFantasyCard) =>
      costLines(card.cost, card, { kind: 'once' }, []),
    constraints: (card: BundledFantasyCard) =>
      card.constraints.flatMap(constraint),
  };
};

export const fantasyCardReference = (
  naming: FantasyCardNaming,
  text: Readonly<FantasyCardText>,
): readonly FantasyReferenceCardGroup[] => {
  const describe = describer(naming);
  return fantasyCardCategories
    .map((category) => ({
      category,
      cards: naming.cards
        .filter((card) => card.category === category)
        .sort(by((card) => card.name))
        .map((card) => ({
          code: card.code,
          name: card.name,
          cost: describe.cost(card),
          choices: unpricedChoices(card),
          constraints: describe.constraints(card),
          text: text[card.code],
        })),
    }))
    .filter((group) => group.cards.length > 0);
};
