import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundlePaths } from '@/lib/data/bundle.ts';
import type { TroopTypeCode } from '@/lib/data/schema.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { insertCollectionEntry } from '@/lib/db/collection.ts';
import { insertCollectionPhoto } from '@/lib/db/collection-photos.ts';
import { listArmyPins } from '@/lib/db/collection-pins.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { UsersTable } from '@/lib/db/schema.ts';
import type { TroopOptionId } from '@/lib/domain/army/army-list.ts';
import type { CollectionEntryFormInput } from '@/lib/domain/collection/entry-schema.ts';
import type { EncodedPhoto } from '@/lib/photos/encode.ts';
import { createPhotoStore, type PhotoStore } from '@/lib/photos/store.ts';
import type { Context } from '@/lib/trpc/context.ts';
import { createCaller } from '@/lib/trpc/root.ts';
import { bundledTroopTypes, memoryBundleSource } from '@/test/bundle-source.ts';
import {
  blockEvents,
  carthage,
  eventLogFull,
  recordedEvents,
  recordedKinds,
} from '@/test/events.ts';
import {
  armyDetail,
  armyIndexEntry,
  entries,
  fixtureSelection,
  troopOption,
} from '@/test/fixtures/army.ts';
import { type BundleFiles, seedDataVersion } from '@/test/reference.ts';
import { sampleBattleCards } from '@/test/sample.ts';
import { buildableListLimit } from '../../domain/collection/buildable.ts';

let db: ReturnType<typeof createDatabase>;
let minted: number;
let ticks: number;
let dir: string;
let photos: PhotoStore;

const servedDataVersion = '2026-09-28.0123abcd';

const owner = 'user-hannibal';
const other = 'user-scipio';
const browser = 'user-anonymous';

const encoded: EncodedPhoto = {
  display: { bytes: Buffer.from('display bytes'), width: 1600, height: 1200 },
  thumb: { bytes: Buffer.from('thumb bytes'), width: 400, height: 300 },
};

const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
  isAnonymous,
});

const at = (tick: number) =>
  new Date(Date.UTC(2026, 8, 24, 10, tick)).toISOString();

const context = (userId: string | null, isAnonymous = false): Context => ({
  db,
  caller: userId ? { userId, isAnonymous, isAdmin: false } : null,
  origin: carthage,
  photos,
  photoQuota: { perEntry: 6, perAccount: 200 },
  bundles: () => memoryBundleSource(bundleFiles),
  now: () => at(++ticks),
  nextId: () => `entry-${++minted}`,
});

const caller = (userId: string | null, isAnonymous = false) =>
  createCaller(context(userId, isAnonymous));

const signedIn = () => caller(owner);

const phalangites = (
  overrides: Partial<CollectionEntryFormInput> = {},
): CollectionEntryFormInput => ({
  name: 'Macedonian phalangites',
  count: 8,
  troopType: 'PIK',
  tags: ['macedonian', 'pike'],
  status: 'painted',
  notes: 'Victrix, based on 40 mm',
  ...overrides,
});

const create = (overrides: Partial<CollectionEntryFormInput> = {}) =>
  signedIn().collection.create(phalangites(overrides));

const names = (entries: readonly { name: string }[]) =>
  entries.map(({ name }) => name);

const armyOf = (id: string, name: string, ...troopTypes: TroopTypeCode[]) =>
  armyDetail({
    id,
    name,
    troopOptions: troopTypes.map((troopType) =>
      troopOption({ min: 0, max: 24, troopEntries: entries(troopType) }),
    ),
    troopEntriesForGeneral: [{ troopEntries: entries(...troopTypes) }],
    battleCardEntries: [],
    allyOptions: [],
    allyContingents: [],
  });

const fixtureArmies = [
  armyOf('army-phalanx', 'Phalanx', 'PIK'),
  armyOf('army-spears', 'Spearmen', 'SPR'),
  ...Array.from({ length: buildableListLimit }, (_, index) =>
    armyOf(`army-levy-${index}`, `Levy ${index}`, 'HRD'),
  ),
];

