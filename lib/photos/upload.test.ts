import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Insertable } from 'kysely';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRateLimiter, type RateLimiter } from '@/lib/auth/rate-limit.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { insertCollectionEntry } from '@/lib/db/collection.ts';
import type { PhotoQuota } from '@/lib/db/collection-photos.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import type { UsersTable } from '@/lib/db/schema.ts';
import type { Caller } from '@/lib/trpc/context.ts';
import {
  blockEvents,
  carthage,
  eventLogFull,
  recordedEvents,
} from '@/test/events.ts';
import { maxUploadBytes } from './limits.ts';
import { createPhotoStore, type PhotoStore } from './store.ts';
import { uploadPhotoResponse } from './upload.ts';

let db: ReturnType<typeof createDatabase>;
let dir: string;
let store: PhotoStore;
let minted: number;

const owner = 'user-hannibal';
const stranger = 'user-scipio';
const browser = 'user-anonymous';

const quota: PhotoQuota = { perEntry: 2, perAccount: 3 };

const generousLimiter = () => createRateLimiter({ window: 3600, max: 100 });

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

const jpeg = () =>
  sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 3,
      background: { r: 180, g: 40, b: 20 },
    },
  })
    .jpeg()
    .toBuffer();

const uploadRequest = (entryId: string, file: Blob) => {
  const form = new FormData();
  form.set('entryId', entryId);
  form.set('photo', file, 'phalanx.jpg');
  return new Request('http://localhost:3013/api/collection/photos', {
    method: 'POST',
    body: form,
  });
};

const photoFile = async () =>
  new Blob([new Uint8Array(await jpeg())], { type: 'image/jpeg' });

type UploadOptions = {
  caller?: Caller | null;
  limiter?: RateLimiter;
  request?: Request;
};

const upload = async (
  entryId: string,
  {
    caller = account(owner),
    limiter = generousLimiter(),
    request,
  }: UploadOptions = {},
) =>
  uploadPhotoResponse({
    request: request ?? uploadRequest(entryId, await photoFile()),
    caller,
    origin: carthage,
    db,
    store,
    quota,
    limiter,
    nextId: () => `photo-${++minted}`,
    now: () => '2026-09-24T11:00:00.000Z',
  });

const storedFiles = async () => (await readdir(dir)).sort();

const storedRows = () =>
  db.selectFrom('collection_photos').selectAll().orderBy('id').execute();

beforeEach(async () => {
  db = createDatabase(':memory:');
  await migrateToLatest(db);
  await db
    .insertInto('users')
    .values([user(owner), user(stranger), user(browser, 1)])
    .execute();
  await addEntry('entry-spearmen');
  await addEntry('entry-cavalry');
  await addEntry('entry-legion', stranger);
  dir = await mkdtemp(join(tmpdir(), 'triumph-upload-'));
  store = createPhotoStore(dir);
  minted = 0;
});

afterEach(async () => {
  await db.destroy();
  await rm(dir, { recursive: true, force: true });
});

