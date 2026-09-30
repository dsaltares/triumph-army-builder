import { randomUUID } from 'node:crypto';
import { requestOrigin } from '@/lib/auth/client-ip';
import {
  createRateLimiter,
  perUserPhotoUploadLimit,
} from '@/lib/auth/rate-limit';
import { getDatabase } from '@/lib/db/client';
import { photoQuota } from '@/lib/photos/limits';
import { createPhotoStore } from '@/lib/photos/store';
import { uploadPhotoResponse } from '@/lib/photos/upload';
import { resolveCaller } from '@/lib/trpc/context';

const uploads = createRateLimiter(perUserPhotoUploadLimit);

export const POST = async (request: Request) =>
  uploadPhotoResponse({
    request,
    caller: await resolveCaller(request.headers),
    origin: requestOrigin(request.headers),
    db: getDatabase(),
    store: createPhotoStore(),
    quota: photoQuota(),
    limiter: uploads,
    nextId: randomUUID,
    now: () => new Date().toISOString(),
  });
