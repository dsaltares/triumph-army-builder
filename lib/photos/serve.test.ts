import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Insertable } from 'kysely';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '@/lib/db/client.ts';
import { insertCollectionEntry } from '@/lib/db/collection.ts';
import { insertCollectionPhoto } from '@/lib/db/collection-photos.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { UsersTable } from '@/lib/db/schema.ts';
import type { Caller } from '@/lib/trpc/context.ts';
import type { EncodedPhoto } from './encode.ts';
import { servePhotoResponse } from './serve.ts';
import { createPhotoStore, type PhotoStore } from './store.ts';

let db: ReturnType<typeof createDatabase>;
let dir: string;
let store: PhotoStore;

const owner = 'user-hannibal';
const stranger = 'user-scipio';
const browser = 'user-anonymous';

const photo: EncodedPhoto = {
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

const account = (userId: string): Caller => ({
  userId,
  isAnonymous: false,
  isAdmin: false,
});

const serve = (id: string, size: string, caller: Caller | null) =>
  servePhotoResponse({ caller, db, store, id, size });

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(stranger), user(browser, 1)])
    .execute();
  await insertCollectionEntry(db, {
    id: 'entry-spearmen',
    userId: owner,
    name: 'Libyan spearmen',
    count: 8,
    troopType: 'SPR',
    tags: ['libyan'],
    status: 'painted',
    notes: '',
    at: '2026-09-24T10:00:00.000Z',
  });
  await insertCollectionPhoto(db, {
    id: 'photo-1',
    entryId: 'entry-spearmen',
    userId: owner,
    position: 0,
    width: 1600,
    height: 1200,
    bytes: 24,
    at: '2026-09-24T10:00:00.000Z',
  });
  dir = await mkdtemp(join(tmpdir(), 'triumph-serve-'));
  store = createPhotoStore(dir);
  await store.write('photo-1', photo);
});

afterEach(async () => {
  await db.destroy();
  await rm(dir, { recursive: true, force: true });
});

describe('serving a photo', () => {
  it('streams each size to its owner as a WebP cached for a year', async () => {
    for (const size of ['display', 'thumb'] as const) {
      const response = await serve('photo-1', size, account(owner));

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/webp');
      expect(response.headers.get('cache-control')).toBe(
        'private, max-age=31536000, immutable',
      );
      expect(response.headers.get('content-length')).toBe(
        String(photo[size].bytes.byteLength),
      );
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        photo[size].bytes,
      );
    }
  });

  it('answers 404 to another account, as if the photo did not exist', async () => {
    const response = await serve('photo-1', 'display', account(stranger));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'notYourPhoto' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('asks an anonymous caller or one with no session to sign in', async () => {
    for (const caller of [
      { userId: browser, isAnonymous: true, isAdmin: false },
      null,
    ]) {
      const response = await serve('photo-1', 'display', caller);

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: 'needsAccount' });
    }
  });

  it('answers 404 for a size it does not keep', async () => {
    for (const size of ['original', 'constructor', '__proto__']) {
      expect((await serve('photo-1', size, account(owner))).status).toBe(404);
    }
  });

  it('answers 404 for a photo with no row, even when its file exists', async () => {
    await store.write('photo-stray', photo);

    expect((await serve('photo-stray', 'display', account(owner))).status).toBe(
      404,
    );
  });

  it('answers 404 for a row whose file has gone', async () => {
    await store.remove('photo-1');

    expect((await serve('photo-1', 'display', account(owner))).status).toBe(
      404,
    );
  });
});
