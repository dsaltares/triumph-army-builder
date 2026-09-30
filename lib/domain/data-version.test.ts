import { describe, expect, it } from 'vitest';
import {
  compareDataVersions,
  dataVersionMatchesContentHash,
  formatDataVersion,
  isDataVersion,
  parseDataVersion,
} from './data-version.ts';

const contentHash =
  '9dfc73a99c85e84f72b4f30c97265b31d18096e547adf2924c287628f4608f44';

describe('formatDataVersion', () => {
  it('joins the fetch date to the first eight characters of the content hash', () => {
    expect(
      formatDataVersion({
        fetchedAt: '2026-09-17T17:10:54.396Z',
        contentHash,
      }),
    ).toBe('2026-09-17.9dfc73a9');
  });

  it('dates the version in UTC', () => {
    expect(
      formatDataVersion({
        fetchedAt: '2026-09-17T23:30:00.000-05:00',
        contentHash,
      }),
    ).toBe('2026-09-18.9dfc73a9');
  });

  it('rejects a timestamp it cannot read', () => {
    expect(() =>
      formatDataVersion({ fetchedAt: 'last tuesday', contentHash }),
    ).toThrow('last tuesday is not a timestamp');
  });

  it('rejects a content hash that is not hexadecimal', () => {
    expect(() =>
      formatDataVersion({
        fetchedAt: '2026-09-17T17:10:54.396Z',
        contentHash: 'not-a-hash',
      }),
    ).toThrow('not-a-hash is not a content hash');
  });

  it('rejects a content hash that is too short', () => {
    expect(() =>
      formatDataVersion({
        fetchedAt: '2026-09-17T17:10:54.396Z',
        contentHash: '9dfc73',
      }),
    ).toThrow('is not a content hash');
  });
});

describe('parseDataVersion', () => {
  it('splits a version into its date and hash', () => {
    expect(parseDataVersion('2026-09-17.9dfc73a9')).toEqual({
      date: '2026-09-17',
      hash: '9dfc73a9',
    });
  });

  it.each([
    '',
    '2026-09-17',
    '9dfc73a9',
    '2026-9-17.9dfc73a9',
    '2026-09-17.9DFC73A9',
    '2026-09-17.9dfc73a',
    '2026-09-17.9dfc73a99',
    ' 2026-09-17.9dfc73a9',
  ])('rejects %j', (value) => {
    expect(parseDataVersion(value)).toBeNull();
    expect(isDataVersion(value)).toBe(false);
  });
});

describe('dataVersionMatchesContentHash', () => {
  it('holds when the version carries the hash prefix', () => {
    expect(
      dataVersionMatchesContentHash('2026-09-17.9dfc73a9', contentHash),
    ).toBe(true);
  });

  it('fails when the version was stamped from other content', () => {
    expect(
      dataVersionMatchesContentHash('2026-09-17.00000000', contentHash),
    ).toBe(false);
  });

  it('fails when the version is malformed', () => {
    expect(dataVersionMatchesContentHash('unversioned', contentHash)).toBe(
      false,
    );
  });
});

describe('compareDataVersions', () => {
  it('is current when the versions are identical', () => {
    expect(
      compareDataVersions('2026-09-17.9dfc73a9', '2026-09-17.9dfc73a9'),
    ).toBe('current');
  });

  it('is older when the army was built against an earlier snapshot', () => {
    expect(
      compareDataVersions('2026-09-17.9dfc73a9', '2026-11-02.1234abcd'),
    ).toBe('older');
  });

  it('is older when the snapshot changed on the same day', () => {
    expect(
      compareDataVersions('2026-09-17.9dfc73a9', '2026-09-17.1234abcd'),
    ).toBe('older');
  });

  it('is newer when the army arrived from a snapshot we do not have yet', () => {
    expect(
      compareDataVersions('2026-11-02.1234abcd', '2026-09-17.9dfc73a9'),
    ).toBe('newer');
  });

  it('is unknown when either version is malformed', () => {
    expect(compareDataVersions('unversioned', '2026-09-17.9dfc73a9')).toBe(
      'unknown',
    );
    expect(compareDataVersions('2026-09-17.9dfc73a9', 'unversioned')).toBe(
      'unknown',
    );
  });
});
