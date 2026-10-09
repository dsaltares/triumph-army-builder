import { z } from 'zod';
import type { PointsMeter } from './army/builder.ts';
import type { ValidationRules } from './army/validation.ts';
import type { ValidationReport } from './army/validation-report.ts';

export const games = ['triumph'] as const;

export type Game = (typeof games)[number];

export const gameSchema = z.enum(games);

export const defaultGame: Game = 'triumph';

export type NamedSelection<Selection> = {
  name: string;
  selection: Selection;
};

export type GameModule<Selection, Reference, Sheet> = {
  game: Game;
  rules: ValidationRules;
  selectionSchema: z.ZodType<Selection>;
  armyListId: (selection: Selection) => string | null;
  canonicalise: (selection: Selection) => Selection;
  points: (selection: Selection, reference: Reference) => PointsMeter;
  validate: (selection: Selection, reference: Reference) => ValidationReport;
  sheetData: (list: NamedSelection<Selection>, reference: Reference) => Sheet;
  listTitle: (reference: Reference, at: Date) => string;
};
