import { execFile } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';
import type { Kysely } from 'kysely';
import { z } from 'zod';
import {
  parseReferencePack,
  type ReferencePack,
  referencePackFileName,
} from '../lib/data/reference-pack.ts';
import {
  currentReferenceVersion,
  hasReferenceVersion,
  importReferencePack,
  makeReferenceCurrent,
} from '../lib/db/reference.ts';
import type { Database } from '../lib/db/schema.ts';
import { describeError } from '../lib/errors.ts';

export const dataRepository = 'dsaltares/triumph-army-builder-data';

export const referenceVersionFile = fileURLToPath(
  new URL('../reference-version.txt', import.meta.url),
);

export const samplePackFile = fileURLToPath(
  new URL('../test/fixtures/reference/sample-pack.json', import.meta.url),
);

export const referenceCacheDirectory = join(
  homedir(),
  '.cache',
  'triumph-army-builder',
  'reference',
);

export const referenceConfigFile = join(
  homedir(),
  '.config',
  'triumph-army-builder',
  'env',
);

export const releaseTag = (dataVersion: string) => `data-${dataVersion}`;

export const cachedPackFile = (cacheDirectory: string, dataVersion: string) =>
  join(cacheDirectory, `${dataVersion}.json.gz`);

const gzipMagic = [0x1f, 0x8b];

const isGzipped = (bytes: Uint8Array) =>
  gzipMagic.every((byte, index) => bytes[index] === byte);

export const decodePackFile = (bytes: Uint8Array): ReferencePack => {
  let json: unknown;
  try {
    json = JSON.parse(
      (isGzipped(bytes) ? gunzipSync(bytes) : Buffer.from(bytes)).toString(
        'utf8',
      ),
    );
  } catch {
    throw new Error('the reference pack is neither JSON nor gzipped JSON');
  }
  return parseReferencePack(json);
};

export const readPinnedVersion = async (file = referenceVersionFile) => {
  const version = (await readFile(file, 'utf8')).trim();
  if (!version) {
    throw new Error(`${file} does not name a data version`);
  }
  return version;
};

const run = promisify(execFile);

const ghToken = async () => {
  try {
    const { stdout } = await run('gh', ['auth', 'token']);
    return stdout.trim() || null;
  } catch {
    return null;
  }
};

const configuredToken = async (configFile: string) => {
  try {
    return parseEnv(await readFile(configFile, 'utf8')).REFERENCE_PACK_TOKEN;
  } catch {
    return undefined;
  }
};

export const referencePackToken = async ({
  env = process.env,
  configFile = referenceConfigFile,
  gh = ghToken,
}: {
  env?: Readonly<Record<string, string | undefined>>;
  configFile?: string;
  gh?: () => Promise<string | null>;
} = {}) =>
  env.REFERENCE_PACK_TOKEN ||
  (await configuredToken(configFile)) ||
  (await gh()) ||
  null;

const releaseSchema = z.object({
  assets: z.array(z.object({ name: z.string(), url: z.url() })),
});

const githubHeaders = (token: string, accept: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: accept,
  'X-GitHub-Api-Version': '2022-11-28',
});

export const downloadReleasePack = async ({
  dataVersion,
  token,
  fetch: fetchFn = fetch,
  repository = dataRepository,
}: {
  dataVersion: string;
  token: string;
  fetch?: typeof fetch;
  repository?: string;
}) => {
  const tag = releaseTag(dataVersion);
  const release = await fetchFn(
    `https://api.github.com/repos/${repository}/releases/tags/${tag}`,
    { headers: githubHeaders(token, 'application/vnd.github+json') },
  );
  if (!release.ok) {
    throw new Error(
      `${repository} answered ${release.status} for release ${tag}: it does not exist, or the token cannot read it`,
    );
  }
  const assetName = referencePackFileName(dataVersion);
  const asset = releaseSchema
    .parse(await release.json())
    .assets.find(({ name }) => name === assetName);
  if (!asset) {
    throw new Error(`release ${tag} has no ${assetName}`);
  }
  const download = await fetchFn(asset.url, {
    headers: githubHeaders(token, 'application/octet-stream'),
  });
  if (!download.ok) {
    throw new Error(`${assetName} answered ${download.status}`);
  }
  return new Uint8Array(await download.arrayBuffer());
};

