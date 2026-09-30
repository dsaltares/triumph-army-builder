import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Kysely } from 'kysely';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  encodeReferencePack,
  type ReferencePack,
  referencePackFileName,
} from '@/lib/data/reference-pack.ts';
import { createDatabase } from '@/lib/db/client.ts';
import { migrateToLatest } from '@/lib/db/migrator.ts';
import { currentReferenceVersion } from '@/lib/db/reference.ts';
import type { Database } from '@/lib/db/schema.ts';
import {
  renamedArmyIndex,
  samplePack,
  seedReference,
} from '@/test/reference.ts';
import {
  cachedPackFile,
  dataRepository,
  readPinnedVersion,
  referencePackToken,
  seedPinnedReference,
} from './pinned-reference.ts';

const pinnedVersion = '2026-10-01.0badf00d';
const token = 'gho_token';
const assetUrl = `https://api.github.com/repos/${dataRepository}/releases/assets/1`;
const releaseUrl = `https://api.github.com/repos/${dataRepository}/releases/tags/data-${pinnedVersion}`;

let directory: string;
let cacheDirectory: string;
let db: Kysely<Database>;
let sample: ReferencePack;
let pinnedPack: ReferencePack;

const releaseServer = (
  asset: Uint8Array,
  assetName = referencePackFileName(pinnedVersion),
) =>
  vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url === releaseUrl) {
      return Response.json({ assets: [{ name: assetName, url: assetUrl }] });
    }
    if (url === assetUrl) {
      return new Response(new Uint8Array(asset));
    }
    return new Response(null, { status: 404 });
  });

const seed = (
  overrides: Partial<Parameters<typeof seedPinnedReference>[0]> = {},
) =>
  seedPinnedReference({
    db,
    pinnedVersion,
    cacheDirectory,
    token: async () => token,
    fetch: releaseServer(encodeReferencePack(pinnedPack)),
    ...overrides,
  });

const freshDatabase = async () => {
  const fresh = createDatabase(':memory:');
  await migrateToLatest(fresh);
  return fresh;
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pinned-reference-'));
  cacheDirectory = join(directory, 'cache');
  db = await freshDatabase();
  sample = await samplePack();
  pinnedPack = renamedArmyIndex(sample, pinnedVersion, 'Pinned');
});

afterEach(async () => {
  await db.destroy();
  await rm(directory, { recursive: true, force: true });
});

