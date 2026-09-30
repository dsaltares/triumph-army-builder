import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { SharesTable, UsersTable } from '@/lib/db/schema.ts';
import { shareId } from '@/lib/db/shares.ts';
import { anonymousShareLimit } from '@/lib/domain/army/shared-list.ts';
import { defaultPhotoQuota } from '@/lib/photos/limits.ts';
import type { Context } from '@/lib/trpc/context.ts';
import { createCaller } from '@/lib/trpc/root.ts';
import { absentBundles } from '@/test/bundle-source.ts';
import { carthage, recordedEvents, recordedKinds } from '@/test/events.ts';
import { fixtureSelection } from '@/test/fixtures/army.ts';
import { absentPhotoStore } from '@/test/photo-store.ts';

let db: ReturnType<typeof createDatabase>;
let ticks: number;

const owner = 'user-hannibal';
const browser = 'user-anonymous';

const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
  isAnonymous,
});

const at = (tick: number) =>
  new Date(Date.UTC(2026, 8, 20, 10, tick)).toISOString();

const context = (userId: string | null, isAnonymous = false): Context => ({
  db,
  caller: userId ? { userId, isAnonymous, isAdmin: false } : null,
  origin: carthage,
  photos: absentPhotoStore(),
  photoQuota: defaultPhotoQuota,
  bundles: absentBundles(),
  now: () => at(++ticks),
  nextId: () => 'army-1',
});

const caller = (userId: string | null) => createCaller(context(userId));

const anonymous = () => createCaller(context(browser, true));

const filler = (index: number): Insertable<SharesTable> => ({
  id: `filler-${index}`,
  user_id: browser,
  name: `Filler ${index}`,
  army_list_id: 'army-1',
  selection: JSON.stringify(fixtureSelection()),
  data_version: fixtureSelection().dataVersion,
  created_at: at(0),
  last_seen_at: at(0),
});

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(browser, 1)])
    .execute();
  ticks = 0;
});

afterEach(async () => {
  await db.destroy();
});

describe('share.create', () => {
  it('copies the list behind a short link', async () => {
    const shared = await caller(owner).share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });

    expect(shared).toMatchObject({
      id: shareId({ name: 'Cannae', selection: fixtureSelection() }),
      name: 'Cannae',
      armyListId: 'army-1',
      createdAt: at(1),
    });
  });

  it('gives an anonymous player a link like everyone else', async () => {
    const shared = await anonymous().share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });

    expect(shared.id).toHaveLength(12);
  });

  it('hands back the same link when the same list is shared again', async () => {
    const first = await caller(owner).share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    const again = await anonymous().share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });

    expect(again).toEqual(first);
  });

  it('gives an edited list a link of its own', async () => {
    const first = await caller(owner).share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    const edited = await caller(owner).share.create({
      name: 'Cannae',
      selection: fixtureSelection({ stands: 2 }),
    });

    expect(edited.id).not.toBe(first.id);
  });

  it('refuses a caller with no session', async () => {
    await expect(
      caller(null).share.create({
        name: 'Cannae',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow('signInToKeep');
  });

  it('refuses an unnamed list', async () => {
    await expect(
      caller(owner).share.create({
        name: '   ',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow();
  });

  it('caps how many lists one anonymous browser may share', async () => {
    await db
      .insertInto('shares')
      .values(
        Array.from({ length: anonymousShareLimit }, (_row, index) =>
          filler(index),
        ),
      )
      .execute();

    await expect(
      anonymous().share.create({
        name: 'Cannae',
        selection: fixtureSelection(),
      }),
    ).rejects.toThrow('signInToShareMore');
  });

  it('lets a capped browser hand out a link it already made', async () => {
    const shared = await anonymous().share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });
    await db
      .insertInto('shares')
      .values(
        Array.from({ length: anonymousShareLimit }, (_row, index) =>
          filler(index),
        ),
      )
      .execute();

    expect(
      await anonymous().share.create({
        name: 'Cannae',
        selection: fixtureSelection(),
      }),
    ).toEqual(shared);
  });

  it('does not cap a signed-in player', async () => {
    await db
      .insertInto('shares')
      .values(
        Array.from({ length: anonymousShareLimit }, (_row, index) => ({
          ...filler(index),
          user_id: owner,
        })),
      )
      .execute();

    await expect(
      caller(owner).share.create({
        name: 'Cannae',
        selection: fixtureSelection(),
      }),
    ).resolves.toMatchObject({ name: 'Cannae' });
  });
});

describe('the events a share records', () => {
  it('records a minted link with its player, subject, address and place', async () => {
    const shared = await caller(owner).share.create({
      name: 'Cannae',
      selection: fixtureSelection(),
    });

    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'share.minted',
        user_id: owner,
        is_anonymous: 0,
        subject_id: shared.id,
        props: '{}',
        ip: carthage.ip,
        country: 'TN',
        region: 'Tunis',
        city: 'Carthage',
      },
    ]);
  });

  it('records nothing when the link already existed, since nothing was written', async () => {
    const list = { name: 'Cannae', selection: fixtureSelection() };
    await caller(owner).share.create(list);

    await anonymous().share.create(list);

    expect(await recordedKinds(db)).toEqual(['share.minted']);
  });

  it('records nothing for a link the cap refused', async () => {
    await db
      .insertInto('shares')
      .values(
        Array.from({ length: anonymousShareLimit }, (_, index) =>
          filler(index),
        ),
      )
      .execute();

    await expect(
      anonymous().share.create({ name: 'Zama', selection: fixtureSelection() }),
    ).rejects.toThrow('signInToShareMore');

    expect(await recordedEvents(db)).toEqual([]);
  });
});
