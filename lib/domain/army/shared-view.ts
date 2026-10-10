import type { PricedBattleCard } from '../battle-cards/costs.ts';
import type { ListedCard } from '../battle-cards/listing.ts';
import {
  type CollectionEntry,
  type CollectionPin,
  coverage,
} from '../collection/coverage.ts';
import { type HeroKind, triumphStands } from '../collection/entry.ts';
import {
  type ListCoverage,
  listCoverage,
} from '../collection/list-coverage.ts';
import type { ViewableGame } from '../game.ts';
import { gameModule } from '../games/registry.ts';
import type {
  TroopTypeCost,
  TroopTypeFactor,
  TroopTypeName,
} from '../troop-types.ts';
import type { ArmyList } from './army-list.ts';
import type { PointsMeter } from './builder.ts';
import type { ViewableSavedArmy } from './saved-army.ts';
import type { ArmySelection } from './selection.ts';
import type { SharedList } from './shared-list.ts';
import type { ArmySheet } from './sheet.ts';
import type { ValidationReport } from './validation-report.ts';

export type ViewedList = {
  name: string;
  game: ViewableGame;
  dataVersion: string;
  selection: ArmySelection;
};

export type ListReading = {
  sheet: ArmySheet;
  report: ValidationReport;
  meter: PointsMeter;
};

export type SharedView = ListReading & { kind: 'shared'; list: SharedList };

export type CollectionReading =
  | { kind: 'needsAccount' }
  | ({ kind: 'coverage' } & ListCoverage);

export type SavedView = ListReading & {
  kind: 'saved';
  list: ViewableSavedArmy;
  collection: CollectionReading;
};

export type NamedCollectionEntry = CollectionEntry & { name: string };

export type CollectedEntry = NamedCollectionEntry | HeroKind;

export type DraftList = ViewedList & { armyListId: string };

export type DraftView = ListReading & {
  kind: 'draft';
  list: DraftList;
  collection: CollectionReading;
};

export type ListView = SharedView | SavedView | DraftView;

export type ListViewData = {
  armyList: ArmyList;
  troopTypes: readonly (TroopTypeCost &
    TroopTypeName &
    TroopTypeFactor & { movement?: number })[];
  battleCards: readonly (ListedCard & PricedBattleCard)[];
};

export const listReading = (
  list: ViewedList,
  data: ListViewData,
): ListReading => {
  const module = gameModule(list.game);
  return {
    sheet: module.sheetData(list, data),
    report: module.validate(list.selection, data),
    meter: module.points(list.selection, data),
  };
};

export const sharedView = ({
  shared,
  ...data
}: ListViewData & { shared: SharedList }): SharedView => ({
  kind: 'shared',
  list: shared,
  ...listReading(shared, data),
});

export const collectionReading = (
  selection: ArmySelection,
  armyList: ArmyList,
  sheet: ArmySheet,
  collection: readonly CollectedEntry[] | null,
  pins: readonly CollectionPin[],
): CollectionReading => {
  if (!collection) {
    return { kind: 'needsAccount' };
  }
  const entries = triumphStands(collection);
  return {
    kind: 'coverage',
    ...listCoverage(
      sheet,
      coverage(selection, armyList, entries, pins),
      entries,
    ),
    entries: collection.length,
  };
};

export const savedView = ({
  saved,
  collection,
  pins = [],
  ...data
}: ListViewData & {
  saved: ViewableSavedArmy;
  collection: readonly CollectedEntry[] | null;
  pins?: readonly CollectionPin[];
}): SavedView => {
  const reading = listReading(saved, data);
  return {
    kind: 'saved',
    list: saved,
    ...reading,
    collection: collectionReading(
      saved.selection,
      data.armyList,
      reading.sheet,
      collection,
      pins,
    ),
  };
};

export const draftView = ({
  selection,
  collection,
  ...data
}: ListViewData & {
  selection: ArmySelection;
  collection: readonly CollectedEntry[] | null;
}): DraftView => {
  const list: DraftList = {
    name: data.armyList.name,
    game: 'triumph',
    dataVersion: selection.dataVersion,
    selection,
    armyListId: data.armyList.id,
  };
  const reading = listReading(list, data);
  return {
    kind: 'draft',
    list,
    ...reading,
    collection: collectionReading(
      selection,
      data.armyList,
      reading.sheet,
      collection,
      [],
    ),
  };
};
