import type { Game, TroopTypeCode } from '../../data/schema.ts';
import { type ArmySelection, standCount } from '../army/selection.ts';
import type { CollectionEntryId, CollectionPin } from './coverage.ts';
import { type HeroKind, triumphStands } from './entry.ts';

type FieldedEntry = {
  id: CollectionEntryId;
  troopType: TroopTypeCode;
  games?: readonly Game[];
};

export const stalePins = (
  selection: ArmySelection,
  pins: readonly CollectionPin[],
  entries: readonly (FieldedEntry | HeroKind)[],
): readonly CollectionPin[] => {
  const fielded = new Map(
    triumphStands(entries).map(({ id, troopType }) => [id, troopType]),
  );
  return pins.filter(
    ({ option, troopType, entry }) =>
      standCount(selection, option, troopType) === 0 ||
      fielded.get(entry) !== troopType,
  );
};
