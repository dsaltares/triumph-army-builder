import { z } from 'zod';
import { type Game, games } from '../data/schema.ts';
import type { PointsMeter } from './army/builder.ts';

export { type Game, games } from '../data/schema.ts';

export const gameSchema = z.enum(games);

export const savableGames = [
  'triumph',
  'fantasy',
] as const satisfies readonly Game[];

export type SavableGame = (typeof savableGames)[number];

export const savableGameSchema = z.enum(savableGames);

export const defaultGame: SavableGame = 'triumph';

export const viewableGames = ['triumph'] as const satisfies readonly Game[];

export type ViewableGame = (typeof viewableGames)[number];

export const viewableGameSchema = z.enum(viewableGames);

export const isViewableGame = (game: Game): game is ViewableGame =>
  (viewableGames as readonly Game[]).includes(game);

export type NamedSelection<Selection> = {
  name: string;
  selection: Selection;
};

export type GameModule<
  Selection,
  Reference,
  Sheet,
  Meter extends PointsMeter,
  Report,
> = {
  game: Game;
  selectionSchema: z.ZodType<Selection>;
  armyListId: (selection: Selection) => string | null;
  canonicalise: (selection: Selection) => Selection;
  points: (selection: Selection, reference: Reference) => Meter;
  validate: (selection: Selection, reference: Reference) => Report;
  sheetData: (list: NamedSelection<Selection>, reference: Reference) => Sheet;
  subjectName: (reference: Reference) => string;
  listTitle: (reference: Reference, at: Date) => string;
};
