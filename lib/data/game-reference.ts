import { buildArmyList } from '../domain/army/army-list.ts';
import type { SavedSelection } from '../domain/army/selection-schema.ts';
import type { ListViewData } from '../domain/army/shared-view.ts';
import type { FantasyReference } from '../domain/fantasy/reference.ts';
import type { GameData } from '../domain/games/registry.ts';
import type { ArmyBundle, FantasyBundle, ListBundle } from './bundle-source.ts';

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

export const readFantasyReference = async (
  bundle: FantasyBundle,
): Promise<FantasyReference | null> => {
  const [troopTypes, cards, format] = await Promise.all([
    bundle.readFantasyTroopTypes(),
    bundle.readFantasyBattleCards(),
    bundle.readFantasyFormat(),
  ]);
  return troopTypes && cards && format ? { troopTypes, cards, format } : null;
};

export const readGameData = async (
  bundle: ListBundle,
  list: SavedSelection,
): Promise<GameData | null> => {
  switch (list.game) {
    case 'triumph': {
      const reference = await readArmyListReference(
        bundle,
        list.selection.army,
      );
      return (
        reference && { game: list.game, selection: list.selection, reference }
      );
    }
    case 'fantasy': {
      const reference = await readFantasyReference(bundle);
      return (
        reference && { game: list.game, selection: list.selection, reference }
      );
    }
  }
};
