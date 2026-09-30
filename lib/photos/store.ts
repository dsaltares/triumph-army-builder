import {
  mkdir,
  open as openFile,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { type EncodedPhoto, type PhotoSize, photoSizes } from './encode.ts';

export const defaultPhotoDir = '/data/photos';

export const photoDir = () => process.env.PHOTO_DIR || defaultPhotoDir;

const photoIdPattern = /^[A-Za-z0-9_-]{1,64}$/;

const storedFilePattern =
  /^([A-Za-z0-9_-]{1,64})-(display|thumb)\.webp(\.partial)?$/;

const partialSuffix = '.partial';

const sizes = Object.keys(photoSizes) as PhotoSize[];

export const isPhotoId = (id: string) => photoIdPattern.test(id);

export type StoredFile = {
  name: string;
  id: string;
  size: PhotoSize;
  partial: boolean;
  modifiedAt: Date;
};

const isMissing = (error: unknown) =>
  (error as NodeJS.ErrnoException).code === 'ENOENT';

const fileName = (id: string, size: PhotoSize) => `${id}-${size}.webp`;

const parse = (name: string) => {
  const match = storedFilePattern.exec(name);
  if (!match) {
    return undefined;
  }
  const [, id = '', size, partial] = match;
  return { name, id, size: size as PhotoSize, partial: Boolean(partial) };
};

export const createPhotoStore = (dir: string = photoDir()) => {
  const pathOf = (name: string) => join(dir, name);

  const write = async (id: string, photo: EncodedPhoto) => {
    if (!isPhotoId(id)) {
      throw new Error(`Not a photo id: ${id}`);
    }
    await mkdir(dir, { recursive: true });
    await Promise.all(
      sizes.map(async (size) => {
        const target = pathOf(fileName(id, size));
        await writeFile(`${target}${partialSuffix}`, photo[size].bytes);
        await rename(`${target}${partialSuffix}`, target);
      }),
    );
  };

  const read = async (id: string, size: PhotoSize) => {
    if (!isPhotoId(id)) {
      return undefined;
    }
    try {
      return await readFile(pathOf(fileName(id, size)));
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }
      throw error;
    }
  };

  const open = async (id: string, size: PhotoSize) => {
    if (!isPhotoId(id)) {
      return undefined;
    }
    let handle: Awaited<ReturnType<typeof openFile>>;
    try {
      handle = await openFile(pathOf(fileName(id, size)));
    } catch (error) {
      if (isMissing(error)) {
        return undefined;
      }
      throw error;
    }
    try {
      const { size: bytes } = await handle.stat();
      const stream = Readable.toWeb(
        handle.createReadStream(),
      ) as ReadableStream<Uint8Array>;
      return { bytes, stream };
    } catch (error) {
      await handle.close();
      throw error;
    }
  };

  const discard = (name: string) => rm(pathOf(name), { force: true });

  const remove = async (id: string) => {
    if (!isPhotoId(id)) {
      return;
    }
    await Promise.all(sizes.map((size) => discard(fileName(id, size))));
  };

  const list = async (): Promise<StoredFile[]> => {
    let names: string[];
    try {
      names = await readdir(dir);
    } catch (error) {
      if (isMissing(error)) {
        return [];
      }
      throw error;
    }
    const files = await Promise.all(
      names.map(async (name) => {
        const parsed = parse(name);
        if (!parsed) {
          return undefined;
        }
        try {
          const { mtime } = await stat(pathOf(name));
          return { ...parsed, modifiedAt: mtime };
        } catch (error) {
          if (isMissing(error)) {
            return undefined;
          }
          throw error;
        }
      }),
    );
    return files.filter((file) => file !== undefined);
  };

  return { dir, write, read, open, remove, discard, list };
};

export type PhotoStore = ReturnType<typeof createPhotoStore>;
