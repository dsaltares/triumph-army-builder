import type { Game } from '../game.ts';
import { gameModule } from '../games/registry.ts';
import type { TriumphReference } from '../games/triumph.ts';
import { matchesAllTerms, searchTerms } from '../text-search.ts';
import type { PointsMeter } from './builder.ts';
import type { SavedArmy } from './saved-army.ts';
import type { ArmySelection } from './selection.ts';

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

export const savedListReading = (
  { game, selection }: { game: Game; selection: ArmySelection },
  reference: TriumphReference,
): SavedListReading => {
  const module = gameModule(game);
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
