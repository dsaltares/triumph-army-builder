import { z } from 'zod';
import {
  type BattleCardCategory,
  type BattleCardCostRule,
  type BattleCardPurchaseScope,
  battleCardCategories,
  battleCardPurchaseScopes,
  type StandCostEffect,
} from '../domain/battle-cards/cost-rules.ts';
import type { StandFigures, TroopTypeBasing } from '../domain/troop-types.ts';
import {
  type BattleCardCode,
  battleCardCodes,
  type TroopTypeCode,
  troopTypeCodes,
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

export type Curation = {
  movement: Readonly<Partial<Record<TroopTypeCode, number>>>;
  basing: Readonly<Partial<Record<TroopTypeCode, TroopTypeBasing>>>;
  battleCardCosts: Readonly<Record<BattleCardCode, CuratedBattleCardCost>>;
  subFactions: Readonly<Record<string, SubFactionGroup>>;
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

export const curationSchema = z.strictObject({
  movement: z.partialRecord(z.enum(troopTypeCodes), movementSchema),
  basing: z.partialRecord(z.enum(troopTypeCodes), troopTypeBasingSchema),
  battleCardCosts: z.record(
    z.enum(battleCardCodes),
    curatedBattleCardCostSchema,
  ),
  subFactions: z.record(identifier, subFactionGroupSchema),
}) satisfies z.ZodType<Curation>;
