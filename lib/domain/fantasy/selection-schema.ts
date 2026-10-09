import { z } from 'zod';
import {
  fantasyCardCodes,
  fantasyTopographies,
  troopTypeCodes,
} from '../../data/schema.ts';
import { dataVersionFormat, dataVersionPattern } from '../data-version.ts';

export const fantasyNameMaxLength = 80;

export const fantasyTagMaxLength = 40;

export const fantasyTagsMax = 12;

export const fantasyCardNoteMaxLength = 60;

const idSchema = z.string().min(1).max(64);

const nameSchema = z.string().max(fantasyNameMaxLength);

const tagsSchema = z
  .array(z.string().min(1).max(fantasyTagMaxLength))
  .max(fantasyTagsMax)
  .readonly();

const countSchema = z.number().int().positive();

const markedSchema = z.number().int().nonnegative();

const ratingSchema = z.number().int().min(0).max(4);

const cardCodeSchema = z.enum(fantasyCardCodes);

const variantsSchema = z.record(z.string().min(1), z.string().min(1));

export const fantasyCardChoiceSchema = z.object({
  code: cardCodeSchema,
  variants: variantsSchema.exactOptional(),
  note: z.string().max(fantasyCardNoteMaxLength).exactOptional(),
});

export const fantasyListFormatSchema = z.object({
  pointsTotal: z.number().positive(),
  topography: z.enum(fantasyTopographies),
  invasion: ratingSchema,
  maneuver: ratingSchema,
});

export const fantasyUnitSchema = z.object({
  id: idSchema,
  name: nameSchema,
  tags: tagsSchema,
  troopType: z.enum(troopTypeCodes),
  stands: countSchema,
  cards: z.array(fantasyCardChoiceSchema),
  marks: z.object({
    delayedEntry: markedSchema,
    transports: markedSchema,
    eventCards: z.partialRecord(cardCodeSchema, countSchema),
  }),
});

export const fantasyHeroSchema = z.object({
  id: idSchema,
  name: nameSchema,
  tags: tagsSchema,
  cards: z.array(fantasyCardChoiceSchema),
  delayedEntry: z.boolean(),
});

export const fantasyArmyCardSchema = z.object({
  code: cardCodeSchema,
  count: countSchema.exactOptional(),
  variants: variantsSchema.exactOptional(),
});

export const fantasySelectionSchema = z.object({
  dataVersion: z
    .string()
    .regex(dataVersionPattern, `is not a data version of ${dataVersionFormat}`),
  format: fantasyListFormatSchema,
  units: z.array(fantasyUnitSchema),
  heroes: z.array(fantasyHeroSchema),
  armyCards: z.array(fantasyArmyCardSchema),
  general: idSchema.nullable(),
});

export const fantasySavedSelectionSchema = z.object({
  game: z.literal('fantasy'),
  selection: fantasySelectionSchema,
});

export type FantasyCardChoice = z.infer<typeof fantasyCardChoiceSchema>;
export type FantasyListFormat = z.infer<typeof fantasyListFormatSchema>;
export type FantasyUnit = z.infer<typeof fantasyUnitSchema>;
export type FantasyHero = z.infer<typeof fantasyHeroSchema>;
export type FantasyArmyCard = z.infer<typeof fantasyArmyCardSchema>;
export type FantasySelection = z.infer<typeof fantasySelectionSchema>;
export type FantasyUnitId = FantasyUnit['id'];
export type FantasyHeroId = FantasyHero['id'];
