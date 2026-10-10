import type { StoredSavedList } from '../domain/army/saved-army.ts';
import {
  parseStoredSelection,
  type SavedSelection,
  type SelectionInput,
  withGame,
} from '../domain/army/selection-schema.ts';
import { listArmyListId } from '../domain/games/registry.ts';

export type StoredList = {
  game: string;
  army_list_id: string | null;
  selection: string;
};

export const selectionColumns = (list: SavedSelection) => ({
  army_list_id: listArmyListId(list),
  selection: JSON.stringify(list.selection),
  data_version: list.selection.dataVersion,
});

export const listColumns = (input: SelectionInput) => {
  const list = withGame(input);
  return { game: list.game, ...selectionColumns(list) };
};

const triumphArmyListId = ({ army_list_id }: StoredList) => {
  if (army_list_id === null) {
    throw new Error('a Triumph! list was stored without an army list');
  }
  return army_list_id;
};

export const storedList = (row: StoredList): StoredSavedList => {
  const list = parseStoredSelection(row.game, row.selection);
  return list.game === 'triumph'
    ? { ...list, armyListId: triumphArmyListId(row) }
    : { ...list, armyListId: null };
};
