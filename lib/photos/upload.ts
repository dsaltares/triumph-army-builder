import type { Kysely } from 'kysely';
import { z } from 'zod';
import type { RateLimiter } from '../auth/rate-limit.ts';
import { type EventOrigin, recordEvent } from '../db/activity-events.ts';
import {
  findPhotoSlot,
  type PhotoPlacement,
  type PhotoQuota,
  type PhotoQuotaRefusal,
  placeCollectionPhoto,
} from '../db/collection-photos.ts';
import type { Database } from '../db/schema.ts';
import type { Caller } from '../trpc/context.ts';
import { writeEvent } from '../trpc/events.ts';
import { encodePhoto, type PhotoRefusal } from './encode.ts';
import { maxUploadBytes } from './limits.ts';
import { needsAccount, refusalResponse } from './responses.ts';
import type { PhotoStore } from './store.ts';

export type PhotoUploadRequest = {
  request: Request;
  caller: Caller | null;
  origin: EventOrigin;
  db: Kysely<Database>;
  store: PhotoStore;
  quota: PhotoQuota;
  limiter: RateLimiter;
  nextId: () => string;
  now: () => string;
};

const multipartOverhead = 64 * 1024;

const uploadSchema = z.object({
  entryId: z.string().min(1).max(64),
  photo: z.instanceof(File),
});

const quotaRefusal = (refusal: PhotoQuotaRefusal, quota: PhotoQuota) => {
  switch (refusal) {
    case 'noSuchEntry':
      return refusalResponse(404, 'notYourEntry');
    case 'entryFull':
      return refusalResponse(403, 'photosPerEntryReached', {
        limit: quota.perEntry,
      });
    case 'accountFull':
      return refusalResponse(403, 'photosPerAccountReached', {
        limit: quota.perAccount,
      });
  }
};

const encodeRefusal = (refusal: PhotoRefusal) =>
  refusal === 'too-many-pixels'
    ? refusalResponse(413, 'photoTooLarge')
    : refusalResponse(415, 'notAPhoto');

const tooLarge = () => refusalResponse(413, 'photoTooLarge');

const readCapped = async (request: Request, max: number) => {
  if (Number(request.headers.get('content-length')) > max) {
    return undefined;
  }
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  const reader = request.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return new Blob(chunks);
};

const readUpload = async (request: Request, body: Blob) => {
  try {
    const form = await new Response(body, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
    return uploadSchema.safeParse(Object.fromEntries(form)).data;
  } catch {
    return undefined;
  }
};

export const uploadPhotoResponse = async ({
  request,
  caller,
  origin,
  db,
  store,
  quota,
  limiter,
  nextId,
  now,
}: PhotoUploadRequest) => {
  if (!caller || caller.isAnonymous) {
    return needsAccount();
  }
  const verdict = await limiter.consume(caller.userId);
  if (!verdict.allowed) {
    return refusalResponse(
      429,
      'photoUploadsTooFast',
      { retryAfter: verdict.retryAfter },
      { 'retry-after': String(verdict.retryAfter) },
    );
  }

  const body = await readCapped(request, maxUploadBytes + multipartOverhead);
  if (!body) {
    return tooLarge();
  }
  const upload = await readUpload(request, body);
  if (!upload) {
    return refusalResponse(400, 'notAPhoto');
  }
  if (upload.photo.size > maxUploadBytes) {
    return tooLarge();
  }

  const owner = { entryId: upload.entryId, userId: caller.userId };
  const slot = await findPhotoSlot(db, owner, quota);
  if (!slot.open) {
    return quotaRefusal(slot.refusal, quota);
  }

  const encoded = await encodePhoto(
    new Uint8Array(await upload.photo.arrayBuffer()),
  );
  if (!encoded.encoded) {
    return encodeRefusal(encoded.refusal);
  }

  const { display, thumb } = encoded.photo;
  const id = nextId();
  const at = now();
  await store.write(id, encoded.photo);
  let placement: PhotoPlacement | undefined;
  try {
    placement = await placeCollectionPhoto(
      db,
      {
        ...owner,
        id,
        width: display.width,
        height: display.height,
        bytes: display.bytes.byteLength + thumb.bytes.byteLength,
        at,
      },
      quota,
      (trx) =>
        recordEvent(
          trx,
          writeEvent(
            { caller, origin },
            at,
            { kind: 'collection.photo_uploaded' },
            id,
          ),
        ),
    );
  } finally {
    if (!placement?.placed) {
      await store.remove(id);
    }
  }
  if (!placement.placed) {
    return quotaRefusal(placement.refusal, quota);
  }
  return Response.json(placement.photo, {
    status: 201,
    headers: { 'cache-control': 'no-store' },
  });
};
