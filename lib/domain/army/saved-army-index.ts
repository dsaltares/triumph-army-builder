import type { FindingReport, SeverityFinding } from '../findings.ts';
import type { Game } from '../game.ts';
import { fantasy } from '../games/fantasy.ts';
import type { GameData } from '../games/registry.ts';
import { triumph } from '../games/triumph.ts';
import { matchesAllTerms, searchTerms } from '../text-search.ts';
import type { PointsMeter } from './builder.ts';
import type { SavedArmy } from './saved-army.ts';

export type SavedArmyStanding = {
  meter: PointsMeter;
  legal: boolean;
  errors: number;
  warnings: number;
};

export type SavedArmyEntry = {
  army: SavedArmy;
  listName: string | null;
  standing: SavedArmyStanding | null;
};

export type SavedListReading = {
  listName: string;
  standing: SavedArmyStanding;
};

export type ReadableList = GameData;

type ReadingModule<Selection, Reference> = {
  points: (selection: Selection, reference: Reference) => PointsMeter;
  validate: (
    selection: Selection,
    reference: Reference,
  ) => FindingReport<SeverityFinding>;
  subjectName: (reference: Reference) => string;
};

const reading = <Selection, Reference>(
  module: ReadingModule<Selection, Reference>,
  selection: Selection,
  reference: Reference,
): SavedListReading => {
  const { legal, errors, warnings } = module.validate(selection, reference);
  return {
    listName: module.subjectName(reference),
    standing: {
      meter: module.points(selection, reference),
      legal,
      errors,
      warnings,
    },
  };
};

export const savedListReading = (list: ReadableList): SavedListReading => {
  switch (list.game) {
    case 'triumph':
      return reading(triumph, list.selection, list.reference);
    case 'fantasy':
      return reading(fantasy, list.selection, list.reference);
  }
};

export const searchSavedArmies = (
  entries: readonly SavedArmyEntry[],
  search: string,
  games: readonly Game[] = [],
): SavedArmyEntry[] => {
  const terms = searchTerms(search);
  return entries.filter(
    ({ army, listName }) =>
      (games.length === 0 || games.includes(army.game)) &&
      matchesAllTerms([army.name, listName], terms),
  );
};
