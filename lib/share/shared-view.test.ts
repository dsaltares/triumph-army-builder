import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ArmyBundle } from '@/lib/data/bundle-source';
import { countArmies, insertArmy } from '@/lib/db/armies';
import { createDatabase } from '@/lib/db/client';
import { insertCollectionEntry } from '@/lib/db/collection';
import { pinEntry } from '@/lib/db/collection-pins';
import { migrateToLatest } from '@/lib/db/migrator';
import { insertShare } from '@/lib/db/shares';
import { buildArmyList, type TroopOptionId } from '@/lib/domain/army/army-list';
import {
  decodeSelection,
  encodeSelection,
} from '@/lib/domain/army/share-codec';
import type { SavedView } from '@/lib/domain/army/shared-view';
import type { CollectionStatus } from '@/lib/domain/collection/entry';
import {
  loadDraftView,
  loadSavedView,
  loadSharedView,
  seenResolutionMs,
  sharedListSummary,
} from '@/lib/share/shared-view';
import { sampleBundleHolding } from '@/test/bundle-source.ts';
import { armyDetail, fixtureSelection } from '@/test/fixtures/army.ts';

const armyList = buildArmyList(armyDetail());

const owner = 'user-hannibal';

const at = '2026-09-20T10:00:00.000Z';

let bundle: ArmyBundle;
let db: ReturnType<typeof createDatabase>;

beforeAll(async () => {
  bundle = await sampleBundleHolding(armyDetail());
});

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values({
      id: owner,
      name: owner,
      email: `${owner}@example.test`,
      image: null,
    })
    .execute();
});

afterEach(async () => {
  await db.destroy();
});

const shareList = (name = 'Cannae') =>
  insertShare(db, { userId: owner, name, selection: fixtureSelection(), at });

const view = async (id: string, now?: () => Date) =>
  loadSharedView({ db, bundle, id, ...(now ? { now } : {}) });

const lastSeen = async (id: string) =>
  (
    await db
      .selectFrom('shares')
      .select('last_seen_at')
      .where('id', '=', id)
      .executeTakeFirstOrThrow()
  ).last_seen_at;

const laterBy = (ms: number) => () => new Date(Date.parse(at) + ms);

const goneArmyList = {
  army_list_id: 'army-gone',
  selection: JSON.stringify({ ...fixtureSelection(), army: 'army-gone' }),
};

describe('loadSharedView', () => {
  it('reads the copy back as a sheet, a report and a points meter', async () => {
    const shared = await shareList();

    const loaded = await view(shared.id);

    expect(loaded?.kind).toBe('shared');
    expect(loaded?.list).toEqual(shared);
    expect(loaded?.sheet.listName).toBe('Cannae');
    expect(loaded?.sheet.armyName).toBe(armyList.name);
    expect(loaded?.sheet.totals.stands).toBe(4);
    expect(loaded?.meter.total).toBe(loaded?.sheet.totals.total);
    expect(loaded?.report.legal).toBe(false);
  });

  it('is nothing for an id that is not a share id, without asking the database', async () => {
    await db.destroy();

    expect(await view('../../etc/passwd')).toBeNull();
  });

  it('is nothing for an id nobody shared', async () => {
    expect(await view('nothinghere1')).toBeNull();
  });

  it('marks a copy as seen when somebody opens it', async () => {
    const shared = await shareList();
    const opened = laterBy(seenResolutionMs * 3);

    await view(shared.id, opened);

    expect(await lastSeen(shared.id)).toBe(opened().toISOString());
  });

  it('leaves a copy opened again the same day alone, so a view is not a write', async () => {
    const shared = await shareList();

    await view(shared.id, laterBy(seenResolutionMs / 2));

    expect(await lastSeen(shared.id)).toBe(at);
  });

  it('is nothing when the army list has left the data bundle', async () => {
    const shared = await shareList();
    await db
      .updateTable('shares')
      .set(goneArmyList)
      .where('id', '=', shared.id)
      .execute();

    expect(await view(shared.id)).toBeNull();
  });
});

const saveList = (name = 'Cannae') =>
  insertArmy(db, {
    id: 'saved-1',
    userId: owner,
    name,
    selection: fixtureSelection(),
    at,
  });

