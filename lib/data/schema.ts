import { z } from 'zod';
import {
  dataVersionFormat,
  dataVersionPattern,
} from '../domain/data-version.ts';

export const troopTypeCodes = [
  'ARC',
  'ART',
  'BAD',
  'BLV',
  'BTX',
  'CAT',
  'CHT',
  'ECV',
  'EFT',
  'ELE',
  'HBW',
  'HFT',
  'HRD',
  'JCV',
  'KNT',
  'LFT',
  'LSP',
  'PAV',
  'PIK',
  'RBL',
  'RDR',
  'SKM',
  'SPR',
  'WBD',
  'WRR',
  'WWG',
] as const;

export const battleCardCodes = [
  'AC',
  'AM',
  'CC',
  'CF',
  'CH',
  'CT',
  'DC',
  'DD',
  'ES',
  'ET',
  'FC',
  'HD',
  'HL',
  'LC',
  'MD',
  'MI',
  'NC',
  'PD',
  'PL',
  'PT',
  'SB',
  'SC',
  'SF',
  'SP',
  'SS',
  'SV',
  'SW',
] as const;

export const topographies = [
  'Arable',
  'Delta',
  'Dry',
  'Forest',
  'Hilly',
  'Marsh',
  'Steppe',
] as const;

export const armyListStatuses = ['Revised', 'Ready', 'DRAFT'] as const;

export const battleLines = ['all', 'half', ''] as const;

export const troopTypeCategories = ['foot', 'mounted'] as const;

export const troopTypeOrders = ['Open', 'Close'] as const;

export const battleCardCategories = ['army', 'troop'] as const;

const objectId = z.string().min(1);

const text = z.string().transform((value) => value.trim());

const internalIdKey = '_id';

const dropInternalId = (value: unknown) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== internalIdKey),
  );
};

const withoutInternalId = <Shape extends z.ZodRawShape>(shape: Shape) =>
  z.preprocess(dropInternalId, z.strictObject(shape));

export const dateRangeSchema = withoutInternalId({
  startDate: z.int(),
  endDate: z.int(),
});

export const ratingSchema = withoutInternalId({
  value: z.int(),
  note: text.nullable(),
});

export const homeTopographySchema = withoutInternalId({
  values: z.array(text.pipe(z.enum(topographies))).min(1),
  note: text,
});

const troopEntrySchema = withoutInternalId({
  troopTypeCode: z.enum(troopTypeCodes),
  dismountTypeCode: z.enum(troopTypeCodes).nullable(),
  note: text.nullable(),
});

export const battleCardEntrySchema = withoutInternalId({
  battleCardCode: z.enum(battleCardCodes),
  min: z.int().nullable().default(null),
  max: z.int().nullable().default(null),
  note: text.nullable(),
});

export const troopOptionSchema = withoutInternalId({
  min: z.int(),
  max: z.int(),
  core: z.enum(battleLines),
  description: text,
  note: text,
  troopEntries: z.array(troopEntrySchema).min(1),
  dateRanges: z.array(dateRangeSchema),
  battleCardEntries: z.array(battleCardEntrySchema),
});

export const generalTroopEntriesSchema = withoutInternalId({
  troopEntries: z.array(troopEntrySchema).min(1),
});

const allyEntrySchema = withoutInternalId({
  allyArmyList: objectId,
  name: text,
});

export const allyOptionSchema = withoutInternalId({
  allyEntries: z.array(allyEntrySchema).min(1),
  dateRange: dateRangeSchema.nullable(),
  note: text.nullable(),
});

export const armyListSchema = z.strictObject({
  id: objectId,
  listId: z.number(),
  sublistId: z.string(),
  sortId: z.number(),
  name: text,
  status: z.enum(armyListStatuses),
  keywords: z.array(text),
  showTroopOptionDescriptions: z.boolean(),
  derivedData: z.strictObject({
    extendedName: text,
    listStartDate: z.int(),
    listEndDate: z.int(),
  }),
  dateRanges: z.array(dateRangeSchema).min(1),
  invasionRatings: z.array(ratingSchema).min(1),
  maneuverRatings: z.array(ratingSchema).min(1),
  homeTopographies: z.array(homeTopographySchema).min(1),
  troopOptions: z.array(troopOptionSchema).min(1),
  troopEntriesForGeneral: z.array(generalTroopEntriesSchema).min(1),
  allyOptions: z.array(allyOptionSchema),
  battleCardEntries: z.array(battleCardEntrySchema),
});

