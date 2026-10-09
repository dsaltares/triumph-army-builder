import { z } from 'zod';
import {
  type BattleCardCategory,
  type BattleCardCostRule,
  type BattleCardPurchaseScope,
  battleCardCategories,
  battleCardPurchaseScopes,
  type StandCostEffect,
} from '../domain/battle-cards/cost-rules.ts';
import {
  type FantasyCard,
  type FantasyCardConstraint,
  type FantasyCardCost,
  type FantasyFormat,
  type FantasyStandSelector,
  fantasyCardBearers,
  fantasyCardCategories,
  unpricedVariantProblems,
} from '../domain/fantasy/battle-cards.ts';
import type { StandFigures, TroopTypeBasing } from '../domain/troop-types.ts';
import {
  type BattleCardCode,
  battleCardCodes,
  type FantasyCardCode,
  fantasyCardCodes,
  fantasyTopographies,
  type TroopTypeCode,
  troopTypeCategories,
  troopTypeCodes,
  troopTypeOrders,
} from './schema.ts';
import type {
  SubFactionClause,
  SubFactionGroup,
  SubFactionVariant,
} from './sub-factions.ts';

export type CuratedBattleCardCost = {
  name: string;
  category: BattleCardCategory;
  purchasedPer: BattleCardPurchaseScope;
  rule: BattleCardCostRule;
  sources: readonly string[];
};

export type CuratedFantasyCard = FantasyCard & { sources: readonly string[] };

export type FantasyCuration = {
  troopTypeNames: Readonly<Partial<Record<TroopTypeCode, string>>>;
  cards: Readonly<Record<FantasyCardCode, CuratedFantasyCard>>;
  text: Readonly<Record<FantasyCardCode, string>>;
  format: FantasyFormat;
};

export type GameCurations = {
  fantasy?: FantasyCuration;
};

export type Curation = {
  movement: Readonly<Partial<Record<TroopTypeCode, number>>>;
  basing: Readonly<Partial<Record<TroopTypeCode, TroopTypeBasing>>>;
  battleCardCosts: Readonly<Record<BattleCardCode, CuratedBattleCardCost>>;
  subFactions: Readonly<Record<string, SubFactionGroup>>;
  games: GameCurations;
};

const identifier = z.string().min(1);

const points = z.number().nonnegative();

const standCostEffectSchema: z.ZodType<StandCostEffect> = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({ kind: z.literal('reduceBy'), points }),
    z.strictObject({ kind: z.literal('setTo'), points }),
  ],
);

export const battleCardCostRuleSchema: z.ZodType<BattleCardCostRule> =
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('free') }),
    z.strictObject({ kind: z.literal('flat'), points }),
    z.strictObject({ kind: z.literal('perStand'), pointsPerStand: points }),
    z.strictObject({ kind: z.literal('perCard'), pointsPerCard: points }),
    z.strictObject({
      kind: z.literal('perCardCapped'),
      pointsPerCard: points,
      maxPoints: points,
    }),
    z.strictObject({
      kind: z.literal('firstFreeThenFlat'),
      countedIn: z.enum(['cards', 'stands']),
      pointsAfterFirst: points,
      cumulative: z.boolean(),
    }),
    z.strictObject({
      kind: z.literal('modifiesStandCost'),
      effect: standCostEffectSchema,
    }),
    z.strictObject({
      kind: z.literal('conditional'),
      pointsPerDeclaration: points,
    }),
  ]);

export const battleCardPurchaseScopeSchema = z.enum(battleCardPurchaseScopes);

const figureCount = z.int().positive();

const standFiguresSchema: z.ZodType<StandFigures> = z.discriminatedUnion(
  'kind',
  [
    z.strictObject({
      kind: z.literal('figures'),
      min: figureCount,
      max: figureCount,
    }),
    z.strictObject({ kind: z.literal('modelWithCrew') }),
  ],
);

const depth = z.int().positive();

export const troopTypeBasingSchema: z.ZodType<TroopTypeBasing> = z.strictObject(
  {
    depths: z.strictObject({ 40: depth, 60: depth, 80: depth }),
    figures: standFiguresSchema,
  },
);

