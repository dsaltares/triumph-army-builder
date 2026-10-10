import { z } from 'zod';
import { battleCardCodes, troopTypeCodes } from '../../data/schema.ts';
import { dataVersionFormat, dataVersionPattern } from '../data-version.ts';
import {
  fantasySavedSelectionSchema,
  fantasySelectionSchema,
} from '../fantasy/selection-schema.ts';
import { isViewableGame, type ViewableGame } from '../game.ts';
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
  fantasySavedSelectionSchema,
]);

export type SavedSelection = z.infer<typeof savedSelectionSchema>;

const triumphByDefault = z.literal('triumph').default('triumph');

export const savedListInputSchema = z.union([
  z.object({ game: triumphByDefault, selection: selectionSchema }),
  fantasySavedSelectionSchema,
]);

export const savedListChangeSchema = z.union([
  z.object({ game: triumphByDefault, selection: selectionSchema.optional() }),
  z.object({
    game: z.literal('fantasy'),
    selection: fantasySelectionSchema.optional(),
  }),
]);

export type SavedListChange = z.input<typeof savedListChangeSchema>;

export const changedList = (
  change: SavedListChange,
): SavedSelection | undefined =>
  change.game === 'fantasy'
    ? change.selection && { game: 'fantasy', selection: change.selection }
    : change.selection && { game: 'triumph', selection: change.selection };

export const savedSelectionOf = (list: SavedSelection): SavedSelection => {
  switch (list.game) {
    case 'triumph':
      return { game: list.game, selection: list.selection };
    case 'fantasy':
      return { game: list.game, selection: list.selection };
  }
};

export type ViewableSavedSelection = Extract<
  SavedSelection,
  { game: ViewableGame }
>;

export const isViewableList = (
  list: SavedSelection,
): list is ViewableSavedSelection => isViewableGame(list.game);

export type TriumphSavedSelection = z.infer<typeof triumphSavedSelectionSchema>;

export type FantasySavedSelection = z.infer<typeof fantasySavedSelectionSchema>;

export const parseStoredSelection = (game: string, json: string) =>
  savedSelectionSchema.parse({ game, selection: JSON.parse(json) });

export type SelectionInput =
  | SavedSelection
  | {
      game?: 'triumph' | undefined;
      selection: z.infer<typeof selectionSchema>;
    };

export const withGame = (input: SelectionInput): SavedSelection =>
  input.game === 'fantasy'
    ? { game: input.game, selection: input.selection }
    : { game: 'triumph', selection: input.selection };