describe('seedPinnedReference', () => {
  it('downloads the pinned release with the token, caches it and makes it current', async () => {
    const request = releaseServer(encodeReferencePack(pinnedPack));

    const result = await seed({ fetch: request });

    expect(result).toEqual({
      source: 'release',
      dataVersion: pinnedVersion,
      imported: true,
    });
    expect(await currentReferenceVersion(db)).toBe(pinnedVersion);
    expect(request).toHaveBeenCalledWith(
      assetUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
          Accept: 'application/octet-stream',
        }),
      }),
    );
    expect(
      await readFile(cachedPackFile(cacheDirectory, pinnedVersion)),
    ).toEqual(Buffer.from(encodeReferencePack(pinnedPack)));
  });

  it('asks for no token and makes no request once the pinned version is current', async () => {
    await seed();
    const request = vi.fn<typeof fetch>();
    const askForToken = vi.fn(async () => token);

    const result = await seed({ fetch: request, token: askForToken });

    expect(result).toEqual({ source: 'current', dataVersion: pinnedVersion });
    expect(request).not.toHaveBeenCalled();
    expect(askForToken).not.toHaveBeenCalled();
  });

  it('seeds another database from the cache without a request', async () => {
    await seed();
    const other = await freshDatabase();
    const request = vi.fn<typeof fetch>();

    try {
      const result = await seed({ db: other, fetch: request });

      expect(result).toEqual({
        source: 'cache',
        dataVersion: pinnedVersion,
        imported: true,
      });
      expect(await currentReferenceVersion(other)).toBe(pinnedVersion);
      expect(request).not.toHaveBeenCalled();
    } finally {
      await other.destroy();
    }
  });

  it('downloads again over a cached file that is not the pinned pack', async () => {
    const cacheFile = cachedPackFile(cacheDirectory, pinnedVersion);
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(cacheFile, 'not a pack');

    const result = await seed();

    expect(result.source).toBe('release');
    expect(await readFile(cacheFile)).toEqual(
      Buffer.from(encodeReferencePack(pinnedPack)),
    );
  });

  it('makes a held version current again without a request', async () => {
    await seed();
    await seedReference(db, sample);
    const request = vi.fn<typeof fetch>();

    const result = await seed({ fetch: request });

    expect(result).toEqual({ source: 'held', dataVersion: pinnedVersion });
    expect(await currentReferenceVersion(db)).toBe(pinnedVersion);
    expect(request).not.toHaveBeenCalled();
  });

  it('falls back to the sample pack when there is no token', async () => {
    const request = vi.fn<typeof fetch>();

    const result = await seed({ token: async () => null, fetch: request });

    expect(result).toEqual({
      source: 'sample',
      dataVersion: sample.dataVersion,
      imported: true,
      reason: 'no GitHub token was found',
    });
    expect(await currentReferenceVersion(db)).toBe(sample.dataVersion);
    expect(request).not.toHaveBeenCalled();
  });

  it('falls back to the sample pack when the token cannot read the release', async () => {
    const result = await seed({
      fetch: vi.fn<typeof fetch>(
        async () => new Response(null, { status: 404 }),
      ),
    });

    expect(result).toMatchObject({
      source: 'sample',
      reason: expect.stringContaining('answered 404'),
    });
  });

  it('falls back to the sample pack when the request fails', async () => {
    const result = await seed({
      fetch: vi.fn<typeof fetch>(async () => {
        throw new Error('getaddrinfo ENOTFOUND api.github.com');
      }),
    });

    expect(result).toMatchObject({
      source: 'sample',
      reason: expect.stringContaining('ENOTFOUND'),
    });
  });

  it('falls back to the sample pack when the release holds another version', async () => {
    const result = await seed({
      fetch: releaseServer(encodeReferencePack(sample)),
    });

    expect(result).toMatchObject({
      source: 'sample',
      reason: `release data-${pinnedVersion} holds ${sample.dataVersion}`,
    });
  });

  it('falls back to the sample pack when the release has no pack', async () => {
    const result = await seed({
      fetch: releaseServer(encodeReferencePack(pinnedPack), 'notes.txt'),
    });

    expect(result).toMatchObject({
      source: 'sample',
      reason: `release data-${pinnedVersion} has no ${referencePackFileName(pinnedVersion)}`,
    });
  });

  it('seeds REFERENCE_PACK whatever the pinned version is', async () => {
    const override = join(directory, 'unreleased.json.gz');
    const unreleased = renamedArmyIndex(
      sample,
      '2026-12-01.00000000',
      'Unreleased',
    );
    await writeFile(override, encodeReferencePack(unreleased));
    await seed();
    const request = vi.fn<typeof fetch>();

    const result = await seed({ packOverride: override, fetch: request });

    expect(result).toEqual({
      source: 'override',
      dataVersion: unreleased.dataVersion,
      imported: true,
    });
    expect(await currentReferenceVersion(db)).toBe(unreleased.dataVersion);
    expect(request).not.toHaveBeenCalled();
  });

  it('reads an uncompressed REFERENCE_PACK and makes a held one current', async () => {
    const override = join(directory, 'sample.json');
    await writeFile(override, JSON.stringify(sample));
    await seedReference(db, sample);
    await seed();

    const result = await seed({ packOverride: override });

    expect(result).toEqual({
      source: 'override',
      dataVersion: sample.dataVersion,
      imported: false,
    });
    expect(await currentReferenceVersion(db)).toBe(sample.dataVersion);
  });
});

describe('referencePackToken', () => {
  const configFile = () => join(directory, 'env');

  it('takes REFERENCE_PACK_TOKEN from the environment first', async () => {
    await writeFile(configFile(), 'REFERENCE_PACK_TOKEN=from-file\n');

    expect(
      await referencePackToken({
        env: { REFERENCE_PACK_TOKEN: 'from-env' },
        configFile: configFile(),
        gh: async () => 'from-gh',
      }),
    ).toBe('from-env');
  });

  it('then from the config file', async () => {
    await writeFile(
      configFile(),
      '# token\nREFERENCE_PACK_TOKEN="from-file"\n',
    );

    expect(
      await referencePackToken({
        env: {},
        configFile: configFile(),
        gh: async () => 'from-gh',
      }),
    ).toBe('from-file');
  });

  it('then from gh', async () => {
    expect(
      await referencePackToken({
        env: {},
        configFile: configFile(),
        gh: async () => 'from-gh',
      }),
    ).toBe('from-gh');
  });

  it('is null when none of them has one', async () => {
    expect(
      await referencePackToken({
        env: {},
        configFile: configFile(),
        gh: async () => null,
      }),
    ).toBeNull();
  });
});

describe('readPinnedVersion', () => {
  it('reads the version without its newline', async () => {
    const file = join(directory, 'reference-version.txt');
    await writeFile(file, `${pinnedVersion}\n`);

    expect(await readPinnedVersion(file)).toBe(pinnedVersion);
  });

  it('pins the data version this repo releases', async () => {
    expect(await readPinnedVersion()).toMatch(
      /^\d{4}-\d{2}-\d{2}\.[0-9a-f]{8}$/,
    );
  });
});
