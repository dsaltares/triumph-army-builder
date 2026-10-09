import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bundlePaths } from '@/lib/data/bundle.ts';
import type { TroopTypeCode } from '@/lib/data/schema.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { insertCollectionEntry } from '@/lib/db/collection.ts';
import { listArmyPins, pinEntry } from '@/lib/db/collection-pins.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { UsersTable } from '@/lib/db/schema.ts';
import {
  buildArmyList,
  type TroopOptionId,
} from '@/lib/domain/army/army-list.ts';
import { anonymousArmyLimit } from '@/lib/domain/army/saved-army.ts';
import { withStands } from '@/lib/domain/army/selection.ts';
import { defaultPhotoQuota } from '@/lib/photos/limits.ts';
import type { Context } from '@/lib/trpc/context.ts';
import { createCaller } from '@/lib/trpc/root.ts';
import { absentBundles } from '@/test/bundle-source.ts';
import {
  blockEvents,
  carthage,
  eventLogFull,
  recordedEvents,
  recordedKinds,
} from '@/test/events.ts';
import {
  armyDetail,
  fixtureDataVersion,
  fixtureSelection,
} from '@/test/fixtures/army.ts';
import { absentPhotoStore } from '@/test/photo-store.ts';
import { seedDataVersion } from '@/test/reference.ts';

let db: ReturnType<typeof createDatabase>;
let minted: number;
let ticks: number;

const owner = 'user-hannibal';
const other = 'user-scipio';
const browser = 'user-anonymous';

const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
  isAnonymous,
});

const at = (tick: number) =>
  new Date(Date.UTC(2026, 8, 18, 10, tick)).toISOString();

const context = (userId: string | null, isAnonymous = false): Context => ({
  db,
  caller: userId ? { userId, isAnonymous, isAdmin: false } : null,
  origin: carthage,
  photos: absentPhotoStore(),
  photoQuota: defaultPhotoQuota,
  bundles: absentBundles(),
  now: () => at(++ticks),
  nextId: () => `army-${++minted}`,
});

const caller = (userId: string | null) => createCaller(context(userId));

const signedIn = () => caller(owner);

const anonymous = () => createCaller(context(browser, true));

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(other), user(browser, 1)])
    .execute();
  minted = 0;
  ticks = 0;
});

afterEach(async () => {
  await db.destroy();
});

const create = (name: string, selection = fixtureSelection()) =>
  signedIn().army.create({ name, selection });

const names = (armies: readonly { name: string }[]) =>
  armies.map(({ name }) => name);

describe('army.list', () => {
  it('returns an empty list to a caller with no session, without a query', async () => {
    await create('Cannae');

    expect(await caller(null).army.list()).toEqual([]);
  });

  it('returns only the lists the caller owns', async () => {
    await create('Cannae');
    await caller(other).army.create({
      name: 'Zama',
      selection: fixtureSelection(),
    });

    expect(names(await signedIn().army.list())).toEqual(['Cannae']);
  });

  it('puts the most recently touched list first', async () => {
    const first = await create('Cannae');
    await create('Trebia');
    await signedIn().army.update({ id: first.id, name: 'Cannae' });

    expect(names(await signedIn().army.list())).toEqual(['Cannae', 'Trebia']);
  });
});

