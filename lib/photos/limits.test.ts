import { describe, expect, it } from 'vitest';
import { defaultPhotoQuota, photoQuota } from './limits.ts';

describe('photoQuota', () => {
  it('is 6 photos an entry and 200 an account unless configured', () => {
    expect(photoQuota({})).toEqual({ perEntry: 6, perAccount: 200 });
    expect(defaultPhotoQuota).toEqual({ perEntry: 6, perAccount: 200 });
  });

  it('reads both limits from the environment', () => {
    expect(
      photoQuota({
        COLLECTION_PHOTOS_PER_ENTRY: '10',
        COLLECTION_PHOTOS_PER_ACCOUNT: '500',
      }),
    ).toEqual({ perEntry: 10, perAccount: 500 });
  });

  it('falls back to the default for a value that is not a positive count', () => {
    for (const value of ['', 'many', '0', '-3', '2.5']) {
      expect(
        photoQuota({
          COLLECTION_PHOTOS_PER_ENTRY: value,
          COLLECTION_PHOTOS_PER_ACCOUNT: value,
        }),
      ).toEqual(defaultPhotoQuota);
    }
  });
});
