import type { Kysely } from 'kysely';
import { sweepEvery } from '../db/anonymous.ts';
import { getDatabase } from '../db/client.ts';
import {
  collectionPhotoIds,
  deleteCollectionPhotosById,
} from '../db/collection-photos.ts';
import type { Database } from '../db/schema.ts';
import { getLogger } from '../logger.ts';
import { photoSizes } from './encode.ts';
import { createPhotoStore, type PhotoStore, type StoredFile } from './store.ts';

export const strayFileGrace = 60 * 60 * 1000;

export type PhotoFileSweepOptions = {
  rowIds: ReadonlySet<string>;
  now?: () => Date;
  grace?: number;
};

export type PhotoFileSweepResult = {
  removedFiles: number;
  rowsWithoutFiles: string[];
};

const sizeCount = Object.keys(photoSizes).length;

const completeIds = (files: StoredFile[]) => {
  const sizesById = new Map<string, number>();
  for (const { id, partial } of files) {
    if (!partial) {
      sizesById.set(id, (sizesById.get(id) ?? 0) + 1);
    }
  }
  return new Set(
    [...sizesById].filter(([, count]) => count === sizeCount).map(([id]) => id),
  );
};

export const sweepPhotoFiles = async (
  store: PhotoStore,
  {
    rowIds,
    now = () => new Date(),
    grace = strayFileGrace,
  }: PhotoFileSweepOptions,
): Promise<PhotoFileSweepResult> => {
  const files = await store.list();
  const complete = completeIds(files);
  const rowsWithoutFiles = [...rowIds].filter((id) => !complete.has(id));
  const settledBefore = now().getTime() - grace;
  const stray = files.filter(
    ({ id, partial, modifiedAt }) =>
      (partial || !rowIds.has(id)) && modifiedAt.getTime() < settledBefore,
  );

  await Promise.all(stray.map(({ name }) => store.discard(name)));
  await Promise.all(rowsWithoutFiles.map((id) => store.remove(id)));

  return { removedFiles: stray.length, rowsWithoutFiles };
};

export type PhotoSweepOptions = {
  now?: () => Date;
  grace?: number;
};

export type PhotoSweepResult = {
  files: number;
  rows: number;
};

export const sweepPhotos = async (
  db: Kysely<Database> = getDatabase(),
  store: PhotoStore = createPhotoStore(),
  options: PhotoSweepOptions = {},
): Promise<PhotoSweepResult> => {
  const rowIds = await collectionPhotoIds(db);
  const { removedFiles, rowsWithoutFiles } = await sweepPhotoFiles(store, {
    rowIds,
    ...options,
  });
  const rows = await deleteCollectionPhotosById(db, rowsWithoutFiles);
  return { files: removedFiles, rows };
};

export const startPhotoSweep = (
  db: Kysely<Database> = getDatabase(),
  store: PhotoStore = createPhotoStore(),
  options: PhotoSweepOptions = {},
) => {
  const logger = getLogger('photos');
  const sweep = async () => {
    try {
      const swept = await sweepPhotos(db, store, options);
      if (swept.files > 0 || swept.rows > 0) {
        logger.info(swept, 'Collection photos reconciled');
      }
    } catch (error) {
      logger.error({ err: error }, 'Collection photo sweep failed');
    }
  };

  void sweep();
  const timer = setInterval(() => void sweep(), sweepEvery);
  timer.unref();
  return () => clearInterval(timer);
};
