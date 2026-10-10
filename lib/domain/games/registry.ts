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

export type GameSelection<G extends Game> = Extract<
  SavedSelection,
  { game: G }
>['selection'];

export type GameReference<G extends Game> = Parameters<
  GameModules[G]['points']
>[1];

export type GameSheet<G extends Game> = ReturnType<GameModules[G]['sheetData']>;

export type GameData = {
  [G in Game]: {
    game: G;
    selection: GameSelection<G>;
    reference: GameReference<G>;
  };
}[Game];

export type ListSheet = {
  [G in Game]: { game: G; sheet: GameSheet<G> };
}[Game];

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

export const listSubjectName = (data: GameData) => {
  switch (data.game) {
    case 'triumph':
      return triumph.subjectName(data.reference);
    case 'fantasy':
      return fantasy.subjectName(data.reference);
  }
};

export const listSheet = (data: GameData, name: string): ListSheet => {
  switch (data.game) {
    case 'triumph':
      return {
        game: data.game,
        sheet: triumph.sheetData(
          { name, selection: data.selection },
          data.reference,
        ),
      };
    case 'fantasy':
      return {
        game: data.game,
        sheet: fantasy.sheetData(
          { name, selection: data.selection },
          data.reference,
        ),
      };
  }
};
