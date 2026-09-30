import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../db/client.ts';
import { insertCollectionEntry } from '../db/collection.ts';
import {
  collectionPhotoIds,
  insertCollectionPhoto,
} from '../db/collection-photos.ts';
import { migrateToLatest } from '../db/migrator.ts';
import type { EncodedPhoto } from './encode.ts';
import { createPhotoStore, type PhotoStore } from './store.ts';
import { strayFileGrace, sweepPhotoFiles, sweepPhotos } from './sweep.ts';

let dir: string;
let store: PhotoStore;

const now = new Date(Date.UTC(2026, 8, 24, 12));

const settled = new Date(now.getTime() - strayFileGrace - 1000);

const fresh = new Date(now.getTime() - 1000);

const photo: EncodedPhoto = {
  display: { bytes: Buffer.from('display'), width: 1600, height: 1200 },
  thumb: { bytes: Buffer.from('thumb'), width: 400, height: 300 },
};

const files = async () => (await readdir(dir)).sort();

const age = async (at: Date) => {
  for (const name of await readdir(dir)) {
    await utimes(join(dir, name), at, at);
  }
};

const sweep = (rowIds: string[]) =>
  sweepPhotoFiles(store, { rowIds: new Set(rowIds), now: () => now });

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'triumph-photo-sweep-'));
  store = createPhotoStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('sweepPhotoFiles', () => {
  it('leaves a photo with a row and both files alone', async () => {
    await store.write('kept', photo);
    await age(settled);

    expect(await sweep(['kept'])).toEqual({
      removedFiles: 0,
      rowsWithoutFiles: [],
    });
    expect(await files()).toEqual(['kept-display.webp', 'kept-thumb.webp']);
  });

  it('deletes the files of a photo with no row', async () => {
    await store.write('kept', photo);
    await store.write('orphan', photo);
    await age(settled);

    expect(await sweep(['kept'])).toEqual({
      removedFiles: 2,
      rowsWithoutFiles: [],
    });
    expect(await files()).toEqual(['kept-display.webp', 'kept-thumb.webp']);
  });

  it('spares files with no row yet while an upload may still write it', async () => {
    await store.write('uploading', photo);
    await age(fresh);

    expect(await sweep([])).toEqual({ removedFiles: 0, rowsWithoutFiles: [] });
    expect(await files()).toEqual([
      'uploading-display.webp',
      'uploading-thumb.webp',
    ]);
  });

  it('deletes a partial write a crash left behind, row or not', async () => {
    await store.write('kept', photo);
    await writeFile(join(dir, 'kept-thumb.webp.partial'), 'half');
    await writeFile(join(dir, 'crashed-display.webp.partial'), 'half');
    await age(settled);

    expect(await sweep(['kept'])).toEqual({
      removedFiles: 2,
      rowsWithoutFiles: [],
    });
    expect(await files()).toEqual(['kept-display.webp', 'kept-thumb.webp']);
  });

  it('reports the rows with no files, so they can be deleted', async () => {
    await store.write('kept', photo);
    await age(settled);

    expect(await sweep(['kept', 'lost'])).toEqual({
      removedFiles: 0,
      rowsWithoutFiles: ['lost'],
    });
  });

  it('treats a row with one of its two files as a row with no files', async () => {
    await store.write('half', photo);
    await rm(join(dir, 'half-display.webp'));
    await age(fresh);

    expect(await sweep(['half'])).toEqual({
      removedFiles: 0,
      rowsWithoutFiles: ['half'],
    });
    expect(await files()).toEqual([]);
  });

  it('sweeps an empty or absent directory without complaint', async () => {
    expect(await sweep(['lost'])).toEqual({
      removedFiles: 0,
      rowsWithoutFiles: ['lost'],
    });

    const absent = createPhotoStore(join(dir, 'absent'));
    expect(
      await sweepPhotoFiles(absent, { rowIds: new Set(), now: () => now }),
    ).toEqual({ removedFiles: 0, rowsWithoutFiles: [] });
  });

  it('leaves files it does not recognise alone', async () => {
    await writeFile(join(dir, 'README'), 'not a photo');
    await age(settled);

    expect(await sweep([])).toEqual({ removedFiles: 0, rowsWithoutFiles: [] });
    expect(await files()).toEqual(['README']);
  });
});

describe('sweepPhotos', () => {
  let db: ReturnType<typeof createDatabase>;

  const givenPhotoRow = (id: string) =>
    insertCollectionPhoto(db, {
      id,
      entryId: 'entry-1',
      userId: 'user-1',
      position: 0,
      width: 1600,
      height: 1200,
      bytes: 280_000,
      at: now.toISOString(),
    });

  const givenUploaded = async (id: string) => {
    await store.write(id, photo);
    await givenPhotoRow(id);
  };

  beforeEach(async () => {
    db = createDatabase(':memory:');
    await migrateToLatest(db);
    await db
      .insertInto('users')
      .values({
        id: 'user-1',
        name: 'Hannibal',
        email: 'hannibal@example.test',
        image: null,
      })
      .execute();
    await insertCollectionEntry(db, {
      id: 'entry-1',
      userId: 'user-1',
      name: 'Libyan spearmen',
      count: 8,
      troopType: 'SPR',
      tags: ['libyan'],
      status: 'painted',
      notes: '',
      at: now.toISOString(),
    });
  });

  afterEach(async () => {
    await db.destroy();
  });

  const sweepAll = () => sweepPhotos(db, store, { now: () => now });

  it('keeps every photo that has both its row and its files', async () => {
    await givenUploaded('kept');
    await age(settled);

    expect(await sweepAll()).toEqual({ files: 0, rows: 0 });
    expect(await collectionPhotoIds(db)).toEqual(new Set(['kept']));
    expect(await files()).toEqual(['kept-display.webp', 'kept-thumb.webp']);
  });

  it('deletes the files an upload wrote before it crashed short of the row', async () => {
    await givenUploaded('kept');
    await store.write('crashed', photo);
    await age(settled);

    expect(await sweepAll()).toEqual({ files: 2, rows: 0 });
    expect(await files()).toEqual(['kept-display.webp', 'kept-thumb.webp']);
  });

  it('deletes a row whose files are gone', async () => {
    await givenUploaded('kept');
    await givenPhotoRow('lost');
    await age(settled);

    expect(await sweepAll()).toEqual({ files: 0, rows: 1 });
    expect(await collectionPhotoIds(db)).toEqual(new Set(['kept']));
  });

  it('removes the files of an entry once its rows have gone with it', async () => {
    await givenUploaded('first');
    await givenUploaded('second');
    await age(settled);

    await db.deleteFrom('users').where('id', '=', 'user-1').execute();

    expect(await sweepAll()).toEqual({ files: 4, rows: 0 });
    expect(await files()).toEqual([]);
  });
});
