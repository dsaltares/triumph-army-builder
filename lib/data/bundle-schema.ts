import { z } from 'zod';
import type { TagWord } from '../domain/collection/tag-words.ts';
import type {
  AllyContingent,
  ArmyDetail,
  ArmyIndex,
  BattleCardText,
  BundledBattleCard,
  BundledTroopType,
} from './bundle.ts';
import {
  battleCardCostRuleSchema,
  battleCardPurchaseScopeSchema,
  movementSchema,
  subFactionGroupSchema,
  troopTypeBasingSchema,
} from './curation-schema.ts';
import {
  allyOptionSchema,
  armyListStatuses,
  battleCardCategories,
  battleCardCodes,
  battleCardEntrySchema,
  dateRangeSchema,
  generalTroopEntriesSchema,
  homeTopographySchema,
  ratingSchema,
  topographies,
  troopOptionSchema,
  troopTypeCategories,
  troopTypeCodes,
  troopTypeOrders,
} from './schema.ts';

const identifier = z.string().min(1);

const allyContingentSchema: z.ZodType<AllyContingent> = z.strictObject({
  id: identifier,
  name: z.string(),
  internalContingent: z.boolean(),
  dateRange: dateRangeSchema.nullable(),
  troopOptions: z.array(troopOptionSchema),
});

export const armyIndexSchema: z.ZodType<ArmyIndex> = z.strictObject({
  meta: z.strictObject({
    source: z.url(),
    fetchedAt: z.iso.datetime(),
    contentHash: z.string().min(1),
  }),
  armies: z
    .array(
      z.strictObject({
        id: identifier,
        key: identifier,
        name: z.string(),
        extendedName: z.string(),
        status: z.enum(armyListStatuses),
        keywords: z.array(z.string()),
        startDate: z.int(),
        endDate: z.int(),
        invasion: z.array(z.int()),
        maneuver: z.array(z.int()),
        topographies: z.array(z.enum(topographies)),
        categories: z.array(identifier),
      }),
    )
    .min(1),
});

export const armyDetailSchema: z.ZodType<ArmyDetail> = z.strictObject({
  id: identifier,
  key: identifier,
  name: z.string(),
  extendedName: z.string(),
  startDate: z.int(),
  endDate: z.int(),
  showTroopOptionDescriptions: z.boolean(),
  invasionRatings: z.array(ratingSchema).min(1),
  maneuverRatings: z.array(ratingSchema).min(1),
  homeTopographies: z.array(homeTopographySchema).min(1),
  troopOptions: z.array(troopOptionSchema).min(1),
  troopEntriesForGeneral: z.array(generalTroopEntriesSchema).min(1),
  battleCardEntries: z.array(battleCardEntrySchema),
  allyOptions: z.array(allyOptionSchema),
  allyContingents: z.array(allyContingentSchema),
  enemies: z.array(identifier),
  subFactions: subFactionGroupSchema.nullable(),
});

export const bundledTroopTypesSchema: z.ZodType<BundledTroopType[]> = z
  .array(
    z.strictObject({
      permanentCode: z.enum(troopTypeCodes),
      displayName: z.string(),
      displayCode: z.string(),
      description: z.string(),
      category: z.enum(troopTypeCategories),
      order: z.enum(troopTypeOrders),
      cost: z.int(),
      combatFactors: z.strictObject({
        closeCombat: z.strictObject({ vsFoot: z.int(), vsMounted: z.int() }),
        rangedCombat: z.strictObject({ shooting: z.int(), shotAt: z.int() }),
      }),
      movement: movementSchema.exactOptional(),
      basing: troopTypeBasingSchema.exactOptional(),
    }),
  )
  .min(1);

export const bundledBattleCardsSchema: z.ZodType<BundledBattleCard[]> = z
  .array(
    z.strictObject({
      permanentCode: z.enum(battleCardCodes),
      listName: z.string(),
      displayName: z.string(),
      category: z.enum(battleCardCategories),
      showInList: z.boolean(),
      purchasedPer: battleCardPurchaseScopeSchema,
      rule: battleCardCostRuleSchema,
    }),
  )
  .min(1);

export const battleCardTextSchema: z.ZodType<BattleCardText> = z.record(
  z.enum(battleCardCodes),
  z.string(),
);

export const tagWordsSchema: z.ZodType<TagWord[]> = z.array(
  z.strictObject({
    word: z.string().min(1),
    troopTypes: z.array(z.enum(troopTypeCodes)),
    options: z.int().min(1),
  }),
);
