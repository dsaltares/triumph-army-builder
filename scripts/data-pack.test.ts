import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  decodeReferencePack,
  referencePackFileName,
} from '@/lib/data/reference-pack.ts';
import { loadManifest } from '@/lib/data/snapshot.ts';
import { writeSnapshotFixture } from '@/test/fixtures/meshwesh.ts';
import { samplePack } from '@/test/reference.ts';
import {
  sampleCurationDirectory,
  sampleSnapshotDirectory,
  sampleTranslationsDirectory,
} from '@/test/sample.ts';

const run = promisify(execFile);

const script = (name: string) =>
  fileURLToPath(new URL(`./${name}`, import.meta.url));

const node = (name: string, args: readonly string[]) =>
  run(process.execPath, [
    '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    script(name),
    ...args,
  ]);

const sampleSources = [
  '--curation',
  sampleCurationDirectory,
  '--translations',
  sampleTranslationsDirectory,
];

const directories: string[] = [];

const temporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reference-pack-'));
  directories.push(directory);
  return directory;
};

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('data-pack', () => {
  it('packs the sample sources into the sample pack, stamped with the manifest version', async () => {
    const { dataVersion } = await loadManifest(sampleSnapshotDirectory);
    const packFile = join(
      await temporaryDirectory(),
      referencePackFileName(dataVersion),
    );

    const { stdout } = await node('data-pack.ts', [
      '--snapshot',
      sampleSnapshotDirectory,
      ...sampleSources,
      '--out',
      packFile,
    ]);
    const pack = decodeReferencePack(await readFile(packFile));

    expect(stdout).toContain(`data version ${dataVersion}`);
    expect(pack.dataVersion).toBe(dataVersion);
    expect(pack.locales).toEqual((await samplePack()).locales);
  });

  it('fails when the curated overlays no longer match the snapshot', async () => {
    const snapshot = await writeSnapshotFixture();
    directories.push(snapshot);
    const packFile = join(await temporaryDirectory(), 'pack.json.gz');

    await expect(
      node('data-pack.ts', [
        '--snapshot',
        snapshot,
        ...sampleSources,
        '--out',
        packFile,
      ]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        'The curated overlays no longer match the snapshot',
      ),
    });
    await expect(readFile(packFile)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails on a snapshot it cannot read', async () => {
    await expect(
      node('data-pack.ts', [
        '--snapshot',
        join(tmpdir(), 'no-such-snapshot'),
        ...sampleSources,
      ]),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('yarn sync:meshwesh'),
    });
  });
});
