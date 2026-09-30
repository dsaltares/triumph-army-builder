import { z } from 'zod';
import { troopTypeCodes } from '../../data/schema.ts';
import { collectionStatuses } from './entry.ts';

export const entryNameMaxLength = 80;

export const entryTagMaxLength = 40;

export const entryTagLimit = 30;

export const entryNotesMaxLength = 2000;

export const normaliseTags = (tags: readonly string[]) => [
  ...new Set(
    tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag !== ''),
  ),
];

const entryNameSchema = z
  .string()
  .trim()
  .min(1, 'nameYourEntry')
  .max(entryNameMaxLength, 'nameTooLong');

const entryCountSchema = z
  .number('countAtLeastOne')
  .int('countAtLeastOne')
  .min(1, 'countAtLeastOne');

const entryTroopTypeSchema = z
  .enum(troopTypeCodes, 'pickATroopType')
  .nullable()
  .pipe(z.enum(troopTypeCodes, 'pickATroopType'));

const entryTagsSchema = z
  .array(z.string())
  .transform(normaliseTags)
  .pipe(
    z
      .array(z.string().max(entryTagMaxLength, 'tagTooLong'))
      .max(entryTagLimit, 'tooManyTags'),
  );

const entryNotesSchema = z
  .string()
  .trim()
  .max(entryNotesMaxLength, 'notesTooLong');

export const collectionEntryFormSchema = z.object({
  name: entryNameSchema,
  count: entryCountSchema,
  troopType: entryTroopTypeSchema,
  tags: entryTagsSchema,
  status: z.enum(collectionStatuses),
  notes: entryNotesSchema,
});

export type CollectionEntryFormInput = z.input<
  typeof collectionEntryFormSchema
>;

export type CollectionEntryForm = z.output<typeof collectionEntryFormSchema>;
