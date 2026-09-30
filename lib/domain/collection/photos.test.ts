import { describe, expect, it } from 'vitest';
import {
  movedPhoto,
  photoLimitReached,
  photoSpace,
  shrunkDimensions,
} from './photos.ts';

describe('shrunkDimensions', () => {
  it('brings the long edge of a phone photo down to 2048 px and keeps its shape', () => {
    expect(shrunkDimensions({ width: 4032, height: 3024 })).toEqual({
      width: 2048,
      height: 1536,
    });
    expect(shrunkDimensions({ width: 3024, height: 4032 })).toEqual({
      width: 1536,
      height: 2048,
    });
  });

  it('never enlarges a photo that is already small enough', () => {
    expect(shrunkDimensions({ width: 1200, height: 800 })).toEqual({
      width: 1200,
      height: 800,
    });
  });

  it('keeps a sliver at least one pixel wide', () => {
    expect(shrunkDimensions({ width: 20_000, height: 2 })).toEqual({
      width: 2048,
      height: 1,
    });
  });
});

describe('photoLimitReached', () => {
  const room = { onEntry: 0, onAccount: 0, perEntry: 6, perAccount: 200 };

  it('leaves room below both limits', () => {
    expect(photoLimitReached({ ...room, onEntry: 5, onAccount: 199 })).toBe(
      null,
    );
  });

  it('names the entry limit once the entry is full', () => {
    expect(photoLimitReached({ ...room, onEntry: 6, onAccount: 200 })).toEqual({
      reason: 'photosPerEntryReached',
      limit: 6,
    });
  });

  it('names the account limit once the collection is full', () => {
    expect(photoLimitReached({ ...room, onEntry: 2, onAccount: 200 })).toEqual({
      reason: 'photosPerAccountReached',
      limit: 200,
    });
  });
});

describe('photoSpace', () => {
  it('is what the entry has room for when the account has more', () => {
    expect(
      photoSpace({ onEntry: 2, onAccount: 10, perEntry: 6, perAccount: 200 }),
    ).toBe(4);
  });

  it('is what the account has room for when the entry has more', () => {
    expect(
      photoSpace({ onEntry: 0, onAccount: 199, perEntry: 6, perAccount: 200 }),
    ).toBe(1);
  });

  it('is never below nothing', () => {
    expect(
      photoSpace({ onEntry: 7, onAccount: 10, perEntry: 6, perAccount: 200 }),
    ).toBe(0);
  });
});

describe('movedPhoto', () => {
  const ids = ['a', 'b', 'c'];

  it('swaps a photo with its neighbour', () => {
    expect(movedPhoto(ids, 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(movedPhoto(ids, 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('leaves the order alone at either end or for a photo it does not hold', () => {
    expect(movedPhoto(ids, 'a', -1)).toEqual(ids);
    expect(movedPhoto(ids, 'c', 1)).toEqual(ids);
    expect(movedPhoto(ids, 'z', 1)).toEqual(ids);
  });
});
