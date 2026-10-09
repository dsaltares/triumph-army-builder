import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundlePaths } from '@/lib/data/bundle.ts';
import {
  buildReferencePack,
  decodeReferencePack,
  encodeReferencePack,
  type ReferencePack,
  referenceDataVersion,
  referencePackFileName,
} from '@/lib/data/reference-pack.ts';
import { emptyCatalogue } from '@/lib/data/translations.ts';
import { dataVersionPattern } from '@/lib/domain/data-version.ts';
import { sampleCuration, sampleSnapshot } from '@/test/sample.ts';

const builtAt = new Date('2026-09-29T10:00:00.000Z');

let pack: ReferencePack;

beforeAll(async () => {
  pack = buildReferencePack({
    snapshot: await sampleSnapshot(),
    curation: sampleCuration,
    catalogues: { en: emptyCatalogue(), es: emptyCatalogue() },
    builtAt,
  });
});

const encoded = (value: unknown) => gzipSync(JSON.stringify(value));

const withoutFantasy = (files: ReferencePack['locales']['en']) =>
  files.filter(({ path }) => !path.startsWith('games/fantasy/'));

const withEnglishFiles = (
  change: (files: ReferencePack['locales']['en']) => unknown[],
) => ({ ...pack, locales: { ...pack.locales, en: change(pack.locales.en) } });

describe('reference pack', () => {
  it('is named after the data version it carries', () => {
    expect(referencePackFileName('2026-09-17.8457e4d4')).toBe(
      'reference-2026-09-17.8457e4d4.json.gz',
    );
  });

  it('stamps the version, the source and when it was built', async () => {
    const { manifest } = await sampleSnapshot();

    expect(pack).toMatchObject({
      dataVersion: manifest.dataVersion,
      source: manifest.source,
      builtAt: '2026-09-29T10:00:00.000Z',
    });
  });

  it('decodes to what was encoded', () => {
    expect(decodeReferencePack(encodeReferencePack(pack))).toEqual(pack);
  });

  it('refuses bytes that are not gzipped JSON', () => {
    expect(() => decodeReferencePack(Buffer.from('not a pack'))).toThrow(
      'the reference pack is not gzipped JSON',
    );
  });

  it('refuses a pack without every locale', () => {
    const { es: _, ...english } = pack.locales;

    expect(() =>
      decodeReferencePack(encoded({ ...pack, locales: english })),
    ).toThrow('locales.es');
  });

  it('refuses a locale missing one of the shared files', () => {
    expect(() =>
      decodeReferencePack(
        encoded(
          withEnglishFiles((files) =>
            files.filter(({ path }) => path !== bundlePaths.troopTypes),
          ),
        ),
      ),
    ).toThrow('troop-types.json is missing');
  });

  it('carries a Fantasy Triumph section in every locale', () => {
    for (const files of Object.values(pack.locales)) {
      expect(files.map(({ path }) => path)).toEqual(
        expect.arrayContaining(Object.values(bundlePaths.fantasy)),
      );
    }
  });

  it('accepts a pack with no Fantasy Triumph section, as packs built before it were', () => {
    const older = {
      ...pack,
      locales: {
        en: withoutFantasy(pack.locales.en),
        es: withoutFantasy(pack.locales.es),
      },
    };

    expect(decodeReferencePack(encoded(older))).toEqual(older);
  });

  it('refuses a Fantasy Triumph section with a file missing', () => {
    expect(() =>
      decodeReferencePack(
        encoded(
          withEnglishFiles((files) =>
            files.filter(({ path }) => path !== bundlePaths.fantasy.format),
          ),
        ),
      ),
    ).toThrow(
      `${bundlePaths.fantasy.format} is missing from the Fantasy Triumph section`,
    );
  });

  it('refuses Fantasy Triumph cards that do not match the bundle schema', () => {
    expect(() =>
      decodeReferencePack(
        encoded(
          withEnglishFiles((files) =>
            files.map((file) =>
              file.path === bundlePaths.fantasy.battleCards
                ? { ...file, contents: [{ code: 'dragonfire' }] }
                : file,
            ),
          ),
        ),
      ),
    ).toThrow(
      `${bundlePaths.fantasy.battleCards} does not match the data bundle schema`,
    );
  });

  it('refuses a file the bundle does not write', () => {
    expect(() =>
      decodeReferencePack(
        encoded(
          withEnglishFiles((files) => [
            ...files,
            { path: 'secrets.json', eager: false, contents: {} },
          ]),
        ),
      ),
    ).toThrow('secrets.json is not a data bundle file');
  });

  it('refuses a file that appears twice', () => {
    expect(() =>
      decodeReferencePack(
        encoded(withEnglishFiles((files) => [...files, files[0]])),
      ),
    ).toThrow(`${bundlePaths.index} appears twice`);
  });

  it('refuses a file whose contents do not match the bundle schema', () => {
    expect(() =>
      decodeReferencePack(
        encoded(
          withEnglishFiles((files) =>
            files.map((file) =>
              file.path.startsWith('armies/')
                ? { ...file, contents: { name: 'Goblin Warrens' } }
                : file,
            ),
          ),
        ),
      ),
    ).toThrow('does not match the data bundle schema');
  });
});

describe('referenceDataVersion', () => {
  const manifest = {
    fetchedAt: '2026-09-17T20:35:10.599Z',
    dataVersion: '2026-09-17.8457e4d4',
    contentHash:
      '8457e4d4c314126a854f46c6470c38f7307800c080d4084179be322909de8d17',
  };

  it('is the snapshot version when the data has never been bumped', () => {
    expect(referenceDataVersion(manifest, undefined)).toBe(
      '2026-09-17.8457e4d4',
    );
  });

  it('takes the day of a bump and a hash of the snapshot and the bump', () => {
    const bumped = referenceDataVersion(manifest, {
      bumpedAt: '2026-10-09T16:05:00.000Z',
    });

    expect(bumped).toMatch(dataVersionPattern);
    expect(bumped).toMatch(/^2026-10-09\./);
    expect(bumped).not.toBe('2026-10-09.8457e4d4');
  });

  it('is the same for the same bump, and new for every later one', () => {
    const at = (bumpedAt: string) =>
      referenceDataVersion(manifest, { bumpedAt });

    expect(at('2026-10-09T16:05:00.000Z')).toBe(at('2026-10-09T16:05:00.000Z'));
    expect(at('2026-10-09T17:00:00.000Z')).not.toBe(
      at('2026-10-09T16:05:00.000Z'),
    );
  });

  it('moves with a snapshot refreshed after the bump', () => {
    const release = { bumpedAt: '2026-10-09T16:05:00.000Z' };
    const refreshed = {
      fetchedAt: '2026-10-12T06:17:00.000Z',
      dataVersion: '2026-10-12.0badf00d',
      contentHash:
        '0badf00d0badf00d0badf00d0badf00d0badf00d0badf00d0badf00d0badf00d',
    };

    expect(referenceDataVersion(refreshed, release)).toMatch(/^2026-10-12\./);
    expect(referenceDataVersion(refreshed, release)).not.toBe(
      referenceDataVersion(manifest, release),
    );
  });

  it('stamps a bumped pack with the bumped version', async () => {
    const snapshot = await sampleSnapshot();
    const release = { bumpedAt: '2026-10-09T16:05:00.000Z' };

    expect(
      buildReferencePack({
        snapshot,
        curation: { ...sampleCuration, release },
        catalogues: { en: emptyCatalogue(), es: emptyCatalogue() },
        builtAt,
      }).dataVersion,
    ).toBe(referenceDataVersion(snapshot.manifest, release));
  });
});
