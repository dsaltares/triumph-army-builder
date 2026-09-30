import type { Kysely } from 'kysely';
import { findCollectionPhoto } from '../db/collection-photos.ts';
import type { Database } from '../db/schema.ts';
import type { Caller } from '../trpc/context.ts';
import { type PhotoSize, photoSizes } from './encode.ts';
import { needsAccount, refusalResponse } from './responses.ts';
import type { PhotoStore } from './store.ts';

export type PhotoServeRequest = {
  caller: Caller | null;
  db: Kysely<Database>;
  store: PhotoStore;
  id: string;
  size: string;
};

export const photoCacheControl = 'private, max-age=31536000, immutable';

const isPhotoSize = (size: string): size is PhotoSize =>
  Object.hasOwn(photoSizes, size);

const notYourPhoto = () => refusalResponse(404, 'notYourPhoto');

export const servePhotoResponse = async ({
  caller,
  db,
  store,
  id,
  size,
}: PhotoServeRequest) => {
  if (!caller || caller.isAnonymous) {
    return needsAccount();
  }
  if (!isPhotoSize(size)) {
    return notYourPhoto();
  }
  const photo = await findCollectionPhoto(db, { id, userId: caller.userId });
  if (!photo) {
    return notYourPhoto();
  }
  const file = await store.open(photo.id, size);
  if (!file) {
    return notYourPhoto();
  }
  return new Response(file.stream, {
    headers: {
      'content-type': 'image/webp',
      'content-length': String(file.bytes),
      'cache-control': photoCacheControl,
    },
  });
};
