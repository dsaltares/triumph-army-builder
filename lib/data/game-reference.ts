import { buildArmyList } from '../domain/army/army-list.ts';
import type { ArmySelection } from '../domain/army/selection.ts';
import type { SavedSelection } from '../domain/army/selection-schema.ts';
import type { ListViewData } from '../domain/army/shared-view.ts';
import type { Game } from '../domain/game.ts';
import type { GameModules } from '../domain/games/registry.ts';
import type { ArmyBundle } from './bundle-source.ts';

export type GameReference<G extends Game> = Parameters<
  GameModules[G]['points']
>[1];

export const readArmyListReference = async (
  bundle: ArmyBundle,
  armyListId: string,
): Promise<ListViewData | null> => {
  const detail = await bundle.readArmyDetail(armyListId);
  if (!detail) {
    return null;
  }
  const [troopTypes, battleCards] = await Promise.all([
    bundle.readTroopTypes(),
    bundle.readBattleCards(),
  ]);
  return { armyList: buildArmyList(detail), troopTypes, battleCards };
};

const referenceReaders = {
  triumph: (bundle: ArmyBundle, selection: ArmySelection) =>
    readArmyListReference(bundle, selection.army),
} satisfies {
  [G in Game]: (
    bundle: ArmyBundle,
    selection: Extract<SavedSelection, { game: G }>['selection'],
  ) => Promise<GameReference<G> | null>;
};

export const readGameReference = (
  bundle: ArmyBundle,
  { game, selection }: SavedSelection,
) => referenceReaders[game](bundle, selection);
