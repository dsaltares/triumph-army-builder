import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { UsersTable } from '@/lib/db/schema.ts';
import { readUserLocale } from '@/lib/db/user-locale.ts';
import { defaultPhotoQuota } from '@/lib/photos/limits.ts';
import type { Context } from '@/lib/trpc/context.ts';
import { createCaller } from '@/lib/trpc/root.ts';
import { absentBundles } from '@/test/bundle-source.ts';
import { carthage, recordedEvents } from '@/test/events.ts';
import { absentPhotoStore } from '@/test/photo-store.ts';

let db: ReturnType<typeof createDatabase>;

const player = 'user-hannibal';
const browser = 'user-anonymous';

const user = (id: string, isAnonymous = 0): Insertable<UsersTable> => ({
  id,
  name: id,
  email: `${id}@example.test`,
  image: null,
  isAnonymous,
});

const context = (userId: string | null, isAnonymous = false): Context => ({
  db,
  caller: userId ? { userId, isAnonymous, isAdmin: false } : null,
  origin: carthage,
  photos: absentPhotoStore(),
  photoQuota: defaultPhotoQuota,
  bundles: absentBundles(),
  now: () => new Date(Date.UTC(2026, 8, 20, 10, 0)).toISOString(),
  nextId: () => 'id-1',
});

const caller = (userId: string | null, isAnonymous = false) =>
  createCaller(context(userId, isAnonymous));

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(player), user(browser, 1)])
    .execute();
});

afterEach(async () => {
  await db.destroy();
});

describe('preferences.setLocale', () => {
  it('saves the locale on the account so it follows the player', async () => {
    await caller(player).preferences.setLocale({ locale: 'es' });

    expect(await readUserLocale(db, player)).toBe('es');
  });

  it('replaces a locale the player chose before', async () => {
    await caller(player).preferences.setLocale({ locale: 'es' });
    await caller(player).preferences.setLocale({ locale: 'en' });

    expect(await readUserLocale(db, player)).toBe('en');
  });

  it('remembers the locale of an anonymous browser session', async () => {
    await caller(browser, true).preferences.setLocale({ locale: 'es' });

    expect(await readUserLocale(db, browser)).toBe('es');
  });

  it('turns a signed-out caller away', async () => {
    await expect(
      caller(null).preferences.setLocale({ locale: 'es' }),
    ).rejects.toThrow();

    expect(await readUserLocale(db, player)).toBeNull();
  });

  it('refuses a locale the app does not ship', async () => {
    await expect(
      // @ts-expect-error a locale outside the union is what this guards
      caller(player).preferences.setLocale({ locale: 'fr' }),
    ).rejects.toThrow();

    expect(await readUserLocale(db, player)).toBeNull();
  });

  it('reads back nothing for a player who never chose', async () => {
    expect(await readUserLocale(db, player)).toBeNull();
  });
});

describe('the events preferences record', () => {
  it('records a change with its player, address and place', async () => {
    await caller(player).preferences.setLocale({ locale: 'es' });

    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'preferences.changed',
        user_id: player,
        is_anonymous: 0,
        subject_id: null,
        props: '{}',
        ip: carthage.ip,
        country: 'TN',
        region: 'Tunis',
        city: 'Carthage',
      },
    ]);
  });

  it('records nothing for a caller with no session', async () => {
    await expect(
      caller(null).preferences.setLocale({ locale: 'es' }),
    ).rejects.toThrow();

    expect(await recordedEvents(db)).toEqual([]);
  });
});
