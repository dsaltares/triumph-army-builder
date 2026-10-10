import type { SavedSelection } from '../army/selection-schema.ts';
import type { Game } from '../game.ts';
import { fantasy } from './fantasy.ts';
import { triumph } from './triumph.ts';

const gameModules = { triumph, fantasy } as const satisfies Record<
  Game,
  unknown
>;

export type GameModules = typeof gameModules;

export const gameModule = <G extends Game>(game: G): GameModules[G] =>
  gameModules[game];

const parsedCanonical = <Selection>(
  module: {
    selectionSchema: { parse: (value: unknown) => Selection };
    canonicalise: (selection: Selection) => Selection;
  },
  selection: Selection,
) => module.selectionSchema.parse(module.canonicalise(selection));

export const canonicalList = (list: SavedSelection): SavedSelection => {
  switch (list.game) {
    case 'triumph':
      return {
        game: list.game,
        selection: parsedCanonical(triumph, list.selection),
      };
    case 'fantasy':
      return {
        game: list.game,
        selection: parsedCanonical(fantasy, list.selection),
      };
  }
};

export const listArmyListId = (list: SavedSelection) => {
  switch (list.game) {
    case 'triumph':
      return triumph.armyListId(list.selection);
    case 'fantasy':
      return fantasy.armyListId(list.selection);
  }
};
