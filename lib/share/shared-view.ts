import type { Kysely } from 'kysely';
import type { ArmyBundle } from '../data/bundle-source.ts';
import { findArmy } from '../db/armies.ts';
import { listCollectionEntries } from '../db/collection.ts';
import { listArmyPins } from '../db/collection-pins.ts';
import type { Database } from '../db/schema.ts';
import { findShare, touchShare } from '../db/shares.ts';
import { buildArmyList } from '../domain/army/army-list.ts';
import { decodeSelection } from '../domain/army/share-codec.ts';
import { shareIdPattern } from '../domain/army/shared-list.ts';
import {
  type DraftView,
  draftView,
  type ListView,
  type ListViewData,
  type SavedView,
  type SharedView,
  savedView,
  sharedView,
} from '../domain/army/shared-view.ts';
import { countOf, formatPoints, formatYear } from '../format.ts';
import type { Locale } from '../i18n/locales.ts';

export const seenResolutionMs = 24 * 60 * 60 * 1000;

export type SharedViewRequest = {
  db: Kysely<Database>;
  bundle: ArmyBundle;
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
  bundle: ArmyBundle;
  id: string;
  userId: string;
  isAnonymous: boolean;
};

export const readViewData = async (
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

export const loadSharedView = async ({
  db,
  bundle,
  id,
  now = () => new Date(),
}: SharedViewRequest): Promise<SharedView | null> => {
  if (!shareIdPattern.test(id)) {
    return null;
  }
  const shared = await findShare(db, id);
  if (!shared) {
    return null;
  }
  await markSeen(db, id, now);
  const data = await readViewData(bundle, shared.armyListId);
  return data && sharedView({ shared, ...data });
};

export const loadSavedView = async ({
  db,
  bundle,
  id,
  userId,
  isAnonymous,
}: SavedViewRequest): Promise<SavedView | null> => {
  const saved = await findArmy(db, { id, userId });
  if (!saved) {
    return null;
  }
  const [data, collection, pins] = await Promise.all([
    readViewData(bundle, saved.armyListId),
    isAnonymous ? null : listCollectionEntries(db, userId),
    isAnonymous ? [] : listArmyPins(db, { armyId: id, userId }),
  ]);
  return data && savedView({ saved, collection, pins, ...data });
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
    readViewData(bundle, selection.army),
    userId === null ? null : listCollectionEntries(db, userId),
  ]);
  return data && draftView({ selection, collection, ...data });
};

export const sharedListSummary = ({ sheet }: ListView, locale: Locale) =>
  [
    sheet.armyName,
    `${formatPoints(sheet.totals.total)} points`,
    countOf(sheet.totals.stands, 'stand'),
    formatYear(sheet.year, locale),
  ].join(' · ');
