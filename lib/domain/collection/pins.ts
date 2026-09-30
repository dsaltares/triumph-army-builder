import type { TroopTypeCode } from '../../data/schema.ts';
import { type ArmySelection, standCount } from '../army/selection.ts';
import type { CollectionEntryId, CollectionPin } from './coverage.ts';

type FieldedEntry = {
  id: CollectionEntryId;
  troopType: TroopTypeCode;
};

export const stalePins = (
  selection: ArmySelection,
  pins: readonly CollectionPin[],
  entries: readonly FieldedEntry[],
): readonly CollectionPin[] => {
  const fielded = new Map(entries.map(({ id, troopType }) => [id, troopType]));
  return pins.filter(
    ({ option, troopType, entry }) =>
      standCount(selection, option, troopType) === 0 ||
      fielded.get(entry) !== troopType,
  );
};