const bundleFiles: BundleFiles = {
  [bundlePaths.index]: {
    meta: {
      source: 'https://meshwesh.example.test',
      fetchedAt: '2026-09-17T00:00:00.000Z',
      contentHash: 'abcdef01',
    },
    armies: fixtureArmies.map(({ id, name }) => armyIndexEntry({ id, name })),
  },
  [bundlePaths.troopTypes]: bundledTroopTypes,
  [bundlePaths.battleCards]: sampleBattleCards,
  ...Object.fromEntries(
    fixtureArmies.map((detail) => [bundlePaths.army(detail.id), detail]),
  ),
};

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(other), user(browser, 1)])
    .execute();
  await seedDataVersion(db, servedDataVersion);
  dir = await mkdtemp(join(tmpdir(), 'triumph-collection-'));
  photos = createPhotoStore(dir);
  minted = 0;
  ticks = 0;
});

afterEach(async () => {
  await db.destroy();
  await rm(dir, { recursive: true, force: true });
});

describe('the collection router', () => {
  it.each([
    ['there is no caller', () => caller(null)],
    ['the caller is anonymous', () => caller(browser, true)],
  ])('asks for an account when %s', async (_, as) => {
    const refusal = { code: 'UNAUTHORIZED', message: 'needsAccount' };

    await expect(as().collection.list()).rejects.toMatchObject(refusal);
    await expect(as().collection.create(phalangites())).rejects.toMatchObject(
      refusal,
    );
    await expect(
      as().collection.update({ id: 'entry-1', count: 2 }),
    ).rejects.toMatchObject(refusal);
    await expect(
      as().collection.delete({ id: 'entry-1' }),
    ).rejects.toMatchObject(refusal);
    await expect(
      as().collection.buildable({ locale: 'en' }),
    ).rejects.toMatchObject(refusal);
  });
});

