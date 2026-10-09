import { z } from 'zod';
import { battleCardCodes, troopTypeCodes } from '../../data/schema.ts';
import { dataVersionFormat, dataVersionPattern } from '../data-version.ts';
import {
  type ContingentGroupId,
  parseContingentGroupId,
  parseTroopOptionId,
  type TroopOptionId,
} from './army-list.ts';

export const troopOptionIdSchema = z.custom<TroopOptionId>(
  (value) =>
    typeof value === 'string' &&
    parseTroopOptionId(value as TroopOptionId) !== null,
  'is not a troop option the army list model mints',
);

const contingentGroupIdSchema = z.custom<ContingentGroupId>(
  (value) =>
    typeof value === 'string' &&
    parseContingentGroupId(value as ContingentGroupId) !== null,
  'is not a contingent group the army list model mints',
);

const countSchema = z.number().int().positive();

export const selectionSchema = z.object({
  army: z.string().min(1),
  dataVersion: z
    .string()
    .regex(dataVersionPattern, `is not a data version of ${dataVersionFormat}`),
  year: z.number().int(),
  variant: z.string().nullable(),
  contingentGroups: z.array(contingentGroupIdSchema).readonly(),
  stands: z.record(
    troopOptionIdSchema,
    z.partialRecord(z.enum(troopTypeCodes), countSchema),
  ),
  general: z
    .object({
      option: troopOptionIdSchema,
      troopType: z.enum(troopTypeCodes),
    })
    .nullable(),
  armyBattleCards: z.partialRecord(z.enum(battleCardCodes), countSchema),
  troopBattleCards: z.record(
    troopOptionIdSchema,
    z.partialRecord(z.enum(battleCardCodes), countSchema),
  ),
});

export const triumphSavedSelectionSchema = z.object({
  game: z.literal('triumph'),
  selection: selectionSchema,
});

export const savedSelectionSchema = z.discriminatedUnion('game', [
  triumphSavedSelectionSchema,
]);

export type SavedSelection = z.infer<typeof savedSelectionSchema>;

export const parseStoredSelection = (game: string, json: string) =>
  savedSelectionSchema.parse({ game, selection: JSON.parse(json) });

export type SelectionInput =
  | SavedSelection
  | { game?: undefined; selection: z.infer<typeof selectionSchema> };

export const withGame = (input: SelectionInput): SavedSelection =>
  input.game === undefined
    ? { game: 'triumph', selection: input.selection }
    : { game: input.game, selection: input.selection };
