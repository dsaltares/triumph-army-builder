import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EncodedPhoto } from './encode.ts';
import {
  createPhotoStore,
  defaultPhotoDir,
  type PhotoStore,
  photoDir,
} from './store.ts';

let dir: string;
let store: PhotoStore;

const photo: EncodedPhoto = {
  display: { bytes: Buffer.from('display bytes'), width: 1600, height: 1200 },
  thumb: { bytes: Buffer.from('thumb bytes'), width: 400, height: 300 },
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'triumph-photos-'));
  store = createPhotoStore(dir);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('photoDir', () => {
  const previous = process.env.PHOTO_DIR;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.PHOTO_DIR;
    } else {
      process.env.PHOTO_DIR = previous;
    }
  });

  it('is /data/photos unless PHOTO_DIR says otherwise', () => {
    delete process.env.PHOTO_DIR;
    expect(photoDir()).toBe(defaultPhotoDir);
    expect(defaultPhotoDir).toBe('/data/photos');

    process.env.PHOTO_DIR = '/elsewhere/photos';
    expect(photoDir()).toBe('/elsewhere/photos');
  });
});

describe('createPhotoStore', () => {
  it('writes a display and a thumb named after the id', async () => {
    await store.write('abc123', photo);

    expect((await readdir(dir)).sort()).toEqual([
      'abc123-display.webp',
      'abc123-thumb.webp',
    ]);
    expect(await store.read('abc123', 'display')).toEqual(photo.display.bytes);
    expect(await store.read('abc123', 'thumb')).toEqual(photo.thumb.bytes);
  });

  it('creates its directory on the first write', async () => {
    const nested = createPhotoStore(join(dir, 'not', 'yet'));

    await nested.write('abc123', photo);

    expect(await nested.read('abc123', 'thumb')).toEqual(photo.thumb.bytes);
  });

  it('reads nothing for a photo it does not have', async () => {
    expect(await store.read('missing', 'display')).toBeUndefined();
  });

  it('opens a file as a stream with its length', async () => {
    await store.write('abc123', photo);

    const opened = await store.open('abc123', 'thumb');

    expect(opened?.bytes).toBe(photo.thumb.bytes.byteLength);
    expect(
      Buffer.from(await new Response(opened?.stream).arrayBuffer()),
    ).toEqual(photo.thumb.bytes);
  });

  it('opens nothing for a photo it does not have', async () => {
    expect(await store.open('missing', 'display')).toBeUndefined();
  });

  it('never reads or writes outside its directory', async () => {
    await writeFile(join(dir, '..', 'outside-display.webp'), 'secret');

    expect(await store.read('../outside', 'display')).toBeUndefined();
    expect(await store.open('../outside', 'display')).toBeUndefined();
    await expect(store.write('../outside', photo)).rejects.toThrow(
      'Not a photo id',
    );
    await store.remove('../outside');
    await rm(join(dir, '..', 'outside-display.webp'));
  });

  it('removes both files of a photo', async () => {
    await store.write('abc123', photo);
    await store.write('def456', photo);

    await store.remove('abc123');

    expect((await readdir(dir)).sort()).toEqual([
      'def456-display.webp',
      'def456-thumb.webp',
    ]);
    await expect(store.remove('abc123')).resolves.toBeUndefined();
  });

  it('lists the files it recognises and ignores the rest', async () => {
    await store.write('abc123', photo);
    await writeFile(join(dir, 'def456-thumb.webp.partial'), 'half');
    await writeFile(join(dir, 'notes.txt'), 'not ours');

    const files = await store.list();

    expect(
      files
        .map(({ name, id, size, partial }) => ({ name, id, size, partial }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ).toEqual([
      {
        name: 'abc123-display.webp',
        id: 'abc123',
        size: 'display',
        partial: false,
      },
      {
        name: 'abc123-thumb.webp',
        id: 'abc123',
        size: 'thumb',
        partial: false,
      },
      {
        name: 'def456-thumb.webp.partial',
        id: 'def456',
        size: 'thumb',
        partial: true,
      },
    ]);
    for (const { modifiedAt } of files) {
      expect(modifiedAt).toBeInstanceOf(Date);
    }
  });

  it('lists nothing before its directory exists', async () => {
    expect(await createPhotoStore(join(dir, 'absent')).list()).toEqual([]);
  });
});
