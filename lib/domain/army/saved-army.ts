import { z } from 'zod';
import type {
  FantasySavedSelection,
  SavedSelection,
  TriumphSavedSelection,
} from './selection-schema.ts';

export const armyNameMaxLength = 80;

export const anonymousArmyLimit = 20;

export const armyNameSchema = z
  .string()
  .trim()
  .min(1, 'nameYourList')
  .max(armyNameMaxLength, 'nameTooLong');

export const armyNameFormSchema = z.object({ name: armyNameSchema });

export type ArmyNameForm = z.infer<typeof armyNameFormSchema>;

export type StoredSavedList =
  | (TriumphSavedSelection & { armyListId: string })
  | (FantasySavedSelection & { armyListId: null });

export type SavedArmy = StoredSavedList & {
  id: string;
  name: string;
  dataVersion: string;
  createdAt: string;
  updatedAt: string;
};

export const storedSavedList = (list: SavedSelection): StoredSavedList =>
  list.game === 'triumph'
    ? { ...list, armyListId: list.selection.army }
    : { ...list, armyListId: null };

export type TriumphSavedArmy = Extract<SavedArmy, { game: 'triumph' }>;

export type FantasySavedArmy = Extract<SavedArmy, { game: 'fantasy' }>;

const copySuffix = ' (copy)';

export const copyName = (name: string) =>
  `${name.slice(0, armyNameMaxLength - copySuffix.length)}${copySuffix}`;

const listDay = new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' });

export const defaultListName = (armyName: string, at: Date) => {
  const suffix = ` \u00b7 ${listDay.format(at)}`;
  return `${armyName.slice(0, armyNameMaxLength - suffix.length)}${suffix}`;
};

const descending = (left: string, right: string) =>
  left === right ? 0 : left < right ? 1 : -1;

export const byMostRecent = (left: SavedArmy, right: SavedArmy) =>
  descending(left.updatedAt, right.updatedAt) || descending(left.id, right.id);

export const withArmyUpserted = <Army extends SavedArmy>(
  armies: readonly Army[],
  army: Army,
): Army[] =>
  [...armies.filter(({ id }) => id !== army.id), army].sort(byMostRecent);

export const withArmyRemoved = <Army extends SavedArmy>(
  armies: readonly Army[],
  id: string,
): Army[] => armies.filter((army) => army.id !== id);