const addEntry = (
  userId: string,
  id: string,
  count: number,
  status: CollectionStatus = 'painted',
) =>
  insertCollectionEntry(db, {
    id,
    userId,
    at,
    name: 'Sumerian spearmen',
    count,
    troopType: 'SPR',
    tags: [],
    status,
    notes: '',
  });

const spearmen = armyList.main.troopOptions[0]?.id as TroopOptionId;

const sourcesOf = (view: SavedView | null) =>
  view?.collection.kind === 'coverage'
    ? view.collection.contingents.flatMap(({ options }) =>
        options.flatMap(({ lines }) => lines.flatMap(({ sources }) => sources)),
      )
    : [];

const countShares = async () =>
  Number(
    (
      await db
        .selectFrom('shares')
        .select(({ fn }) => fn.countAll<number>().as('shares'))
        .executeTakeFirstOrThrow()
    ).shares,
  );

describe('loadSavedView', () => {
  it("reads the owner's list as a sheet, a report and a points meter", async () => {
    const saved = await saveList();

    const loaded = await loadSavedView({
      db,
      bundle,
      id: saved.id,
      userId: owner,
      isAnonymous: false,
    });

    expect(loaded?.kind).toBe('saved');
    expect(loaded?.list).toEqual(saved);
    expect(loaded?.sheet.listName).toBe('Cannae');
    expect(loaded?.sheet.totals.stands).toBe(4);
    expect(loaded?.meter.total).toBe(loaded?.sheet.totals.total);
    expect(loaded?.report.legal).toBe(false);
  });

  it('is nothing for a list somebody else saved', async () => {
    const saved = await saveList();

    expect(
      await loadSavedView({
        db,
        bundle,
        id: saved.id,
        userId: 'user-scipio',
        isAnonymous: false,
      }),
    ).toBeNull();
  });

  it('is nothing for an id nobody saved', async () => {
    expect(
      await loadSavedView({
        db,
        bundle,
        id: 'saved-404',
        userId: owner,
        isAnonymous: false,
      }),
    ).toBeNull();
  });

  it('mints no share link for the owner to look at their own list', async () => {
    const saved = await saveList();

    await loadSavedView({
      db,
      bundle,
      id: saved.id,
      userId: owner,
      isAnonymous: false,
    });

    expect(await countShares()).toBe(0);
  });

  it("covers the list with its owner's collection", async () => {
    const saved = await saveList();
    await addEntry(owner, 'entry-1', 3);

    const loaded = await loadSavedView({
      db,
      bundle,
      id: saved.id,
      userId: owner,
      isAnonymous: false,
    });

    expect(loaded?.collection).toMatchObject({
      kind: 'coverage',
      entries: 1,
      stands: 4,
      covered: 3,
      toBuy: 1,
    });
  });

  it("never covers the list with somebody else's collection", async () => {
    const saved = await saveList();
    await db
      .insertInto('users')
      .values({
        id: 'user-scipio',
        name: 'user-scipio',
        email: 'user-scipio@example.test',
        image: null,
      })
      .execute();
    await addEntry('user-scipio', 'entry-scipio', 4);

    const loaded = await loadSavedView({
      db,
      bundle,
      id: saved.id,
      userId: owner,
      isAnonymous: false,
    });

    expect(loaded?.collection).toMatchObject({
      kind: 'coverage',
      entries: 0,
      covered: 0,
    });
  });

  it('fixes a pinned entry first, where the allocation would have chosen another', async () => {
    const saved = await saveList();
    await addEntry(owner, 'entry-painted', 4);
    await addEntry(owner, 'entry-unpainted', 4, 'unpainted');
    await pinEntry(
      db,
      { armyId: saved.id, userId: owner },
      {
        option: spearmen,
        troopType: 'SPR',
        entry: 'entry-unpainted',
        count: 4,
      },
    );

    const loaded = await loadSavedView({
      db,
      bundle,
      id: saved.id,
      userId: owner,
      isAnonymous: false,
    });

    expect(sourcesOf(loaded)).toEqual([
      expect.objectContaining({
        entry: 'entry-unpainted',
        stands: 4,
        pinned: true,
        fit: 'match',
      }),
    ]);
  });

  it('reads no pin into a share made from a pinned list', async () => {
    const saved = await saveList();
    await addEntry(owner, 'entry-1', 4);
    await pinEntry(
      db,
      { armyId: saved.id, userId: owner },
      { option: spearmen, troopType: 'SPR', entry: 'entry-1', count: 4 },
    );

    const shared = await insertShare(db, {
      userId: owner,
      name: saved.name,
      selection: saved.selection,
      at,
    });
    const row = await db
      .selectFrom('shares')
      .selectAll()
      .where('id', '=', shared.id)
      .executeTakeFirstOrThrow();

    expect(JSON.stringify(row)).not.toContain('entry-1');
    expect(decodeSelection(encodeSelection(saved.selection))).toEqual({
      ok: true,
      selection: saved.selection,
    });
    expect(JSON.stringify(saved.selection)).not.toContain('entry-1');
  });

  it('asks an anonymous owner for an account instead of reading a collection', async () => {
    const saved = await saveList();

    const loaded = await loadSavedView({
      db,
      bundle,
      id: saved.id,
      userId: owner,
      isAnonymous: true,
    });

    expect(loaded?.collection).toEqual({ kind: 'needsAccount' });
  });

  it('is nothing when the army list has left the data bundle', async () => {
    const saved = await saveList();
    await db
      .updateTable('armies')
      .set(goneArmyList)
      .where('id', '=', saved.id)
      .execute();

    expect(
      await loadSavedView({
        db,
        bundle,
        id: saved.id,
        userId: owner,
        isAnonymous: false,
      }),
    ).toBeNull();
  });
});