const writeAtomically = async (file: string, bytes: Uint8Array) => {
  await mkdir(dirname(file), { recursive: true });
  const partial = `${file}.${process.pid}.partial`;
  await writeFile(partial, bytes);
  await rename(partial, file);
};

const readCachedPack = async (file: string, dataVersion: string) => {
  try {
    const pack = decodePackFile(await readFile(file));
    return pack.dataVersion === dataVersion ? pack : null;
  } catch {
    return null;
  }
};

const fetchReleasePack = async ({
  dataVersion,
  token,
  fetch: fetchFn,
  cacheFile,
}: {
  dataVersion: string;
  token: () => Promise<string | null>;
  fetch: typeof fetch;
  cacheFile: string;
}): Promise<{ pack: ReferencePack } | { reason: string }> => {
  const found = await token();
  if (!found) {
    return { reason: 'no GitHub token was found' };
  }
  try {
    const bytes = await downloadReleasePack({
      dataVersion,
      token: found,
      fetch: fetchFn,
    });
    const pack = decodePackFile(bytes);
    if (pack.dataVersion !== dataVersion) {
      return {
        reason: `release ${releaseTag(dataVersion)} holds ${pack.dataVersion}`,
      };
    }
    await writeAtomically(cacheFile, bytes);
    return { pack };
  } catch (error) {
    return { reason: describeError(error) };
  }
};

export type ReferenceSeed =
  | { source: 'current' | 'held'; dataVersion: string }
  | {
      source: 'override' | 'cache' | 'release' | 'sample';
      dataVersion: string;
      imported: boolean;
      reason?: string;
    };

export type SeedPinnedReference = {
  db: Kysely<Database>;
  pinnedVersion: string;
  packOverride?: string | undefined;
  cacheDirectory?: string;
  token?: () => Promise<string | null>;
  fetch?: typeof fetch;
  sampleFile?: string;
  now?: () => Date;
};

export const seedPinnedReference = async ({
  db,
  pinnedVersion,
  packOverride,
  cacheDirectory = referenceCacheDirectory,
  token = referencePackToken,
  fetch: fetchFn = fetch,
  sampleFile = samplePackFile,
  now = () => new Date(),
}: SeedPinnedReference): Promise<ReferenceSeed> => {
  const seed = async (pack: ReferencePack) => {
    const { imported } = await importReferencePack(db, pack, { now });
    if (!imported) {
      await makeReferenceCurrent(db, pack.dataVersion);
    }
    return { dataVersion: pack.dataVersion, imported };
  };

  if (packOverride) {
    return {
      source: 'override',
      ...(await seed(decodePackFile(await readFile(packOverride)))),
    };
  }

  if ((await currentReferenceVersion(db)) === pinnedVersion) {
    return { source: 'current', dataVersion: pinnedVersion };
  }
  if (await hasReferenceVersion(db, pinnedVersion)) {
    await makeReferenceCurrent(db, pinnedVersion);
    return { source: 'held', dataVersion: pinnedVersion };
  }

  const cacheFile = cachedPackFile(cacheDirectory, pinnedVersion);
  const cached = await readCachedPack(cacheFile, pinnedVersion);
  if (cached) {
    return { source: 'cache', ...(await seed(cached)) };
  }

  const released = await fetchReleasePack({
    dataVersion: pinnedVersion,
    token,
    fetch: fetchFn,
    cacheFile,
  });
  if ('pack' in released) {
    return { source: 'release', ...(await seed(released.pack)) };
  }

  return {
    source: 'sample',
    reason: released.reason,
    ...(await seed(decodePackFile(await readFile(sampleFile)))),
  };
};
