import type { Kysely } from 'kysely';
import {
  currentReferenceVersion,
  sameReferenceDocument,
} from '../db/reference.ts';
import type { Database } from '../db/schema.ts';
import type { SavedSelection } from '../domain/army/selection-schema.ts';
import { bundlePaths } from './bundle.ts';

const referencePaths = (list: SavedSelection): string[] => {
  switch (list.game) {
    case 'triumph':
      return [
        bundlePaths.army(list.selection.army),
        bundlePaths.troopTypes,
        bundlePaths.battleCards,
      ];
    case 'fantasy':
      return [
        bundlePaths.fantasy.troopTypes,
        bundlePaths.fantasy.battleCards,
        bundlePaths.fantasy.format,
      ];
  }
};

type VersionedList = SavedSelection & { dataVersion: string };

export const listDataVersions = (db: Kysely<Database>, current: string) => {
  const compared = new Map<string, Promise<boolean>>();
  const unchanged = (from: string, path: string) => {
    const key = `${from}:${path}`;
    const known = compared.get(key);
    if (known) {
      return known;
    }
    const comparison = sameReferenceDocument(db, { path, from, to: current });
    compared.set(key, comparison);
    return comparison;
  };
  return async <List extends VersionedList>(list: List): Promise<List> => {
    const from = list.selection.dataVersion;
    if (from === current) {
      return list;
    }
    const paths = referencePaths(list);
    const same = await Promise.all(paths.map((path) => unchanged(from, path)));
    return same.every(Boolean)
      ? {
          ...list,
          dataVersion: current,
          selection: { ...list.selection, dataVersion: current },
        }
      : list;
  };
};

export const currentListDataVersions = async (db: Kysely<Database>) => {
  const current = await currentReferenceVersion(db);
  return current === null
    ? async <List extends VersionedList>(list: List) => list
    : listDataVersions(db, current);
};
