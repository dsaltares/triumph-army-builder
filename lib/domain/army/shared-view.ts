import type { PricedBattleCard } from '../battle-cards/costs.ts';
import { battleCardNames, type ListedCard } from '../battle-cards/listing.ts';
import {
  type CollectionEntry,
  type CollectionPin,
  coverage,
} from '../collection/coverage.ts';
import {
  type ListCoverage,
  listCoverage,
} from '../collection/list-coverage.ts';
import {
  type TroopTypeCost,
  type TroopTypeFactor,
  type TroopTypeName,
  troopTypeFactors,
  troopTypeMovements,
  troopTypeNames,
} from '../troop-types.ts';
import type { ArmyList } from './army-list.ts';
import { type PointsMeter, pointsMeter } from './builder.ts';
import { armyPoints, pointCosts } from './points.ts';
import type { SavedArmy } from './saved-army.ts';
import type { ArmySelection } from './selection.ts';
import type { SharedList } from './shared-list.ts';
import { type ArmySheet, armySheet } from './sheet.ts';
import {
  type ValidationReport,
  validationReport,
} from './validation-report.ts';

export type ViewedList = {
  name: string;
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
  list: SavedArmy;
  collection: CollectionReading;
};

export type NamedCollectionEntry = CollectionEntry & { name: string };

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
  { name, selection }: ViewedList,
  { armyList, troopTypes, battleCards }: ListViewData,
): ListReading => {
  const costs = pointCosts(troopTypes, battleCards);
  const names = troopTypeNames(troopTypes);
  return {
    sheet: armySheet({
      listName: name,
      armyList,
      selection,
      costs,
      names,
      factors: troopTypeFactors(troopTypes),
      movement: troopTypeMovements(troopTypes),
      cardNames: battleCardNames(battleCards),
    }),
    report: validationReport(armyList, selection, costs, names),
    meter: pointsMeter(armyPoints(armyList, selection, costs)),
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
  entries: readonly NamedCollectionEntry[] | null,
  pins: readonly CollectionPin[],
): CollectionReading =>
  entries
    ? {
        kind: 'coverage',
        ...listCoverage(
          sheet,
          coverage(selection, armyList, entries, pins),
          entries,
        ),
      }
    : { kind: 'needsAccount' };

export const savedView = ({
  saved,
  collection,
  pins = [],
  ...data
}: ListViewData & {
  saved: SavedArmy;
  collection: readonly NamedCollectionEntry[] | null;
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
  collection: readonly NamedCollectionEntry[] | null;
}): DraftView => {
  const list: DraftList = {
    name: data.armyList.name,
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
