import { gzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { bundlePaths } from '@/lib/data/bundle.ts';
import {
  buildReferencePack,
  decodeReferencePack,
  encodeReferencePack,
  type ReferencePack,
  referencePackFileName,
} from '@/lib/data/reference-pack.ts';
import { emptyCatalogue } from '@/lib/data/translations.ts';
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