const loadDraft = (code: string, userId: string | null = owner) =>
  loadDraftView({ db, bundle, code, userId });

describe('loadDraftView', () => {
  it('reads a selection from its code as a sheet, a report and a points meter', async () => {
    const loaded = await loadDraft(encodeSelection(fixtureSelection()));

    expect(loaded?.kind).toBe('draft');
    expect(loaded?.list).toEqual({
      name: armyList.name,
      game: 'triumph',
      dataVersion: fixtureSelection().dataVersion,
      selection: fixtureSelection(),
      armyListId: armyList.id,
    });
    expect(loaded?.sheet.listName).toBe(armyList.name);
    expect(loaded?.sheet.totals.stands).toBe(4);
    expect(loaded?.meter.total).toBe(loaded?.sheet.totals.total);
  });

  it('saves nothing and shares nothing to be looked at', async () => {
    await loadDraft(encodeSelection(fixtureSelection()));

    expect(await countArmies(db, owner)).toBe(0);
    expect(await countShares()).toBe(0);
  });

  it("covers the selection with the player's collection", async () => {
    await addEntry(owner, 'entry-1', 3);

    const loaded = await loadDraft(encodeSelection(fixtureSelection()));

    expect(loaded?.collection).toMatchObject({
      kind: 'coverage',
      entries: 1,
      stands: 4,
      covered: 3,
      toBuy: 1,
    });
  });

  it('asks for an account to cover it when there is nobody to cover it for', async () => {
    const loaded = await loadDraft(encodeSelection(fixtureSelection()), null);

    expect(loaded?.collection).toEqual({ kind: 'needsAccount' });
  });

  it('is nothing for a code that does not decode', async () => {
    expect(await loadDraft('1.not-a-selection')).toBeNull();
  });

  it('is nothing for an army that is not in the data bundle', async () => {
    const code = encodeSelection({ ...fixtureSelection(), army: 'army-gone' });

    expect(await loadDraft(code)).toBeNull();
  });
});

describe('sharedListSummary', () => {
  it('names the army, the points, the stands and the year', async () => {
    const shared = await shareList();
    const loaded = await view(shared.id);
    if (!loaded) {
      throw new Error('the fixture share did not load');
    }

    expect(sharedListSummary(loaded, 'en')).toBe(
      `${armyList.name} · 16 points · 4 stands · 2900 BC`,
    );
  });
});