describe('collection.buildable', () => {
  const buildable = async () =>
    (await signedIn().collection.buildable({ locale: 'en' })).map(
      ({ army, name, pointsCovered }) => ({ army, name, pointsCovered }),
    );

  it('builds nothing from an empty collection', async () => {
    expect(await buildable()).toEqual([]);
  });

  it('ranks the armies the caller can build from their own collection', async () => {
    await create({ count: 8, troopType: 'PIK' });
    await create({ name: 'Spearmen', count: 3, troopType: 'SPR' });
    await caller(other).collection.create(
      phalangites({ name: 'Levy', count: 12, troopType: 'HRD' }),
    );

    expect(await buildable()).toEqual([
      { army: 'army-phalanx', name: 'Phalanx', pointsCovered: 24 },
      { army: 'army-spears', name: 'Spearmen', pointsCovered: 12 },
    ]);
  });

  it('stamps every list with the data version the database serves', async () => {
    await create({ count: 8, troopType: 'PIK' });

    const [phalanx] = await signedIn().collection.buildable({ locale: 'en' });

    expect(phalanx?.selection.dataVersion).toBe(servedDataVersion);
  });

  it(`returns the best ${buildableListLimit} at most`, async () => {
    await create({ name: 'Levy', count: 12, troopType: 'HRD' });

    expect(await buildable()).toHaveLength(buildableListLimit);
  });

  it('builds only the armies named like the search, before it takes the best', async () => {
    await create({ count: 8, troopType: 'PIK' });
    await create({ name: 'Levy', count: 12, troopType: 'HRD' });

    expect(
      (
        await signedIn().collection.buildable({
          locale: 'en',
          search: 'levy 12',
        })
      ).map(({ army }) => army),
    ).toEqual(['army-levy-12']);
  });

  it('builds from matches alone when the caller turns stand-ins off', async () => {
    await create({ count: 8, troopType: 'PIK' });

    expect(
      await signedIn().collection.buildable({ locale: 'en', standIns: false }),
    ).toEqual([]);
  });

  it('builds only the armies the collection completes when the caller asks', async () => {
    await create({ count: 16, troopType: 'PIK' });
    await create({ name: 'Spearmen', count: 3, troopType: 'SPR' });

    expect(
      (
        await signedIn().collection.buildable({ locale: 'en', complete: true })
      ).map(({ army }) => army),
    ).toEqual(['army-phalanx']);
  });

  it('refuses a locale the app does not speak', async () => {
    await expect(
      signedIn().collection.buildable({ locale: 'fr' as 'en' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describe('collection.list', () => {
  it('returns only the entries the caller owns', async () => {
    await create();
    await caller(other).collection.create(
      phalangites({ name: 'Roman hastati', troopType: 'HFT' }),
    );

    expect(names(await signedIn().collection.list())).toEqual([
      'Macedonian phalangites',
    ]);
  });

  it('puts the most recently touched entry first', async () => {
    const first = await create({ name: 'Phalangites' });
    await create({ name: 'Companions', troopType: 'KNT' });
    await signedIn().collection.update({ id: first.id, count: 12 });

    expect(names(await signedIn().collection.list())).toEqual([
      'Phalangites',
      'Companions',
    ]);
  });
});

describe('collection.create', () => {
  it('saves the entry under the caller, with the id and time from the context', async () => {
    const entry = await create();

    expect(entry).toEqual({
      id: 'entry-1',
      name: 'Macedonian phalangites',
      count: 8,
      troopType: 'PIK',
      tags: ['macedonian', 'pike'],
      status: 'painted',
      notes: 'Victrix, based on 40 mm',
      createdAt: at(1),
      updatedAt: at(1),
    });
    const row = await db
      .selectFrom('collection_entries')
      .select('user_id')
      .where('id', '=', entry.id)
      .executeTakeFirstOrThrow();
    expect(row.user_id).toBe(owner);
  });

  it('trims, lowercases and de-duplicates the tags', async () => {
    const entry = await create({
      tags: [' Macedonian ', 'PIKE', 'pike', 'macedonian', '  '],
    });

    expect(entry.tags).toEqual(['macedonian', 'pike']);
  });

  it('trims the name and the notes a phone keyboard padded', async () => {
    const entry = await create({ name: '  Phalangites  ', notes: ' Victrix ' });

    expect(entry).toMatchObject({ name: 'Phalangites', notes: 'Victrix' });
  });

  it.each([
    ['an empty name', { name: '   ' }, 'nameYourEntry'],
    ['no stands', { count: 0 }, 'countAtLeastOne'],
    ['part of a stand', { count: 1.5 }, 'countAtLeastOne'],
    ['no troop type', { troopType: null }, 'pickATroopType'],
    ['a troop type nobody fields', { troopType: 'XYZ' }, 'pickATroopType'],
    ['a status the table does not know', { status: 'glued' }, undefined],
  ])('refuses %s', async (_, overrides, message) => {
    await expect(
      create(overrides as Partial<CollectionEntryFormInput>),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    if (message) {
      await expect(
        create(overrides as Partial<CollectionEntryFormInput>),
      ).rejects.toThrow(message);
    }
    expect(await signedIn().collection.list()).toEqual([]);
  });
});

describe('collection.update', () => {
  it('changes only the fields it is given, and stamps the time', async () => {
    const entry = await create();

    const updated = await signedIn().collection.update({
      id: entry.id,
      status: 'inProgress',
      tags: ['Successor', 'pike'],
    });

    expect(updated).toEqual({
      ...entry,
      status: 'inProgress',
      tags: ['successor', 'pike'],
      updatedAt: at(2),
    });
    expect(await signedIn().collection.list()).toEqual([updated]);
  });

  it('refuses a change the form would refuse', async () => {
    const entry = await create();

    await expect(
      signedIn().collection.update({ id: entry.id, troopType: null }),
    ).rejects.toThrow('pickATroopType');
    expect(await signedIn().collection.list()).toEqual([entry]);
  });

  it('answers another account’s entry as one that does not exist', async () => {
    const entry = await create();

    const theirs = caller(other).collection.update({ id: entry.id, count: 1 });
    const nobodys = caller(other).collection.update({
      id: 'entry-missing',
      count: 1,
    });

    await expect(theirs).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'notYourEntry',
    });
    await expect(nobodys).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'notYourEntry',
    });
    expect(await signedIn().collection.list()).toEqual([entry]);
  });
});

describe('collection.delete', () => {
  it('removes the entry and returns its id', async () => {
    const entry = await create();

    expect(await signedIn().collection.delete({ id: entry.id })).toEqual({
      id: entry.id,
    });
    expect(await signedIn().collection.list()).toEqual([]);
  });

  it('answers another account’s entry as one that does not exist, and leaves it', async () => {
    const entry = await create();

    await expect(
      caller(other).collection.delete({ id: entry.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'notYourEntry' });
    await expect(
      caller(other).collection.delete({ id: 'entry-missing' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', message: 'notYourEntry' });
    expect(await signedIn().collection.list()).toEqual([entry]);
  });
});

describe('collection.photos', () => {
  const photosOf = (userId: string, isAnonymous = false) =>
    caller(userId, isAnonymous).collection.photos;
  const mine = () => photosOf(owner);
  const anonymous = () => photosOf(browser, true);

  const addEntry = (id: string, userId = owner) =>
    insertCollectionEntry(db, {
      id,
      userId,
      name: 'Libyan spearmen',
      count: 8,
      troopType: 'SPR',
      tags: ['libyan'],
      status: 'painted',
      notes: '',
      at: '2026-09-24T10:00:00.000Z',
    });

  const addPhoto = async (
    id: string,
    position: number,
    { entryId = 'entry-spearmen', userId = owner } = {},
  ) => {
    await photos.write(id, encoded);
    await insertCollectionPhoto(db, {
      id,
      entryId,
      userId,
      position,
      width: 1600,
      height: 1200,
      bytes: 24,
      at: '2026-09-24T10:00:00.000Z',
    });
  };

  const ids = (list: readonly { id: string }[]) => list.map(({ id }) => id);

  beforeEach(async () => {
    await addEntry('entry-spearmen');
    await addEntry('entry-legion', other);
    await addPhoto('photo-b', 1);
    await addPhoto('photo-a', 0);
    await addPhoto('photo-legion', 0, {
      entryId: 'entry-legion',
      userId: other,
    });
  });

  describe('collection.photos.overview', () => {
    it('names each entry’s first photo and counts the account against its limits', async () => {
      await addEntry('entry-cavalry');
      await addPhoto('photo-cavalry', 3, { entryId: 'entry-cavalry' });

      expect(await mine().overview()).toEqual({
        perEntry: 6,
        perAccount: 200,
        onAccount: 3,
        covers: {
          'entry-spearmen': 'photo-a',
          'entry-cavalry': 'photo-cavalry',
        },
      });
    });

    it('follows a reorder to the new first photo', async () => {
      await mine().reorder({
        entryId: 'entry-spearmen',
        ids: ['photo-b', 'photo-a'],
      });

      expect((await mine().overview()).covers).toEqual({
        'entry-spearmen': 'photo-b',
      });
    });

    it('refuses an anonymous caller', async () => {
      await expect(anonymous().overview()).rejects.toThrow('needsAccount');
    });
  });

  describe('collection.photos.list', () => {
    it('lists an entry’s photos in their order', async () => {
      const list = await mine().list({ entryId: 'entry-spearmen' });

      expect(ids(list)).toEqual(['photo-a', 'photo-b']);
      expect(list[0]).toEqual({
        id: 'photo-a',
        entryId: 'entry-spearmen',
        position: 0,
        width: 1600,
        height: 1200,
        bytes: 24,
        createdAt: '2026-09-24T10:00:00.000Z',
      });
    });

    it('lists nothing for another account’s entry', async () => {
      expect(await mine().list({ entryId: 'entry-legion' })).toEqual([]);
    });

    it('refuses an anonymous caller', async () => {
      await expect(
        anonymous().list({ entryId: 'entry-spearmen' }),
      ).rejects.toThrow('needsAccount');
    });
  });

  describe('collection.photos.reorder', () => {
    it('stores the order it is given and returns it', async () => {
      const list = await mine().reorder({
        entryId: 'entry-spearmen',
        ids: ['photo-b', 'photo-a'],
      });

      expect(ids(list)).toEqual(['photo-b', 'photo-a']);
      expect(ids(await mine().list({ entryId: 'entry-spearmen' }))).toEqual([
        'photo-b',
        'photo-a',
      ]);
    });

    it('refuses an order that leaves out or repeats a photo', async () => {
      for (const order of [['photo-b'], ['photo-a', 'photo-a']]) {
        await expect(
          mine().reorder({ entryId: 'entry-spearmen', ids: order }),
        ).rejects.toThrow('photosChanged');
      }
      expect(ids(await mine().list({ entryId: 'entry-spearmen' }))).toEqual([
        'photo-a',
        'photo-b',
      ]);
    });

    it('cannot move another account’s photo', async () => {
      await expect(
        mine().reorder({
          entryId: 'entry-legion',
          ids: ['photo-legion'],
        }),
      ).rejects.toThrow('photosChanged');
      await expect(
        mine().reorder({
          entryId: 'entry-spearmen',
          ids: ['photo-a', 'photo-legion'],
        }),
      ).rejects.toThrow('photosChanged');
    });

    it('refuses an anonymous caller', async () => {
      await expect(
        anonymous().reorder({ entryId: 'entry-spearmen', ids: [] }),
      ).rejects.toThrow('needsAccount');
    });
  });

  describe('collection.photos.delete', () => {
    it('removes the row and both files', async () => {
      expect(await mine().delete({ id: 'photo-a' })).toEqual({
        id: 'photo-a',
      });

      expect(ids(await mine().list({ entryId: 'entry-spearmen' }))).toEqual([
        'photo-b',
      ]);
      expect((await readdir(dir)).sort()).toEqual([
        'photo-b-display.webp',
        'photo-b-thumb.webp',
        'photo-legion-display.webp',
        'photo-legion-thumb.webp',
      ]);
    });

    it('records the removal with its player, subject, address and place', async () => {
      await mine().delete({ id: 'photo-a' });

      expect(await recordedEvents(db)).toEqual([
        {
          kind: 'collection.photo_removed',
          user_id: owner,
          is_anonymous: 0,
          subject_id: 'photo-a',
          props: '{}',
          ip: carthage.ip,
          country: 'TN',
          region: 'Tunis',
          city: 'Carthage',
        },
      ]);
    });

    it('records nothing for another account’s photo', async () => {
      await expect(mine().delete({ id: 'photo-legion' })).rejects.toThrow();

      expect(await recordedEvents(db)).toEqual([]);
    });

    it('keeps the photo and its files when its event cannot be recorded', async () => {
      await blockEvents(db);

      await expect(mine().delete({ id: 'photo-a' })).rejects.toThrow(
        eventLogFull,
      );

      expect(ids(await mine().list({ entryId: 'entry-spearmen' }))).toEqual([
        'photo-a',
        'photo-b',
      ]);
      expect(await readdir(dir)).toContain('photo-a-display.webp');
    });

    it('answers not found for another account’s photo, and keeps its files', async () => {
      await expect(mine().delete({ id: 'photo-legion' })).rejects.toThrow(
        'notYourPhoto',
      );

      expect(
        ids(await photosOf(other).list({ entryId: 'entry-legion' })),
      ).toEqual(['photo-legion']);
      expect(await photos.read('photo-legion', 'display')).toEqual(
        encoded.display.bytes,
      );
    });

    it('refuses an anonymous caller', async () => {
      await expect(anonymous().delete({ id: 'photo-a' })).rejects.toThrow(
        'needsAccount',
      );
    });
  });

  describe('deleting the entry', () => {
    it('removes the files of every photo it held', async () => {
      await caller(owner).collection.delete({ id: 'entry-spearmen' });

      expect((await readdir(dir)).sort()).toEqual([
        'photo-legion-display.webp',
        'photo-legion-thumb.webp',
      ]);
    });

    it('leaves the files alone when the entry is not the caller’s', async () => {
      await expect(
        caller(owner).collection.delete({ id: 'entry-legion' }),
      ).rejects.toThrow('notYourEntry');

      expect(await photos.read('photo-legion', 'display')).toEqual(
        encoded.display.bytes,
      );
    });
  });
});

describe('pinning an entry to a troop option', () => {
  const spearmen = 'main/0' as TroopOptionId;

  const pinKey = (armyId: string, entryId: string) => ({
    armyId,
    option: spearmen,
    troopType: 'SPR' as const,
    entryId,
  });

  const saveList = (userId: string) =>
    caller(userId).army.create({
      name: 'Cannae',
      selection: fixtureSelection({ stands: 6 }),
    });

  const pinsOf = (armyId: string, userId = owner) =>
    listArmyPins(db, { armyId, userId });

  it.each([
    ['there is no caller', () => caller(null)],
    ['the caller is anonymous', () => caller(browser, true)],
  ])('asks for an account when %s', async (_, as) => {
    const refusal = { code: 'UNAUTHORIZED', message: 'needsAccount' };

    await expect(
      as().collection.pin({ ...pinKey('army-1', 'entry-1'), count: 2 }),
    ).rejects.toMatchObject(refusal);
    await expect(
      as().collection.unpin(pinKey('army-1', 'entry-1')),
    ).rejects.toMatchObject(refusal);
  });

  it('pins an entry of the caller’s to a list of the caller’s', async () => {
    const army = await saveList(owner);
    const entry = await create({ troopType: 'SPR' });

    expect(
      await signedIn().collection.pin({
        ...pinKey(army.id, entry.id),
        count: 4,
      }),
    ).toEqual({
      option: spearmen,
      troopType: 'SPR',
      entry: entry.id,
      count: 4,
    });
    expect(await pinsOf(army.id)).toEqual([
      { option: spearmen, troopType: 'SPR', entry: entry.id, count: 4 },
    ]);
  });

  it('keeps one pin per entry and troop, taking the latest count', async () => {
    const army = await saveList(owner);
    const entry = await create({ troopType: 'SPR' });

    await signedIn().collection.pin({ ...pinKey(army.id, entry.id), count: 4 });
    await signedIn().collection.pin({ ...pinKey(army.id, entry.id), count: 6 });

    expect(await pinsOf(army.id)).toEqual([
      { option: spearmen, troopType: 'SPR', entry: entry.id, count: 6 },
    ]);
  });

  it('refuses a list or an entry that is not the caller’s, and stores nothing', async () => {
    const mine = await saveList(owner);
    const theirs = await saveList(other);
    const myEntry = await create({ troopType: 'SPR' });
    const theirEntry = await caller(other).collection.create(
      phalangites({ troopType: 'SPR' }),
    );
    const refusal = { code: 'NOT_FOUND', message: 'notYourListOrEntry' };

    await expect(
      signedIn().collection.pin({ ...pinKey(theirs.id, myEntry.id), count: 2 }),
    ).rejects.toMatchObject(refusal);
    await expect(
      signedIn().collection.pin({
        ...pinKey(mine.id, theirEntry.id),
        count: 2,
      }),
    ).rejects.toMatchObject(refusal);
    await expect(
      signedIn().collection.pin({
        ...pinKey(mine.id, 'entry-missing'),
        count: 2,
      }),
    ).rejects.toMatchObject(refusal);

    expect(await pinsOf(mine.id)).toEqual([]);
    expect(await pinsOf(theirs.id, other)).toEqual([]);
  });

  it('refuses a troop option the army list model does not mint', async () => {
    const army = await saveList(owner);
    const entry = await create({ troopType: 'SPR' });

    await expect(
      signedIn().collection.pin({
        ...pinKey(army.id, entry.id),
        option: 'spearmen' as TroopOptionId,
        count: 2,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('unpins only the pin it names', async () => {
    const army = await saveList(owner);
    const levy = await create({ name: 'Levy', troopType: 'SPR' });
    const guard = await create({ name: 'Guard', troopType: 'SPR' });
    await signedIn().collection.pin({ ...pinKey(army.id, levy.id), count: 2 });
    await signedIn().collection.pin({ ...pinKey(army.id, guard.id), count: 2 });

    await signedIn().collection.unpin(pinKey(army.id, levy.id));

    expect(await pinsOf(army.id)).toEqual([
      { option: spearmen, troopType: 'SPR', entry: guard.id, count: 2 },
    ]);
  });

  it('cannot unpin another account’s pin', async () => {
    const army = await saveList(owner);
    const entry = await create({ troopType: 'SPR' });
    await signedIn().collection.pin({ ...pinKey(army.id, entry.id), count: 2 });

    await caller(other).collection.unpin(pinKey(army.id, entry.id));

    expect(await pinsOf(army.id)).toHaveLength(1);
  });

  it('forgets a pin when the entry it names is deleted', async () => {
    const army = await saveList(owner);
    const entry = await create({ troopType: 'SPR' });
    await signedIn().collection.pin({ ...pinKey(army.id, entry.id), count: 2 });

    await signedIn().collection.delete({ id: entry.id });

    expect(await pinsOf(army.id)).toEqual([]);
  });
});

describe('the events a collection entry records', () => {
  it('records an entry added, edited and removed, with its address and place', async () => {
    const entry = await create();

    await signedIn().collection.update({ id: entry.id, count: 12 });
    await signedIn().collection.delete({ id: entry.id });

    expect(
      (await recordedEvents(db)).map(
        ({ kind, user_id, subject_id, ip, country, region, city }) => ({
          kind,
          user_id,
          subject_id,
          ip,
          location: { country, region, city },
        }),
      ),
    ).toEqual(
      [
        'collection.entry_added',
        'collection.entry_edited',
        'collection.entry_removed',
      ].map((kind) => ({
        kind,
        user_id: owner,
        subject_id: entry.id,
        ip: carthage.ip,
        location: carthage.location,
      })),
    );
  });

  it('records nothing for another account’s entry', async () => {
    const entry = await create();

    await expect(
      caller(other).collection.update({ id: entry.id, count: 12 }),
    ).rejects.toThrow();
    await expect(
      caller(other).collection.delete({ id: entry.id }),
    ).rejects.toThrow();

    expect(await recordedKinds(db)).toEqual(['collection.entry_added']);
  });

  it('keeps no entry whose event could not be recorded', async () => {
    const entry = await create();
    await blockEvents(db);

    await expect(create({ name: 'Thracian peltasts' })).rejects.toThrow(
      eventLogFull,
    );
    await expect(
      signedIn().collection.update({ id: entry.id, count: 12 }),
    ).rejects.toThrow(eventLogFull);
    await expect(
      signedIn().collection.delete({ id: entry.id }),
    ).rejects.toThrow(eventLogFull);

    expect(await signedIn().collection.list()).toEqual([
      expect.objectContaining({ id: entry.id, count: 8 }),
    ]);
  });
});
