import { z } from 'zod';
import { type Game, games, troopTypeCodes } from '../../data/schema.ts';
import {
  type CollectionEntryKind,
  collectionEntryKinds,
  collectionStatuses,
} from './entry.ts';

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
  .nullable();

const entryTagsSchema = z
  .array(z.string())
  .transform(normaliseTags)
  .pipe(
    z
      .array(z.string().max(entryTagMaxLength, 'tagTooLong'))
      .max(entryTagLimit, 'tooManyTags'),
  );

const entryGamesSchema = z
  .array(z.enum(games, 'pickAGame'))
  .transform((chosen) => games.filter((game) => chosen.includes(game)))
  .pipe(z.array(z.enum(games)).min(1, 'pickAGame'));

const entryNotesSchema = z
  .string()
  .trim()
  .max(entryNotesMaxLength, 'notesTooLong');

const entryFieldsSchema = z.object({
  kind: z.enum(collectionEntryKinds).optional(),
  name: entryNameSchema,
  count: entryCountSchema,
  troopType: entryTroopTypeSchema,
  tags: entryTagsSchema,
  games: entryGamesSchema.optional(),
  status: z.enum(collectionStatuses),
  notes: entryNotesSchema,
});

type KindedTroopType = {
  kind?: CollectionEntryKind | undefined;
  troopType?: string | null | undefined;
  games?: readonly Game[] | undefined;
};

const kindFields: readonly PropertyKey[] = ['kind', 'troopType', 'games'];

const kindParsed = {
  when: ({ issues }: z.core.ParsePayload) =>
    issues.every(({ path }) => !kindFields.includes(path?.[0] ?? '')),
};

const fieldsTroopType = ({ kind, troopType }: KindedTroopType) =>
  kind === 'hero' ||
  (troopType !== null && (kind !== 'stands' || troopType !== undefined));

const heroWithoutTroopType = ({ kind, troopType }: KindedTroopType) =>
  kind !== 'hero' || !troopType;

const heroInFantasyAlone = ({ kind, games: chosen }: KindedTroopType) =>
  kind !== 'hero' || (chosen ?? []).every((game) => game === 'fantasy');

const withTroopTypeForItsKind = <Schema extends z.ZodType<KindedTroopType>>(
  schema: Schema,
) =>
  schema
    .refine(fieldsTroopType, {
      message: 'pickATroopType',
      path: ['troopType'],
      ...kindParsed,
    })
    .refine(heroWithoutTroopType, {
      message: 'heroHasNoTroopType',
      path: ['troopType'],
      ...kindParsed,
    })
    .refine(heroInFantasyAlone, {
      message: 'heroIsFantasyOnly',
      path: ['games'],
      ...kindParsed,
    });

export const collectionEntryFormSchema =
  withTroopTypeForItsKind(entryFieldsSchema);

export const collectionEntryChangesSchema = withTroopTypeForItsKind(
  entryFieldsSchema.partial().extend({ id: z.string().min(1) }),
);

export type CollectionEntryFormInput = z.input<
  typeof collectionEntryFormSchema
>;

export type CollectionEntryForm = z.output<typeof collectionEntryFormSchema>;