export const movementSchema = z.int().positive();

const subFactionClauseSchema: z.ZodType<SubFactionClause> = z.union([
  identifier,
  z
    .strictObject({
      variant: identifier,
      from: z.int().optional(),
      to: z.int().optional(),
    })
    .transform(
      ({ variant, from, to }): SubFactionClause => ({
        variant,
        ...(from === undefined ? {} : { from }),
        ...(to === undefined ? {} : { to }),
      }),
    ),
]);

const subFactionVariantSchema: z.ZodType<SubFactionVariant> = z
  .strictObject({
    id: identifier,
    name: z.string(),
    year: z.int().optional(),
  })
  .transform(
    ({ id, name, year }): SubFactionVariant => ({
      id,
      name,
      ...(year === undefined ? {} : { year }),
    }),
  );

export const subFactionGroupSchema: z.ZodType<SubFactionGroup> = z.strictObject(
  {
    army: z.string(),
    label: z.string(),
    variants: z.array(subFactionVariantSchema).min(1),
    rules: z.record(
      z.string(),
      z.union([
        z.strictObject({ only: z.array(subFactionClauseSchema).min(1) }),
        z.strictObject({ except: z.array(identifier).min(1) }),
      ]),
    ),
  },
);

const curatedBattleCardCostSchema: z.ZodType<CuratedBattleCardCost> =
  z.strictObject({
    name: z.string().min(1),
    category: z.enum(battleCardCategories),
    purchasedPer: battleCardPurchaseScopeSchema,
    rule: battleCardCostRuleSchema,
    sources: z.array(z.string().min(1)).min(1),
  });

const halfPoints = z.number().multipleOf(0.5);

const cardCount = z.int().positive();

const fantasyCardCode = z.enum(fantasyCardCodes);

const fantasyCardCodeList = z.array(fantasyCardCode).min(1);

const fantasyStandSelectorSchema: z.ZodType<FantasyStandSelector> = z
  .strictObject({
    troopTypes: z.array(z.enum(troopTypeCodes)).min(1).exactOptional(),
    order: z.enum(troopTypeOrders).exactOptional(),
    category: z.enum(troopTypeCategories).exactOptional(),
    minMovement: movementSchema.exactOptional(),
    cards: fantasyCardCodeList.exactOptional(),
  })
  .refine((selector) => Object.keys(selector).length > 0, {
    message: 'a selector must name at least one thing a stand is',
  });

const fantasyCardCostSchema: z.ZodType<FantasyCardCost> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('flat'), points: halfPoints }),
    z.strictObject({
      kind: z.literal('byTroopType'),
      points: halfPoints,
      overrides: z
        .array(
          z.strictObject({
            when: fantasyStandSelectorSchema,
            points: halfPoints,
          }),
        )
        .min(1),
    }),
    z.strictObject({
      kind: z.literal('byTopography'),
      points: halfPoints,
      dense: halfPoints,
    }),
    z.strictObject({
      kind: z.literal('byVariant'),
      choice: identifier,
      options: z.record(identifier, fantasyCardCostSchema),
    }),
    z.strictObject({
      kind: z.literal('perCount'),
      max: cardCount,
      each: fantasyCardCostSchema,
    }),
    z.strictObject({
      kind: z.literal('perMarkedCappedAtValue'),
      points: halfPoints,
    }),
    z.strictObject({
      kind: z.literal('byBearer'),
      stand: fantasyCardCostSchema,
      hero: fantasyCardCostSchema,
    }),
  ]),
);

