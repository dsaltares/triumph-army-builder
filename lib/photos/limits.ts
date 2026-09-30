import { z } from 'zod';
import type { PhotoQuota } from '../db/collection-photos.ts';

export const maxUploadBytes = 10 * 1024 * 1024;

export const defaultPhotoQuota: PhotoQuota = { perEntry: 6, perAccount: 200 };

type Environment = Record<string, string | undefined>;

const configured = (value: string | undefined, fallback: number) =>
  z.coerce
    .number()
    .int()
    .positive()
    .catch(fallback)
    .parse(value ?? fallback);

export const photoQuota = (
  environment: Environment = process.env,
): PhotoQuota => ({
  perEntry: configured(
    environment.COLLECTION_PHOTOS_PER_ENTRY,
    defaultPhotoQuota.perEntry,
  ),
  perAccount: configured(
    environment.COLLECTION_PHOTOS_PER_ACCOUNT,
    defaultPhotoQuota.perAccount,
  ),
});