describe('uploading a photo', () => {
  it('re-encodes it, writes both sizes and records it against the entry', async () => {
    const response = await upload('entry-spearmen');

    expect(response.status).toBe(201);
    const photo = await response.json();
    expect(photo).toMatchObject({
      id: 'photo-1',
      entryId: 'entry-spearmen',
      position: 0,
      width: 1200,
      height: 900,
    });
    expect(await storedFiles()).toEqual([
      'photo-1-display.webp',
      'photo-1-thumb.webp',
    ]);
    const [row] = await storedRows();
    expect(row).toMatchObject({ id: 'photo-1', user_id: owner });
    const display = await store.read('photo-1', 'display');
    const thumb = await store.read('photo-1', 'thumb');
    expect(row?.bytes).toBe(
      (display?.byteLength ?? 0) + (thumb?.byteLength ?? 0),
    );
  });

  it('puts each new photo after the entry’s last', async () => {
    await upload('entry-spearmen');
    const second = await (await upload('entry-spearmen')).json();

    expect(second.position).toBe(1);
  });

  it('asks an anonymous caller to sign in, and stores nothing', async () => {
    const response = await upload('entry-spearmen', {
      caller: { userId: browser, isAnonymous: true, isAdmin: false },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'needsAccount' });
    expect(await storedFiles()).toEqual([]);
  });

  it('asks a caller with no session to sign in', async () => {
    const response = await upload('entry-spearmen', { caller: null });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'needsAccount' });
  });

  it('answers 404 for another account’s entry, and stores nothing', async () => {
    const response = await upload('entry-legion');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'notYourEntry' });
    expect(await storedFiles()).toEqual([]);
    expect(await storedRows()).toEqual([]);
  });

  it('refuses a photo past the per-entry limit and says so', async () => {
    await upload('entry-spearmen');
    await upload('entry-spearmen');

    const response = await upload('entry-spearmen');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'photosPerEntryReached',
      limit: quota.perEntry,
    });
    expect(await storedRows()).toHaveLength(quota.perEntry);
    expect(await storedFiles()).toHaveLength(quota.perEntry * 2);
  });

  it('refuses a photo past the per-account limit and says so', async () => {
    await upload('entry-spearmen');
    await upload('entry-spearmen');
    await upload('entry-cavalry');

    const response = await upload('entry-cavalry');

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'photosPerAccountReached',
      limit: quota.perAccount,
    });
    expect(await storedRows()).toHaveLength(quota.perAccount);
  });

  it('counts only the caller’s own photos against the account limit', async () => {
    await upload('entry-spearmen');
    await upload('entry-spearmen');
    await upload('entry-cavalry');

    const response = await upload('entry-legion', {
      caller: account(stranger),
    });

    expect(response.status).toBe(201);
  });

  it('holds the limit when two uploads race for the last slot', async () => {
    await upload('entry-spearmen');

    const responses = await Promise.all([
      upload('entry-spearmen'),
      upload('entry-spearmen'),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 403]);
    expect(await storedRows()).toHaveLength(quota.perEntry);
    expect(await storedFiles()).toHaveLength(quota.perEntry * 2);
  });

  it('refuses uploads past the per-user rate limit with a retry time', async () => {
    const limiter = createRateLimiter({ window: 600, max: 1 });
    await upload('entry-spearmen', { limiter });

    const response = await upload('entry-cavalry', { limiter });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('600');
    expect(await response.json()).toEqual({
      error: 'photoUploadsTooFast',
      retryAfter: 600,
    });
    expect(await storedRows()).toHaveLength(1);
  });

  it('rate limits each account on its own', async () => {
    const limiter = createRateLimiter({ window: 600, max: 1 });
    await upload('entry-spearmen', { limiter });

    const response = await upload('entry-legion', {
      limiter,
      caller: account(stranger),
    });

    expect(response.status).toBe(201);
  });

  it('refuses a body over 10 MB without reading it all', async () => {
    const oversized = new Blob([new Uint8Array(maxUploadBytes + 1)], {
      type: 'image/jpeg',
    });

    const response = await upload('entry-spearmen', {
      request: uploadRequest('entry-spearmen', oversized),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'photoTooLarge' });
    expect(await storedFiles()).toEqual([]);
  });

  it('refuses a streamed body that outgrows 10 MB', async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        sent += 1;
        controller.enqueue(chunk);
      },
    });

    const response = await upload('entry-spearmen', {
      request: new Request('http://localhost:3013/api/collection/photos', {
        method: 'POST',
        body: endless,
        headers: { 'content-type': 'multipart/form-data; boundary=x' },
        duplex: 'half',
      } as RequestInit),
    });

    expect(response.status).toBe(413);
    expect(sent).toBeLessThan(20);
  });

  it('refuses a file that is not an image', async () => {
    const response = await upload('entry-spearmen', {
      request: uploadRequest(
        'entry-spearmen',
        new Blob(['not a photo'], { type: 'image/jpeg' }),
      ),
    });

    expect(response.status).toBe(415);
    expect(await response.json()).toEqual({ error: 'notAPhoto' });
    expect(await storedFiles()).toEqual([]);
  });

  it('refuses a form without a photo', async () => {
    const form = new FormData();
    form.set('entryId', 'entry-spearmen');

    const response = await upload('entry-spearmen', {
      request: new Request('http://localhost:3013/api/collection/photos', {
        method: 'POST',
        body: form,
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'notAPhoto' });
  });
});

describe('the event an upload records', () => {
  it('records the photo with its player, address and place', async () => {
    await upload('entry-spearmen');

    expect(await recordedEvents(db)).toEqual([
      {
        kind: 'collection.photo_uploaded',
        user_id: owner,
        is_anonymous: 0,
        subject_id: 'photo-1',
        props: '{}',
        ip: carthage.ip,
        country: 'TN',
        region: 'Tunis',
        city: 'Carthage',
      },
    ]);
  });

  it('records nothing for an upload it refused', async () => {
    await upload('entry-legion');
    await upload('entry-spearmen', { caller: null });

    expect(await recordedEvents(db)).toEqual([]);
  });

  it('keeps neither the row nor the files when its event cannot be recorded', async () => {
    await blockEvents(db);

    await expect(upload('entry-spearmen')).rejects.toThrow(eventLogFull);

    expect(await storedRows()).toEqual([]);
    expect(await storedFiles()).toEqual([]);
  });
});
