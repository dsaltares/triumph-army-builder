import type { Kysely } from 'kysely';
import type { ArmyBundle, ListBundle } from '../data/bundle-source.ts';
import { readArmyListReference, readGameData } from '../data/game-reference.ts';
import { currentListDataVersions } from '../data/list-data-version.ts';
import { findArmy } from '../db/armies.ts';
import { listCollectionEntries } from '../db/collection.ts';
import { listArmyPins } from '../db/collection-pins.ts';
import type { Database } from '../db/schema.ts';
import { findShare, touchShare } from '../db/shares.ts';
import { decodeSelection } from '../domain/army/share-codec.ts';
import { shareIdPattern } from '../domain/army/shared-list.ts';
import {
  type DraftView,
  draftView,
  type ListView,
  type SavedView,
  type SharedView,
  savedView,
  sharedView,
} from '../domain/army/shared-view.ts';
import { fantasyGameName } from '../domain/games/fantasy.ts';
import { countOf, formatPoints, formatYear } from '../format.ts';
import type { Locale } from '../i18n/locales.ts';

export const seenResolutionMs = 24 * 60 * 60 * 1000;

export type SharedViewRequest = {
  db: Kysely<Database>;
  bundle: ListBundle;
  id: string;
  now?: () => Date;
};

const markSeen = async (
  db: Kysely<Database>,
  id: string,
  now: () => Date,
): Promise<void> => {
  const at = now();
  await touchShare(db, {
    id,
    at: at.toISOString(),
    staleBefore: new Date(at.getTime() - seenResolutionMs).toISOString(),
  });
};

export type SavedViewRequest = {
  db: Kysely<Database>;
  bundle: ListBundle;
  id: string;
  userId: string;
  isAnonymous: boolean;
};

export const loadSharedView = async ({
  db,
  bundle,
  id,
  now = () => new Date(),
}: SharedViewRequest): Promise<SharedView | null> => {
  if (!shareIdPattern.test(id)) {
    return null;
  }
  const found = await findShare(db, id);
  if (!found) {
    return null;
  }
  await markSeen(db, id, now);
  const shared = await (await currentListDataVersions(db))(found);
  const data = await readGameData(bundle, shared);
  return data && sharedView({ shared, data });
};

export const loadSavedView = async ({
  db,
  bundle,
  id,
  userId,
  isAnonymous,
}: SavedViewRequest): Promise<SavedView | null> => {
  const found = await findArmy(db, { id, userId });
  if (!found) {
    return null;
  }
  const saved = await (await currentListDataVersions(db))(found);
  const [data, collection, pins] = await Promise.all([
    readGameData(bundle, saved),
    isAnonymous ? null : listCollectionEntries(db, userId),
    isAnonymous ? [] : listArmyPins(db, { armyId: id, userId }),
  ]);
  return data && savedView({ saved, data, collection, pins });
};

export type DraftViewRequest = {
  db: Kysely<Database>;
  bundle: ArmyBundle;
  code: string;
  userId: string | null;
};

export const loadDraftView = async ({
  db,
  bundle,
  code,
  userId,
}: DraftViewRequest): Promise<DraftView | null> => {
  const decoded = decodeSelection(code);
  if (!decoded.ok) {
    return null;
  }
  const { selection } = decoded;
  const [data, collection] = await Promise.all([
    readArmyListReference(bundle, selection.army),
    userId === null ? null : listCollectionEntries(db, userId),
  ]);
  return data && draftView({ selection, collection, ...data });
};

export const sharedListSummary = (view: ListView, locale: Locale) => {
  switch (view.game) {
    case 'triumph':
      return [
        view.sheet.armyName,
        `${formatPoints(view.sheet.totals.total)} points`,
        countOf(view.sheet.totals.stands, 'stand'),
        formatYear(view.sheet.year, locale),
      ].join(' · ');
    case 'fantasy':
      return [
        fantasyGameName,
        `${formatPoints(view.sheet.totals.total)} / ${formatPoints(view.sheet.totals.pointsTotal)} points`,
        countOf(view.sheet.totals.stands, 'stand'),
        ...(view.sheet.totals.heroes > 0
          ? [countOf(view.sheet.totals.heroes, 'hero', 'heroes')]
          : []),
      ].join(' · ');
  }
};