export const allyArmyListSchema = z.strictObject({
  id: objectId,
  armyListId: objectId.nullable().default(null),
  listId: z.number(),
  sublistId: z.string(),
  name: text,
  internalContingent: z.boolean(),
  dateRange: dateRangeSchema.nullable(),
  troopOptions: z.array(troopOptionSchema),
});

export const battleCardSchema = z
  .strictObject({
    id: objectId,
    permanentCode: z.enum(battleCardCodes),
    importName: text,
    listName: text,
    displayName: text,
    category: z.enum(battleCardCategories),
    showInList: z.boolean(),
    mdText: z.string(),
    htmlText: z.string(),
  })
  .transform(({ htmlText: _htmlText, ...battleCard }) => battleCard);

export const troopTypeSchema = z.strictObject({
  id: objectId,
  permanentCode: z.enum(troopTypeCodes),
  importName: text,
  displayName: text,
  displayCode: text,
  description: text,
  category: z.enum(troopTypeCategories),
  order: z.enum(troopTypeOrders),
  cost: z.int(),
  combatFactors: z.strictObject({
    closeCombat: z.strictObject({ vsFoot: z.int(), vsMounted: z.int() }),
    rangedCombat: z.strictObject({ shooting: z.int(), shotAt: z.int() }),
  }),
});

export const thematicCategorySchema = z.strictObject({
  id: objectId,
  name: text,
});

const idsByIdSchema = z.record(objectId, z.array(objectId));

export const enemyArmyListsSchema = idsByIdSchema;

export const thematicCategoryArmyListsSchema = idsByIdSchema;

export const manifestSchema = z.strictObject({
  source: z.url(),
  fetchedAt: z.iso.datetime(),
  dataVersion: z
    .string()
    .regex(dataVersionPattern, `must look like ${dataVersionFormat}`),
  contentHash: z.string().min(1),
  files: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        records: z.int().nonnegative(),
        bytes: z.int().nonnegative(),
        sha256: z.string().min(1),
      }),
    )
    .min(1),
});

export type MeshweshDateRange = z.infer<typeof dateRangeSchema>;
export type MeshweshRating = z.infer<typeof ratingSchema>;
export type MeshweshHomeTopography = z.infer<typeof homeTopographySchema>;
export type MeshweshTroopEntry = z.infer<typeof troopEntrySchema>;
export type MeshweshBattleCardEntry = z.infer<typeof battleCardEntrySchema>;
export type MeshweshTroopOption = z.infer<typeof troopOptionSchema>;
export type MeshweshAllyOption = z.infer<typeof allyOptionSchema>;
export type MeshweshArmyList = z.infer<typeof armyListSchema>;
export type MeshweshAllyArmyList = z.infer<typeof allyArmyListSchema>;
export type MeshweshBattleCard = z.infer<typeof battleCardSchema>;
export type MeshweshTroopType = z.infer<typeof troopTypeSchema>;
export type MeshweshThematicCategory = z.infer<typeof thematicCategorySchema>;
export type MeshweshEnemyArmyLists = z.infer<typeof enemyArmyListsSchema>;
export type MeshweshThematicCategoryArmyLists = z.infer<
  typeof thematicCategoryArmyListsSchema
>;
export type MeshweshManifest = z.infer<typeof manifestSchema>;
export type ArmyListStatus = (typeof armyListStatuses)[number];
export type Topography = (typeof topographies)[number];
export type TroopTypeCode = (typeof troopTypeCodes)[number];
export type TroopTypeCategory = (typeof troopTypeCategories)[number];
export type TroopTypeOrder = (typeof troopTypeOrders)[number];
export type BattleCardCode = (typeof battleCardCodes)[number];