const fantasyCardConstraintSchema: z.ZodType<FantasyCardConstraint> =
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('eligible'),
      anyOf: z.array(fantasyStandSelectorSchema).min(1),
    }),
    z.strictObject({
      kind: z.literal('ineligible'),
      anyOf: z.array(fantasyStandSelectorSchema).min(1),
    }),
    z.strictObject({
      kind: z.literal('excludedWith'),
      cards: fantasyCardCodeList,
    }),
    z.strictObject({
      kind: z.literal('requires'),
      cards: fantasyCardCodeList,
      bearer: z.enum(fantasyCardBearers).exactOptional(),
    }),
    z
      .strictObject({
        kind: z.literal('maxPerArmy'),
        stands: cardCount.exactOptional(),
        heroes: cardCount.exactOptional(),
      })
      .refine(
        ({ stands, heroes }) => stands !== undefined || heroes !== undefined,
        { message: 'a maximum must cap stands, heroes or both' },
      ),
    z.strictObject({ kind: z.literal('oncePerArmy') }),
    z.strictObject({ kind: z.literal('notOnGeneral') }),
    z.strictObject({ kind: z.literal('notOnHeroes') }),
    z.strictObject({ kind: z.literal('oneClassPerArmy') }),
  ]);

const variantOptionsSchema = z
  .record(identifier, z.string().min(1))
  .refine((options) => Object.keys(options).length >= 2, {
    message: 'a variant offers at least two options',
  });

export const fantasyCardShape = {
  name: z.string().min(1),
  category: z.enum(fantasyCardCategories),
  variants: z.record(identifier, variantOptionsSchema).exactOptional(),
  cost: fantasyCardCostSchema,
  constraints: z.array(fantasyCardConstraintSchema),
};

export const pricesEveryVariant = (
  card: Pick<FantasyCard, 'variants' | 'cost'>,
  context: z.RefinementCtx,
) => {
  for (const message of unpricedVariantProblems(card)) {
    context.addIssue({ code: 'custom', path: ['cost'], message });
  }
};

export const fantasyCardSchema: z.ZodType<FantasyCard> = z
  .strictObject(fantasyCardShape)
  .superRefine(pricesEveryVariant);

const curatedFantasyCardSchema: z.ZodType<CuratedFantasyCard> = z
  .strictObject({
    ...fantasyCardShape,
    sources: z.array(z.string().min(1)).min(1),
  })
  .superRefine(pricesEveryVariant);

const ratingCostsSchema = z.strictObject({
  base: z.int().min(0).max(4),
  costs: z.strictObject({
    0: halfPoints,
    1: halfPoints,
    2: halfPoints,
    3: halfPoints,
    4: halfPoints,
  }),
});

const positivePoints = halfPoints.positive();

export const fantasyFormatSchema: z.ZodType<FantasyFormat> = z.strictObject({
  points: positivePoints,
  pointsPerRequiredStand: positivePoints,
  minimumStandCost: positivePoints,
  heroes: z.strictObject({
    max: cardCount,
    maxPoints: positivePoints,
    cost: positivePoints,
    mayTakeNegativeCostCards: z.boolean(),
  }),
  invasion: ratingCostsSchema,
  maneuver: ratingCostsSchema,
  denseTopographies: z.array(z.enum(fantasyTopographies)).min(1),
  victory: z
    .strictObject({ numerator: cardCount, denominator: cardCount })
    .refine(({ numerator, denominator }) => numerator < denominator, {
      message: 'victory takes a share of the army, not all of it',
    }),
});

export const fantasyCurationSchema = z.strictObject({
  troopTypeNames: z.partialRecord(z.enum(troopTypeCodes), z.string().min(1)),
  cards: z.record(fantasyCardCode, curatedFantasyCardSchema),
  text: z.record(fantasyCardCode, z.string().min(1)),
  format: fantasyFormatSchema,
}) satisfies z.ZodType<FantasyCuration>;

export const curationSchema = z.strictObject({
  movement: z.partialRecord(z.enum(troopTypeCodes), movementSchema),
  basing: z.partialRecord(z.enum(troopTypeCodes), troopTypeBasingSchema),
  battleCardCosts: z.record(
    z.enum(battleCardCodes),
    curatedBattleCardCostSchema,
  ),
  subFactions: z.record(identifier, subFactionGroupSchema),
  games: z.strictObject({ fantasy: fantasyCurationSchema.exactOptional() }),
}) satisfies z.ZodType<Curation>;
