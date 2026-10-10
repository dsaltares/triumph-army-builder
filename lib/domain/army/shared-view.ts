import type { FantasyCardCode } from '../../data/schema.ts';
import type { PricedBattleCard } from '../battle-cards/costs.ts';
import type { ListedCard } from '../battle-cards/listing.ts';
import {
  type CollectionEntry,
  type CollectionPin,
  coverage,
} from '../collection/coverage.ts';
import {
  type ListCoverage,
  listCoverage,
} from '../collection/list-coverage.ts';
import type { FantasyReference } from '../fantasy/reference.ts';
import type { FantasySelection } from '../fantasy/selection-schema.ts';
import type { FantasySheet } from '../fantasy/sheet-data.ts';
import type { FantasyValidationReport } from '../fantasy/validation.ts';
import { type FantasyPointsMeter, fantasy } from '../games/fantasy.ts';
import type { GameData } from '../games/registry.ts';
import { triumph } from '../games/triumph.ts';
import type {
  TroopTypeCost,
  TroopTypeFactor,
  TroopTypeName,
} from '../troop-types.ts';
import type { ArmyList } from './army-list.ts';
import type { PointsMeter } from './builder.ts';
import type { SavedArmy } from './saved-army.ts';
import type { ArmySelection } from './selection.ts';
import type { SharedList } from './shared-list.ts';
import type { ArmySheet } from './sheet.ts';
import type { ValidationReport } from './validation-report.ts';

export type FantasyCardNames = Readonly<
  Partial<Record<FantasyCardCode, string>>
>;

export type TriumphReading = {
  game: 'triumph';
  sheet: ArmySheet;
  report: ValidationReport;
  meter: PointsMeter;
};

export type FantasyReading = {
  game: 'fantasy';
  sheet: FantasySheet;
  report: FantasyValidationReport;
  meter: FantasyPointsMeter;
  cardNames: FantasyCardNames;
};

export type ListReading = TriumphReading | FantasyReading;

export type SharedView = ListReading & { kind: 'shared'; list: SharedList };

export type CollectionReading =
  | { kind: 'needsAccount' }
  | ({ kind: 'coverage' } & ListCoverage);

export type SavedView = ListReading & {
  kind: 'saved';
  list: SavedArmy;
  collection: CollectionReading | null;
};

export type NamedCollectionEntry = CollectionEntry & { name: string };

export type DraftList = {
  name: string;
  game: 'triumph';
  dataVersion: string;
  selection: ArmySelection;
  armyListId: string;
};

export type DraftView = TriumphReading & {
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

const triumphReading = (
  name: string,
  selection: ArmySelection,
  reference: ListViewData,
): TriumphReading => ({
  game: 'triumph',
  sheet: triumph.sheetData({ name, selection }, reference),
  report: triumph.validate(selection, reference),
  meter: triumph.points(selection, reference),
});

const fantasyReading = (
  name: string,
  selection: FantasySelection,
  reference: FantasyReference,
): FantasyReading => ({
  game: 'fantasy',
  sheet: fantasy.sheetData({ name, selection }, reference),
  report: fantasy.validate(selection, reference),
  meter: fantasy.points(selection, reference),
  cardNames: Object.fromEntries(
    reference.cards.map(({ code, name: cardName }) => [code, cardName]),
  ),
});

const listReading = (name: string, data: GameData): ListReading => {
  switch (data.game) {
    case 'triumph':
      return triumphReading(name, data.selection, data.reference);
    case 'fantasy':
      return fantasyReading(name, data.selection, data.reference);
  }
};

export const sharedView = ({
  shared,
  data,
}: {
  shared: SharedList;
  data: GameData;
}): SharedView => ({
  kind: 'shared',
  list: shared,
  ...listReading(shared.name, data),
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
  data,
  collection,
  pins = [],
}: {
  saved: SavedArmy;
  data: GameData;
  collection: readonly NamedCollectionEntry[] | null;
  pins?: readonly CollectionPin[];
}): SavedView => {
  switch (data.game) {
    case 'triumph': {
      const reading = triumphReading(
        saved.name,
        data.selection,
        data.reference,
      );
      return {
        kind: 'saved',
        list: saved,
        ...reading,
        collection: collectionReading(
          data.selection,
          data.reference.armyList,
          reading.sheet,
          collection,
          pins,
        ),
      };
    }
    case 'fantasy':
      return {
        kind: 'saved',
        list: saved,
        ...fantasyReading(saved.name, data.selection, data.reference),
        collection: null,
      };
  }
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
    game: 'triumph',
    dataVersion: selection.dataVersion,
    selection,
    armyListId: data.armyList.id,
  };
  const reading = triumphReading(list.name, selection, data);
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