describe('army.create', () => {
  it('saves the list under the caller, deriving the columns from the selection', async () => {
    const selection = fixtureSelection();

    const army = await create('Cannae', selection);

    expect(army).toMatchObject({
      name: 'Cannae',
      armyListId: selection.army,
      dataVersion: selection.dataVersion,
      selection,
    });
    expect(army.createdAt).toBe(army.updatedAt);
    const row = await db
      .selectFrom('armies')
      .select('user_id')
      .where('id', '=', army.id)
      .executeTakeFirstOrThrow();
    expect(row.user_id).toBe(owner);
  });

  it('trims the name a phone keyboard padded', async () => {
    expect((await create('  Cannae  ')).name).toBe('Cannae');
  });

  it('refuses an empty name', async () => {
    await expect(create('   ')).rejects.toThrow();
  });

  it('refuses a selection that is not one the builder mints', async () => {
    await expect(
      signedIn().army.create({
        name: 'Cannae',
        selection: {
          ...fixtureSelection(),
          dataVersion: 'yesterday',
        },
      }),
    ).rejects.toThrow();
  });

  it('turns away a caller with no session', async () => {
    await expect(
      caller(null).army.create({
        name: 'Cannae',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow('signInToKeep');
  });
});

describe('reading a row back', () => {
  it('hands out the parsed selection, never the stored text', async () => {
    const { id } = await create('Cannae');

    const [army] = await signedIn().army.list();

    expect(army?.selection).toEqual(fixtureSelection());
    expect(typeof army?.selection).toBe('object');
    expect(
      typeof (
        await db
          .selectFrom('armies')
          .select('selection')
          .where('id', '=', id)
          .executeTakeFirstOrThrow()
      ).selection,
    ).toBe('string');
  });

  it('fails loudly on a selection the builder could not have written', async () => {
    const { id } = await create('Cannae');
    await db
      .updateTable('armies')
      .set({ selection: '{"army":"army-1"}' })
      .where('id', '=', id)
      .execute();

    await expect(signedIn().army.list()).rejects.toThrow();
  });
});

describe('army.byId', () => {
  it('reads back the list the caller saved', async () => {
    const { id } = await create('Cannae');

    expect(await signedIn().army.byId({ id })).toMatchObject({
      id,
      name: 'Cannae',
      selection: fixtureSelection(),
    });
  });

  it('hides a list owned by somebody else', async () => {
    const { id } = await create('Cannae');

    await expect(caller(other).army.byId({ id })).rejects.toThrow(
      'notYourList',
    );
  });
});

describe('army.update', () => {
  it('renames without touching the selection', async () => {
    const { id, selection } = await create('Cannae');

    const renamed = await signedIn().army.update({ id, name: 'Zama' });

    expect(renamed).toMatchObject({ id, name: 'Zama', selection });
  });

  it('replaces the selection and the columns derived from it', async () => {
    const { id } = await create('Cannae');
    const list = buildArmyList(armyDetail());
    const spearmen = list.main.troopOptions[0];
    if (!spearmen) {
      throw new Error('the fixture army no longer has a first troop option');
    }
    const selection = withStands(
      fixtureSelection({ dataVersion: '2026-09-19.beefcafe' }),
      spearmen,
      'SPR',
      6,
    );

    const updated = await signedIn().army.update({ id, selection });

    expect(updated.selection).toEqual(selection);
    expect(updated.dataVersion).toBe('2026-09-19.beefcafe');
  });

  it('moves the list to the top by bumping its updated time', async () => {
    const { id, createdAt } = await create('Cannae');

    const updated = await signedIn().army.update({ id, name: 'Zama' });

    expect(updated.createdAt).toBe(createdAt);
    expect(updated.updatedAt > createdAt).toBe(true);
  });

  it('refuses to write to a list owned by somebody else', async () => {
    const { id } = await create('Cannae');

    await expect(
      caller(other).army.update({ id, name: 'Stolen' }),
    ).rejects.toThrow('notYourList');
    expect((await signedIn().army.byId({ id })).name).toBe('Cannae');
  });

  it('reports a list that is not there', async () => {
    await expect(
      signedIn().army.update({ id: 'nothing', name: 'Zama' }),
    ).rejects.toThrow('notYourList');
  });
});

describe('saving a list with pins', () => {
  const spearmen = 'main/0' as TroopOptionId;

  const pinned = async (troopType: TroopTypeCode = 'SPR') => {
    const army = await create('Cannae', fixtureSelection({ stands: 6 }));
    await insertCollectionEntry(db, {
      id: 'entry-levy',
      userId: owner,
      name: 'Levy spearmen',
      count: 6,
      troopType,
      tags: [],
      status: 'painted',
      notes: '',
      at: at(0),
    });
    await pinEntry(
      db,
      { armyId: army.id, userId: owner },
      { option: spearmen, troopType: 'SPR', entry: 'entry-levy', count: 6 },
    );
    return army;
  };

  const pinsOf = (armyId: string) =>
    listArmyPins(db, { armyId, userId: owner });

  it('keeps a pin to a troop the list still takes', async () => {
    const { id } = await pinned();

    await signedIn().army.update({
      id,
      selection: fixtureSelection({ stands: 4 }),
    });

    expect(await pinsOf(id)).toHaveLength(1);
  });

  it('forgets a pin to a troop the list no longer takes', async () => {
    const { id, selection } = await pinned();

    await signedIn().army.update({
      id,
      selection: { ...selection, stands: {} },
    });

    expect(await pinsOf(id)).toEqual([]);
  });

  it('forgets a pin to an entry that no longer fields as that troop type', async () => {
    const { id, selection } = await pinned();
    await signedIn().collection.update({
      id: 'entry-levy',
      troopType: 'HFT',
    });

    await signedIn().army.update({ id, selection });

    expect(await pinsOf(id)).toEqual([]);
  });

  it('leaves pins alone on a rename', async () => {
    const { id } = await pinned('HFT');

    await signedIn().army.update({ id, name: 'Zama' });

    expect(await pinsOf(id)).toHaveLength(1);
  });
});

describe('army.duplicate', () => {
  it('copies the selection under a name that says it is a copy', async () => {
    const original = await create('Cannae');

    const copy = await signedIn().army.duplicate({ id: original.id });

    expect(copy.id).not.toBe(original.id);
    expect(copy).toMatchObject({
      name: 'Cannae (copy)',
      armyListId: original.armyListId,
      dataVersion: original.dataVersion,
      selection: original.selection,
    });
    expect(names(await signedIn().army.list())).toEqual([
      'Cannae (copy)',
      'Cannae',
    ]);
  });

  it('refuses to copy a list owned by somebody else', async () => {
    const { id } = await create('Cannae');

    await expect(caller(other).army.duplicate({ id })).rejects.toThrow(
      'notYourList',
    );
    expect(await caller(other).army.list()).toEqual([]);
  });
});

describe('army.delete', () => {
  it('removes the list and answers with the id that went', async () => {
    const { id } = await create('Cannae');

    expect(await signedIn().army.delete({ id })).toEqual({ id });
    expect(await signedIn().army.list()).toEqual([]);
  });

  it('refuses to delete a list owned by somebody else', async () => {
    const { id } = await create('Cannae');

    await expect(caller(other).army.delete({ id })).rejects.toThrow(
      'notYourList',
    );
    expect(names(await signedIn().army.list())).toEqual(['Cannae']);
  });

  it('reports a list that is already gone', async () => {
    const { id } = await create('Cannae');
    await signedIn().army.delete({ id });

    await expect(signedIn().army.delete({ id })).rejects.toThrow('notYourList');
  });
});

const fillTheBrowser = async (count = anonymousArmyLimit) => {
  for (let saved = 0; saved < count; saved++) {
    await anonymous().army.create({
      name: `List ${saved}`,
      selection: fixtureSelection(),
    });
  }
};

describe('the cap on one browser', () => {
  it('lets an anonymous player save up to the cap', async () => {
    await fillTheBrowser();

    expect(await anonymous().army.list()).toHaveLength(anonymousArmyLimit);
  });

  it('refuses the one past it, and says what to do about it', async () => {
    await fillTheBrowser();

    await expect(
      anonymous().army.create({
        name: 'One more',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow('signInToKeepMore');
    expect(await anonymous().army.list()).toHaveLength(anonymousArmyLimit);
  });

  it('refuses a copy past it too, so duplicate is not a way around', async () => {
    await fillTheBrowser();
    const [first] = await anonymous().army.list();

    await expect(
      anonymous().army.duplicate({ id: first?.id ?? '' }),
    ).rejects.toThrow('signInToKeepMore');
  });

  it('caps nobody who signed up', async () => {
    for (let saved = 0; saved <= anonymousArmyLimit; saved++) {
      await create(`List ${saved}`);
    }

    expect(await signedIn().army.list()).toHaveLength(anonymousArmyLimit + 1);
  });

  it('lets the browser save again once it has room', async () => {
    await fillTheBrowser();
    const [first] = await anonymous().army.list();
    await anonymous().army.delete({ id: first?.id ?? '' });

    await expect(
      anonymous().army.create({
        name: 'One more',
        selection: fixtureSelection(),
      }),
    ).resolves.toMatchObject({ name: 'One more' });
  });
});

describe('army.undoClaim', () => {
  it('takes back the lists a claim moved in, and answers with how many', async () => {
    const first = await create('Cannae');
    const second = await create('Trebia');

    expect(
      await signedIn().army.undoClaim({ ids: [first.id, second.id] }),
    ).toEqual({ removed: 2 });
    expect(await signedIn().army.list()).toEqual([]);
  });

  it('leaves the lists it was not given alone', async () => {
    const claimed = await create('Cannae');
    await create('Trebia');

    await signedIn().army.undoClaim({ ids: [claimed.id] });

    expect(names(await signedIn().army.list())).toEqual(['Trebia']);
  });

  it('cannot reach a list owned by somebody else', async () => {
    const { id } = await create('Cannae');

    expect(await caller(other).army.undoClaim({ ids: [id] })).toEqual({
      removed: 0,
    });
    expect(names(await signedIn().army.list())).toEqual(['Cannae']);
  });

  it('refuses a caller with no session at all', async () => {
    const { id } = await create('Cannae');

    await expect(caller(null).army.undoClaim({ ids: [id] })).rejects.toThrow(
      'signInToKeep',
    );
  });
});

describe('the events a list records', () => {
  it('records a created list with its player, subject, address and place', async () => {
    const army = await create('Cannae');

    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'list.created',
        user_id: owner,
        is_anonymous: 0,
        subject_id: army.id,
        props: '{}',
        ip: carthage.ip,
        country: 'TN',
        region: 'Tunis',
        city: 'Carthage',
      },
    ]);
  });

  it('marks a list an anonymous browser created as anonymous', async () => {
    await anonymous().army.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });

    expect(await recordedEvents(db)).toEqual([
      expect.objectContaining({
        kind: 'list.created',
        user_id: browser,
        is_anonymous: 1,
      }),
    ]);
  });

  it('records an edit and a rename apart, and only what changed', async () => {
    const { id } = await create('Cannae');

    await signedIn().army.update({
      id,
      name: 'Cannae',
      selection: fixtureSelection({ stands: 5 }),
    });
    ticks += 10;
    await signedIn().army.update({
      id,
      name: 'Trebia',
      selection: fixtureSelection({ stands: 5 }),
    });

    expect(
      (await recordedEvents(db)).map(({ kind, subject_id, ip, city }) => ({
        kind,
        subject_id,
        ip,
        city,
      })),
    ).toEqual([
      {
        kind: 'list.created',
        subject_id: id,
        ip: carthage.ip,
        city: 'Carthage',
      },
      {
        kind: 'list.edited',
        subject_id: id,
        ip: carthage.ip,
        city: 'Carthage',
      },
      {
        kind: 'list.renamed',
        subject_id: id,
        ip: carthage.ip,
        city: 'Carthage',
      },
    ]);
  });

  it('records one edit per list every ten minutes, so autosave does not flood the log', async () => {
    const { id } = await create('Cannae');
    const other = await create('Trebia');

    for (const stands of [5, 6, 7]) {
      await signedIn().army.update({
        id,
        selection: fixtureSelection({ stands }),
      });
    }
    await signedIn().army.update({
      id: other.id,
      selection: fixtureSelection({ stands: 5 }),
    });
    ticks += 10;
    await signedIn().army.update({
      id,
      selection: fixtureSelection({ stands: 8 }),
    });

    expect(
      (await recordedEvents(db))
        .filter(({ kind }) => kind === 'list.edited')
        .map(({ subject_id }) => subject_id),
    ).toEqual([id, other.id, id]);
  });

  it('records one rename per list every ten minutes, for a name typed into the builder', async () => {
    const { id } = await create('Cannae');

    for (const name of ['C', 'Ca', 'Can']) {
      await signedIn().army.update({ id, name });
    }

    expect(await recordedKinds(db)).toEqual(['list.created', 'list.renamed']);
  });

  it('records a duplicate against the copy, and a deletion against the list', async () => {
    const { id } = await create('Cannae');

    const copy = await signedIn().army.duplicate({ id });
    await signedIn().army.delete({ id });

    expect(
      (await recordedEvents(db)).map(({ kind, subject_id, country }) => ({
        kind,
        subject_id,
        country,
      })),
    ).toEqual([
      { kind: 'list.created', subject_id: id, country: 'TN' },
      { kind: 'list.duplicated', subject_id: copy.id, country: 'TN' },
      { kind: 'list.deleted', subject_id: id, country: 'TN' },
    ]);
  });

  it('records a deletion for every list an undone claim took back', async () => {
    const first = await create('Cannae');
    const second = await create('Trebia');

    await signedIn().army.undoClaim({
      ids: [first.id, second.id, 'army-gone'],
    });

    expect(
      (await recordedEvents(db))
        .filter(({ kind }) => kind === 'list.deleted')
        .map(({ subject_id, ip }) => ({ subject_id, ip })),
    ).toEqual([
      { subject_id: first.id, ip: carthage.ip },
      { subject_id: second.id, ip: carthage.ip },
    ]);
  });

  it('records nothing for a write that was refused', async () => {
    const { id } = await create('Cannae');
    for (let saved = 0; saved < anonymousArmyLimit; saved += 1) {
      await anonymous().army.create({
        name: `List ${saved}`,
        selection: fixtureSelection(),
      });
    }
    const before = await recordedEvents(db);

    await expect(
      caller(other).army.update({ id, name: 'Stolen' }),
    ).rejects.toThrow();
    await expect(caller(other).army.duplicate({ id })).rejects.toThrow();
    await expect(caller(other).army.delete({ id })).rejects.toThrow();
    await expect(
      anonymous().army.create({
        name: 'One more',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow('signInToKeepMore');

    expect(await recordedEvents(db)).toEqual(before);
  });

  it('keeps no list whose event could not be recorded', async () => {
    const { id } = await create('Cannae');
    await blockEvents(db);

    await expect(create('Trebia')).rejects.toThrow(eventLogFull);
    await expect(signedIn().army.delete({ id })).rejects.toThrow(eventLogFull);

    expect(names(await signedIn().army.list())).toEqual(['Cannae']);
  });
});

describe('a list and its game', () => {
  it('is a Triumph! list when the caller names no game, as a tab opened before games did', async () => {
    const army = await create('Cannae');

    expect(army.game).toBe('triumph');
    expect(await signedIn().army.list()).toMatchObject([
      { name: 'Cannae', game: 'triumph' },
    ]);
  });

  it('keeps the game the caller names', async () => {
    const army = await signedIn().army.create({
      name: 'Cannae',
      game: 'triumph',
      selection: fixtureSelection(),
    });

    expect(await signedIn().army.byId({ id: army.id })).toMatchObject({
      game: 'triumph',
      armyListId: fixtureSelection().army,
    });
  });

  it('refuses a game this build does not have', async () => {
    await expect(
      signedIn().army.create({
        name: 'Cannae',
        game: 'chess' as 'triumph',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow();
  });

  it('stores the selection with no game in it, as every list before games was', async () => {
    const army = await create('Cannae');

    const row = await db
      .selectFrom('armies')
      .select(['game', 'selection'])
      .where('id', '=', army.id)
      .executeTakeFirstOrThrow();
    expect(row.game).toBe('triumph');
    expect(JSON.parse(row.selection)).toEqual(fixtureSelection());
  });

  it('keeps the game through an edit and a duplicate', async () => {
    const original = await create('Cannae');

    const edited = await signedIn().army.update({
      id: original.id,
      selection: fixtureSelection({ stands: 2 }),
    });
    const copy = await signedIn().army.duplicate({ id: original.id });

    expect(edited.game).toBe('triumph');
    expect(copy.game).toBe('triumph');
  });
});

describe('a list saved against older data its army has not changed in', () => {
  const current = '2026-10-09.0badf00d';
  const files = {
    [bundlePaths.army(armyDetail().id)]: armyDetail(),
    [bundlePaths.troopTypes]: [],
    [bundlePaths.battleCards]: [],
  };

  beforeEach(async () => {
    await seedDataVersion(db, fixtureDataVersion, files);
    await seedDataVersion(db, current, files);
  });

  const stampOnRow = async (id: string) =>
    (
      await db
        .selectFrom('armies')
        .select('data_version')
        .where('id', '=', id)
        .executeTakeFirstOrThrow()
    ).data_version;

  it('reads at the current version without rewriting the row', async () => {
    const { id } = await create('Cannae');

    const [listed] = await signedIn().army.list();
    const read = await signedIn().army.byId({ id });

    expect(listed?.dataVersion).toBe(current);
    expect(read.selection.dataVersion).toBe(current);
    expect(await stampOnRow(id)).toBe(fixtureDataVersion);
  });

  it('moves to the current version once it is saved as read', async () => {
    const { id } = await create('Cannae');
    const { selection } = await signedIn().army.byId({ id });

    await signedIn().army.update({ id, selection });

    expect(await stampOnRow(id)).toBe(current);
  });
});
